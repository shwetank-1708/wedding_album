import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';
import { getEndpointsForPath, fetchWithEndpointFallback } from './storage';

let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (e) {
  console.warn('[UploadQueue] expo-notifications is not supported in this environment. System notifications will be disabled.');
}

const STORAGE_KEY = '@evebash_upload_queue_v2';
const LEGACY_STORAGE_KEY = '@evebash_upload_queue';
const PROGRESS_NOTIFICATION_ID = 'media-upload-progress';
const CHANNEL_PROGRESS = 'upload-progress';
const CHANNEL_COMPLETE = 'upload-completion';

const CONCURRENCY = 3;
const MAX_UPLOAD_RETRIES = 3;
const UPLOAD_DIR_NAME = 'evebash_uploads/';

export type UploadStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded_pending_metadata'
  | 'completed'
  | 'failed'
  | 'upload_needs_reconciliation';

export interface UploadQueueItem {
  id: string; // clientUploadId
  fileUri: string;
  originalFileName: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  eventId: string;
  userId: string;
  mediaType: 'photo' | 'video';
  status: UploadStatus;
  progress: number; // In-memory progress 0-100
  storageKey?: string;
  error?: string;
  retryCount?: number;
  addedAt: number;
}

type QueueListener = (items: UploadQueueItem[]) => void;

let queue: UploadQueueItem[] = [];
let activeSlots = 0;
const listeners = new Set<QueueListener>();

// ── 1. Non-Poisoning Queue Mutation Mutex ────────────────────────────────────
let queueWriteChain: Promise<void> = Promise.resolve();

export function mutateQueue(mutator: (currentQueue: UploadQueueItem[]) => void): Promise<void> {
  const operation = queueWriteChain
    .catch(() => undefined)
    .then(async () => {
      mutator(queue);
      await saveQueueToStorage();
      notifyListeners();
    });

  queueWriteChain = operation.catch(() => undefined);
  return operation;
}

function notifyListeners() {
  const immutableQueue = queue.map(item => ({ ...item }));
  listeners.forEach(listener => {
    try {
      listener(immutableQueue);
    } catch (err) {
      console.error('[UploadQueue] Listener error:', err);
    }
  });
}

async function saveQueueToStorage() {
  try {
    // Progress % is ephemeral — strip or keep state for persistence
    const serialized = JSON.stringify(queue);
    await AsyncStorage.setItem(STORAGE_KEY, serialized);
  } catch (err) {
    console.error('[UploadQueue] Failed to save queue to storage:', err);
  }
}

// ── 2. Notification Channels & Permissions ──────────────────────────────────
async function ensureNotificationChannels() {
  if (!Notifications) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_PROGRESS, {
        name: 'Upload Progress',
        importance: Notifications.AndroidImportance.LOW,
        showBadge: false,
      });
      await Notifications.setNotificationChannelAsync(CHANNEL_COMPLETE, {
        name: 'Upload Completion',
        importance: Notifications.AndroidImportance.DEFAULT,
        showBadge: true,
      });
    }
  } catch (err) {
    console.warn('[UploadQueue] Failed to set notification channels:', err);
  }
}

async function checkNotificationPermission() {
  if (!Notifications) return false;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (err) {
    console.warn('[UploadQueue] Failed to check notification permissions:', err);
    return false;
  }
}

// ── 3. Queue Initialization & Startup Reconciliation ────────────────────────
export async function initUploadQueue() {
  await ensureNotificationChannels();

  try {
    // 1. Check for legacy migration
    const legacyRaw = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
    let initialQueue: UploadQueueItem[] = [];

    const storedRaw = await AsyncStorage.getItem(STORAGE_KEY);
    if (storedRaw) {
      initialQueue = JSON.parse(storedRaw);
    } else if (legacyRaw) {
      // Migrate legacy queue items
      try {
        const legacyParsed = JSON.parse(legacyRaw);
        if (Array.isArray(legacyParsed)) {
          initialQueue = legacyParsed.map((item: any) => ({
            id: item.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            fileUri: item.fileUri,
            originalFileName: item.fileName || 'upload.bin',
            fileName: item.fileName || 'upload.bin',
            fileType: item.fileType || 'application/octet-stream',
            fileSize: 0,
            eventId: item.eventId,
            userId: item.userId || 'anonymous',
            mediaType: item.mediaType || 'photo',
            status: item.status === 'uploading' ? 'upload_needs_reconciliation' : item.status,
            progress: item.status === 'completed' ? 100 : 0,
            error: item.error,
            addedAt: item.addedAt || Date.now(),
          }));
        }
        await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch (migrationErr) {
        console.warn('[UploadQueue] Legacy migration notice:', migrationErr);
      }
    }

    // 2. Mark any interrupted uploads as needs reconciliation
    queue = initialQueue.map(item => {
      if (item.status === 'uploading') {
        return { ...item, status: 'upload_needs_reconciliation' as UploadStatus, progress: 0 };
      }
      return item;
    });

    notifyListeners();

    // 3. Reconcile interrupted uploads with remote server
    const needsReconciliation = queue.filter(i => i.status === 'upload_needs_reconciliation');
    if (needsReconciliation.length > 0) {
      void reconcileInterruptedUploads(needsReconciliation);
    }

    // 4. Flush any pending metadata batches
    void flushMetadataBatches();

    // 5. Start queue processing if there are pending items
    if (queue.some(item => item.status === 'pending')) {
      processQueue();
    }
  } catch (err) {
    console.error('[UploadQueue] Init error:', err);
  }
}

async function reconcileInterruptedUploads(items: UploadQueueItem[]) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return;

  for (const item of items) {
    try {
      let reconciled = false;
      try {
        const response = await fetchWithEndpointFallback(
          getEndpointsForPath('/api/media/mobile/reconcile-upload'),
          (endpoint: string) => {
            return fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                clientUploadId: item.id,
                storageKey: item.storageKey,
                expectedSize: item.fileSize,
              }),
            });
          },
          'reconcile upload'
        );

        const result = await response.json().catch(() => ({}));
        if (response.ok && result.state === 'completed') {
          reconciled = true;
          if (result.alreadySaved) {
            await cleanupDurableFile(item.fileUri);
            await mutateQueue(q => {
              const target = q.find(i => i.id === item.id);
              if (target) {
                target.status = 'completed';
                target.progress = 100;
              }
            });
          } else {
            await mutateQueue(q => {
              const target = q.find(i => i.id === item.id);
              if (target) {
                target.status = 'uploaded_pending_metadata';
                target.storageKey = result.storageKey || target.storageKey;
              }
            });
          }
        }
      } catch (err) {
        console.warn(`[UploadQueue] Reconcile endpoint notice for ${item.id}:`, err);
      }

      if (!reconciled) {
        // Not completed in B2 or endpoint unavailable — verify local file still exists
        const fileInfo = await FileSystem.getInfoAsync(item.fileUri).catch(() => null);
        await mutateQueue(q => {
          const target = q.find(i => i.id === item.id);
          if (target) {
            if (fileInfo?.exists) {
              target.status = 'pending';
              target.progress = 0;
            } else {
              target.status = 'failed';
              target.error = 'Original file was deleted from device while app was inactive.';
            }
          }
        });
      }
    } catch (reconcileErr) {
      console.warn(`[UploadQueue] Reconcile error for ${item.id}:`, reconcileErr);
    }
  }

  void flushMetadataBatches();
  processQueue();
}

// ── 4. Add Files with Durable Copy & Disk Budget Check ───────────────────────
export async function addToUploadQueue(
  files: { uri: string; name: string; type: string }[],
  eventId: string,
  userId: string,
  mediaType: 'photo' | 'video'
) {
  await checkNotificationPermission();

  // 1. Calculate total batch size & check disk space
  let totalBatchBytes = 0;
  const fileDetails: Array<{ originalUri: string; name: string; type: string; size: number }> = [];

  for (const file of files) {
    try {
      const info = await FileSystem.getInfoAsync(file.uri);
      const size = info?.exists ? info.size || 0 : 0;
      totalBatchBytes += size;
      fileDetails.push({ originalUri: file.uri, name: file.name, type: file.type, size });
    } catch {
      fileDetails.push({ originalUri: file.uri, name: file.name, type: file.type, size: 0 });
    }
  }

  const freeDisk = await FileSystem.getFreeDiskStorageAsync().catch(() => 1024 * 1024 * 1024);
  const safetyMargin = 50 * 1024 * 1024; // 50 MB safety margin
  if (freeDisk < totalBatchBytes + safetyMargin) {
    Alert.alert(
      'Storage Space Low',
      'Your device is very low on free storage space. Please free up some space before uploading large media batches.',
      [{ text: 'OK' }]
    );
    return;
  }

  // 2. Ensure durable upload directory exists
  const uploadDir = `${FileSystem.documentDirectory}${UPLOAD_DIR_NAME}`;
  await FileSystem.makeDirectoryAsync(uploadDir, { intermediates: true }).catch(() => {});

  // 3. Copy files to durable document directory
  const newItems: UploadQueueItem[] = [];

  for (const detail of fileDetails) {
    const clientUploadId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const sanitizedFileName = detail.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const durableUri = `${uploadDir}${clientUploadId}_${sanitizedFileName}`;

    try {
      await FileSystem.copyAsync({ from: detail.originalUri, to: durableUri });
    } catch (copyErr) {
      console.warn(`[UploadQueue] Failed to make durable copy for ${detail.name}, using original URI:`, copyErr);
    }

    const effectiveUri = (await FileSystem.getInfoAsync(durableUri).catch(() => null))?.exists
      ? durableUri
      : detail.originalUri;

    newItems.push({
      id: clientUploadId,
      fileUri: effectiveUri,
      originalFileName: detail.name,
      fileName: detail.name,
      fileType: detail.type,
      fileSize: detail.size,
      eventId,
      userId,
      mediaType,
      status: 'pending',
      progress: 0,
      retryCount: 0,
      addedAt: Date.now(),
    });
  }

  await mutateQueue(q => {
    q.push(...newItems);
  });

  processQueue();
}

async function cleanupDurableFile(fileUri: string) {
  if (fileUri && fileUri.includes(UPLOAD_DIR_NAME)) {
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (err) {
      console.warn('[UploadQueue] Notice on deleting durable file:', err);
    }
  }
}

// ── 5. Single-Part Upload Worker (Up to 5GB) ─────────────────────────────────
async function uploadWorker(item: UploadQueueItem) {
  await mutateQueue(q => {
    const target = q.find(i => i.id === item.id);
    if (target) {
      target.status = 'uploading';
      target.progress = 0;
    }
  });

  void updateProgressNotification();

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error('Authorization required.');
    }

    // Retrieve file size if missing
    let fileSize = item.fileSize || 0;
    if (fileSize <= 0) {
      const info = await FileSystem.getInfoAsync(item.fileUri).catch(() => null);
      if (info && info.exists) {
        fileSize = info.size || 0;
      }
    }

    // 1. Get B2 upload URL (try /mobile/ endpoint first, fallback to standard endpoint if server is not yet updated)
    console.log(`[UploadQueue] Getting upload URL for: ${item.fileName} (${fileSize} bytes)`);
    let getUrlResult: any = null;

    try {
      const mobileResponse = await fetchWithEndpointFallback(
        getEndpointsForPath('/api/media/mobile/get-upload-url'),
        (endpoint: string) => {
          return fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              eventId: item.eventId,
              fileName: item.fileName,
              resourceType: item.mediaType === 'video' ? 'video' : 'image',
              fileSize,
              clientUploadId: item.id,
            }),
          });
        },
        'get mobile upload url'
      );
      if (mobileResponse.ok) {
        getUrlResult = await mobileResponse.json().catch(() => null);
      }
    } catch {
      // Mobile endpoint not available on server yet
    }

    if (!getUrlResult || !getUrlResult.uploadUrl) {
      console.log(`[UploadQueue] Mobile endpoint not found, falling back to standard /get-upload-url...`);
      const standardResponse = await fetchWithEndpointFallback(
        getEndpointsForPath('/api/media/get-upload-url'),
        (endpoint: string) => {
          return fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              eventId: item.eventId,
              fileName: item.fileName,
              resourceType: item.mediaType === 'video' ? 'video' : 'image',
            }),
          });
        },
        'get standard upload url'
      );

      getUrlResult = await standardResponse.json().catch(() => ({}));
      if (!standardResponse.ok) {
        throw new Error(getUrlResult.error || `Failed to get B2 upload URL (status: ${standardResponse.status})`);
      }
    }

    const { uploadUrl, authorizationToken, storageKey } = getUrlResult;

    await mutateQueue(q => {
      const target = q.find(i => i.id === item.id);
      if (target) {
        target.storageKey = storageKey;
        target.fileSize = fileSize;
      }
    });

    // 2. Upload file binary directly to Backblaze B2 via background task
    console.log(`[UploadQueue] Uploading directly to B2 (single-part, up to 5GB): ${storageKey}`);
    const uploadTask = FileSystem.createUploadTask(
      uploadUrl,
      item.fileUri,
      {
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: {
          Authorization: authorizationToken,
          'Content-Type': item.fileType || 'application/octet-stream',
          'X-Bz-File-Name': encodeURIComponent(storageKey),
          'X-Bz-Content-Sha1': 'do_not_verify',
        },
        sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
      },
      (progress) => {
        const percent = Math.min(
          99,
          Math.max(0, (progress.totalBytesSent / (progress.totalBytesExpectedToSend || fileSize || 1)) * 100)
        );
        // Progress ticks are in-memory only — never save entire queue to disk on progress!
        const target = queue.find(i => i.id === item.id);
        if (target) {
          target.progress = percent;
        }
        notifyListeners();
        void updateProgressNotification();
      }
    );

    const response = await uploadTask.uploadAsync();
    if (!response || response.status !== 200) {
      throw new Error(`Direct B2 upload failed with status: ${response ? response.status : 'unknown'}`);
    }

    // 3. Mark as uploaded_pending_metadata
    console.log(`[UploadQueue] B2 binary upload successful for ${storageKey}. Enqueueing for metadata batch.`);
    await mutateQueue(q => {
      const target = q.find(i => i.id === item.id);
      if (target) {
        target.status = 'uploaded_pending_metadata';
        target.progress = 99;
      }
    });

    // Trigger metadata batch flusher
    void flushMetadataBatches();
  } catch (err: any) {
    console.error(`[UploadQueue] Error uploading ${item.fileName}:`, err);
    const retries = (item.retryCount || 0) + 1;

    if (retries < MAX_UPLOAD_RETRIES) {
      console.log(`[UploadQueue] Retrying ${item.fileName} (attempt ${retries}/${MAX_UPLOAD_RETRIES})...`);
      await mutateQueue(q => {
        const target = q.find(i => i.id === item.id);
        if (target) {
          target.status = 'pending';
          target.retryCount = retries;
          target.progress = 0;
        }
      });
      // Backoff before slot is retried
      await new Promise(res => setTimeout(res, 1500 * retries));
    } else {
      await mutateQueue(q => {
        const target = q.find(i => i.id === item.id);
        if (target) {
          target.status = 'failed';
          target.error = err.message || String(err);
        }
      });
    }
  } finally {
    activeSlots = Math.max(0, activeSlots - 1);
    void updateProgressNotification();
    processQueue();
  }
}

// ── 6. Single-Flight Metadata Batch Sync ─────────────────────────────────────
let metadataFlushPromise: Promise<void> | null = null;

export function flushMetadataBatches(): Promise<void> {
  if (metadataFlushPromise) return metadataFlushPromise;

  metadataFlushPromise = flushMetadataBatchesInternal().finally(() => {
    metadataFlushPromise = null;
  });

  return metadataFlushPromise;
}

async function flushMetadataBatchesInternal(): Promise<void> {
  const pendingItems = queue.filter(i => i.status === 'uploaded_pending_metadata');
  if (pendingItems.length === 0) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return;

  // Group pending items by eventId
  const itemsByEvent = new Map<string, UploadQueueItem[]>();
  for (const item of pendingItems) {
    const list = itemsByEvent.get(item.eventId) || [];
    list.push(item);
    itemsByEvent.set(item.eventId, list);
  }

  for (const [eventId, items] of itemsByEvent.entries()) {
    try {
      console.log(`[UploadQueue] Flushing metadata batch for event ${eventId} (${items.length} items)...`);

      const photosPayload = items.map(item => ({
        clientUploadId: item.id,
        storageKey: item.storageKey,
        eventId: item.eventId || eventId,
        fileName: item.fileName,
        fileSize: item.fileSize,
        resourceType: item.mediaType === 'video' ? 'video' : 'image',
      }));

      let response: Response | null = null;
      try {
        response = await fetchWithEndpointFallback(
          getEndpointsForPath('/api/media/mobile/save-photo-batch'),
          (endpoint: string) => {
            return fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                eventId,
                photos: photosPayload,
              }),
            });
          },
          'save mobile photo batch'
        );
      } catch {
        // Mobile endpoint not available on server yet
      }

      if (!response || !response.ok) {
        console.log(`[UploadQueue] Mobile save-batch not found, falling back to standard /save-photo-batch...`);
        response = await fetchWithEndpointFallback(
          getEndpointsForPath('/api/media/save-photo-batch'),
          (endpoint: string) => {
            return fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                photos: photosPayload.map(p => ({
                  storageKey: p.storageKey,
                  eventId,
                  fileName: p.fileName,
                  fileSize: p.fileSize,
                  resourceType: p.resourceType,
                })),
              }),
            });
          },
          'save standard photo batch'
        );
      }

      if (!response) {
        throw new Error('Network error: unable to reach metadata sync endpoints');
      }

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || `Failed to save metadata batch (status: ${response.status})`);
      }

      console.log(`[UploadQueue] Metadata batch response for event ${eventId}:`, JSON.stringify(result));

      // Inspect per-item results
      const resultsMap = new Map<string, { status: string; error?: string }>();
      if (Array.isArray(result.results)) {
        for (const res of result.results) {
          resultsMap.set(res.clientUploadId, res);
        }
      }

      await mutateQueue(q => {
        for (const item of items) {
          const itemResult = resultsMap.get(item.id);
          const target = q.find(i => i.id === item.id);
          if (!target) continue;

          if (!itemResult || itemResult.status === 'saved') {
            target.status = 'completed';
            target.progress = 100;
            target.error = undefined;
            void cleanupDurableFile(target.fileUri);
          } else if (itemResult.status === 'not_uploaded') {
            const retries = (target.retryCount || 0) + 1;
            if (retries < MAX_UPLOAD_RETRIES) {
              target.status = 'pending';
              target.retryCount = retries;
              target.progress = 0;
              target.error = itemResult.error || 'Server did not find B2 file, retrying';
            } else {
              target.status = 'failed';
              target.error = itemResult.error || 'File failed to verify on server';
            }
          } else if (itemResult.status === 'rejected') {
            target.status = 'failed';
            target.error = itemResult.error || 'Rejected by server';
          }
        }
      });
    } catch (batchErr: any) {
      console.warn(`[UploadQueue] Error flushing metadata batch for event ${eventId}:`, batchErr);
      await mutateQueue(q => {
        for (const item of items) {
          const target = q.find(i => i.id === item.id);
          if (!target) continue;
          const retries = (target.retryCount || 0) + 1;
          if (retries >= MAX_UPLOAD_RETRIES) {
            target.status = 'failed';
            target.error = batchErr?.message || 'Metadata sync failed';
          }
        }
      });
    }
  }

  void updateProgressNotification();
  processQueue();
}

// ── 7. Concurrent Queue Dispatcher ──────────────────────────────────────────
async function processQueue() {
  while (activeSlots < CONCURRENCY) {
    const nextItem = queue.find(item => item.status === 'pending');

    if (!nextItem) {
      if (activeSlots === 0) {
        const allSettled = queue.every(
          item => item.status === 'completed' || item.status === 'failed'
        );
        if (allSettled && queue.length > 0) {
          notifyQueueDrained();
        }
      }
      break;
    }

    activeSlots++;
    uploadWorker(nextItem);
  }
}

// ── 8. Public Queue Control Methods ─────────────────────────────────────────
export function getUploadQueue(): UploadQueueItem[] {
  return queue;
}

export function subscribeToUploadQueue(listener: QueueListener) {
  listeners.add(listener);
  listener(queue.map(item => ({ ...item })));
  return () => {
    listeners.delete(listener);
  };
}

export async function clearFinishedUploads() {
  // Only remove items that have truly finished (never remove in-flight metadata items)
  const itemsToRemove = queue.filter(item => item.status === 'completed' || item.status === 'failed');
  for (const item of itemsToRemove) {
    if (item.status === 'completed') {
      await cleanupDurableFile(item.fileUri);
    }
  }

  await mutateQueue(q => {
    queue = q.filter(item => item.status !== 'completed' && item.status !== 'failed');
  });
}

export async function cancelUploadItem(itemId: string) {
  const item = queue.find(i => i.id === itemId);
  if (!item) return;

  await cleanupDurableFile(item.fileUri);

  await mutateQueue(q => {
    queue = q.filter(i => i.id !== itemId);
  });

  if (item.status === 'uploading') {
    activeSlots = Math.max(0, activeSlots - 1);
    processQueue();
  }
}

export async function retryUploadItem(itemId: string) {
  await mutateQueue(q => {
    const target = q.find(i => i.id === itemId);
    if (target) {
      target.status = 'pending';
      target.progress = 0;
      target.error = undefined;
      target.retryCount = 0;
    }
  });

  processQueue();
}

export async function resetUploadQueue() {
  for (const item of queue) {
    await cleanupDurableFile(item.fileUri);
  }

  activeSlots = 0;
  await mutateQueue(() => {
    queue = [];
  });

  if (Notifications) {
    try {
      await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
    } catch (e) {}
  }
}

// ── 9. Notification & Drainage Handlers ─────────────────────────────────────
async function updateProgressNotification() {
  if (!Notifications) return;

  const activeItems = queue.filter(
    item => item.status === 'pending' || item.status === 'uploading' || item.status === 'uploaded_pending_metadata'
  );

  if (activeItems.length === 0) {
    try {
      await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
    } catch (e) {}
    return;
  }

  const completedCount = queue.filter(item => item.status === 'completed').length;
  const totalCount = queue.length;

  const totalProgressSum = queue.reduce((sum, item) => {
    if (item.status === 'completed') return sum + 100;
    return sum + item.progress;
  }, 0);
  const overallPercentage = totalCount > 0 ? (totalProgressSum / (totalCount * 100)) * 100 : 0;

  const bodyText = `Uploading: ${completedCount}/${totalCount} files completed (${Math.round(overallPercentage)}%)`;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: PROGRESS_NOTIFICATION_ID,
      content: {
        title: 'Uploading Media to EveBash',
        body: bodyText,
        sound: false,
        color: '#CCA43B',
        android: {
          channelId: CHANNEL_PROGRESS,
          sticky: true,
          ongoing: true,
        },
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('[UploadQueue] Failed to update progress notification:', err);
  }
}

async function notifyQueueDrained() {
  const totalCount = queue.length;
  if (totalCount === 0) return;

  const failed = queue.filter(item => item.status === 'failed');
  const succeeded = queue.filter(item => item.status === 'completed');

  if (succeeded.length > 0) {
    try {
      const triggerUrl = getEndpointsForPath('/api/media/trigger-modal-batch?immediate=true')[0];
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (triggerUrl && accessToken) {
        const eventIds = Array.from(new Set(succeeded.map(item => item.eventId).filter(Boolean)));
        for (const eventId of eventIds) {
          fetch(triggerUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ eventId }),
          }).catch(err => {
            console.warn(`[UploadQueue] Face indexing trigger failed for event ${eventId}:`, err);
          });
        }
      }
    } catch (triggerErr) {
      console.warn('[UploadQueue] Failed to initiate immediate face indexing trigger:', triggerErr);
    }
  }

  if (Notifications) {
    try {
      await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
    } catch (e) {}

    try {
      if (failed.length > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Upload Finished with Issues',
            body: `Succeeded: ${succeeded.length}, Failed: ${failed.length}. Tap to retry.`,
            sound: true,
            android: { channelId: CHANNEL_COMPLETE },
          },
          trigger: null,
        });
      } else {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Upload Complete',
            body: 'All files uploaded successfully!',
            sound: true,
            android: { channelId: CHANNEL_COMPLETE },
          },
          trigger: null,
        });
      }
    } catch (err) {
      console.warn('[UploadQueue] Failed to send completion notification:', err);
    }
  }
}

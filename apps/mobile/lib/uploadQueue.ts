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
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (e) {
  console.warn('[UploadQueue] expo-notifications is not supported in this environment (e.g. Expo Go on Android). System notifications will be disabled.');
}

const STORAGE_KEY = '@evebash_upload_queue';
const PROGRESS_NOTIFICATION_ID = 'media-upload-progress';
const CHANNEL_PROGRESS = 'upload-progress';
const CHANNEL_COMPLETE = 'upload-completion';

// ── Chunked Upload Resume State ──────────────────────────────────────────────
// Persisted per-file in AsyncStorage. Key: 'evebash_chunk_resume_{queueItemId}'
// Survives app kill, backgrounding, and device restart.
// B2 large-file sessions last 24 hours, so we use a 23-hour expiry.

const CHUNK_RESUME_KEY_PREFIX = 'evebash_chunk_resume_';
const CHUNK_RESUME_EXPIRY_MS = 23 * 60 * 60 * 1000; // 23 hours

interface ChunkResumeState {
    fileId: string;
    storageKey: string;
    eventId: string;
    queueItemId: string;
    fileName: string;
    fileSize: number;
    totalChunks: number;
    /** partNumber (1-indexed) → sha1 from B2 response */
    completedParts: Record<number, string>;
    createdAt: number;
}

async function saveChunkResumeState(state: ChunkResumeState): Promise<void> {
    try {
        const key = `${CHUNK_RESUME_KEY_PREFIX}${state.queueItemId}`;
        await AsyncStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
        console.warn('[UploadQueue] Failed to save chunk resume state:', err);
    }
}

async function loadChunkResumeState(queueItemId: string): Promise<ChunkResumeState | null> {
    try {
        const key = `${CHUNK_RESUME_KEY_PREFIX}${queueItemId}`;
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return null;
        const state = JSON.parse(raw) as ChunkResumeState;
        if (Date.now() - state.createdAt > CHUNK_RESUME_EXPIRY_MS) {
            await AsyncStorage.removeItem(key);
            return null;
        }
        return state;
    } catch {
        return null;
    }
}

async function clearChunkResumeState(queueItemId: string): Promise<void> {
    try {
        await AsyncStorage.removeItem(`${CHUNK_RESUME_KEY_PREFIX}${queueItemId}`);
    } catch {
        // ignore
    }
}

/**
 * Maximum number of files uploaded simultaneously.
 * 3 is the sweet spot: ~3x faster than sequential on WiFi
 * without saturating mobile radio or server threads.
 */
const CONCURRENCY = 3;

export interface UploadQueueItem {
  id: string;
  fileUri: string;
  fileName: string;
  fileType: string;
  eventId: string;
  userId: string;
  mediaType: 'photo' | 'video';
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number; // 0 to 100
  error?: string;
  addedAt: number;
}

type QueueListener = (items: UploadQueueItem[]) => void;

let queue: UploadQueueItem[] = [];

/** Number of upload slots currently active */
let activeSlots = 0;


const listeners = new Set<QueueListener>();

// Helper to notify listeners of changes
function notifyListeners() {
  const immutableQueue = queue.map(item => ({ ...item }));
  listeners.forEach(listener => listener(immutableQueue));
}

// Persist queue to AsyncStorage
async function saveQueueToStorage() {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[UploadQueue] Failed to save queue:', err);
  }
}

// Set up channels on Android
async function ensureNotificationChannels() {
  if (!Notifications) return;
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_PROGRESS, {
        name: 'Upload Progress',
        importance: Notifications.AndroidImportance.LOW, // Low importance so it doesn't make sound repeatedly
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

// Request permission and show notifications
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

// Initialize the queue
export async function initUploadQueue() {
  await ensureNotificationChannels();
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: UploadQueueItem[] = JSON.parse(stored);
      // Clean up previous run: reset 'uploading' status back to 'pending'
      queue = parsed.map(item => {
        if (item.status === 'uploading') {
          return { ...item, status: 'pending', progress: 0 };
        }
        return item;
      });
      notifyListeners();
      // Auto-start queue processing if there are pending items
      if (queue.some(item => item.status === 'pending')) {
        processQueue();
      }
    }
  } catch (err) {
    console.error('[UploadQueue] Init error:', err);
  }
}

// Add files to the queue
export async function addToUploadQueue(
  files: { uri: string; name: string; type: string }[],
  eventId: string,
  userId: string,
  mediaType: 'photo' | 'video'
) {
  const hasPermission = await checkNotificationPermission();
  if (!hasPermission) {
    console.warn('[UploadQueue] Notification permission not granted. Uploads will proceed without notifications.');
  }

  const newItems: UploadQueueItem[] = files.map(file => ({
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    fileUri: file.uri,
    fileName: file.name,
    fileType: file.type,
    eventId,
    userId,
    mediaType,
    status: 'pending',
    progress: 0,
    addedAt: Date.now(),
  }));

  queue = [...queue, ...newItems];
  notifyListeners();
  await saveQueueToStorage();

  // Trigger processing — fills all available concurrency slots
  processQueue();
}

// Get the active queue list
export function getUploadQueue(): UploadQueueItem[] {
  return queue;
}

// Subscribe to queue changes
export function subscribeToUploadQueue(listener: QueueListener) {
  listeners.add(listener);
  listener(queue.map(item => ({ ...item })));
  return () => {
    listeners.delete(listener);
  };
}

// Clear completed and failed items
export async function clearFinishedUploads() {
  queue = queue.filter(item => item.status === 'pending' || item.status === 'uploading');
  notifyListeners();
  await saveQueueToStorage();
}

// Cancel a specific pending/uploading item
export async function cancelUploadItem(itemId: string) {
  const item = queue.find(i => i.id === itemId);
  if (!item) return;

  // With fetch-based uploads, we can't cancel in-flight requests directly.
  // Removing from queue is sufficient — the worker will finish but the result
  // will be discarded when it can't find the item in the queue.
  queue = queue.filter(i => i.id !== itemId);
  notifyListeners();
  await saveQueueToStorage();

  // A slot just freed up — try to fill it
  if (item.status === 'uploading') {
    activeSlots = Math.max(0, activeSlots - 1);
    processQueue();
  }
}

// Retry a failed item
export async function retryUploadItem(itemId: string) {
  queue = queue.map(item => {
    if (item.id === itemId) {
      return { ...item, status: 'pending', progress: 0, error: undefined };
    }
    return item;
  });
  notifyListeners();
  await saveQueueToStorage();
  processQueue();
}

// Clean up entire queue
export async function resetUploadQueue() {
  activeSlots = 0;
  queue = [];
  notifyListeners();
  await saveQueueToStorage();
  if (Notifications) {
    try {
      await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
    } catch (e) {}
  }
}

// Update the system notification with overall progress details
async function updateProgressNotification() {
  if (!Notifications) return;
  
  const activeItems = queue.filter(item => item.status === 'pending' || item.status === 'uploading' || item.status === 'failed');
  if (activeItems.length === 0) {
    try {
      await Notifications.dismissNotificationAsync(PROGRESS_NOTIFICATION_ID);
    } catch (e) {}
    return;
  }

  const completedCount = queue.filter(item => item.status === 'completed').length;
  const totalCount = queue.length;
  
  // Calculate total overall percentage
  const totalProgressSum = queue.reduce((sum, item) => {
    if (item.status === 'completed') return sum + 100;
    return sum + item.progress;
  }, 0);
  const overallPercentage = totalProgressSum / (totalCount * 100) * 100;

  const bodyText = `Uploading: ${completedCount}/${totalCount} files completed (${Math.round(overallPercentage)}%)`;

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: PROGRESS_NOTIFICATION_ID,
      content: {
        title: 'Uploading Media to EveBash',
        body: bodyText,
        sound: false,
        color: '#CCA43B', // Golden theme color
        android: {
          channelId: CHANNEL_PROGRESS,
          sticky: true,
          ongoing: true,
        },
      },
      trigger: null, // show immediately
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

  // Trigger immediate face recognition on the backend if any uploads succeeded
  if (succeeded.length > 0) {
    try {
      const triggerUrl = getEndpointsForPath('/api/media/trigger-modal-batch?immediate=true')[0];
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (triggerUrl && accessToken) {
        const eventIds = Array.from(new Set(succeeded.map(item => item.eventId).filter(Boolean)));
        console.log(`[UploadQueue] Queue drained. Triggering face indexing for ${eventIds.length} event(s).`);

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
            body: 'Upload complete',
            sound: true,
            android: { channelId: CHANNEL_COMPLETE },
          },
          trigger: null,
        });
      }
    } catch (err) {
      console.warn('[UploadQueue] Failed to send completion notification:', err);
    }
  } else {
    try {
      if (failed.length > 0) {
        Alert.alert(
          'Upload finished with issues',
          `Succeeded: ${succeeded.length}, Failed: ${failed.length}. Open dashboard notifications to manage.`,
          [{ text: 'OK' }]
        );
      } else if (succeeded.length > 0) {
        Alert.alert(
          'Upload Complete',
          'Upload complete',
          [{ text: 'OK' }]
        );
      }
    } catch (err) {
      console.warn('[UploadQueue] Failed to show fallback Alert:', err);
    }
  }
}

/**
 * Uploads a single queue item and manages its lifecycle.
 * Runs concurrently with other uploadWorker() calls (up to CONCURRENCY).
 */
async function uploadWorkerLargeFileInChunks(item: UploadQueueItem, accessToken: string, fileSize: number) {
  console.log(`[UploadQueue] Starting chunked upload for: ${item.fileName} (${fileSize} bytes)`);

  const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB chunks
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

  // ── 1. Check for existing resume state ──────────────────────────────────────
  let fileId: string;
  let storageKey: string;
  let completedParts: Record<number, string> = {};
  let resumeCreatedAt = Date.now();

  const saved = await loadChunkResumeState(item.id);
  if (
    saved &&
    saved.eventId === item.eventId &&
    saved.fileName === item.fileName &&
    saved.fileSize === fileSize &&
    saved.totalChunks === totalChunks
  ) {
    // Resume from persisted state — don't re-initiate the B2 session
    fileId = saved.fileId;
    storageKey = saved.storageKey;
    completedParts = saved.completedParts;
    resumeCreatedAt = saved.createdAt;
    const doneCount = Object.keys(completedParts).length;
    console.log(`[UploadQueue] Resuming chunked upload: ${doneCount}/${totalChunks} chunks already done.`);
  } else {
    // Fresh start — initiate a new B2 large-file session
    const initiateResponse = await fetchWithEndpointFallback(
      getEndpointsForPath('/api/media/upload/chunk/initiate'),
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
            fileSize,
            resourceType: item.mediaType === 'video' ? 'video' : 'image',
            contentType: item.fileType || 'application/octet-stream',
          }),
        });
      },
      'initiate chunked upload'
    );

    const initiateResult = await initiateResponse.json().catch(() => ({}));
    if (!initiateResponse.ok) {
      throw new Error(initiateResult.error || `Failed to initiate chunked upload (status: ${initiateResponse.status})`);
    }

    fileId = initiateResult.fileId;
    storageKey = initiateResult.storageKey;
    completedParts = {};

    // ── Server-side resume check ────────────────────────────────────────────────
    if (initiateResult.resumed && Array.isArray(initiateResult.completedParts)) {
      for (const part of initiateResult.completedParts) {
        completedParts[part.partNumber] = part.sha1;
      }
      const doneCount = Object.keys(completedParts).length;
      console.log(`[UploadQueue] Server-side resume active! ${doneCount}/${totalChunks} chunks verified on Backblaze.`);
    }

    // Persist immediately so we have the fileId saved before any chunk uploads
    await saveChunkResumeState({
      fileId, storageKey, eventId: item.eventId,
      queueItemId: item.id, fileName: item.fileName,
      fileSize, totalChunks,
      completedParts: { ...completedParts },
      createdAt: resumeCreatedAt,
    });
  }

  // Build partSha1Array — pre-fill with already-completed parts
  const partSha1Array: string[] = new Array(totalChunks).fill('');
  for (const [partNumStr, sha1] of Object.entries(completedParts)) {
    partSha1Array[Number(partNumStr) - 1] = sha1;
  }

  // ── 2. Upload chunks sequentially, skipping already-completed ones ───────────
  for (let partIndex = 0; partIndex < totalChunks; partIndex++) {
    const partNumber = partIndex + 1;

    // Skip already-completed parts (resume magic)
    if (completedParts[partNumber]) {
      console.log(`[UploadQueue] Skipping already-completed chunk ${partNumber}/${totalChunks}`);
      continue;
    }

    // Check if item has been cancelled mid-upload
    const currentItem = queue.find(i => i.id === item.id);
    if (!currentItem) {
      await clearChunkResumeState(item.id);
      // Abort the B2 large-file session
      await fetchWithEndpointFallback(
        getEndpointsForPath('/api/media/upload/chunk/abort'),
        (endpoint: string) => {
          return fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ fileId }),
          });
        },
        'abort chunked upload'
      ).catch(() => {});
      throw new Error('Upload cancelled by user.');
    }

    const start = partIndex * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, fileSize);
    const chunkBlobSize = end - start;

    console.log(`[UploadQueue] Uploading chunk ${partNumber}/${totalChunks} (${chunkBlobSize} bytes)...`);

    // Read chunk from local file as base64 string
    const base64Chunk = await FileSystem.readAsStringAsync(item.fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      length: chunkBlobSize,
      position: start,
    });

    // Write chunk temporarily to cache
    const tempUri = `${FileSystem.cacheDirectory}temp_chunk_${item.id}_${partNumber}`;
    await FileSystem.writeAsStringAsync(tempUri, base64Chunk, {
      encoding: FileSystem.EncodingType.Base64,
    });

    let chunkUploadSuccess = false;
    let sha1 = "";
    let attempt = 0;

    while (!chunkUploadSuccess && attempt < 3) {
      attempt++;
      try {
        // Get fresh part upload URL
        const partUrlResponse = await fetchWithEndpointFallback(
          getEndpointsForPath('/api/media/upload/chunk/part-url'),
          (endpoint: string) => {
            return fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ fileId }),
            });
          },
          'get chunk upload URL'
        );

        const partUrlResult = await partUrlResponse.json().catch(() => ({}));
        if (!partUrlResponse.ok) {
          throw new Error(partUrlResult.error || `Failed to get chunk upload URL (status: ${partUrlResponse.status})`);
        }

        const { uploadUrl, authorizationToken } = partUrlResult;

        // Upload chunk temp file directly to B2 URL
        const uploadTask = FileSystem.createUploadTask(
          uploadUrl,
          tempUri,
          {
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: {
              Authorization: authorizationToken,
              'Content-Type': 'application/octet-stream',
              'X-Bz-Part-Number': String(partNumber),
              'X-Bz-Content-Sha1': 'do_not_verify',
            },
            sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
          }
        );

        const response = await uploadTask.uploadAsync();
        if (!response || response.status !== 200) {
          throw new Error(`Chunk B2 upload failed with status: ${response ? response.status : 'unknown'}`);
        }

        // Retrieve SHA-1 from the B2 response body
        const b2Result = JSON.parse(response.body);
        sha1 = b2Result.contentSha1;
        if (!sha1 || sha1 === "do_not_verify") {
          throw new Error("B2 did not return part SHA-1 checksum in response");
        }

        chunkUploadSuccess = true;
        partSha1Array[partIndex] = sha1;

        // Persist completed part to AsyncStorage immediately after every successful chunk
        completedParts[partNumber] = sha1;
        await saveChunkResumeState({
          fileId, storageKey, eventId: item.eventId,
          queueItemId: item.id, fileName: item.fileName,
          fileSize, totalChunks,
          completedParts: { ...completedParts },
          createdAt: resumeCreatedAt,
        });

        // Update progress
        const percent = Math.min(99, ((start + chunkBlobSize) / fileSize) * 100);
        item.progress = percent;
        notifyListeners();
        void updateProgressNotification();
      } catch (err) {
        console.warn(`[UploadQueue] Failed chunk ${partNumber} (attempt ${attempt}/3):`, err);
        if (attempt >= 3) {
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } finally {
        // Always clean up the temp file
        await FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(() => {});
      }
    }
  }

  // ── 3. Complete chunked upload on Railway ────────────────────────────────────
  console.log(`[UploadQueue] Chunks complete. Completing large file: ${storageKey}`);
  const completeResponse = await fetchWithEndpointFallback(
    getEndpointsForPath('/api/media/upload/chunk/complete'),
    (endpoint: string) => {
      return fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          fileId,
          storageKey,
          eventId: item.eventId,
          fileName: item.fileName,
          fileSize,
          resourceType: item.mediaType === 'video' ? 'video' : 'image',
          partSha1Array,
        }),
      });
    },
    'complete chunked upload'
  );

  const completeResult = await completeResponse.json().catch(() => ({}));
  if (!completeResponse.ok) {
    throw new Error(completeResult.error || `Failed to complete chunked upload (status: ${completeResponse.status})`);
  }

  // ── 4. Clean up resume state on success ─────────────────────────────────────
  await clearChunkResumeState(item.id);

  item.status = 'completed';
  item.progress = 100;
}


async function uploadWorker(item: UploadQueueItem) {
  item.status = 'uploading';
  notifyListeners();
  await saveQueueToStorage();
  await updateProgressNotification();

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      throw new Error('Authorization required.');
    }

    // Get file size to save with metadata & decide upload method
    let fileSize = 0;
    try {
      const info = await FileSystem.getInfoAsync(item.fileUri);
      if (info && info.exists) {
        fileSize = info.size || 0;
      }
    } catch (infoErr) {
      console.warn('[UploadQueue] Could not get file size info:', infoErr);
    }

    const isVideo = item.mediaType === 'video' ||
      /\.(mp4|mov|avi|mkv|webm|m4v|3gp|flv|wmv|mts|m2ts|ts|ogv)$/i.test(item.fileName || '');

    if (isVideo || fileSize >= 5 * 1024 * 1024) { // All videos and files >= 5MB use resilient chunking
      await uploadWorkerLargeFileInChunks(item, accessToken, fileSize);
      return;
    }

    // 1. Get B2 upload URL and token
    console.log(`[UploadQueue] Getting B2 upload URL for: ${item.fileName}`);
    const getUrlResponse = await fetchWithEndpointFallback(
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
      'get upload url'
    );

    const getUrlResult = await getUrlResponse.json().catch(() => ({}));
    if (!getUrlResponse.ok) {
      throw new Error(getUrlResult.error || `Failed to get B2 upload URL (status: ${getUrlResponse.status})`);
    }

    const { uploadUrl, authorizationToken, storageKey } = getUrlResult;

    // 2. Upload file binary directly to B2
    console.log(`[UploadQueue] Uploading file binary directly to B2 for: ${storageKey}`);
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
          99, // limit to 99% until response is finalized
          Math.max(0, (progress.totalBytesSent / progress.totalBytesExpectedToSend) * 100)
        );
        item.progress = percent;
        notifyListeners();
        void updateProgressNotification();
      }
    );

    const response = await uploadTask.uploadAsync();
    if (!response || response.status !== 200) {
      throw new Error(`Direct B2 upload failed with status: ${response ? response.status : 'unknown'}`);
    }

    // 3. Save photo metadata to Vercel/Railway
    console.log(`[UploadQueue] Saving metadata to database for: ${storageKey}`);
    const saveResponse = await fetchWithEndpointFallback(
      getEndpointsForPath('/api/media/save-photo'),
      (endpoint: string) => {
        return fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            storageKey,
            eventId: item.eventId,
            fileName: item.fileName,
            fileSize,
            resourceType: item.mediaType === 'video' ? 'video' : 'image',
          }),
        });
      },
      'save photo metadata'
    );

    const saveResult = await saveResponse.json().catch(() => ({}));
    if (!saveResponse.ok) {
      throw new Error(saveResult.error || `Failed to save photo metadata (status: ${saveResponse.status})`);
    }

    item.status = 'completed';
    item.progress = 100;
  } catch (err: any) {
    console.error(`[UploadQueue] Error uploading ${item.fileName}:`, err);
    item.status = 'failed';
    item.error = err.message || String(err);
  } finally {
    activeSlots = Math.max(0, activeSlots - 1);
    notifyListeners();
    await saveQueueToStorage();
    await updateProgressNotification();

    // This slot is now free — fill it with the next pending item, or
    // fire the completion notification if the whole queue is drained.
    processQueue();
  }
}

/**
 * Concurrent queue dispatcher.
 * Launches up to CONCURRENCY upload workers simultaneously.
 * Safe to call multiple times — extra calls are no-ops when all slots are filled.
 */
async function processQueue() {
  // Fill as many slots as possible without exceeding the concurrency limit
  while (activeSlots < CONCURRENCY) {
    const nextItem = queue.find(item => item.status === 'pending');

    if (!nextItem) {
      // No more pending items — check if the whole queue is now drained
      if (activeSlots === 0) {
        const allSettled = queue.every(
          item => item.status === 'completed' || item.status === 'failed'
        );
        if (allSettled && queue.length > 0) {
          notifyQueueDrained();
        }
      }
      // No pending items left to schedule; remaining slots stay idle
      break;
    }

    // Claim this slot and launch the worker
    activeSlots++;
    uploadWorker(nextItem); // intentionally not awaited — runs concurrently
  }
}


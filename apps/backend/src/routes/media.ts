import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import sharp from "sharp";
import { supabaseAnonKey, supabaseUrl } from "../config.js";
import { getSupabaseAdminClient } from "../supabase.js";
import {
  type BackblazeAuth,
  cancelLargeFile,
  finishLargeFile,
  getCachedBackblazeAuth,
  getCachedUploadUrl,
  getUploadPartUrl,
  getUploadUrl,
  startLargeFile,
} from "../backblaze.js";
import {
  publishDelayedModalTrigger,
  publishModalBatchTask,
  publishResizeTask,
  publishVideoTranscodeTask,
} from "../qstash.js";

export const mediaRouter = Router();

type AsyncRoute = (request: Request, response: Response) => Promise<void>;

type PhotoPayload = {
  id: string;
  storage_key: string;
  event_id: string;
  url: string;
  width?: number | null;
  height?: number | null;
};

type SavedPhoto = {
  id: string;
  event_id: string;
  storage_key: string;
  url: string;
  thumbnail_url?: string | null;
  user_id?: string | null;
  media_type?: string | null;
  resource_type?: string | null;
};

type B2FileVersion = {
  fileName: string;
  fileId?: string;
};

const tokenCache = new Map<string, { userId: string; expiresAt: number }>();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const B2_DOWNLOAD_RETRY_DELAYS_MS = [1500, 3000, 6000, 10000, 15000, 20000];
const B2_UPLOAD_RETRY_DELAYS_MS = [1000, 2500, 5000, 10000];
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "avi", "mkv", "webm", "m4v", "3gp", "flv", "wmv", "mts", "m2ts", "ts", "ogv"]);

let activeResizes = 0;
const MAX_CONCURRENT_RESIZES = 3;
const resizeQueue: (() => void)[] = [];

function asyncRoute(handler: AsyncRoute) {
  return (request: Request, response: Response, next: NextFunction) => {
    handler(request, response).catch(next);
  };
}

function jsonError(response: Response, status: number, error: string) {
  response.status(status).json({ success: false, error });
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function getMediaDomain() {
  const value = (
    process.env.MEDIA_DOMAIN ||
    process.env.CLOUDFLARE_DOMAIN ||
    process.env.NEXT_PUBLIC_MEDIA_DOMAIN ||
    ""
  )
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  if (!value) {
    throw new Error("MEDIA_DOMAIN or CLOUDFLARE_DOMAIN is not configured");
  }
  return value;
}

function getRequestOrigin(request: Request) {
  const origin = request.header("origin");
  if (origin) return origin;
  const proto = request.header("x-forwarded-proto") || request.protocol || "https";
  return `${proto}://${request.get("host")}`;
}

function getAccessToken(request: Request) {
  const authHeader = request.header("authorization") || "";
  return authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
}

function sanitizeSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function buildStorageKey(params: {
  eventId?: string;
  userId: string;
  resourceType: string;
  fileName: string;
  scope?: "event" | "profile";
}) {
  const userId = sanitizeSegment(params.userId) || "user";
  const folder = params.resourceType === "video" ? "videos" : "photos";
  const cleanName = sanitizeSegment(params.fileName) || `${folder.slice(0, -1)}.bin`;
  const uniquePrefix = `${Date.now()}-${randomUUID()}`;

  if (params.scope === "profile") {
    return `profiles/${userId}/${uniquePrefix}-${cleanName}`;
  }

  const eventId = sanitizeSegment(params.eventId || "") || "event";
  return `events/${eventId}/${folder}/${userId}-${uniquePrefix}-${cleanName}`;
}

async function verifySupabaseUser(accessToken: string) {
  const cached = tokenCache.get(accessToken);
  if (cached && Date.now() < cached.expiresAt) {
    return { id: cached.userId };
  }

  if (!supabaseUrl || !supabaseAnonKey) return null;

  const response = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      apikey: supabaseAnonKey,
    },
  });

  if (!response.ok) return null;

  const user = await response.json().catch(() => null);
  if (user?.id) {
    tokenCache.set(accessToken, { userId: user.id, expiresAt: Date.now() + 5 * 60 * 1000 });
    return { id: user.id };
  }
  return null;
}

async function getUploadUserId(request: Request) {
  const accessToken = getAccessToken(request);
  if (!accessToken) return "anonymous";
  const user = await verifySupabaseUser(accessToken);
  return user?.id || "anonymous";
}

async function requireUser(request: Request, response: Response) {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    jsonError(response, 401, "Missing authorization token");
    return null;
  }
  const user = await verifySupabaseUser(accessToken);
  if (!user) {
    jsonError(response, 401, "Invalid authorization token");
    return null;
  }
  return user;
}

async function validateAnonymousEvent(eventId: string) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data: event, error } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();

  return !error && !!event;
}

function isVideoResource(resourceType: string | undefined, fileName: string, storageKey?: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  return resourceType === "video" || VIDEO_EXTENSIONS.has(ext) || !!storageKey?.includes("/videos/");
}

function inferContentType(key: string, fallback = "image/jpeg") {
  const cleanKey = key.split("?")[0].toLowerCase();
  if (cleanKey.endsWith(".png")) return "image/png";
  if (cleanKey.endsWith(".webp")) return "image/webp";
  if (cleanKey.endsWith(".tif") || cleanKey.endsWith(".tiff")) return "image/tiff";
  if (cleanKey.endsWith(".jpg") || cleanKey.endsWith(".jpeg")) return "image/jpeg";
  return fallback;
}

function toPhotoRow(params: {
  storageKey: string;
  eventId: string;
  fileName: string;
  fileSize?: number;
  userId: string;
  resourceType?: string;
}) {
  const isVideo = isVideoResource(params.resourceType, params.fileName, params.storageKey);
  const mediaDomain = getMediaDomain();
  const url = `https://${mediaDomain}/${params.storageKey}`;
  const photoId = params.storageKey.replace(/\//g, "_");

  return {
    row: {
      id: photoId,
      event_id: params.eventId,
      storage_key: params.storageKey,
      url,
      height: null,
      width: null,
      uploaded_at: new Date().toISOString(),
      tags: [],
      user_id: params.userId,
      size: Number(params.fileSize) || 0,
      format: params.fileName.split(".").pop()?.toLowerCase() || (isVideo ? "mp4" : "jpg"),
      media_type: isVideo ? "video" : "photo",
      resource_type: isVideo ? "video" : "image",
    },
    url,
    photoId,
    isVideo,
  };
}

function background(label: string, task: () => Promise<unknown>) {
  setTimeout(() => {
    task().catch((error) => console.error(`[${label}] Background task failed:`, error));
  }, 0);
}

async function sendOwnerUploadNotification(
  eventId: string,
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
) {
  if (!eventId || !userId || userId === "anonymous") return;

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("created_by, title")
    .eq("id", eventId)
    .maybeSingle();

  if (eventError || !event?.created_by || event.created_by === userId) return;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("push_token, notification_preferences")
    .eq("id", event.created_by)
    .maybeSingle();

  if (profileError || !profile?.push_token) return;
  const preferences = profile.notification_preferences as Record<string, unknown> | null;
  if (preferences?.push === false || preferences?.event_activity === false) return;

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: profile.push_token,
      sound: "default",
      title,
      body,
      data,
    }),
  });
}

async function deleteB2File(auth: BackblazeAuth, bucketId: string, key: string) {
  const listResponse = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_names`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucketId, startFileName: key, maxFileCount: 1, prefix: key }),
  });

  if (!listResponse.ok) return false;
  const listData = await listResponse.json();
  const file = listData.files?.find((item: { fileName: string; fileId?: string }) => item.fileName === key);
  if (!file?.fileId) return true;

  const deleteResponse = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileName: key, fileId: file.fileId }),
  });

  return deleteResponse.ok;
}

async function listExactFileVersions(auth: BackblazeAuth, bucketId: string, key: string): Promise<B2FileVersion[]> {
  const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_versions`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bucketId,
      startFileName: key,
      maxFileCount: 20,
      prefix: key,
    }),
  });

  if (!response.ok) {
    console.warn(`[MediaRotate] Could not list existing file versions for ${key}: ${response.status}`);
    return [];
  }

  const data = await response.json().catch(() => ({}));
  return (data.files || []).filter((file: B2FileVersion) => file.fileName === key && file.fileId);
}

async function deleteB2FileVersion(auth: BackblazeAuth, file: B2FileVersion) {
  if (!file.fileId) return false;

  const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.fileName,
      fileId: file.fileId,
    }),
  });

  if (!response.ok) {
    console.warn(`[MediaRotate] Could not delete old file version ${file.fileName}: ${response.status}`);
    return false;
  }

  return true;
}

async function deleteB2Prefix(auth: BackblazeAuth, bucketId: string, prefix: string) {
  let startFileName: string | undefined;
  while (true) {
    const listResponse: globalThis.Response = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_names`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bucketId, prefix, maxFileCount: 1000, ...(startFileName ? { startFileName } : {}) }),
    });

    if (!listResponse.ok) return false;
    const listData = await listResponse.json();
    const files: Array<{ fileName: string; fileId?: string }> = listData.files || [];
    if (files.length === 0) return true;

    for (const file of files) {
      if (file.fileId) {
        await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
          method: "POST",
          headers: {
            Authorization: auth.authorizationToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ fileName: file.fileName, fileId: file.fileId }),
        }).catch(() => null);
      }
    }

    if (!listData.nextFileName) return true;
    startFileName = listData.nextFileName;
  }
}

async function rollbackB2Upload(storageKey: string, resourceType: string) {
  const backblazeAuth = await getCachedBackblazeAuth();
  const bucketId = requireEnv("B2_BUCKET_ID");
  const keys = resourceType === "image"
    ? [storageKey, `${storageKey}-thumbnail.webp`, `${storageKey}-preview.webp`]
    : [storageKey];
  await Promise.all(keys.map((key) => deleteB2File(backblazeAuth, bucketId, key).catch(() => false)));
}

function isRetryableB2Status(status: number) {
  return status === 404 || status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

async function fetchB2WithRetries(url: string, init: RequestInit, label: string, retryDelaysMs: number[]) {
  const maxAttempts = retryDelaysMs.length + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;

      lastError = new Error(`${label} failed with ${response.status} ${response.statusText}`);
      if (!isRetryableB2Status(response.status) || attempt === maxAttempts) throw lastError;
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
    }
    await sleep(retryDelaysMs[attempt - 1] || 1000);
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
}

async function uploadBufferToB2(auth: BackblazeAuth, bucketId: string, buffer: Buffer, key: string, contentType: string) {
  const maxAttempts = B2_UPLOAD_RETRY_DELAYS_MS.length + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const uploadUrlData = await getUploadUrl(auth);
      const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
        method: "POST",
        headers: {
          Authorization: uploadUrlData.authorizationToken,
          "Content-Type": contentType,
          "X-Bz-File-Name": encodeURIComponent(key),
          "X-Bz-Content-Sha1": "do_not_verify",
          "Content-Length": String(buffer.length),
        },
        body: buffer as unknown as BodyInit,
      });
      if (uploadResponse.ok) return (await uploadResponse.json()).fileId as string;
      lastError = new Error(`B2 upload failed for ${key}: ${uploadResponse.status}`);
      if (!isRetryableB2Status(uploadResponse.status)) throw lastError;
    } catch (error) {
      lastError = error;
    }
    await sleep(B2_UPLOAD_RETRY_DELAYS_MS[attempt - 1] || 1000);
  }

  throw lastError instanceof Error ? lastError : new Error(`B2 upload failed for ${key}`);
}

async function acquireResizeLock() {
  if (activeResizes < MAX_CONCURRENT_RESIZES) {
    activeResizes++;
    return;
  }
  await new Promise<void>((resolve) => resizeQueue.push(resolve));
}

function releaseResizeLock() {
  activeResizes--;
  const next = resizeQueue.shift();
  if (next) {
    activeResizes++;
    next();
  }
}

function getB2KeyFromUrl(url: string) {
  const mediaDomain = getMediaDomain();
  const prefix = `https://${mediaDomain}/`;
  if (url.startsWith(prefix)) return decodeURIComponent(url.slice(prefix.length));
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    return "";
  }
}

mediaRouter.post("/get-upload-url", asyncRoute(async (request, response) => {
  const body = request.body || {};
  const scope = body.scope === "profile" ? "profile" : "event";
  const eventId = String(body.eventId || "");
  const resourceType = body.resourceType === "video" ? "video" : "image";
  const fileName = String(body.fileName || (scope === "profile" ? "profile.jpg" : "upload.jpg"));

  if (scope === "event" && !eventId.trim()) return jsonError(response, 400, "Missing eventId");

  const userId = await getUploadUserId(request);
  if (userId === "anonymous" && scope === "event" && !(await validateAnonymousEvent(eventId))) {
    return jsonError(response, 401, "Invalid event or unauthorized access");
  }

  const storageKey = buildStorageKey({ eventId, userId, resourceType, fileName, scope });
  const backblazeAuth = await getCachedBackblazeAuth();
  const b2UploadData = await getCachedUploadUrl(
    backblazeAuth,
    body.forceRefresh === true,
    typeof body.laneIndex === "number" ? body.laneIndex : 0,
  );

  response.json({
    uploadUrl: b2UploadData.uploadUrl,
    authorizationToken: b2UploadData.authorizationToken,
    storageKey,
    mediaDomain: getMediaDomain(),
  });
}));

mediaRouter.post("/upload/chunk/initiate", asyncRoute(async (request, response) => {
  const body = request.body || {};
  const scope = body.scope === "profile" ? "profile" : "event";
  const eventId = String(body.eventId || "");
  const requestedResourceType = String(body.resourceType || "video");
  const resourceType = requestedResourceType === "video" ? "video" : "image";
  const fileName = String(body.fileName || (scope === "profile" ? "profile.mp4" : "upload.mp4"));
  const contentType = String(body.contentType || (resourceType === "video" ? "video/mp4" : "image/jpeg"));

  if (scope === "event" && !eventId.trim()) return jsonError(response, 400, "Missing eventId");

  const userId = await getUploadUserId(request);
  if (userId === "anonymous" && scope === "event" && !(await validateAnonymousEvent(eventId))) {
    return jsonError(response, 401, "Invalid event or unauthorized access");
  }

  const storageKey = buildStorageKey({ eventId, userId, resourceType, fileName, scope });
  const backblazeAuth = await getCachedBackblazeAuth();
  const largeFileData = await startLargeFile(backblazeAuth, storageKey, contentType);

  response.json({ fileId: largeFileData.fileId, storageKey, mediaDomain: getMediaDomain() });
}));

mediaRouter.post("/upload/chunk/part-url", asyncRoute(async (request, response) => {
  const fileId = String(request.body?.fileId || "");
  if (!fileId.trim()) return jsonError(response, 400, "Missing fileId");

  const backblazeAuth = await getCachedBackblazeAuth();
  const partUrlData = await getUploadPartUrl(backblazeAuth, fileId);
  response.json({ uploadUrl: partUrlData.uploadUrl, authorizationToken: partUrlData.authorizationToken });
}));

mediaRouter.post("/upload/chunk/abort", asyncRoute(async (request, response) => {
  const fileId = String(request.body?.fileId || "");
  if (!fileId.trim()) return jsonError(response, 400, "Missing fileId");

  const backblazeAuth = await getCachedBackblazeAuth();
  await cancelLargeFile(backblazeAuth, fileId);
  response.json({ success: true });
}));

mediaRouter.post("/upload/chunk/complete", asyncRoute(async (request, response) => {
  const body = request.body || {};
  const fileId = String(body.fileId || "");
  const storageKey = String(body.storageKey || "");
  const eventId = String(body.eventId || "");
  const fileName = String(body.fileName || "");
  const fileSize = Number(body.fileSize || 0);
  const partSha1Array = Array.isArray(body.partSha1Array) ? body.partSha1Array : [];

  if (!fileId.trim() || !storageKey.trim() || !eventId.trim() || !partSha1Array.length) {
    return jsonError(response, 400, "Missing required parameters: fileId, storageKey, eventId, and partSha1Array are required.");
  }

  const userId = await getUploadUserId(request);
  if (userId === "anonymous" && !(await validateAnonymousEvent(eventId))) {
    return jsonError(response, 401, "Invalid event or unauthorized access");
  }

  const backblazeAuth = await getCachedBackblazeAuth();
  let finishResult: { contentLength?: number } = {};
  try {
    finishResult = await finishLargeFile(backblazeAuth, fileId, partSha1Array);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("No active upload for") && !message.includes("already_finished") && !message.includes("bad_request")) {
      throw error;
    }
  }

  const { row, url, photoId, isVideo } = toPhotoRow({
    storageKey,
    eventId,
    fileName,
    fileSize: fileSize || finishResult.contentLength || 0,
    userId,
    resourceType: body.resourceType,
  });

  const supabaseAdmin = getSupabaseAdminClient();
  const { error: dbError } = await supabaseAdmin.from("photos").upsert(row);
  if (dbError) return jsonError(response, 500, `Upload succeeded to storage but failed to save database record: ${dbError.message}`);

  if (isVideo) {
    background("CompleteChunkedUpload", () => publishVideoTranscodeTask({ id: photoId, storage_key: storageKey, event_id: eventId, url }, fileSize));
  }
  background("CompleteChunkedUploadNotify", () =>
    sendOwnerUploadNotification(
      eventId,
      userId,
      isVideo ? "🎥 New video uploaded" : "📸 New photo uploaded",
      `Someone added a ${isVideo ? "video" : "photo"} to your event`,
      { eventId },
    ),
  );

  response.json({
    success: true,
    url,
    publicId: storageKey,
    storageKey,
    fileId,
    fileName,
    bytes: fileSize || finishResult.contentLength || 0,
    mediaType: isVideo ? "video" : "photo",
    resourceType: isVideo ? "video" : "image",
    savedPhotoId: photoId,
  });
}));

mediaRouter.post("/save-photo", asyncRoute(async (request, response) => {
  const body = request.body || {};
  const storageKey = String(body.storageKey || "");
  const eventId = String(body.eventId || "");
  const fileName = String(body.fileName || "");
  const fileSize = Number(body.fileSize || 0);

  if (!storageKey) return jsonError(response, 400, "Missing storageKey");
  if (!eventId) return jsonError(response, 400, "Missing eventId");
  if (!fileName) return jsonError(response, 400, "Missing fileName");

  const userId = await getUploadUserId(request);
  if (userId === "anonymous" && !(await validateAnonymousEvent(eventId))) {
    return jsonError(response, 401, "Invalid event or unauthorized access");
  }

  const { row, url, photoId, isVideo } = toPhotoRow({ storageKey, eventId, fileName, fileSize, userId, resourceType: body.resourceType });
  const supabaseAdmin = getSupabaseAdminClient();
  const { error: dbError } = await supabaseAdmin.from("photos").upsert(row);

  if (dbError) {
    background("UploadRollback", () => rollbackB2Upload(storageKey, isVideo ? "video" : "image"));
    return jsonError(response, 500, `Failed to save to database: ${dbError.message}`);
  }

  background("SavePhotoNotify", () =>
    sendOwnerUploadNotification(eventId, userId, isVideo ? "🎥 New video uploaded" : "📸 New photo uploaded", `Someone added a ${isVideo ? "video" : "photo"} to your event`, { eventId }),
  );

  if (isVideo) {
    background("SavePhotoVideo", () => publishVideoTranscodeTask({ id: photoId, storage_key: storageKey, event_id: eventId, url }, fileSize));
  } else {
    background("SavePhotoResize", async () => {
      await publishResizeTask({ storageKey, origin: getRequestOrigin(request) });
    });
  }

  response.json({ success: true, url, photoId });
}));

mediaRouter.post("/save-photo-batch", asyncRoute(async (request, response) => {
  const photos = request.body?.photos;
  if (!Array.isArray(photos) || photos.length === 0) return jsonError(response, 400, "Missing photos array");

  const userId = await getUploadUserId(request);
  const upsertRows: unknown[] = [];
  const imagePayloads: PhotoPayload[] = [];
  const videoPayloads: Array<PhotoPayload & { fileSize?: number }> = [];
  let firstEventId = "";

  for (const photo of photos) {
    const storageKey = String(photo.storageKey || "");
    const eventId = String(photo.eventId || "");
    const fileName = String(photo.fileName || "");
    const fileSize = Number(photo.fileSize || 0);
    if (!storageKey || !eventId || !fileName) continue;
    if (!firstEventId) firstEventId = eventId;

    const { row, url, photoId, isVideo } = toPhotoRow({ storageKey, eventId, fileName, fileSize, userId, resourceType: photo.resourceType });
    upsertRows.push(row);
    if (isVideo && !photo.skipTranscode) {
      videoPayloads.push({ id: photoId, storage_key: storageKey, event_id: eventId, url, fileSize });
    } else if (!isVideo) {
      imagePayloads.push({ id: photoId, storage_key: storageKey, event_id: eventId, url, width: null, height: null });
    }
  }

  if (upsertRows.length === 0) return jsonError(response, 400, "No valid photos in batch");

  const supabaseAdmin = getSupabaseAdminClient();
  const { error: dbError } = await supabaseAdmin.from("photos").upsert(upsertRows);
  if (dbError) return jsonError(response, 500, `Failed to save database records: ${dbError.message}`);

  for (const video of videoPayloads) {
    background("SavePhotoBatchVideo", () => publishVideoTranscodeTask(video, video.fileSize));
  }

  if (imagePayloads.length > 0) {
    background("SavePhotoBatchResize", async () => {
      for (const photo of imagePayloads) {
        await publishResizeTask({ storageKey: photo.storage_key, origin: getRequestOrigin(request) });
      }
      if (firstEventId) await publishDelayedModalTrigger(firstEventId, getRequestOrigin(request));
    });
  }

  if (firstEventId) {
    background("SavePhotoBatchNotify", () =>
      sendOwnerUploadNotification(firstEventId, userId, "📸 New photos uploaded", `Someone added ${upsertRows.length} photos to your event`, { eventId: firstEventId }),
    );
  }

  response.json({ success: true, processed: upsertRows.length });
}));

mediaRouter.post("/process-thumbnail", asyncRoute(async (request, response) => {
  const storageKey = String(request.body?.storageKey || "");
  if (!storageKey) return jsonError(response, 400, "Missing storageKey");

  let locked = false;
  try {
    await acquireResizeLock();
    locked = true;

    const supabaseAdmin = getSupabaseAdminClient();
    const backblazeAuth = await getCachedBackblazeAuth();
    const bucketId = requireEnv("B2_BUCKET_ID");
    const bucketName = requireEnv("B2_BUCKET_NAME");
    const mediaDomain = getMediaDomain();
    const encodedStorageKey = storageKey.split("/").map(encodeURIComponent).join("/");
    const downloadUrl = `${backblazeAuth.downloadUrl}/file/${bucketName}/${encodedStorageKey}`;
    const downloadResponse = await fetchB2WithRetries(
      downloadUrl,
      { headers: { Authorization: backblazeAuth.authorizationToken } },
      `B2 original download for ${storageKey}`,
      B2_DOWNLOAD_RETRY_DELAYS_MS,
    );

    const bufferBytes = Buffer.from(await downloadResponse.arrayBuffer());
    const metadata = await sharp(bufferBytes).rotate().metadata();
    const thumbnailBuffer = await sharp(bufferBytes)
      .rotate()
      .resize({ width: 400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();
    const previewBuffer = await sharp(bufferBytes)
      .rotate()
      .resize({ width: 3000, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 75 })
      .toBuffer();

    const thumbnailKey = `${storageKey}-thumbnail.webp`;
    const previewKey = `${storageKey}-preview.webp`;
    await uploadBufferToB2(backblazeAuth, bucketId, thumbnailBuffer, thumbnailKey, "image/webp");
    await uploadBufferToB2(backblazeAuth, bucketId, previewBuffer, previewKey, "image/webp");

    const thumbnailUrl = `https://${mediaDomain}/${thumbnailKey}`;
    const previewUrl = `https://${mediaDomain}/${previewKey}`;
    const { data, error: updateError } = await supabaseAdmin
      .from("photos")
      .update({
        thumbnail_url: thumbnailUrl,
        preview_url: previewUrl,
        width: metadata.width || null,
        height: metadata.height || null,
      })
      .eq("storage_key", storageKey)
      .select("id")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!data) return jsonError(response, 404, "Photo row not found for thumbnail update");

    response.json({ success: true, thumbnailUrl, previewUrl });
  } finally {
    if (locked) releaseResizeLock();
  }
}));

mediaRouter.post("/trigger-modal-batch", asyncRoute(async (request, response) => {
  const eventId = String(request.body?.eventId || request.query.eventId || "");
  const supabaseAdmin = getSupabaseAdminClient();
  let query = supabaseAdmin
    .from("photos")
    .select("id, storage_key, event_id, preview_url, thumbnail_url, url")
    .eq("media_type", "photo")
    .eq("face_indexed", false)
    .not("thumbnail_url", "is", null)
    .limit(100);
  if (eventId) query = query.eq("event_id", eventId);

  const { data: photos, error } = await query;
  if (error) throw error;

  const payload = (photos || []).map((photo) => ({
    id: photo.id,
    storage_key: photo.storage_key,
    event_id: photo.event_id,
    url: photo.preview_url || photo.thumbnail_url || photo.url,
  }));

  if (payload.length > 0) {
    background("TriggerModalBatch", () => publishModalBatchTask(payload));
  }

  response.json({ success: true, queued: payload.length });
}));

mediaRouter.get("/indexing-status", asyncRoute(async (request, response) => {
  const eventId = String(request.query.eventId || "");
  if (!eventId) return jsonError(response, 400, "Missing eventId");

  const supabaseAdmin = getSupabaseAdminClient();
  const [{ count: total, error: totalError }, { count: indexed, error: indexedError }, { count: ready, error: readyError }] = await Promise.all([
    supabaseAdmin.from("photos").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("media_type", "photo"),
    supabaseAdmin.from("photos").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("media_type", "photo").eq("face_indexed", true),
    supabaseAdmin.from("photos").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("media_type", "photo").not("thumbnail_url", "is", null),
  ]);
  if (totalError || indexedError || readyError) throw totalError || indexedError || readyError;

  response.json({ total: total || 0, indexed: indexed || 0, ready: ready || 0 });
}));

mediaRouter.post("/delete", asyncRoute(async (request, response) => {
  const user = await requireUser(request, response);
  if (!user) return;

  const photoId = String(request.body?.photoId || "");
  if (!photoId) return jsonError(response, 400, "Missing photoId");

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: photo, error: photoError } = await supabaseAdmin.from("photos").select("*").eq("id", photoId).maybeSingle();
  if (photoError) throw photoError;
  if (!photo) return jsonError(response, 404, "Photo not found");
  const savedPhoto = photo as SavedPhoto;

  const { data: event, error: eventError } = await supabaseAdmin.from("events").select("created_by").eq("id", savedPhoto.event_id).maybeSingle();
  if (eventError) throw eventError;

  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAuthorized = event?.created_by === user.id || savedPhoto.user_id === user.id || profile?.role === "admin" || profile?.role === "super_admin";
  if (!isAuthorized) return jsonError(response, 403, "Not authorized to delete this media");

  const backblazeAuth = await getCachedBackblazeAuth();
  const bucketId = requireEnv("B2_BUCKET_ID");
  await Promise.all([
    deleteB2File(backblazeAuth, bucketId, savedPhoto.storage_key),
    deleteB2File(backblazeAuth, bucketId, `${savedPhoto.storage_key}-thumbnail.webp`),
    deleteB2File(backblazeAuth, bucketId, `${savedPhoto.storage_key}-preview.webp`),
    deleteB2Prefix(backblazeAuth, bucketId, `${savedPhoto.storage_key}-hls/`),
  ]);

  await supabaseAdmin.from("photo_faces").delete().eq("photo_id", savedPhoto.id);
  const { error: deleteError } = await supabaseAdmin.from("photos").delete().eq("id", savedPhoto.id);
  if (deleteError) throw deleteError;

  response.json({ success: true });
}));

mediaRouter.post("/profile-image", asyncRoute(async (request, response) => {
  const user = await requireUser(request, response);
  if (!user) return;

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await supabaseAdmin.from("profiles").select("profile_image").eq("id", user.id).maybeSingle();
  if (profileError) throw profileError;

  const deletedFiles: string[] = [];
  if (profile?.profile_image) {
    const storageKey = getB2KeyFromUrl(profile.profile_image);
    if (storageKey && storageKey.startsWith(`profiles/${user.id}/`)) {
      const backblazeAuth = await getCachedBackblazeAuth();
      const bucketId = requireEnv("B2_BUCKET_ID");
      for (const key of [storageKey, `${storageKey}-thumbnail.webp`, `${storageKey}-preview.webp`]) {
        if (await deleteB2File(backblazeAuth, bucketId, key)) deletedFiles.push(key);
      }
    }
  }

  const { error: updateError } = await supabaseAdmin.from("profiles").update({ profile_image: null }).eq("id", user.id);
  if (updateError) throw updateError;

  response.json({ success: true, deletedFiles });
}));

mediaRouter.post("/rotate", asyncRoute(async (request, response) => {
  const user = await requireUser(request, response);
  if (!user) return;

  const photoId = String(request.body?.photoId || "");
  const direction = request.body?.direction;
  if (!photoId) return jsonError(response, 400, "Missing photoId");

  const angle = direction === "left" ? -90 : direction === "right" ? 90 : Number(direction);
  if (![90, -90, 180, -180, 270, -270].includes(angle)) {
    return jsonError(response, 400, "Invalid rotation direction");
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: photo, error: photoError } = await supabaseAdmin
    .from("photos")
    .select("*")
    .eq("id", photoId)
    .maybeSingle();

  if (photoError) throw photoError;
  if (!photo) return jsonError(response, 404, "Photo not found");
  const savedPhoto = photo as SavedPhoto;

  const isVideo = savedPhoto.media_type === "video" || savedPhoto.resource_type === "video";
  if (isVideo) return jsonError(response, 400, "Videos cannot be rotated from this tool");
  if (!savedPhoto.storage_key || !savedPhoto.url) return jsonError(response, 400, "Photo storage details are missing");

  const { data: event, error: eventError } = await supabaseAdmin
    .from("events")
    .select("created_by")
    .eq("id", savedPhoto.event_id)
    .maybeSingle();
  if (eventError) throw eventError;

  const { data: profile } = await supabaseAdmin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAuthorized = event?.created_by === user.id || savedPhoto.user_id === user.id || profile?.role === "admin" || profile?.role === "super_admin";
  if (!isAuthorized) return jsonError(response, 403, "Forbidden: You do not have permission to rotate this photo");

  console.log("[MediaRotate] Starting", {
    photoId,
    angle,
    storageKey: savedPhoto.storage_key,
    mediaType: savedPhoto.media_type,
  });

  console.log("[MediaRotate] Downloading original image");
  const downloadResponse = await fetchB2WithRetries(savedPhoto.url, {}, "Download original image for rotation", B2_DOWNLOAD_RETRY_DELAYS_MS);
  const originalBytes = Buffer.from(await downloadResponse.arrayBuffer());

  console.log("[MediaRotate] Processing image", { bytes: originalBytes.length });
  const rotated = await sharp(originalBytes).rotate(angle).toBuffer({ resolveWithObject: true });
  const rotatedBuffer = rotated.data;
  const rotatedMetadata = rotated.info;
  const thumbnailBuffer = await sharp(rotatedBuffer)
    .resize({ width: 400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();
  const previewBuffer = await sharp(rotatedBuffer)
    .resize({ width: 900, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 75 })
    .toBuffer();

  const backblazeAuth = await getCachedBackblazeAuth();
  const bucketId = requireEnv("B2_BUCKET_ID");
  const mediaDomain = getMediaDomain();
  const storageKey = savedPhoto.storage_key;
  const thumbnailKey = `${storageKey}-thumbnail.webp`;
  const previewKey = `${storageKey}-preview.webp`;
  const url = `https://${mediaDomain}/${storageKey}`;
  const thumbnailUrl = `https://${mediaDomain}/${thumbnailKey}`;
  const previewUrl = `https://${mediaDomain}/${previewKey}`;
  const contentType = inferContentType(storageKey);

  const oldVersions = await Promise.all([
    listExactFileVersions(backblazeAuth, bucketId, storageKey),
    listExactFileVersions(backblazeAuth, bucketId, thumbnailKey),
    listExactFileVersions(backblazeAuth, bucketId, previewKey),
  ]);

  console.log("[MediaRotate] Uploading rotated variants", {
    originalBytes: rotatedBuffer.length,
    thumbnailBytes: thumbnailBuffer.length,
    previewBytes: previewBuffer.length,
  });
  await Promise.all([
    uploadBufferToB2(backblazeAuth, bucketId, rotatedBuffer, storageKey, contentType),
    uploadBufferToB2(backblazeAuth, bucketId, thumbnailBuffer, thumbnailKey, "image/webp"),
    uploadBufferToB2(backblazeAuth, bucketId, previewBuffer, previewKey, "image/webp"),
  ]);

  console.log("[MediaRotate] Removing old B2 versions", { count: oldVersions.flat().length });
  await Promise.all(oldVersions.flat().map((file) => deleteB2FileVersion(backblazeAuth, file)));

  console.log("[MediaRotate] Updating photo record");
  const { error: updateError } = await supabaseAdmin
    .from("photos")
    .update({
      url,
      thumbnail_url: thumbnailUrl,
      preview_url: previewUrl,
      width: rotatedMetadata.width || null,
      height: rotatedMetadata.height || null,
      size: rotatedBuffer.length,
    })
    .eq("id", photoId);
  if (updateError) throw updateError;

  console.log("[MediaRotate] Completed", { photoId, width: rotatedMetadata.width, height: rotatedMetadata.height });

  response.json({
    success: true,
    url,
    thumbnailUrl,
    previewUrl,
    width: rotatedMetadata.width || null,
    height: rotatedMetadata.height || null,
    size: rotatedBuffer.length,
    cacheBuster: Date.now(),
  });
}));

mediaRouter.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
  void next;
  console.error("[MediaRouter] Error:", error);
  jsonError(response, 500, error instanceof Error ? error.message : "Media request failed");
});

import { getSupabaseAdminClient } from "./supabase.js";

type PhotoPayload = {
  id: string;
  storage_key: string;
  event_id: string;
  url: string;
  width?: number | null;
  height?: number | null;
  user_id?: string;
  fileSize?: number;
  size?: number;
  duration?: number;
};

type QStashPublishOptions = {
  storageKey: string;
  origin?: string;
};

function getInternalJobSecret() {
  return (
    process.env.INTERNAL_JOB_SECRET ||
    process.env.CRON_SECRET ||
    process.env.QSTASH_TOKEN ||
    ""
  ).trim();
}

function getInternalJobForwardHeaders() {
  const secret = getInternalJobSecret();
  if (!secret) {
    throw new Error("INTERNAL_JOB_SECRET, CRON_SECRET, or QSTASH_TOKEN must be configured");
  }
  return { "Upstash-Forward-Authorization": `Bearer ${secret}` };
}

function getBackendBaseUrl(origin?: string) {
  const explicitApiUrl = (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (explicitApiUrl) return explicitApiUrl;

  const railwayUrl = (process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL || "")
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  if (railwayUrl) return `https://${railwayUrl}`;

  if (origin && !origin.includes("localhost") && !origin.includes("127.0.0.1")) {
    return origin.replace(/\/+$/, "");
  }

  return "http://localhost:8080";
}

export async function publishModalBatchTask(
  photos: (PhotoPayload & { fileSize?: number; size?: number })[],
): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    console.warn("[QStash] QSTASH_TOKEN is not configured. Background media processing will not run.");
    return false;
  }

  const targetUrl = (
    process.env.MODAL_MEDIA_BATCH_URL ||
    "https://shwetank-sarthak--wedding-media-engine-process-media-batch.modal.run"
  ).trim();
  console.log(`[QStash] Publishing batch media task for ${photos.length} photos to Modal`);

  try {
    const response = await fetch(`https://qstash-us-east-1.upstash.io/v2/publish/${targetUrl}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        "Content-Type": "application/json",
        "Upstash-Timeout": "120s",
      },
      body: JSON.stringify({ photos }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QStash publish failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`[QStash] Successfully published task to Modal. Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error("[QStash] Error publishing Modal media task:", error);
    return false;
  }
}

export async function publishInternalJob(
  endpoint: string,
  payload: Record<string, unknown>,
  origin?: string,
): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    console.warn("[QStash] QSTASH_TOKEN is not configured. Internal job will not run.");
    return false;
  }

  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  const targetUrl = `${getBackendBaseUrl(origin)}/api/jobs/${cleanEndpoint}`;
  console.log(`[QStash] Publishing internal job to target: ${targetUrl}`);

  try {
    const response = await fetch(`https://qstash-us-east-1.upstash.io/v2/publish/${targetUrl}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        "Content-Type": "application/json",
        "Upstash-Timeout": "120s",
        ...getInternalJobForwardHeaders(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QStash publishInternalJob failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`[QStash] Successfully published internal job. Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error("[QStash] Error publishing internal job:", error);
    return false;
  }
}

export async function publishDelayedModalTrigger(eventId: string, origin?: string): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    console.warn("[QStash] QSTASH_TOKEN is not configured. Delayed modal trigger will not run.");
    return false;
  }

  const targetUrl = `${getBackendBaseUrl(origin)}/api/media/trigger-modal-batch`;
  console.log(`[QStash] Publishing delayed modal trigger for event ${eventId} targeting: ${targetUrl}`);

  try {
    const response = await fetch(`https://qstash-us-east-1.upstash.io/v2/publish/${targetUrl}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        "Content-Type": "application/json",
        "Upstash-Delay": "2m",
        "Upstash-Deduplication-Id": `modal-batch-trigger-${eventId}`,
        ...getInternalJobForwardHeaders(),
      },
      body: JSON.stringify({ eventId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QStash publish failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`[QStash] Successfully scheduled delayed trigger for event ${eventId}. Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error(`[QStash] Error publishing delayed trigger for event ${eventId}:`, error);
    return false;
  }
}

export async function publishVideoTranscodeTask(
  payload: PhotoPayload & { fileSize?: number; duration?: number; user_id?: string },
  fileSize?: number,
): Promise<boolean> {
  return publishManifestAssemblyTask({
    id: payload.id,
    photo_id: payload.id,
    storage_key: payload.storage_key,
    event_id: payload.event_id,
    url: payload.url,
    duration: payload.duration,
    fileSize: payload.fileSize ?? fileSize,
    user_id: payload.user_id,
  });
}

export async function publishManifestAssemblyTask(payload: {
  id: string;
  photo_id?: string;
  storage_key: string;
  event_id: string;
  url?: string;
  total_segments?: number;
  duration?: number;
  fileSize?: number;
  user_id?: string;
}): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  const photoId = payload.photo_id || payload.id;

  let duration = payload.duration;
  let fileSize = payload.fileSize;
  let userId = payload.user_id;

  // If duration, fileSize, or userId is missing or anonymous, fetch latest metadata from database
  if ((!duration || duration <= 0 || !fileSize || !userId || userId === "anonymous") && (photoId || payload.event_id)) {
    try {
      const supabaseAdmin = getSupabaseAdminClient();
      if (photoId) {
        const { data } = await supabaseAdmin
          .from("photos")
          .select("duration, size, user_id, event_id")
          .eq("id", photoId)
          .maybeSingle();
        if (data) {
          if ((!duration || duration <= 0) && data.duration) {
            duration = Number(data.duration);
          }
          if (!fileSize && data.size) {
            fileSize = Number(data.size);
          }
          if ((!userId || userId === "anonymous") && data.user_id && data.user_id !== "anonymous") {
            userId = data.user_id;
          }
          if (!payload.event_id && data.event_id) {
            payload.event_id = data.event_id;
          }
        }
      }

      // If still missing or anonymous, resolve from event owner
      if ((!userId || userId === "anonymous") && payload.event_id) {
        const { data: eventData } = await supabaseAdmin
          .from("events")
          .select("created_by")
          .eq("id", payload.event_id)
          .maybeSingle();
        if (eventData?.created_by) {
          userId = eventData.created_by;
        }
      }
    } catch {
      // Non-blocking lookup
    }
  }

  // Exact Routing Rule:
  // - Video <= 10 min (600 seconds) -> CPU worker (process_video_cpu)
  // - Video > 10 min (600 seconds) -> GPU worker (process_video_gpu)
  let isLongVideo = false;
  if (duration && duration > 0) {
    isLongVideo = duration > 600; // strictly > 10 minutes (600 seconds)
  } else if (fileSize && fileSize > 0) {
    // Fallback if duration is unknown before extraction:
    // At standard 1080p video bitrate (~4.5 Mbps), 10 minutes is ~340 MB
    isLongVideo = fileSize > 350 * 1024 * 1024;
  }

  const targetUrl = isLongVideo
    ? (process.env.MODAL_GPU_WEBHOOK_URL || "https://shwetank-sarthak--wedding-media-engine-process-video-gpu.modal.run").trim()
    : (process.env.MODAL_CPU_WEBHOOK_URL || "https://shwetank-sarthak--wedding-media-engine-process-video-cpu.modal.run").trim();

  console.log(
    `[VideoRouting] ${photoId}: duration=${duration ? `${duration}s` : 'unknown'}, size=${fileSize ? `${(fileSize / (1024 * 1024)).toFixed(1)}MB` : 'unknown'} -> ${
      isLongVideo ? 'GPU worker (process_video_gpu > 10m)' : 'CPU worker (process_video_cpu <= 10m)'
    }`
  );

  // Ensure both `id` and `photo_id` are populated
  const normalizedPayload = {
    ...payload,
    id: payload.id,
    photo_id: photoId,
    user_id: userId,
    fileSize: fileSize,
    duration: duration,
  };

  // Direct invocation fallback if QStash is not configured
  if (!qstashToken) {
    console.warn("[QStash] QSTASH_TOKEN is not configured. Invoking assemble_fmp4_manifest directly...");
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizedPayload),
      });
      return response.ok;
    } catch (directErr) {
      console.error("[Modal Direct] Failed to trigger assemble_fmp4_manifest:", directErr);
      return false;
    }
  }

  // Sanitize key for QStash deduplication ID (alphanumeric, -, _)
  const cleanKey = (payload.storage_key || payload.id).replace(/[^a-zA-Z0-9_-]/g, "-");
  const deduplicationId = `video-transcode-${cleanKey}`;

  console.log(`[QStash] Publishing assemble_fmp4_manifest task for ${payload.storage_key} (dedup: ${deduplicationId})`);

  const queueName = (process.env.QSTASH_QUEUE_NAME || "EveBash").trim();
  const enqueueEndpoint = `https://qstash-us-east-1.upstash.io/v2/enqueue/${queueName}/${targetUrl}`;

  try {
    const response = await fetch(enqueueEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        "Content-Type": "application/json",
        // ── 1. Match Modal's 900s execution timeout (BUG-3 fix) ───────────
        "Upstash-Timeout": "900s",
        // ── 2. Deduplicate: prevent duplicate concurrent runs (BUG-4 fix) ─
        "Upstash-Deduplication-Id": deduplicationId,
        // ── 3. Retry on 5xx or network drop with exponential backoff ─────
        "Upstash-Retries": "3",
      },
      body: JSON.stringify(normalizedPayload),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[QStash] Publish returned status ${response.status}: ${errText}`);
      return false;
    }

    const result = await response.json().catch(() => ({}));
    console.log(`[QStash] Task published successfully. Message ID: ${result.messageId || "ok"}`);
    return true;
  } catch (error) {
    console.error("[QStash] Error publishing assemble_fmp4_manifest task:", error);
    return false;
  }
}




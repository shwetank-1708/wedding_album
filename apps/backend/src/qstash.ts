type PhotoPayload = {
  id: string;
  storage_key: string;
  event_id: string;
  url: string;
  width?: number | null;
  height?: number | null;
};

type QStashPublishOptions = {
  storageKey: string;
  origin?: string;
};

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
  photos: { id: string; storage_key: string; event_id: string; url: string }[],
): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    console.warn("[QStash] QSTASH_TOKEN is not configured. Background media processing will not run.");
    return false;
  }

  const targetUrl = "https://shwetank-sarthak--wedding-media-engine-process-media-batch.modal.run";
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

export async function publishResizeTask(options: QStashPublishOptions): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    console.warn("[QStash] QSTASH_TOKEN is not configured. Background resizing will not run.");
    return false;
  }

  const targetUrl = `${getBackendBaseUrl(options.origin)}/api/media/process-thumbnail`;
  console.log(`[QStash] Publishing resize task for ${options.storageKey} to target: ${targetUrl}`);

  try {
    const response = await fetch(`https://qstash-us-east-1.upstash.io/v2/publish/${targetUrl}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        "Content-Type": "application/json",
        "Upstash-Timeout": "120s",
      },
      body: JSON.stringify({ storageKey: options.storageKey }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QStash publish failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`[QStash] Successfully published resize task. Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error("[QStash] Error publishing resize task:", error);
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
  payload: PhotoPayload,
  fileSize?: number,
): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  let targetUrl = "https://shwetank-sarthak--wedding-media-engine-process-video-tra-78d23c.modal.run";

  if (fileSize) {
    if (fileSize > 1024 * 1024 * 1024) {
      targetUrl = "https://shwetank-sarthak--wedding-media-engine-process-video-tra-1aa355.modal.run";
    } else if (fileSize > 100 * 1024 * 1024) {
      targetUrl = "https://shwetank-sarthak--wedding-media-engine-process-video-tra-e1dce7.modal.run";
    }
  }

  if (!qstashToken) {
    console.warn("[QStash] QSTASH_TOKEN is not configured. Falling back to direct Modal invocation...");
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo_id: payload.id,
          storage_key: payload.storage_key,
          event_id: payload.event_id,
          url: payload.url,
        }),
      });
      return response.ok;
    } catch (directErr) {
      console.error("[Modal Direct] Failed to directly trigger Modal worker:", directErr);
      return false;
    }
  }

  console.log(`[QStash] Publishing video transcode task for ${payload.storage_key} to Modal target: ${targetUrl}`);

  try {
    const response = await fetch(`https://qstash-us-east-1.upstash.io/v2/publish/${targetUrl}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        photo_id: payload.id,
        storage_key: payload.storage_key,
        event_id: payload.event_id,
        url: payload.url,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`QStash video publish failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`[QStash] Successfully published video transcode task. Message ID: ${result.messageId}`);
    return true;
  } catch (error) {
    console.error("[QStash] Error publishing video transcode task:", error);
    return false;
  }
}

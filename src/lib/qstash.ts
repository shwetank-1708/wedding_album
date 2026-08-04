/**
 * Upstash QStash helper utility
 * Uses simple fetch to publish tasks to QStash without adding external dependencies.
 */

interface PhotoPayload {
  id: string;
  storage_key: string;
  event_id: string;
  url: string;
  width: number | null;
  height: number | null;
}

interface QStashPublishOptions {
  storageKey: string;
  origin?: string;
}

export async function publishModalBatchTask(photos: { id: string; storage_key: string; event_id: string; url: string }[]): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  if (!qstashToken) {
    console.warn("[QStash] QSTASH_TOKEN is not configured. Background media processing will not run.");
    return false;
  }

  // The new Modal.com serverless endpoint
  const targetUrl = "https://shwetank-sarthak--wedding-media-engine-process-media-batch.modal.run";

  console.log(`[QStash] Publishing batch media task for ${photos.length} photos to Modal`);

  try {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${qstashToken}`,
      "Content-Type": "application/json",
      // Adding a large timeout header to QStash since Modal might take 1-2 minutes for a massive batch
      "Upstash-Timeout": "120s"
    };

    const response = await fetch(`https://qstash-us-east-1.upstash.io/v2/publish/${targetUrl}`, {
      method: "POST",
      headers,
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
    console.warn("[QStash] QSTASH_TOKEN is not configured. Background resizing will run synchronously or fall back to sweeper.");
    return false;
  }

  const railwayUrl = process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : null;
  const isLocalOrigin = options.origin && (
    options.origin.includes('localhost') || 
    options.origin.includes('127.0.0.1') || 
    options.origin.includes('192.168.') || 
    options.origin.startsWith('http://10.')
  );

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, "");
  
  const siteUrl = (!options.origin || isLocalOrigin)
    ? (process.env.NEXT_PUBLIC_SITE_URL || railwayUrl || `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'}`)
    : (apiUrl || options.origin);
    
  const targetUrl = `${siteUrl}/api/media/process-thumbnail`;

  console.log(`[QStash] Publishing resize task for ${options.storageKey} to target: ${targetUrl}`);

  try {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${qstashToken}`,
      "Content-Type": "application/json",
      "Upstash-Timeout": "120s",
    };

    const response = await fetch(`https://qstash-us-east-1.upstash.io/v2/publish/${targetUrl}`, {
      method: "POST",
      headers,
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

  const railwayUrl = process.env.RAILWAY_STATIC_URL ? `https://${process.env.RAILWAY_STATIC_URL}` : null;
  const isLocalOrigin = origin && (
    origin.includes('localhost') || 
    origin.includes('127.0.0.1') || 
    origin.includes('192.168.') || 
    origin.startsWith('http://10.')
  );
  
  const siteUrl = (!origin || isLocalOrigin)
    ? (process.env.NEXT_PUBLIC_SITE_URL || railwayUrl || `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'}`)
    : origin;
    
  const targetUrl = `${siteUrl}/api/media/trigger-modal-batch`;

  console.log(`[QStash] Publishing delayed modal trigger for event ${eventId} targeting: ${targetUrl}`);

  try {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${qstashToken}`,
      "Content-Type": "application/json",
      "Upstash-Delay": "2m",
      "Upstash-Deduplication-Id": `modal-batch-trigger-${eventId}`
    };

    const response = await fetch(`https://qstash-us-east-1.upstash.io/v2/publish/${targetUrl}`, {
      method: "POST",
      headers,
      body: JSON.stringify({ eventId })
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

export async function publishVideoTranscodeTask(payload: { id: string; storage_key: string; event_id: string; url?: string }, fileSize?: number): Promise<boolean> {
  const qstashToken = process.env.QSTASH_TOKEN;
  let targetUrl = "https://shwetank-sarthak--wedding-media-engine-process-video-tra-78d23c.modal.run";
  let timeout = "300s";

  if (fileSize) {
    if (fileSize > 1024 * 1024 * 1024) {
      // Large tier (> 1 GB): 20 min timeout
      targetUrl = "https://shwetank-sarthak--wedding-media-engine-process-video-tra-1aa355.modal.run";
      timeout = "1200s";
    } else if (fileSize > 100 * 1024 * 1024) {
      // Medium tier (> 100 MB): 10 min timeout
      targetUrl = "https://shwetank-sarthak--wedding-media-engine-process-video-tra-e1dce7.modal.run";
      timeout = "600s";
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
          url: payload.url
        }),
      });
      console.log(`[Modal Direct] Directly triggered Modal video transcode worker. Target: ${targetUrl}, Status: ${response.status}`);
      return response.ok;
    } catch (directErr) {
      console.error("[Modal Direct] Failed to directly trigger Modal worker:", directErr);
      return false;
    }
  }

  console.log(`[QStash] Publishing video transcode task for ${payload.storage_key} to Modal target: ${targetUrl} (fileSize: ${fileSize || 'unknown'})`);

  try {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${qstashToken}`,
      "Content-Type": "application/json",
      "Upstash-Timeout": timeout
    };

    const response = await fetch(`https://qstash-us-east-1.upstash.io/v2/publish/${targetUrl}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        photo_id: payload.id,
        storage_key: payload.storage_key,
        event_id: payload.event_id,
        url: payload.url
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


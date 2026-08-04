import { NextRequest, NextResponse, after } from "next/server";
import { publishResizeTask, publishDelayedModalTrigger, publishVideoTranscodeTask } from "@/lib/qstash";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

// Simple token cache to avoid verifying thousands of times
const tokenCache = new Map<string, { userId: string; expiresAt: number }>();

async function verifySupabaseUser(accessToken: string) {
  const cached = tokenCache.get(accessToken);
  if (cached && Date.now() < cached.expiresAt) {
    return { id: cached.userId };
  }

  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "");
  const supabaseAnonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
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

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { photos } = body; // Expected to be an array of photos

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return jsonResponse({ error: "Missing photos array" }, 400);
    }

    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    let userId = "anonymous";
    if (accessToken) {
      const user = await verifySupabaseUser(accessToken);
      if (user) {
        userId = user.id;
      }
    }

    const supabaseAdmin = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const mediaDomain = (
      process.env.MEDIA_DOMAIN ||
      process.env.CLOUDFLARE_DOMAIN ||
      process.env.NEXT_PUBLIC_MEDIA_DOMAIN ||
      ""
    ).trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

    if (!mediaDomain) {
      throw new Error("MEDIA_DOMAIN or CLOUDFLARE_DOMAIN is not configured");
    }

    // Prepare batch upsert payload for Supabase and batch payload for Modal
    const upsertDataArray: any[] = [];
    const modalPayloadArray: any[] = [];
    const videoPayloadArray: any[] = [];
    let firstEventId = null;

    for (const photo of photos) {
      const { storageKey, eventId, fileName, fileSize, resourceType } = photo;
      
      if (!storageKey || !eventId || !fileName) {
        continue; // Skip invalid entries
      }
      if (!firstEventId) firstEventId = eventId;

      const url = `https://${mediaDomain}/${storageKey}`;
      const isVideo = resourceType === "video" || !!fileName.match(/\.(mp4|mov|avi|mkv|webm)$/i);
      const actualResourceType = isVideo ? "video" : "image";
      const mediaType = isVideo ? "video" : "photo";
      const photoId = storageKey.replace(/\//g, "_");

      upsertDataArray.push({
        id: photoId,
        event_id: eventId,
        storage_key: storageKey,
        url: url,
        height: null,
        width: null,
        uploaded_at: new Date().toISOString(),
        tags: [],
        user_id: userId,
        size: Number(fileSize) || 0,
        format: fileName.split(".").pop()?.toLowerCase() || "jpg",
        media_type: mediaType,
        resource_type: actualResourceType
      });

      if (actualResourceType === "image") {
        modalPayloadArray.push({
          id: photoId,
          storage_key: storageKey,
          event_id: eventId,
          url: url,
          width: null,
          height: null
        });
      } else if (actualResourceType === "video" && !photo.skipTranscode) {
        // Only trigger transcode here for small videos (<100MB direct uploads).
        // Large chunked uploads (>100MB) are already triggered by upload/chunk/complete.
        videoPayloadArray.push({
          id: photoId,
          storage_key: storageKey,
          event_id: eventId,
          url: url,
          fileSize: Number(fileSize) || 0
        });
      } else if (actualResourceType === "video" && photo.skipTranscode) {
        console.log(`[SavePhotoBatch] Skipping transcode trigger for ${storageKey} — already triggered by chunk/complete`);
      }
    }

    if (upsertDataArray.length === 0) {
      return jsonResponse({ error: "No valid photos in batch" }, 400);
    }

    // 1. Batch Upsert to Supabase
    console.log(`[SavePhotoBatch] Writing ${upsertDataArray.length} DB records...`);
    const { error: dbError } = await supabaseAdmin.from("photos").upsert(upsertDataArray);

    if (dbError) {
      console.error(`[SavePhotoBatch] Database save failed:`, dbError);
      return jsonResponse({ error: `Failed to save database records: ${dbError.message}` }, 500);
    }

    // 2. Notify event owner (only once for the batch)
    if (firstEventId && userId && userId !== "anonymous") {
      after(() => {
        (async () => {
          const { data: event, error: eventErr } = await supabaseAdmin
            .from('events')
            .select('created_by, title')
            .eq('id', firstEventId)
            .maybeSingle();

          if (!eventErr && event?.created_by && event.created_by !== userId) {
            const { sendPushNotification } = await import("@/lib/pushNotifications");
            await sendPushNotification(
              event.created_by,
              '📸 New photos uploaded',
              `Someone added ${upsertDataArray.length} photos to "${event.title}"`,
              { eventId: firstEventId }
            );
          }
        })().catch(console.error);
      });
    }

    if (videoPayloadArray.length > 0) {
      console.log(`[SavePhotoBatch] Queuing batch of ${videoPayloadArray.length} videos to Modal transcoding`);
      for (const video of videoPayloadArray) {
        try {
          await publishVideoTranscodeTask(video, video.fileSize);
        } catch (err) {
          console.error(`[SavePhotoBatch] Error publishing video transcode task for ${video.storage_key}:`, err);
        }
      }
    }

    if (modalPayloadArray.length > 0) {
      after(() => {
        console.log(`[SavePhotoBatch] Queuing batch of ${modalPayloadArray.length} photos to local resizing via QStash`);
        for (const photo of modalPayloadArray) {
          publishResizeTask({ storageKey: photo.storage_key, origin: request.nextUrl.origin }).catch((err) => {
            console.error(`[SavePhotoBatch] Error publishing resize task for ${photo.storage_key}:`, err);
          });
        }

        if (firstEventId) {
          console.log(`[SavePhotoBatch] Scheduling delayed modal trigger for event ${firstEventId}`);
          publishDelayedModalTrigger(firstEventId, request.nextUrl.origin).catch((err) => {
            console.error(`[SavePhotoBatch] Error scheduling delayed modal trigger:`, err);
          });
        }
      });
    }

    return jsonResponse({
      success: true,
      processed: upsertDataArray.length,
    });
  } catch (error: unknown) {
    console.error("[SavePhotoBatch] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Save photo batch failed" }, 500);
  }
}

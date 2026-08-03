import { NextRequest, NextResponse, after } from "next/server";
import { getCachedBackblazeAuth, finishLargeFile } from "@/lib/backblaze";
import { createClient } from "@supabase/supabase-js";
import { publishVideoTranscodeTask } from "@/lib/qstash";

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
    const fileId = String(body.fileId || "");
    const storageKey = String(body.storageKey || "");
    const eventId = String(body.eventId || "");
    const fileName = String(body.fileName || "");
    const fileSize = Number(body.fileSize || 0);
    const requestedResourceType = String(body.resourceType || "video");
    const partSha1Array = body.partSha1Array || [];

    if (!fileId.trim() || !storageKey.trim() || !eventId.trim() || !partSha1Array.length) {
      return jsonResponse({ error: "Missing required parameters: fileId, storageKey, eventId, and partSha1Array are required." }, 400);
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

    // Guest uploads fallback: check if event exists in database
    if (userId === "anonymous") {
      const supabaseAdmin = createClient(
        requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
        requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
        {
          auth: { autoRefreshToken: false, persistSession: false },
        }
      );

      const { data: event, error: eventErr } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("id", eventId)
        .maybeSingle();

      if (eventErr || !event) {
        return jsonResponse({ error: "Invalid event or unauthorized access" }, 401);
      }
    }

    // 1. Complete the B2 multipart/large file upload
    console.log(`[CompleteChunkedUpload] Completing large file for id ${fileId} with key ${storageKey}...`);
    const backblazeAuth = await getCachedBackblazeAuth();
    let finishResult: { contentLength?: number } = {};
    try {
      finishResult = await finishLargeFile(backblazeAuth, fileId, partSha1Array);
    } catch (finishErr: any) {
      const msg = String(finishErr?.message || "");
      if (msg.includes("No active upload for") || msg.includes("already_finished") || msg.includes("bad_request")) {
        console.warn(`[CompleteChunkedUpload] B2 large file session already completed or closed (${msg}). Proceeding to save DB record...`);
      } else {
        throw finishErr;
      }
    }

    const mediaDomain = (
      process.env.MEDIA_DOMAIN ||
      process.env.CLOUDFLARE_DOMAIN ||
      process.env.NEXT_PUBLIC_MEDIA_DOMAIN ||
      ""
    ).trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");

    if (!mediaDomain) {
      throw new Error("MEDIA_DOMAIN or CLOUDFLARE_DOMAIN is not configured");
    }
    const url = `https://${mediaDomain}/${storageKey}`;

    const videoExtensions = ["mp4", "mov", "avi", "mkv", "webm", "m4v", "3gp", "flv", "wmv", "mts", "m2ts", "ts", "ogv"];
    const fileExt = fileName.split(".").pop()?.toLowerCase() || "";
    const isVideo = requestedResourceType === "video" || videoExtensions.includes(fileExt) || storageKey.includes("/videos/");
    const resourceType = isVideo ? "video" : "image";
    const mediaType = isVideo ? "video" : "photo";

    // 2. Save metadata to Supabase database
    const photoId = storageKey.replace(/\//g, "_");
    const upsertData = {
      id: photoId,
      event_id: eventId,
      storage_key: storageKey,
      url: url,
      height: null,
      width: null,
      uploaded_at: new Date().toISOString(),
      tags: [],
      user_id: userId,
      size: fileSize || finishResult.contentLength || 0,
      format: fileName.split(".").pop()?.toLowerCase() || "mp4",
      media_type: mediaType,
      resource_type: resourceType,
    };

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

    console.log(`[CompleteChunkedUpload] Saving DB record for photo: ${photoId}`);
    const { error: dbError } = await supabaseAdmin.from("photos").upsert(upsertData);

    if (dbError) {
      console.error(`[CompleteChunkedUpload] Database save failed for ${photoId}`, dbError);
      return jsonResponse({ error: `Upload succeeded to storage but failed to save database record: ${dbError.message}` }, 500);
    }

    // 3. Trigger transcode or resizing
    if (resourceType === "video") {
      after(() => {
        publishVideoTranscodeTask(
          { id: photoId, storage_key: storageKey, event_id: eventId, url },
          fileSize
        ).catch((err) => {
          console.error("[CompleteChunkedUpload] Error publishing video transcode task:", err);
        });
      });
    }

    // Notify event owner when a guest uploads media
    if (eventId && userId) {
      after(() => {
        (async () => {
          const { data: event, error: eventErr } = await supabaseAdmin
            .from('events')
            .select('created_by, title')
            .eq('id', eventId)
            .maybeSingle();

          if (eventErr) {
            console.error("[CompleteChunkedUpload] Error fetching event details for notification:", eventErr);
            return;
          }

          if (event?.created_by && event.created_by !== userId) {
            const isVideo = resourceType === "video";
            const { sendPushNotification } = await import("@/lib/pushNotifications");
            await sendPushNotification(
              event.created_by,
              isVideo ? '🎥 New video uploaded' : '📸 New photo uploaded',
              `Someone added a ${isVideo ? 'video' : 'photo'} to "${event.title}"`,
              { eventId }
            );
          }
        })().catch((err) => {
          console.error("[CompleteChunkedUpload] Push notification background error:", err);
        });
      });
    }

    return jsonResponse({
      url,
      publicId: storageKey,
      storageKey,
      fileId,
      fileName,
      bytes: fileSize || finishResult.contentLength,
      mediaType,
      resourceType,
      savedPhotoId: photoId,
    });
  } catch (error: unknown) {
    console.error("[CompleteChunkedUpload] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Complete chunked upload failed" }, 500);
  }
}

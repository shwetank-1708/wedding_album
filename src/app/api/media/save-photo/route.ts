import { NextRequest, NextResponse, after } from "next/server";
import { publishResizeTask, publishVideoTranscodeTask } from "@/lib/qstash";
import { getCachedBackblazeAuth, BackblazeAuth } from "@/lib/backblaze";
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

async function deleteB2File(auth: BackblazeAuth, bucketId: string, key: string) {
  try {
    const listResponse = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_names`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId,
        startFileName: key,
        maxFileCount: 1,
        prefix: key
      }),
    });

    if (!listResponse.ok) {
      console.error(`[B2Delete] Failed to list file ${key}: ${listResponse.status}`);
      return false;
    }

    const listData = await listResponse.json();
    const file = listData.files?.find((f: { fileName: string; fileId?: string }) => f.fileName === key);
    if (!file || !file.fileId) {
      console.log(`[B2Delete] File ${key} not found or already deleted.`);
      return true;
    }

    const deleteResponse = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: key,
        fileId: file.fileId
      }),
    });

    if (!deleteResponse.ok) {
      console.error(`[B2Delete] Failed to delete file version for ${key}: ${deleteResponse.status}`);
      return false;
    }

    console.log(`[B2Delete] Successfully deleted file ${key} from B2.`);
    return true;
  } catch (err) {
    console.error(`[B2Delete] Error deleting file ${key}:`, err);
    return false;
  }
}

async function rollbackB2Upload(storageKey: string, resourceType: string) {
  try {
    const backblazeAuth = await getCachedBackblazeAuth();
    const bucketId = requireEnv("B2_BUCKET_ID");
    const originalKey = storageKey;
    
    if (resourceType === "image") {
      const thumbnailKey = `${storageKey}-thumbnail.webp`;
      const previewKey = `${storageKey}-preview.webp`;
      console.log(`[Upload Rollback] Deleting B2 assets for storage key: ${storageKey}`);
      await Promise.all([
        deleteB2File(backblazeAuth, bucketId, originalKey),
        deleteB2File(backblazeAuth, bucketId, thumbnailKey),
        deleteB2File(backblazeAuth, bucketId, previewKey)
      ]);
    } else {
      console.log(`[Upload Rollback] Deleting B2 original file: ${storageKey}`);
      await deleteB2File(backblazeAuth, bucketId, originalKey);
    }
  } catch (err) {
    console.error("[Upload Rollback] Failed to rollback B2 files:", err);
  }
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
    const { storageKey, eventId, fileName, fileSize, resourceType } = body;

    if (!storageKey) {
      return jsonResponse({ error: "Missing storageKey" }, 400);
    }
    if (!eventId) {
      return jsonResponse({ error: "Missing eventId" }, 400);
    }
    if (!fileName) {
      return jsonResponse({ error: "Missing fileName" }, 400);
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

    // Guest uploads fallback: check if event exists in the database
    if (userId === "anonymous") {
      const { data: event, error: eventErr } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("id", eventId)
        .maybeSingle();

      if (eventErr || !event) {
        return jsonResponse({ error: "Invalid event or unauthorized access" }, 401);
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

    const isVideo = resourceType === "video" || fileName.split(".").pop()?.toLowerCase() === "mp4";
    const actualResourceType = isVideo ? "video" : "image";
    const mediaType = isVideo ? "video" : "photo";

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
      size: Number(fileSize) || 0,
      format: fileName.split(".").pop()?.toLowerCase() || "jpg",
      media_type: mediaType,
      resource_type: actualResourceType,
    };

    console.log(`[SavePhoto] Writing DB record for photo: ${photoId}`);
    const { error: dbError } = await supabaseAdmin.from("photos").upsert(upsertData);

    if (dbError) {
      console.error(`[SavePhoto] Database save failed for ${photoId}. Rolling back B2 upload...`, dbError);
      await rollbackB2Upload(storageKey, actualResourceType);
      return jsonResponse({ error: `Failed to save database record: ${dbError.message}` }, 500);
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
            console.error("[SavePhoto] Error fetching event details for notification:", eventErr);
            return;
          }

          if (event?.created_by && event.created_by !== userId) {
            const { sendPushNotification } = await import("@/lib/pushNotifications");
            await sendPushNotification(
              event.created_by,
              isVideo ? '🎥 New video uploaded' : '📸 New photo uploaded',
              `Someone added a ${isVideo ? 'video' : 'photo'} to "${event.title}"`,
              { eventId }
            );
          }
        })().catch((err) => {
          console.error("[SavePhoto] Push notification background error:", err);
        });
      });
    }

    // Trigger background processing via QStash
    if (actualResourceType === "image") {
      const qstashToken = process.env.QSTASH_TOKEN;
      if (qstashToken) {
        console.log(`[SavePhoto] Queuing resize task via QStash for: ${storageKey}`);
        after(() => {
          publishResizeTask({ storageKey, origin: request.nextUrl.origin }).catch((err) => {
            console.error("[SavePhoto] Error publishing resize task via QStash:", err);
          });
        });
      }
    } else if (actualResourceType === "video") {
      console.log(`[SavePhoto] Queuing video transcode task via QStash for: ${storageKey}`);
      after(() => {
        publishVideoTranscodeTask({
          id: photoId,
          storage_key: storageKey,
          event_id: eventId,
          url
        }, Number(fileSize) || 0).catch((err) => {
          console.error("[SavePhoto] Error publishing video transcode task via QStash:", err);
        });
      });
    }

    return jsonResponse({
      success: true,
      url,
      photoId,
    });
  } catch (error: unknown) {
    console.error("[SavePhoto] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Save photo failed" }, 500);
  }
}

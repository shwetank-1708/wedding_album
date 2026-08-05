import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCachedBackblazeAuth, BackblazeAuth } from "@/lib/backblaze";

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

async function verifySupabaseUser(accessToken: string) {
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
  return user?.id ? { id: user.id } : null;
}

async function deleteB2Prefix(auth: BackblazeAuth, bucketId: string, prefix: string) {
  try {
    let startFileName: string | undefined = undefined;
    let totalDeleted = 0;
    while (true) {
      const listResponse: Response = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_names`, {
        method: "POST",
        headers: {
          Authorization: auth.authorizationToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bucketId,
          prefix,
          maxFileCount: 1000,
          ...(startFileName ? { startFileName } : {}),
        }),
      });

      if (!listResponse.ok) {
        console.error(`[B2DeletePrefix] Failed to list prefix ${prefix}: ${listResponse.status}`);
        break;
      }

      const listData: any = await listResponse.json();
      const files: Array<{ fileName: string; fileId?: string }> = listData.files || [];
      if (files.length === 0) break;

      const chunkSize = 10;
      for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (file) => {
            if (file.fileId && file.fileName) {
              const deleteResponse = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
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
              if (deleteResponse.ok) totalDeleted++;
            }
          })
        );
      }

      if (listData.nextFileName) {
        startFileName = listData.nextFileName;
      } else {
        break;
      }
    }
    console.log(`[B2DeletePrefix] Successfully deleted ${totalDeleted} files under prefix: ${prefix}`);
    return true;
  } catch (err) {
    console.error(`[B2DeletePrefix] Error deleting prefix ${prefix}:`, err);
    return false;
  }
}

async function deleteB2File(auth: BackblazeAuth, bucketId: string, key: string) {
  try {
    // 1. Get file ID by listing
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

    // 2. Delete version
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
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

    if (!accessToken) {
      return jsonResponse({ error: "Missing authorization token" }, 401);
    }

    const user = await verifySupabaseUser(accessToken);
    if (!user) {
      return jsonResponse({ error: "Invalid authorization token" }, 401);
    }

    const { photoId } = await request.json();
    if (!photoId) {
      return jsonResponse({ error: "Missing photoId" }, 400);
    }

    const supabaseAdmin = createClient(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );

    // 1. Fetch photo details
    const { data: photo, error: photoError } = await supabaseAdmin
      .from("photos")
      .select("*")
      .eq("id", photoId)
      .maybeSingle();

    if (photoError) throw photoError;
    if (!photo) {
      return jsonResponse({ error: "Photo not found" }, 404);
    }

    // 2. Fetch event details to check permissions
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("created_by")
      .eq("id", photo.event_id)
      .maybeSingle();

    if (eventError) throw eventError;

    // Check if requester is event creator, photo uploader, or admin
    let isAuthorized = false;
    if (event && event.created_by === user.id) {
      isAuthorized = true;
    } else if (photo.user_id === user.id) {
      isAuthorized = true;
    } else {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile && profile.role === "admin") {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return jsonResponse({ error: "Forbidden: You do not have permission to delete this photo" }, 403);
    }

    // 3. Delete files from B2 if storage key exists
    const storageKey = photo.storage_key;
    if (storageKey) {
      const auth = await getCachedBackblazeAuth();
      const bucketId = requireEnv("B2_BUCKET_ID");

      const originalKey = storageKey;
      const thumbnailKey = `${storageKey}-thumbnail.webp`;
      const previewKey = `${storageKey}-preview.webp`;
      const hlsPrefix = `hls/${storageKey}/`;

      console.log(`[MediaDelete] Deleting B2 assets for storage key: ${storageKey}`);
      await Promise.all([
        deleteB2File(auth, bucketId, originalKey),
        deleteB2File(auth, bucketId, thumbnailKey),
        deleteB2File(auth, bucketId, previewKey),
        deleteB2Prefix(auth, bucketId, hlsPrefix),
      ]);
    }

    // 4. Delete face embeddings for this photo
    const { error: facesDeleteError } = await supabaseAdmin
      .from("faces")
      .delete()
      .eq("image_id", photoId);

    if (facesDeleteError) {
      console.warn(`[MediaDelete] Could not delete face records for ${photoId}:`, facesDeleteError.message);
    } else {
      console.log(`[MediaDelete] Deleted face embeddings for photo ${photoId}.`);
    }

    // 5. Delete photo from database
    const { error: deleteError } = await supabaseAdmin
      .from("photos")
      .delete()
      .eq("id", photoId);

    if (deleteError) throw deleteError;

    console.log(`[MediaDelete] Successfully deleted photo ${photoId} from database.`);
    return jsonResponse({ success: true, message: "Photo deleted successfully" });
  } catch (error: unknown) {
    console.error("[MediaDelete] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Deletion failed" }, 500);
  }
}

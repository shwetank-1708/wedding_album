import { NextRequest, NextResponse } from "next/server";
import { getCachedBackblazeAuth, startLargeFile } from "@/lib/backblaze";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

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
  const uniquePrefix = `${Date.now()}-${crypto.randomUUID()}`;

  if (params.scope === "profile") {
    return `profiles/${userId}/${uniquePrefix}-${cleanName}`;
  }

  const eventId = sanitizeSegment(params.eventId || "") || "event";
  return `events/${eventId}/${folder}/${userId}-${uniquePrefix}-${cleanName}`;
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
    const scope = body.scope === "profile" ? "profile" : "event";
    const eventId = String(body.eventId || "");
    const requestedResourceType = String(body.resourceType || "video");
    const fileName = String(body.fileName || (scope === "profile" ? "profile.mp4" : "upload.mp4"));
    const contentType = String(body.contentType || "video/mp4");

    if (scope === "event" && !eventId.trim()) {
      return jsonResponse({ error: "Missing eventId" }, 400);
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
    if (userId === "anonymous" && scope === "event") {
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

    const resourceType = requestedResourceType === "video" ? "video" : "image";
    const storageKey = buildStorageKey({
      eventId,
      userId,
      resourceType,
      fileName,
      scope,
    });

    const backblazeAuth = await getCachedBackblazeAuth();
    const largeFileData = await startLargeFile(backblazeAuth, storageKey, contentType);

    const mediaDomain = requireEnv("MEDIA_DOMAIN").replace(/^https?:\/\//, "").replace(/\/+$/, "");

    return jsonResponse({
      fileId: largeFileData.fileId,
      storageKey,
      mediaDomain,
    });
  } catch (error: unknown) {
    console.error("[InitiateChunkedUpload] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Failed to initiate chunked upload" }, 500);
  }
}

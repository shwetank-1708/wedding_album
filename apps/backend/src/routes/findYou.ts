import { Buffer } from "node:buffer";
import { Router } from "express";
import sharp from "sharp";
import { verifySupabaseUser } from "../auth.js";

export const findYouRouter = Router();

const MAX_SELFIE_BYTES = 8 * 1024 * 1024;

type ModalMatch = {
  id?: string;
  imageId?: string;
  url?: string;
  imageUrl?: string;
  storageKey?: string;
  width?: number;
  height?: number;
};

type ModalFindYouResult = {
  error?: string;
  matches?: ModalMatch[];
  debug?: { indexedFacesCount?: number };
};

function getResizedImageUrl(source: string | undefined, width: number) {
  if (!source) return "";
  if (/\.(mp4|mov|avi|webm|mkv|m4v)(\?.*)?$/i.test(source)) return source;

  const mediaDomain = process.env.NEXT_PUBLIC_MEDIA_DOMAIN || "media.evebash.com";
  let parsed: URL;
  try {
    parsed = new URL(source);
  } catch {
    return source;
  }

  if (parsed.hostname !== mediaDomain) return source;

  const suffix = width <= 500 ? "-thumbnail.webp" : "-preview.webp";
  if (parsed.pathname.endsWith("-thumbnail.webp") || parsed.pathname.endsWith("-preview.webp")) {
    return source;
  }

  parsed.pathname = `${parsed.pathname}${suffix}`;
  return parsed.toString();
}

function formatSupabaseError(error: unknown) {
  if (!error || typeof error !== "object") return error;
  const value = error as { message?: string; details?: string; hint?: string; code?: string };
  return {
    message: value.message,
    details: value.details,
    hint: value.hint,
    code: value.code,
  };
}

function getAllowedSelfieHosts() {
  const hosts = new Set(
    (process.env.FIND_YOU_SELFIE_HOSTS || "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean),
  );

  const mediaDomain = process.env.NEXT_PUBLIC_MEDIA_DOMAIN?.trim().toLowerCase();
  if (mediaDomain) hosts.add(mediaDomain);

  try {
    const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").hostname.toLowerCase();
    if (supabaseHost) hosts.add(supabaseHost);
  } catch {
    // The Supabase URL is validated separately when the backend starts using it.
  }

  return hosts;
}

function ensureSelfieSize(buffer: Buffer) {
  if (buffer.length === 0 || buffer.length > MAX_SELFIE_BYTES) {
    throw new Error("Selfie must be a non-empty image smaller than 8 MB.");
  }
}

findYouRouter.post("/", async (request, response) => {
  try {
    const body = (request.body || {}) as Record<string, unknown>;
    const selfieUrl = typeof body.selfieUrl === "string" ? body.selfieUrl : "";
    const selfieBase64 = typeof body.selfieBase64 === "string" ? body.selfieBase64 : "";
    const eventIds = Array.isArray(body.eventIds)
      ? body.eventIds.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
      : [];
    const selfieSource = selfieUrl || selfieBase64;

    if (!selfieSource || eventIds.length === 0) {
      response.status(400).json({ error: "Missing selfie source (selfieUrl or selfieBase64) or eventIds" });
      return;
    }

    let selfieBuffer: Buffer;
    if (selfieSource.startsWith("data:") || !selfieSource.startsWith("http")) {
      const base64Data = selfieSource.includes("base64,")
        ? selfieSource.split("base64,")[1]
        : selfieSource;
      selfieBuffer = Buffer.from(base64Data, "base64");
    } else {
      const selfieSourceUrl = new URL(selfieSource);
      if (!getAllowedSelfieHosts().has(selfieSourceUrl.hostname.toLowerCase())) {
        response.status(400).json({ error: "The supplied selfie URL is not from an allowed media host." });
        return;
      }

      const downloadResponse = await fetch(selfieSourceUrl, { redirect: "error" });
      if (!downloadResponse.ok) {
        response.status(400).json({ error: "Unable to download the supplied selfie." });
        return;
      }
      const contentLength = Number(downloadResponse.headers.get("content-length") || 0);
      if (contentLength > MAX_SELFIE_BYTES) {
        response.status(413).json({ error: "Selfie must be smaller than 8 MB." });
        return;
      }
      selfieBuffer = Buffer.from(await downloadResponse.arrayBuffer());
    }

    ensureSelfieSize(selfieBuffer);

    const optimizedSelfie = await sharp(selfieBuffer)
      .rotate()
      .resize({ width: 1000, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();

    const targetUrl = (
      process.env.MODAL_FIND_YOU_URL ||
      "https://shwetank-sarthak--wedding-media-engine-find-matching-photos.modal.run"
    ).trim();

    const modalResponse = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selfie_base64: optimizedSelfie.toString("base64"),
        event_ids: eventIds,
      }),
    });

    if (!modalResponse.ok) {
      const detail = await modalResponse.text().catch(() => "");
      throw new Error(`Modal search request failed: ${modalResponse.status}${detail ? ` - ${detail}` : ""}`);
    }

    const result = (await modalResponse.json()) as ModalFindYouResult;
    if (result.error) {
      response.json({
        matches: [],
        error: result.error,
        debug: {
          indexedFacesCount: result.debug?.indexedFacesCount || 0,
          selfieDetected: false,
          matchesCount: 0,
        },
      });
      return;
    }

    const matches = (result.matches || []).map((match) => {
      const imageId = match.imageId || match.id || "";
      const imageUrl = match.imageUrl || match.url || "";
      return {
        id: imageId,
        imageId,
        url: imageUrl,
        imageUrl,
        storageKey: match.storageKey,
        thumbnailUrl: getResizedImageUrl(imageUrl, 400),
        previewUrl: getResizedImageUrl(imageUrl, 900),
        width: match.width,
        height: match.height,
      };
    });

    response.json({
      matches,
      total: matches.length,
      debug: {
        indexedFacesCount: result.debug?.indexedFacesCount || 0,
        selfieDetected: true,
        matchesCount: matches.length,
      },
    });
  } catch (error) {
    console.error("[BackendFindYou] Search failed:", error);
    response.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
  }
});

findYouRouter.post("/index-face", async (request, response) => {
  try {
    const verification = await verifySupabaseUser(request);
    if (!verification) {
      response.status(401).json({ error: "Invalid or missing authorization token" });
      return;
    }

    const body = (request.body || {}) as Record<string, unknown>;
    const imageId = typeof body.image_id === "string" ? body.image_id : "";
    const eventId = typeof body.event_id === "string" ? body.event_id : "";
    const imageUrl = typeof body.image_url === "string" ? body.image_url : "";
    const descriptor = Array.isArray(body.descriptor) ? body.descriptor : [];

    if (!imageId || !eventId || !imageUrl || descriptor.length === 0) {
      response.status(400).json({ error: "Missing required face index fields" });
      return;
    }
    if (!descriptor.every((value) => typeof value === "number" && Number.isFinite(value))) {
      response.status(400).json({ error: "Invalid face descriptor" });
      return;
    }

    const { user, supabaseAdmin } = verification;
    const { data: photo, error: photoError } = await supabaseAdmin
      .from("photos")
      .select("id, event_id, user_id")
      .eq("id", imageId)
      .maybeSingle();

    if (photoError) throw photoError;
    if (!photo || photo.event_id !== eventId) {
      response.status(404).json({ error: "Photo not found for this event" });
      return;
    }

    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id, created_by")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!event) {
      response.status(404).json({ error: "Event not found" });
      return;
    }
    if (event.created_by !== user.id && photo.user_id !== user.id) {
      response.status(403).json({ error: "You are not allowed to index faces for this photo" });
      return;
    }

    const { error: insertError } = await supabaseAdmin.from("faces").insert({
      image_id: imageId,
      descriptor,
      event_id: eventId,
      image_url: imageUrl,
      width: Number(body.width) || 0,
      height: Number(body.height) || 0,
    });

    if (insertError) {
      if (insertError.code === "42P01" || insertError.code === "PGRST205") {
        response.status(503).json({ error: "Face index table is not ready yet. Apply the Supabase migration for faces." });
        return;
      }
      throw insertError;
    }

    response.json({ success: true });
  } catch (error) {
    console.error("[BackendFaceIndex] Save failed:", formatSupabaseError(error));
    response.status(500).json({ error: error instanceof Error ? error.message : "Failed to save face index" });
  }
});

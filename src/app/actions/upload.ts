"use server";

import { randomUUID } from "crypto";

type BackblazeUploadOptions = {
    fileName?: string;
    contentType?: string;
    resourceType?: "image" | "video";
};

function getBackendApiUrl() {
    return (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
}

function sanitizeSegment(value: string) {
    return value
        .trim()
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 100);
}

function parseBase64DataUrl(base64File: string, fallbackContentType?: string) {
    const match = base64File.match(/^data:([^;]+);base64,(.+)$/);
    const contentType = match?.[1] || fallbackContentType || "application/octet-stream";
    const payload = match?.[2] || base64File;
    return {
        contentType,
        bytes: Buffer.from(payload, "base64"),
    };
}

function getExtension(fileName: string, contentType: string) {
    const fromName = fileName.split(".").pop();
    if (fromName && fromName !== fileName) return fromName.toLowerCase();
    if (contentType.includes("/")) return contentType.split("/")[1].split("+")[0].toLowerCase();
    return "bin";
}

function buildStorageKey(folder: string, options: Required<Pick<BackblazeUploadOptions, "resourceType">> & BackblazeUploadOptions, contentType: string) {
    const cleanFolder = folder
        .split("/")
        .map((segment) => sanitizeSegment(segment))
        .filter(Boolean)
        .join("/");
    const mediaFolder = options.resourceType === "video" ? "videos" : "photos";
    const safeFileName = sanitizeSegment(options.fileName || `upload.${getExtension("", contentType)}`);
    const extension = getExtension(safeFileName, contentType);
    const finalName = safeFileName.includes(".") ? safeFileName : `${safeFileName}.${extension}`;

    return `${cleanFolder || "uploads"}/${mediaFolder}/${Date.now()}-${randomUUID()}-${finalName}`;
}

export async function uploadToBackblaze(base64File: string, folder: string, options: BackblazeUploadOptions = {}) {
    try {
        const resourceType = options.resourceType || (options.contentType?.startsWith("video/") ? "video" : "image");
        const { contentType, bytes } = parseBase64DataUrl(base64File, options.contentType);
        const storageKey = buildStorageKey(folder, { ...options, resourceType }, contentType);

        console.log(`[Server Action] Requesting presigned upload URL from Railway API for: ${storageKey}`);

        const apiBaseUrl = getBackendApiUrl();
        if (!apiBaseUrl) {
            throw new Error("NEXT_PUBLIC_API_URL is not configured.");
        }

        const presignedResponse = await fetch(`${apiBaseUrl}/api/v1/media/get-upload-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fileName: options.fileName || storageKey,
                fileSize: bytes.length,
                resourceType,
            }),
            cache: "no-store",
        });

        if (!presignedResponse.ok) {
            const errPayload = await presignedResponse.json().catch(() => ({}));
            throw new Error(errPayload.error || "Failed to fetch presigned upload URL from Railway.");
        }

        const presignedData = await presignedResponse.json();

        const uploadResponse = await fetch(presignedData.uploadUrl, {
            method: "POST",
            headers: {
                Authorization: presignedData.authorizationToken,
                "Content-Type": contentType,
                "X-Bz-File-Name": encodeURIComponent(storageKey),
                "X-Bz-Content-Sha1": "do_not_verify",
                "Content-Length": String(bytes.length),
            },
            body: bytes as unknown as BodyInit,
        });

        const uploadResult = await uploadResponse.json().catch(() => ({}));
        if (!uploadResponse.ok) {
            throw new Error(uploadResult.message || `Backblaze upload failed with ${uploadResponse.status}`);
        }

        const mediaDomain = (process.env.MEDIA_DOMAIN || process.env.NEXT_PUBLIC_MEDIA_DOMAIN || "media.evebash.com")
            .replace(/^https?:\/\//, "")
            .replace(/\/+$/, "");
        const url = `https://${mediaDomain}/${storageKey}`;

        return {
            success: true,
            url,
            public_id: storageKey,
            storageKey,
            fileId: uploadResult.fileId,
            width: undefined,
            height: undefined,
            bytes: uploadResult.contentLength || bytes.length,
            format: getExtension(options.fileName || storageKey, contentType),
            resourceType,
        };
    } catch (error: unknown) {
        console.error("[Server Action] Backblaze upload error:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Backblaze upload failed",
        };
    }
}

export async function getPresignedUploadUrl(
    folder: string,
    fileName: string,
    contentType: string,
    resourceType: "image" | "video" = "image"
) {
    try {
        const apiBaseUrl = getBackendApiUrl();
        if (!apiBaseUrl) {
            throw new Error("NEXT_PUBLIC_API_URL is not configured.");
        }

        const storageKey = buildStorageKey(
            folder,
            { fileName, contentType, resourceType },
            contentType
        );

        const response = await fetch(`${apiBaseUrl}/api/v1/media/get-upload-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fileName,
                resourceType,
            }),
            cache: "no-store",
        });

        if (!response.ok) {
            const errPayload = await response.json().catch(() => ({}));
            throw new Error(errPayload.error || "Failed to generate upload URL");
        }

        const data = await response.json();
        const mediaDomain = (process.env.MEDIA_DOMAIN || process.env.NEXT_PUBLIC_MEDIA_DOMAIN || "media.evebash.com")
            .replace(/^https?:\/\//, "")
            .replace(/\/+$/, "");

        return {
            success: true as const,
            uploadUrl: data.uploadUrl,
            authToken: data.authorizationToken,
            storageKey,
            finalUrl: `https://${mediaDomain}/${storageKey}`,
        };
    } catch (error: unknown) {
        console.error("[Server Action] getPresignedUploadUrl error:", error);
        return {
            success: false as const,
            error: error instanceof Error ? error.message : "Failed to generate upload URL",
        };
    }
}

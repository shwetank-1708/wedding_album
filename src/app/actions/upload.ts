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
            url: `https://${mediaDomain}/${storageKey}`,
        };
    } catch (error: unknown) {
        console.error("[Server Action] getPresignedUploadUrl error:", error);
        return {
            success: false as const,
            error: error instanceof Error ? error.message : "Failed to generate upload URL",
        };
    }
}

export async function uploadToBackblaze(_base64File: string, folder: string, options: BackblazeUploadOptions = {}) {
    const res = await getPresignedUploadUrl(folder, options.fileName || "upload.jpg", options.contentType || "image/jpeg", options.resourceType || "image");
    if (!res.success) {
        return { success: false as const, error: res.error, url: "", finalUrl: "" };
    }
    return {
        success: true as const,
        url: res.finalUrl,
        finalUrl: res.finalUrl,
        uploadUrl: res.uploadUrl,
        authToken: res.authToken,
        storageKey: res.storageKey,
    };
}

import JSZip from "jszip";

export interface ZipMediaItem {
    id: string;
    url: string;
    filename?: string;
    mediaType?: string;
    resourceType?: string;
}

export type ZipProgressCallback = (percent: number, currentItem: number, totalItems: number) => void;

function getExtensionFromUrl(url: string, defaultExt = "jpg") {
    try {
        const path = new URL(url).pathname;
        const ext = path.split(".").pop()?.toLowerCase();
        if (ext && ext.length <= 4 && !ext.includes("/")) {
            return ext;
        }
    } catch {}
    return defaultExt;
}

export async function downloadGalleryAsZip(
    galleryTitle: string,
    items: ZipMediaItem[],
    onProgress?: ZipProgressCallback
): Promise<void> {
    if (!items || items.length === 0) {
        throw new Error("No media items selected to download.");
    }

    const zip = new JSZip();
    const folderName = (galleryTitle || "Gallery").replace(/[^a-zA-Z0-9_-]/g, "_");
    const zipFolder = zip.folder(folderName) || zip;

    const total = items.length;
    let completed = 0;

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const mediaUrl = item.url;

        if (!mediaUrl) continue;

        try {
            const response = await fetch(mediaUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const blob = await response.blob();
            const isVideo = item.mediaType === "video" || item.resourceType === "video" || mediaUrl.includes(".mp4") || mediaUrl.includes(".mov");
            const ext = isVideo ? getExtensionFromUrl(mediaUrl, "mp4") : getExtensionFromUrl(mediaUrl, "jpg");

            const safeFilename = item.filename
                ? item.filename.replace(/[^a-zA-Z0-9._-]/g, "_")
                : `media_${i + 1}.${ext}`;

            const finalName = safeFilename.includes(".") ? safeFilename : `${safeFilename}.${ext}`;
            zipFolder.file(finalName, blob);

            completed++;
            if (onProgress) {
                const percent = Math.round((completed / total) * 100);
                onProgress(percent, completed, total);
            }
        } catch (err) {
            console.warn(`[ZipDownload] Failed to download media item ${item.id}:`, err);
        }
    }

    if (completed === 0) {
        throw new Error("Failed to download media files. Please check network connection.");
    }

    const zipBlob = await zip.generateAsync({ type: "blob" }, (metadata) => {
        if (onProgress) {
            const overallPercent = Math.round(50 + (metadata.percent / 2));
            onProgress(overallPercent, completed, total);
        }
    });

    const safeZipName = `${folderName}_Gallery.zip`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(zipBlob);
    link.download = safeZipName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
        URL.revokeObjectURL(link.href);
    }, 10000);
}

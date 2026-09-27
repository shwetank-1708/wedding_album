import * as FileSystem from 'expo-file-system/legacy';

// ─── Pre-Upload Video Validation (Mobile) ──────────────────────────────────────

export interface VideoValidationResult {
    valid: boolean;
    error?: string;
}

/** Supported video MIME types accepted by the platform. */
const SUPPORTED_VIDEO_MIME_TYPES = new Set([
    'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
    'video/webm', 'video/x-m4v', 'video/3gpp', 'video/x-flv',
    'video/x-ms-wmv', 'video/mp2t', 'video/ogg',
]);

/** Supported video extensions — used as fallback when MIME type is absent or generic. */
const VIDEO_EXTENSIONS = new Set([
    'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v', '3gp', 'flv', 'wmv', 'mts', 'm2ts', 'ts', 'ogv',
]);

/**
 * Validates a video asset returned from expo-image-picker before adding it to the
 * upload queue. Uses expo-file-system to stat the file if fileSize is missing.
 *
 * Checks:
 *  1. Non-zero file size (stats via FileSystem if the picker didn't provide it)
 *  2. Minimum 10 KB size — a real video cannot be smaller
 *  3. MIME type and/or extension must identify the file as a video
 *
 * Safe to call in React Native context — does NOT use any browser APIs.
 */
export async function validateVideoAsset(asset: {
    uri: string;
    mimeType?: string | null;
    fileName?: string | null;
    fileSize?: number | null;
    duration?: number | null;
}): Promise<VideoValidationResult> {
    const { uri, mimeType, fileName, fileSize } = asset;

    // 1. Determine file size — prefer the picker-provided value, fall back to a stat call
    let size = fileSize ?? 0;
    if (size === 0) {
        try {
            const info = await FileSystem.getInfoAsync(uri);
            if (info.exists) {
                size = (info as any).size ?? 0;
            }
        } catch {
            // Ignore stat errors — the upload itself will surface the failure
        }
    }

    if (size === 0) {
        return {
            valid: false,
            error: 'The selected video file appears to be empty. Please choose a different video.',
        };
    }

    // 2. Minimum size sanity check
    if (size < 10 * 1024) {
        return {
            valid: false,
            error: 'The selected file is too small to be a valid video. Please choose a real video file.',
        };
    }

    // 3. MIME type / extension check
    const mimeIsVideo = mimeType ? mimeType.startsWith('video/') : false;
    const ext = fileName?.split('.').pop()?.toLowerCase() || '';
    const extIsVideo = VIDEO_EXTENSIONS.has(ext);

    if (!mimeIsVideo && !extIsVideo) {
        return {
            valid: false,
            error: `"${fileName || 'Selected file'}" does not appear to be a video. Got type: ${mimeType || 'unknown'}. Please select an MP4, MOV, or MKV file.`,
        };
    }

    // 4. Uncommon MIME — allow but log for debugging
    if (mimeType && !SUPPORTED_VIDEO_MIME_TYPES.has(mimeType) && mimeIsVideo) {
        console.warn(`[VideoValidation] Uncommon video MIME type: ${mimeType} — proceeding.`);
    }

    return { valid: true };
}

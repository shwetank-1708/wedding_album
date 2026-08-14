import { supabase } from "@/lib/supabase";
import { getApiUrl } from "@/lib/apiBase";

/**
 * Computes the SHA-1 hash of a Blob using the browser's SubtleCrypto API.
 * Returns the hex-encoded hash string.
 */
async function sha1OfBlob(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Uploads a file directly to Backblaze B2, bypassing the server body size limit.
 * 1. Obtains direct upload token/url from Railway.
 * 2. Uploads binary directly to Backblaze B2.
 * 3. Saves photo metadata to Supabase via Railway save-photo endpoint.
 */
function uploadWithXhr(
    url: string,
    authToken: string,
    storageKey: string,
    file: File,
    onProgress?: (percent: number) => void
): Promise<{ status: number; responseText: string }> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);

        xhr.setRequestHeader("Authorization", authToken);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.setRequestHeader("X-Bz-File-Name", encodeURIComponent(storageKey));
        xhr.setRequestHeader("X-Bz-Content-Sha1", "do_not_verify");

        if (onProgress) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = (event.loaded / event.total) * 100;
                    onProgress(percent);
                }
            };
        }

        xhr.onload = () => {
            resolve({
                status: xhr.status,
                responseText: xhr.responseText
            });
        };

        xhr.onerror = () => {
            reject(new Error("Network error during direct B2 upload."));
        };

        xhr.onabort = () => {
            reject(new Error("Upload aborted."));
        };

        xhr.send(file);
    });
}

// ─── Resume State ──────────────────────────────────────────────────────────────
// Persisted in localStorage so uploads survive page reloads / lost connections.

const CHUNK_SIZE = 10 * 1024 * 1024;       // 10 MB per chunk
const MAX_CHUNK_RETRIES = 4;               // attempts per chunk before giving up
const RESUME_EXPIRY_MS = 23 * 60 * 60 * 1000; // 23 h (B2 large-file sessions last 24 h)
const RESUME_KEY_PREFIX = "evebash_upload_v1_";

/**
 * Google Drive-style Dynamic Adaptive Upload Concurrency.
 * Automatically inspects the browser's Network Information API (5G, 4G, 3G, Wi-Fi)
 * and hardware specs to pick the ideal concurrency (8 on fast desktop Wi-Fi/LAN,
 * 4 on mobile, 2 on 3G) preventing RAM overload and socket congestion.
 */
function getOptimalConcurrency(): number {
    if (typeof window === "undefined") return 4;

    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

    // Default target for desktop devices: 8 parallel upload streams (Google Drive behavior)
    let concurrency = 8;

    // Detect mobile device to avoid RAM/battery strain
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
        concurrency = 4;
    }

    // Inspect real-time network conditions if supported by the browser
    if (conn) {
        const effectiveType = conn.effectiveType; // 'slow-2g', '2g', '3g', '4g'
        const rtt = conn.rtt; // round trip time in ms

        if (effectiveType === "2g" || effectiveType === "slow-2g") {
            concurrency = 1;
        } else if (effectiveType === "3g" || (rtt && rtt > 300)) {
            concurrency = 2;
        } else if (conn.saveData) {
            concurrency = 2;
        }
    }

    return concurrency;
}

interface UploadResumeState {
    fileId: string;
    storageKey: string;
    eventId: string;
    fileName: string;
    fileSize: number;
    contentType: string;
    resourceType: string;
    /** partNumber (1-indexed) → sha1 for every successfully uploaded chunk */
    completedParts: Record<number, string>;
    totalChunks: number;
    createdAt: number;
}

function resumeKey(fileName: string, fileSize: number) {
    return `${RESUME_KEY_PREFIX}${fileName}_${fileSize}`;
}

function saveResumeState(state: UploadResumeState) {
    try { localStorage.setItem(resumeKey(state.fileName, state.fileSize), JSON.stringify(state)); } catch { /* quota full */ }
}

function loadResumeState(fileName: string, fileSize: number): UploadResumeState | null {
    try {
        const raw = localStorage.getItem(resumeKey(fileName, fileSize));
        if (!raw) return null;
        const state = JSON.parse(raw) as UploadResumeState;
        if (Date.now() - state.createdAt > RESUME_EXPIRY_MS) {
            localStorage.removeItem(resumeKey(fileName, fileSize));
            return null;
        }
        return state;
    } catch { return null; }
}

function clearResumeState(fileName: string, fileSize: number) {
    try { localStorage.removeItem(resumeKey(fileName, fileSize)); } catch { /* ignore */ }
}

// ─── Parallel + Resumable Chunk Upload ─────────────────────────────────────────

async function uploadLargeFileInChunks(
    file: File,
    eventId: string,
    onProgress?: (percent: number) => void
) {
    console.log(`[Storage] Starting chunk-wise direct B2 upload for large file: ${file.name} (${file.size} bytes)`);

    const resourceType = (file.type?.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm", "m4v", "3gp", "flv", "wmv", "mts", "m2ts", "ts", "ogv"].includes(file.name.split('.').pop()?.toLowerCase() || "")) ? "video" : "image";
    const { data: { session } } = await supabase.auth.getSession();

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.access_token) headers["Authorization"] = `Bearer ${session.access_token}`;

    // ── 1. Initiate or resume ──────────────────────────────────────────────────
    let fileId: string;
    let storageKey: string;
    let completedParts: Record<number, string>;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const saved = loadResumeState(file.name, file.size);
    if (saved && saved.eventId === eventId && saved.totalChunks === totalChunks) {
        // Resume a previous upload
        fileId = saved.fileId;
        storageKey = saved.storageKey;
        completedParts = saved.completedParts;
        const doneCount = Object.keys(completedParts).length;
        console.log(`[Storage] Resuming upload: ${doneCount}/${totalChunks} chunks already done.`);
    } else {
        // Fresh start — initiate a new B2 large-file session
        const initiateRes = await fetch(getApiUrl("/api/media/upload/chunk/initiate"), {
            method: "POST",
            headers,
            body: JSON.stringify({
                eventId,
                fileName: file.name,
                contentType: file.type || "application/octet-stream",
                resourceType,
            }),
        });
        const initiateData = await initiateRes.json().catch(() => ({}));
        if (!initiateRes.ok) {
            throw new Error(initiateData.error || `Failed to initiate chunked upload (status: ${initiateRes.status})`);
        }
        fileId = initiateData.fileId;
        storageKey = initiateData.storageKey;
        completedParts = {};

        // Persist the fresh state immediately so we have the fileId saved
        saveResumeState({
            fileId, storageKey, eventId,
            fileName: file.name, fileSize: file.size,
            contentType: file.type || "application/octet-stream",
            resourceType,
            completedParts,
            totalChunks,
            createdAt: Date.now(),
        });
    }

    // ── 2. Build the queue of pending part indices (0-indexed) ─────────────────
    // Parts already completed are skipped — this is the resume magic.
    const pendingIndices = Array.from({ length: totalChunks }, (_, i) => i)
        .filter(i => !completedParts[i + 1]);

    let bytesCompleted = Object.keys(completedParts).reduce((acc, pn) => {
        const idx = Number(pn) - 1;
        const start = idx * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        return acc + (end - start);
    }, 0);

    // Emit initial progress for already-completed chunks
    if (onProgress && bytesCompleted > 0) {
        onProgress(Math.min(99, (bytesCompleted / file.size) * 100));
    }

    // ── 3. Parallel worker pool ────────────────────────────────────────────────
    // Shared atomic queue index — each worker picks the next item.
    const queueMutex = { pos: 0 };  // simple counter; JS is single-threaded, so no real mutex needed


    const uploadChunk = async (partIndex: number): Promise<void> => {
        const partNumber = partIndex + 1;
        const start = partIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);

        console.log(`[Storage] Uploading chunk ${partNumber}/${totalChunks} (size: ${chunkBlob.size} bytes)...`);

        // Compute SHA-1 once — reused across retries for the same blob
        const chunkSha1 = await sha1OfBlob(chunkBlob);

        let lastErr: unknown;
        for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
            try {
                // Fresh upload URL per attempt (URLs are single-use)
                const partUrlRes = await fetch(getApiUrl("/api/media/upload/chunk/part-url"), {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ fileId }),
                });
                const partUrlData = await partUrlRes.json().catch(() => ({}));
                if (!partUrlRes.ok) {
                    throw new Error(partUrlData.error || `Failed to get chunk URL (status: ${partUrlRes.status})`);
                }

                const { uploadUrl, authorizationToken } = partUrlData;

                const res = await fetch(uploadUrl, {
                    method: "POST",
                    headers: {
                        Authorization: authorizationToken,
                        "Content-Type": "application/octet-stream",
                        "X-Bz-Part-Number": String(partNumber),
                        "X-Bz-Content-Sha1": chunkSha1,
                        "Content-Length": String(chunkBlob.size),
                    },
                    body: chunkBlob,
                });

                if (!res.ok) {
                    const errText = await res.text().catch(() => "");
                    throw new Error(`B2 upload rejected: status ${res.status} — ${errText}`);
                }

                // Prefer the SHA-1 we computed; strip B2's "unverified:" prefix if present
                const b2Sha1Raw = res.headers.get("x-bz-content-sha1") || "";
                const sha1 = (b2Sha1Raw.startsWith("unverified:") ? b2Sha1Raw.split(":")[1] : b2Sha1Raw) || chunkSha1;

                // Mark complete and persist to localStorage immediately
                completedParts[partNumber] = sha1;
                saveResumeState({
                    fileId, storageKey, eventId,
                    fileName: file.name, fileSize: file.size,
                    contentType: file.type || "application/octet-stream",
                    resourceType,
                    completedParts: { ...completedParts },
                    totalChunks,
                    createdAt: saved?.createdAt ?? Date.now(),
                });

                // Update progress
                bytesCompleted += chunkBlob.size;
                if (onProgress) onProgress(Math.min(99, (bytesCompleted / file.size) * 100));

                console.log(`[Storage] ✓ Chunk ${partNumber}/${totalChunks} done (sha1: ${sha1.substring(0, 8)}...)`);

                // Fire-and-forget notification to backend to trigger real-time Modal chunk transcoding
                fetch(getApiUrl("/api/media/upload/chunk/complete-part"), {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        storageKey,
                        eventId,
                        partNumber,
                        totalParts: totalChunks,
                    }),
                }).catch((err) => console.warn(`[Storage] Part complete notification failed (non-critical):`, err));

                return; // success — exit retry loop

            } catch (err) {
                lastErr = err;
                const wait = Math.min(1000 * 2 ** attempt, 30_000); // 2 s, 4 s, 8 s, max 30 s
                console.warn(`[Storage] Chunk ${partNumber} attempt ${attempt}/${MAX_CHUNK_RETRIES} failed. Retrying in ${wait / 1000}s...`, err);
                if (attempt < MAX_CHUNK_RETRIES) {
                    await new Promise(r => setTimeout(r, wait));
                }
            }
        }
        // If we reach here all retries are exhausted — state is already saved to localStorage
        // so the upload can be resumed on the next attempt.
        throw new Error(`Chunk ${partNumber} failed after ${MAX_CHUNK_RETRIES} attempts: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
    };

    // Worker function: keeps pulling from the shared queue until empty
    const worker = async (): Promise<void> => {
        while (true) {
            const myPos = queueMutex.pos++;
            if (myPos >= pendingIndices.length) break;
            await uploadChunk(pendingIndices[myPos]);
        }
    };

    // Launch dynamic adaptive workers in parallel (Google Drive style: 8 on desktop, 4 on mobile, 2 on 3G)
    const targetConcurrency = getOptimalConcurrency();
    const actualConcurrency = Math.min(targetConcurrency, pendingIndices.length);
    console.log(`[Storage] Launching ${actualConcurrency} adaptive parallel upload workers (target: ${targetConcurrency}) for ${pendingIndices.length} pending chunks...`);

    try {
        await Promise.all(Array.from({ length: actualConcurrency }, () => worker()));
    } catch (err) {
        // One or more chunks failed permanently — state is saved, user can retry
        throw new Error(`Upload interrupted: ${err instanceof Error ? err.message : String(err)}. Your progress has been saved — retry to resume from where it stopped.`);
    }

    // ── 4. Complete the upload ─────────────────────────────────────────────────
    // Build partSha1Array in strict part-number order (required by B2)
    const partSha1Array = Array.from({ length: totalChunks }, (_, i) => completedParts[i + 1]);

    console.log(`[Storage] All ${totalChunks} chunks uploaded. Completing large file...`);

    // Refresh auth token (long uploads may expire it)
    const { data: freshSession } = await supabase.auth.getSession();
    const freshToken = freshSession.session?.access_token;
    const saveHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (freshToken) saveHeaders["Authorization"] = `Bearer ${freshToken}`;
    else if (headers["Authorization"]) saveHeaders["Authorization"] = headers["Authorization"];

    const completeRes = await fetch(getApiUrl("/api/media/upload/chunk/complete"), {
        method: "POST",
        headers: saveHeaders,
        body: JSON.stringify({
            fileId,
            storageKey,
            eventId,
            fileName: file.name,
            fileSize: file.size,
            resourceType,
            partSha1Array,
        }),
    });

    const completeData = await completeRes.json().catch(() => ({}));
    if (!completeRes.ok) {
        clearResumeState(file.name, file.size);
        throw new Error(completeData.error || `Failed to complete chunked upload (status: ${completeRes.status})`);
    }

    // ── 5. Clean up ────────────────────────────────────────────────────────────
    clearResumeState(file.name, file.size);
    if (onProgress) onProgress(100);

    return {
        url: completeData.url,
        publicId: storageKey,
        width: undefined,
        height: undefined,
        bytes: file.size,
        format: file.name.split(".").pop() || "mp4",
    };
}


export async function uploadEventImage(
    file: File, 
    eventId: string, 
    userId?: string, 
    laneIndex = 0, 
    skipSaveMetadata = false,
    onProgress?: (percent: number) => void
) {
    if (file.size > 100 * 1024 * 1024) { // > 100 MB
        return uploadLargeFileInChunks(file, eventId, onProgress);
    }

    try {
        console.log(`[Storage] Starting direct B2 upload for: ${file.name} to event: ${eventId} (lane: ${laneIndex})`);

        const resourceType = (file.type?.startsWith("video/") || ["mp4", "mov", "avi", "mkv", "webm", "m4v", "3gp", "flv", "wmv", "mts", "m2ts", "ts", "ogv"].includes(file.name.split('.').pop()?.toLowerCase() || "")) ? "video" : "image";
        const { data: { session } } = await supabase.auth.getSession();

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        // 1. Get B2 upload URL and token from Railway
        const getUrlResponse = await fetch(getApiUrl("/api/media/get-upload-url"), {
            method: "POST",
            headers,
            body: JSON.stringify({
                eventId,
                fileName: file.name,
                resourceType,
                laneIndex,
            }),
        });

        const getUrlResult = await getUrlResponse.json().catch(() => ({}));
        if (!getUrlResponse.ok) {
            throw new Error(getUrlResult.error || `Failed to get B2 upload URL (status: ${getUrlResponse.status})`);
        }

        const { uploadUrl, authorizationToken, storageKey } = getUrlResult;

        // 2. Upload file binary directly to Backblaze B2 URL
        console.log(`[Storage] Uploading file binary directly to B2...`);
        let currentUploadUrl = uploadUrl;
        let currentAuthToken = authorizationToken;
        let responseStatus: number;
        let responseText: string;

        try {
            if (typeof XMLHttpRequest === "undefined") {
                // Fallback to fetch (e.g. server-side/test environment)
                const res = await fetch(currentUploadUrl, {
                    method: "POST",
                    headers: {
                        Authorization: currentAuthToken,
                        "Content-Type": file.type || "application/octet-stream",
                        "X-Bz-File-Name": encodeURIComponent(storageKey),
                        "X-Bz-Content-Sha1": "do_not_verify",
                        "Content-Length": String(file.size),
                    },
                    body: file,
                });
                responseStatus = res.status;
                responseText = await res.text();
            } else {
                const xhrResult = await uploadWithXhr(currentUploadUrl, currentAuthToken, storageKey, file, onProgress);
                responseStatus = xhrResult.status;
                responseText = xhrResult.responseText;
            }

            if (responseStatus < 200 || responseStatus >= 300) {
                throw new Error(`Upload failed with status: ${responseStatus}`);
            }
        } catch (fetchErr) {
            console.warn(`[Storage] Direct B2 upload failed for ${file.name}. Requesting fresh upload URL and retrying...`, fetchErr);
            
            const retryUrlResponse = await fetch(getApiUrl("/api/media/get-upload-url"), {
                method: "POST",
                headers,
                body: JSON.stringify({
                    eventId,
                    fileName: file.name,
                    resourceType,
                    laneIndex,
                    forceRefresh: true,
                }),
            });

            const retryUrlResult = await retryUrlResponse.json().catch(() => ({}));
            if (!retryUrlResponse.ok) {
                throw new Error(retryUrlResult.error || `Failed to refresh B2 upload URL during retry (status: ${retryUrlResponse.status})`);
            }

            currentUploadUrl = retryUrlResult.uploadUrl;
            currentAuthToken = retryUrlResult.authorizationToken;

            // Retry the upload one more time with a fresh URL
            if (typeof XMLHttpRequest === "undefined") {
                const res = await fetch(currentUploadUrl, {
                    method: "POST",
                    headers: {
                        Authorization: currentAuthToken,
                        "Content-Type": file.type || "application/octet-stream",
                        "X-Bz-File-Name": encodeURIComponent(storageKey),
                        "X-Bz-Content-Sha1": "do_not_verify",
                        "Content-Length": String(file.size),
                    },
                    body: file,
                });
                responseStatus = res.status;
                responseText = await res.text();
            } else {
                const xhrResult = await uploadWithXhr(currentUploadUrl, currentAuthToken, storageKey, file, onProgress);
                responseStatus = xhrResult.status;
                responseText = xhrResult.responseText;
            }
        }

        if (responseStatus < 200 || responseStatus >= 300) {
            let errorMsg = "Direct B2 upload failed";
            try {
                const parsed = JSON.parse(responseText);
                errorMsg = parsed.message || errorMsg;
            } catch { }
            throw new Error(`${errorMsg} (status: ${responseStatus})`);
        }

        if (!skipSaveMetadata) {
            // 3. Save database record with a fresh session token (prevents token expiration on long uploads)
            console.log(`[Storage] Refreshing session and saving metadata to database...`);
            const { data: freshSessionData } = await supabase.auth.getSession();
            const freshToken = freshSessionData.session?.access_token;
            
            const saveHeaders: Record<string, string> = {
                "Content-Type": "application/json",
            };
            if (freshToken) {
                saveHeaders["Authorization"] = `Bearer ${freshToken}`;
            } else if (headers["Authorization"]) {
                saveHeaders["Authorization"] = headers["Authorization"];
            }

            let saveResponse = await fetch(getApiUrl("/api/media/save-photo"), {
                method: "POST",
                headers: saveHeaders,
                body: JSON.stringify({
                    storageKey,
                    eventId,
                    fileName: file.name,
                    fileSize: file.size,
                    resourceType,
                }),
            });

            // If token expired, try one force-refresh of the Supabase auth session
            if (!saveResponse.ok && (saveResponse.status === 401 || saveResponse.status === 500)) {
                console.warn("[Storage] Save metadata failed, attempting session refresh and retry...");
                const { data: refreshedAuth } = await supabase.auth.refreshSession();
                if (refreshedAuth.session?.access_token) {
                    saveHeaders["Authorization"] = `Bearer ${refreshedAuth.session.access_token}`;
                    saveResponse = await fetch(getApiUrl("/api/media/save-photo"), {
                        method: "POST",
                        headers: saveHeaders,
                        body: JSON.stringify({
                            storageKey,
                            eventId,
                            fileName: file.name,
                            fileSize: file.size,
                            resourceType,
                        }),
                    });
                }
            }

            const saveResult = await saveResponse.json().catch(() => ({}));
            if (!saveResponse.ok) {
                throw new Error(saveResult.error || `Failed to save photo metadata (status: ${saveResponse.status})`);
            }
        }

        // We construct the media URL locally to avoid depending on saveResult.url when skipSaveMetadata is true
        const mediaDomain = process.env.NEXT_PUBLIC_MEDIA_DOMAIN || "media.evebash.com";
        const finalUrl = `https://${mediaDomain}/${storageKey}`;

        return {
            url: finalUrl,
            publicId: storageKey,
            width: undefined,
            height: undefined,
            bytes: file.size,
            format: file.name.split(".").pop() || "jpg",
        };
    } catch (error: unknown) {
        console.error("[Storage] Direct upload flow error:", error);
        throw error;
    }
}

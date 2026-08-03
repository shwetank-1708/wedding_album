import { supabase } from "@/lib/supabase";

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

async function uploadLargeFileInChunks(
    file: File,
    eventId: string,
    onProgress?: (percent: number) => void
) {
    console.log(`[Storage] Starting chunk-wise direct B2 upload for large file: ${file.name} (${file.size} bytes)`);

    const resourceType = file.type.startsWith("video/") ? "video" : "image";
    const { data: { session } } = await supabase.auth.getSession();

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
    }

    // 1. Initiate chunked upload
    const initiateRes = await fetch("/api/media/upload/chunk/initiate", {
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

    const { fileId, storageKey } = initiateData;
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const partSha1Array: string[] = [];

    // 2. Upload chunks sequentially
    for (let partIndex = 0; partIndex < totalChunks; partIndex++) {
        const start = partIndex * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);
        const partNumber = partIndex + 1;

        console.log(`[Storage] Uploading chunk ${partNumber}/${totalChunks} (size: ${chunkBlob.size} bytes)...`);

        let uploadSuccess = false;
        let sha1 = "";
        let attempt = 0;

        while (!uploadSuccess && attempt < 3) {
            attempt++;
            try {
                // Get fresh part upload URL
                const getPartUrlRes = await fetch("/api/media/upload/chunk/part-url", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ fileId }),
                });

                const partUrlData = await getPartUrlRes.json().catch(() => ({}));
                if (!getPartUrlRes.ok) {
                    throw new Error(partUrlData.error || `Failed to get chunk upload URL (status: ${getPartUrlRes.status})`);
                }

                const { uploadUrl, authorizationToken } = partUrlData;

                // Compute actual SHA-1 of the chunk before uploading so we can
                // send it in the header and use it in partSha1Array without
                // depending on what B2 echoes back (which is "do_not_verify"
                // when we use the do_not_verify shortcut).
                const chunkSha1 = await sha1OfBlob(chunkBlob);

                // Send part directly to B2
                const response = await fetch(uploadUrl, {
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

                if (!response.ok) {
                    const errText = await response.text().catch(() => "");
                    throw new Error(`Part upload failed with status ${response.status}: ${errText}`);
                }

                // Use the SHA-1 we computed client-side — it is guaranteed to be
                // a real hash and is not subject to CORS header visibility issues.
                sha1 = chunkSha1;

                uploadSuccess = true;
                partSha1Array.push(sha1);

                // Update progress
                if (onProgress) {
                    const uploadedBytes = start + chunkBlob.size;
                    const percent = Math.min(99, (uploadedBytes / file.size) * 100);
                    onProgress(percent);
                }
            } catch (err) {
                console.warn(`[Storage] Failed to upload part ${partNumber} (attempt ${attempt}/3):`, err);
                if (attempt >= 3) {
                    // Try to clean up/abort on B2 to prevent orphaned files
                    await fetch("/api/media/upload/chunk/abort", {
                        method: "POST",
                        headers,
                        body: JSON.stringify({ fileId }),
                    }).catch(() => {});
                    throw new Error(`Failed to upload part ${partNumber} after 3 attempts: ${err instanceof Error ? err.message : String(err)}`);
                }
                // Sleep for 2 seconds before retry
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
    }

    // 3. Complete the upload
    console.log(`[Storage] All chunks uploaded. Finishing large file and saving metadata...`);
    
    // Refresh token to prevent token expiration
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

    const completeRes = await fetch("/api/media/upload/chunk/complete", {
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
        throw new Error(completeData.error || `Failed to complete chunked upload (status: ${completeRes.status})`);
    }

    if (onProgress) {
        onProgress(100);
    }

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

        const resourceType = file.type.startsWith("video/") ? "video" : "image";
        const { data: { session } } = await supabase.auth.getSession();

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };
        if (session?.access_token) {
            headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        // 1. Get B2 upload URL and token from Railway
        const getUrlResponse = await fetch("/api/media/get-upload-url", {
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
            
            const retryUrlResponse = await fetch("/api/media/get-upload-url", {
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

            let saveResponse = await fetch("/api/media/save-photo", {
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
                    saveResponse = await fetch("/api/media/save-photo", {
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

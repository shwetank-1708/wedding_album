import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { createUploadTask, FileSystemUploadType } from 'expo-file-system/legacy';

type EventUploadResourceType = 'image' | 'video' | 'auto';

type UploadFile = {
    uri: string;
    name: string;
    type: string;
};

function joinUrl(baseUrl: string, path: string) {
    return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export function getEndpointsForPath(path: string) {
    const explicitEndpoint = process.env.EXPO_PUBLIC_MEDIA_UPLOAD_URL?.trim();
    if (explicitEndpoint) {
        const replaced = explicitEndpoint.replace(/\/api\/media\/upload\/?$/, path);
        return [replaced === explicitEndpoint ? joinUrl(explicitEndpoint, path) : replaced];
    }

    const endpoints: string[] = [];

    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
    if (apiBaseUrl) {
        endpoints.push(joinUrl(apiBaseUrl, path));
    }

    const hostUri = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.developer?.hostUri;
    const devHost = typeof hostUri === 'string' ? hostUri.split(':')[0] : '';
    if (devHost) {
        endpoints.push(`http://${devHost}:3000${path}`);
    }

    if (Platform.OS === 'android') {
        endpoints.push(`http://10.0.2.2:3000${path}`);
    }

    endpoints.push(`http://localhost:8080${path}`);

    return Array.from(new Set(endpoints));
}

function getProfileImageDeleteEndpoints() {
    return getEndpointsForPath('/api/media/profile-image');
}

export async function fetchWithEndpointFallback(
    endpoints: string[],
    requestFactory: (endpoint: string) => Promise<Response>,
    context: string
) {
    let lastError: unknown;

    for (const endpoint of endpoints) {
        try {
            console.log(`[Storage] Trying ${context} endpoint: ${endpoint}`);
            return await requestFactory(endpoint);
        } catch (error) {
            lastError = error;
            console.warn(`[Storage] ${context} endpoint failed: ${endpoint}`, error);
        }
    }

    const endpointsStr = endpoints.join(', ');
    throw new Error(`Failed to connect to any ${context} endpoint. Tried: [${endpointsStr}]. Last error: ${lastError instanceof Error ? lastError.message : lastError}`);
}

function inferResourceType(resourceType: EventUploadResourceType, mimeType: string) {
    if (resourceType === 'auto') {
        return mimeType.startsWith('video/') ? 'video' : 'image';
    }
    return resourceType;
}

export async function uploadEventMedia(
    file: UploadFile,
    eventId: string,
    userId?: string,
    resourceType: EventUploadResourceType = 'image'
) {
    try {
        const resolvedResourceType = inferResourceType(resourceType, file.type);
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
            throw new Error('Please log in before uploading media.');
        }

        console.log(`[Storage] Starting direct B2 upload for ${file.name} (event: ${eventId})`);

        // 1. Get B2 upload URL and token
        const getUrlResponse = await fetchWithEndpointFallback(
            getEndpointsForPath('/api/media/get-upload-url'),
            (endpoint) => {
                return fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                        eventId,
                        fileName: file.name,
                        resourceType: resolvedResourceType,
                    }),
                });
            },
            'get upload url'
        );

        const getUrlResult = await getUrlResponse.json().catch(() => ({}));
        if (!getUrlResponse.ok) {
            throw new Error(getUrlResult.error || `Failed to get B2 upload URL (status: ${getUrlResponse.status})`);
        }

        const { uploadUrl, authorizationToken, storageKey, mediaDomain } = getUrlResult;

        // 2. Upload file binary directly to B2 — with retry (max 3 attempts)
        // B2 upload URLs are single-use: a failed attempt invalidates the URL, so we
        // fetch a fresh one on every retry.
        console.log(`[Storage] Uploading file binary directly to B2: ${storageKey}`);
        let uploadResponse: Awaited<ReturnType<ReturnType<typeof createUploadTask>['uploadAsync']>> = undefined;
        let lastUploadError: unknown = null;
        const MAX_UPLOAD_ATTEMPTS = 3;

        let currentUploadUrl = uploadUrl;
        let currentAuthToken = authorizationToken;
        let currentStorageKey = storageKey;

        for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
            try {
                if (attempt > 1) {
                    console.log(`[Storage] Attempt ${attempt}: Fetching fresh B2 upload URL...`);
                    const retryUrlResponse = await fetchWithEndpointFallback(
                        getEndpointsForPath('/api/media/get-upload-url'),
                        (endpoint) => fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                            body: JSON.stringify({ eventId, fileName: file.name, resourceType: resolvedResourceType }),
                        }),
                        'retry get upload url'
                    );
                    const retryResult = await retryUrlResponse.json().catch(() => ({}));
                    if (!retryUrlResponse.ok) {
                        throw new Error(retryResult.error || `Failed to refresh upload URL (status: ${retryUrlResponse.status})`);
                    }
                    currentUploadUrl = retryResult.uploadUrl;
                    currentAuthToken = retryResult.authorizationToken;
                    currentStorageKey = retryResult.storageKey ?? currentStorageKey;
                }

                const uploadTask = createUploadTask(
                    currentUploadUrl,
                    file.uri,
                    {
                        uploadType: FileSystemUploadType.BINARY_CONTENT,
                        headers: {
                            Authorization: currentAuthToken,
                            'Content-Type': file.type || 'application/octet-stream',
                            'X-Bz-File-Name': encodeURIComponent(currentStorageKey),
                            'X-Bz-Content-Sha1': 'do_not_verify',
                        },
                    }
                );

                uploadResponse = await uploadTask.uploadAsync();

                if (!uploadResponse || uploadResponse.status !== 200) {
                    throw new Error(`B2 upload returned status ${uploadResponse?.status ?? 'unknown'}`);
                }

                // Success — break out of retry loop
                lastUploadError = null;
                break;
            } catch (err) {
                lastUploadError = err;
                console.warn(`[Storage] B2 upload attempt ${attempt}/${MAX_UPLOAD_ATTEMPTS} failed:`, err);
                if (attempt < MAX_UPLOAD_ATTEMPTS) {
                    const backoffMs = 1000 * Math.pow(2, attempt - 1); // 1 s, 2 s
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
            }
        }

        if (lastUploadError || !uploadResponse || uploadResponse.status !== 200) {
            throw new Error(
                lastUploadError instanceof Error
                    ? `Direct B2 upload failed after ${MAX_UPLOAD_ATTEMPTS} attempts: ${lastUploadError.message}`
                    : `Direct B2 upload failed after ${MAX_UPLOAD_ATTEMPTS} attempts.`
            );
        }

        // 3. Save metadata to DB
        console.log(`[Storage] Saving photo metadata...`);
        const saveResponse = await fetchWithEndpointFallback(
            getEndpointsForPath('/api/media/save-photo'),
            (endpoint) => {
                return fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({
                        storageKey,
                        eventId,
                        fileName: file.name,
                        resourceType: resolvedResourceType,
                    }),
                });
            },
            'save photo metadata'
        );

        const saveResult = await saveResponse.json().catch(() => ({}));
        if (!saveResponse.ok) {
            throw new Error(saveResult.error || `Failed to save photo metadata (status: ${saveResponse.status})`);
        }

        const finalUrl = `https://${mediaDomain || 'media.evebash.com'}/${storageKey}`;

        return {
            url: finalUrl,
            publicId: storageKey,
            storageKey,
            width: undefined,
            height: undefined,
            bytes: undefined,
            format: file.name.split('.').pop() || 'jpg',
            mediaType: resolvedResourceType === 'video' ? 'video' : 'photo',
            resourceType: resolvedResourceType,
        };
    } catch (error) {
        console.error('[Storage] Error in uploadEventMedia:', error);
        throw error;
    }
}

export async function uploadEventImage(file: UploadFile, eventId: string, userId?: string) {
    return uploadEventMedia(file, eventId, userId, 'image');
}

export async function uploadProfileImage(base64: string, userId: string) {
    try {
        console.log(`[Storage] Starting profile upload to Backblaze for user ${userId}`);

        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
            throw new Error('Please log in before uploading a profile image.');
        }

        const response = await fetchWithEndpointFallback(
            getEndpointsForPath('/api/media/upload'),
            (endpoint) => fetch(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scope: 'profile',
                    base64,
                    fileName: `profile-${userId}.jpg`,
                    contentType: 'image/jpeg',
                    resourceType: 'image',
                }),
            }),
            'profile upload'
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(result.error || 'Upload failed');
        }

        return {
            url: result.url,
            publicId: result.publicId || result.storageKey || '',
        };
    } catch (error) {
        console.error('[Storage] Error in uploadProfileImage:', error);
        throw error;
    }
}

export async function removeProfileImage() {
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        if (!accessToken) {
            throw new Error('Please log in before removing your profile image.');
        }

        const endpoints = getProfileImageDeleteEndpoints();
        let lastError: unknown;

        for (const endpoint of endpoints) {
            try {
                console.log(`[Storage] Trying profile image delete endpoint: ${endpoint}`);
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });

                const result = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error(result.error || 'Failed to remove profile image');
                }

                return result;
            } catch (error) {
                lastError = error;
                console.warn(`[Storage] Profile image delete endpoint failed: ${endpoint}`, error);
            }
        }

        throw new Error(lastError instanceof Error ? lastError.message : 'Failed to remove profile image');
    } catch (error) {
        console.error('[Storage] Error in removeProfileImage:', error);
        throw error;
    }
}

import { Buffer } from "node:buffer";

export type BackblazeAuth = {
  authorizationToken: string;
  apiUrl: string;
  downloadUrl?: string;
};

export type BackblazeUploadUrl = {
  uploadUrl: string;
  authorizationToken: string;
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

let authPromise: Promise<BackblazeAuth> | null = null;
let tokenExpiresAt = 0;

export async function getCachedBackblazeAuth(): Promise<BackblazeAuth> {
  if (authPromise && Date.now() < tokenExpiresAt) {
    return authPromise;
  }

  tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;

  authPromise = (async () => {
    try {
      const keyId = requireEnv("B2_KEY_ID");
      const applicationKey = requireEnv("B2_APPLICATION_KEY");
      const credentials = Buffer.from(`${keyId}:${applicationKey}`).toString("base64");

      console.log("[B2 Auth] Authenticating with Backblaze API...");
      const response = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Backblaze authorization failed with status ${response.status}`);
      }

      const data = await response.json();
      return {
        authorizationToken: data.authorizationToken,
        apiUrl: data.apiInfo.storageApi.apiUrl,
        downloadUrl: data.apiInfo.storageApi.downloadUrl,
      };
    } catch (err) {
      authPromise = null;
      tokenExpiresAt = 0;
      throw err;
    }
  })();

  return authPromise;
}

export function invalidateBackblazeAuth() {
  authPromise = null;
  tokenExpiresAt = 0;
}

export type B2PartInfo = {
  partNumber: number;
  contentLength: number;
  contentSha1: string;
};

export async function listLargeFileParts(
  auth: BackblazeAuth,
  fileId: string,
  startPartNumber = 1,
  maxPartCount = 1000
): Promise<B2PartInfo[]> {
  const parts: B2PartInfo[] = [];
  let nextPartNumber: number | undefined = startPartNumber;

  while (nextPartNumber !== undefined) {
    const res: Response = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_parts`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileId,
        startPartNumber: nextPartNumber,
        maxPartCount,
      }),
    });

    if (res.status === 401) {
      invalidateBackblazeAuth();
      throw new Error("B2 authorization expired while listing parts");
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`b2_list_parts failed with status ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as {
      parts?: Array<{ partNumber: number; contentLength: number; contentSha1: string }>;
      nextPartNumber?: number;
    };
    for (const part of json.parts || []) {
      parts.push({
        partNumber: part.partNumber,
        contentLength: part.contentLength,
        contentSha1: part.contentSha1,
      });
    }

    nextPartNumber = json.nextPartNumber;
  }

  return parts;
}

export async function getUploadUrl(auth: BackblazeAuth): Promise<BackblazeUploadUrl> {
  const bucketId = requireEnv("B2_BUCKET_ID");
  const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_upload_url`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucketId }),
  });

  if (response.status === 401) {
    invalidateBackblazeAuth();
  }

  if (!response.ok) {
    throw new Error(`Backblaze upload URL request failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Backblaze B2 upload URLs are strictly single-use.
 * Caching them across concurrent requests causes 401/503 upload collisions.
 * We now always fetch a fresh upload URL for every request.
 */
export async function getCachedUploadUrl(
  auth: BackblazeAuth,
  _forceRefresh = false,
  _laneIndex = 0,
): Promise<BackblazeUploadUrl> {
  try {
    return await getUploadUrl(auth);
  } catch (err: any) {
    if (err?.message?.includes("401")) {
      invalidateBackblazeAuth();
      const freshAuth = await getCachedBackblazeAuth();
      return await getUploadUrl(freshAuth);
    }
    throw err;
  }
}

export async function startLargeFile(
  auth: BackblazeAuth,
  fileName: string,
  contentType: string,
): Promise<{ fileId: string; fileName: string }> {
  const bucketId = requireEnv("B2_BUCKET_ID");
  const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_start_large_file`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucketId, fileName, contentType }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`b2_start_large_file failed with status ${response.status}: ${errText}`);
  }

  return response.json();
}

export async function getUploadPartUrl(
  auth: BackblazeAuth,
  fileId: string,
): Promise<BackblazeUploadUrl> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_upload_part_url`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fileId }),
    });

    if (response.status === 401) {
      invalidateBackblazeAuth();
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`b2_get_upload_part_url failed with status ${response.status}: ${errText}`);
    }

    const data: BackblazeUploadUrl = await response.json();
    // Intercept known broken/refusing storage pod so browser never gets ERR_CONNECTION_REFUSED
    if (data.uploadUrl && data.uploadUrl.includes("pod-060-1002-05.backblaze.com")) {
      console.warn(`[Backblaze] Intercepted down pod URL (${data.uploadUrl}). Requesting healthy pod retry ${attempt + 1}/3...`);
      continue;
    }

    return data;
  }

  const finalRes = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_upload_part_url`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileId }),
  });
  return finalRes.json();
}

export async function finishLargeFile(
  auth: BackblazeAuth,
  fileId: string,
  partSha1Array: string[],
): Promise<{ contentLength?: number }> {
  const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_finish_large_file`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileId, partSha1Array }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`b2_finish_large_file failed with status ${response.status}: ${errText}`);
  }

  return response.json();
}

export async function cancelLargeFile(auth: BackblazeAuth, fileId: string): Promise<unknown> {
  const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_cancel_large_file`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileId }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`b2_cancel_large_file failed with status ${response.status}: ${errText}`);
  }

  return response.json();
}

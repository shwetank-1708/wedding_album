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

  if (!response.ok) {
    throw new Error(`Backblaze upload URL request failed with status ${response.status}`);
  }

  return response.json();
}

const POOL_SIZE = 5;
const uploadUrlPool: (Promise<BackblazeUploadUrl> | null)[] = new Array(POOL_SIZE).fill(null);
const poolExpiration: number[] = new Array(POOL_SIZE).fill(0);

export async function getCachedUploadUrl(
  auth: BackblazeAuth,
  forceRefresh = false,
  laneIndex = 0,
): Promise<BackblazeUploadUrl> {
  const slotIndex = Number.isFinite(laneIndex) ? Math.abs(laneIndex) % POOL_SIZE : 0;

  if (forceRefresh || !uploadUrlPool[slotIndex] || Date.now() > poolExpiration[slotIndex]) {
    poolExpiration[slotIndex] = Date.now() + 23 * 60 * 60 * 1000;
    uploadUrlPool[slotIndex] = getUploadUrl(auth).catch((err) => {
      uploadUrlPool[slotIndex] = null;
      poolExpiration[slotIndex] = 0;
      throw err;
    });
  }

  return uploadUrlPool[slotIndex]!;
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
  const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_upload_part_url`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fileId }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`b2_get_upload_part_url failed with status ${response.status}: ${errText}`);
  }

  return response.json();
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

import { getCachedBackblazeAuth, invalidateBackblazeAuth } from './backblaze.js';
import { getAdminClient } from './adminAuth.js';

// Resolve storage keys from the database only; callers cannot supply file paths.
export async function deleteGalleryMedia(db: ReturnType<typeof getAdminClient>, photoId: string, eventId: string) {
  const { data: photo, error } = await db.from('photos').select('id, storage_key').eq('id', photoId).eq('event_id', eventId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!photo) return false;
  if (!photo.storage_key) throw new Error('Media storage key is missing; deletion was stopped');
  const bucketId = process.env.B2_BUCKET_ID;
  if (!bucketId) throw new Error('B2_BUCKET_ID is not configured');
  let auth = await getCachedBackblazeAuth();
  const key = String(photo.storage_key);
  const targets = [
    { prefix: key, exact: true },
    { prefix: `${key}-thumbnail.webp`, exact: true },
    { prefix: `${key}-preview.webp`, exact: true },
    { prefix: `hls/${key}/`, exact: false },
    { prefix: `${key}-hls/`, exact: false },
  ];
  const b2 = async (method: string, body: object) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`${auth.apiUrl}/b2api/v3/${method}`, {
        method: 'POST', headers: { Authorization: auth.authorizationToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) return result;
      const code = typeof result.code === 'string' ? result.code : 'unknown';
      if (method === 'b2_delete_file_version' && code === 'file_not_present') return {};
      if (attempt === 0 && (code === 'expired_auth_token' || code === 'bad_auth_token')) {
        invalidateBackblazeAuth();
        auth = await getCachedBackblazeAuth();
        continue;
      }
      console.error('[deleteGalleryMedia] Storage request failed', { method, status: response.status, code });
      const reason = code === 'unauthorized'
        ? 'The staging storage key does not permit this operation. Check its file permissions and bucket/prefix restrictions.'
        : code === 'access_denied'
          ? 'Storage denied deletion; check whether this file has Object Lock retention.'
          : code === 'bad_bucket_id'
            ? 'The configured storage bucket is invalid.'
            : 'The storage provider rejected the request.';
      throw new Error(`${reason} (${method}: HTTP ${response.status}, ${code})`);
    }
    throw new Error('Unable to refresh the storage session. Please retry.');
  };

  for (const target of targets) {
    let startFileName: string | undefined;
    let startFileId: string | undefined;
    do {
      const batch = await b2('b2_list_file_versions', { bucketId, prefix: target.prefix, maxFileCount: 1000, startFileName, startFileId });
      for (const file of batch.files || []) {
        if (target.exact ? file.fileName !== target.prefix : !file.fileName.startsWith(target.prefix)) continue;
        await b2('b2_delete_file_version', { fileName: file.fileName, fileId: file.fileId });
      }
      startFileName = batch.nextFileName || undefined;
      startFileId = batch.nextFileId || undefined;
    } while (startFileName);
  }
  for (const [table, column] of [['faces', 'image_id'], ['likes', 'photo_id'], ['comments', 'photo_id']]) {
    const { error: relatedError } = await db.from(table).delete().eq(column, photoId);
    if (relatedError) throw new Error(relatedError.message);
  }
  const { error: deleteError } = await db.from('photos').delete().eq('id', photoId).eq('event_id', eventId);
  if (deleteError) throw new Error(deleteError.message);
  return true;
}


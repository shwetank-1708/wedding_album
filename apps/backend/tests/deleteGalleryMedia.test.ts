import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteGalleryMedia } from '../src/deleteGalleryMedia.js';
import { invalidateBackblazeAuth } from '../src/backblaze.js';

test('single media deletion is scoped and preserves the row on storage failure', async () => {
  const originalFetch = globalThis.fetch;
  const env = { ...process.env };
  const deletedFiles: string[] = [];
  const deletedRows: string[] = [];
  let exists = true, failStorage = false, expireOnce = false, alreadyRemoved = false, denied = false;
  let authCalls = 0;
  const key = 'events/event-1/photo.jpg';
  const db: any = { from(table: string) {
    let removing = false;
    const filters: Record<string,string> = {};
    const query: any = {
      select() { return query; },
      delete() { removing = true; return query; },
      eq(column: string, value: string) { filters[column] = value; return query; },
      async maybeSingle() {
        assert.equal(filters.id, 'photo-1'); assert.equal(filters.event_id, 'event-1');
        return { data: exists ? { id: 'photo-1', storage_key: key } : null, error: null };
      },
      then(resolve: any) { if (removing) deletedRows.push(table); return Promise.resolve({ error: null }).then(resolve); },
    };
    return query;
  } };
  process.env.B2_BUCKET_ID = 'test'; process.env.B2_KEY_ID = 'test'; process.env.B2_APPLICATION_KEY = 'test';
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body || '{}'));
    if (url.endsWith('b2_authorize_account')) { authCalls++; return Response.json({ authorizationToken: 'test', apiInfo: { storageApi: { apiUrl: 'https://b2.test' } } }); }
    if (url.endsWith('b2_list_file_versions')) {
      if (expireOnce) { expireOnce = false; return Response.json({ code: 'expired_auth_token' }, { status: 401 }); }
      if (denied) return Response.json({ code: 'unauthorized' }, { status: 401 });
      if (failStorage) return new Response('', { status: 503 });
      return Response.json({ files: [
        { fileName: body.prefix.endsWith('/') ? `${body.prefix}segment.ts` : body.prefix, fileId: 'version-1' },
        ...(body.prefix === key ? [{fileName: `${key}-unrelated`, fileId: 'other'}] : []),
      ] });
    }
    assert.ok(url.endsWith('b2_delete_file_version'));
    if (alreadyRemoved) return Response.json({ code: 'file_not_present' }, { status: 400 });
    deletedFiles.push(body.fileName); return Response.json({});
  };
  try {
    exists = false;
    assert.equal(await deleteGalleryMedia(db, 'photo-1', 'event-1'), false);
    assert.equal(deletedFiles.length, 0);
    exists = true; failStorage = true;
    await assert.rejects(deleteGalleryMedia(db, 'photo-1', 'event-1'), /storage provider rejected/);
    assert.deepEqual(deletedRows, []);
    failStorage = false;
    assert.equal(await deleteGalleryMedia(db, 'photo-1', 'event-1'), true);
    assert.equal(deletedFiles.length, 5);
    assert.ok(!deletedFiles.includes(`${key}-unrelated`));
    assert.ok(deletedFiles.includes(`hls/${key}/segment.ts`));
    assert.deepEqual(deletedRows, ['faces', 'likes', 'comments', 'photos']);
    expireOnce = true; alreadyRemoved = true;
    assert.equal(await deleteGalleryMedia(db, 'photo-1', 'event-1'), true);
    assert.equal(authCalls, 2);
    const rowsBeforeDenial = deletedRows.length;
    denied = true;
    await assert.rejects(deleteGalleryMedia(db, 'photo-1', 'event-1'), /permissions.*b2_list_file_versions: HTTP 401, unauthorized/);
    assert.equal(deletedRows.length, rowsBeforeDenial);
  } finally {
    globalThis.fetch = originalFetch; invalidateBackblazeAuth();
    for (const name of ['B2_BUCKET_ID','B2_KEY_ID','B2_APPLICATION_KEY']) {
      if (env[name] === undefined) delete process.env[name]; else process.env[name] = env[name];
    }
  }
});

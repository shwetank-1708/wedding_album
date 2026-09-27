const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

function storage(fetch) {
  const exports = {};
  const saved = new Map();
  const context = {
    exports, fetch, AbortController, AbortSignal, DOMException, Response, setTimeout, clearTimeout,
    crypto: webcrypto, console: { log() {}, warn() {}, error() {} },
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
    require: name => name.includes('supabase') ? { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test' } } }) } } } : { getApiUrl: url => url },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/storage.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { upload: exports.uploadEventImage, saved };
}
const file = () => new File([new Uint8Array(15000)], 'test.mp4', { type: 'video/mp4' });
test('queued cancellation starts no network requests', async () => {
  const controller = new AbortController(); controller.abort();
  const { upload } = storage(async () => { assert.fail('network called'); });
  await assert.rejects(upload(file(), 'event', 'user', 0, true, undefined, controller.signal), { name: 'AbortError' });
});
for (const cleanupFails of [false, true]) test(`active cancellation aborts transfer, skips finalisation, cleanup failure=${cleanupFails}`, async () => {
  const controller = new AbortController(); const calls = [];
  const { upload, saved } = storage(async (url, init) => {
    calls.push(url);
    if (url.endsWith('/initiate')) return Response.json({ fileId: 'id', storageKey: 'events/test' });
    if (url.endsWith('/part-url')) return Response.json({ uploadUrl: 'https://upload.test', authorizationToken: 'test' });
    if (url === 'https://upload.test') {
      return new Promise((resolve, reject) => { init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }); controller.abort(); });
    }
    if (url.endsWith('/abort')) return Response.json(cleanupFails ? { error: 'Cleanup failed' } : { success: true }, { status: cleanupFails ? 500 : 200 });
    assert.fail(`Unexpected request ${url}`);
  });
  await assert.rejects(upload(file(), 'event', 'user', 0, true, undefined, controller.signal), cleanupFails ? /Cleanup failed/ : { name: 'AbortError' });
  assert.equal(calls.filter(url => url === 'https://upload.test').length, 1);
  assert.equal(calls.filter(url => url.endsWith('/abort')).length, 1);
  assert.equal(saved.size, cleanupFails ? 1 : 0);
});
test('successful upload finalises once and is never aborted', async () => {
  const controller = new AbortController(); let finalizing = false;
  const { upload } = storage(async url => {
    if (url.endsWith('/initiate')) return Response.json({ fileId: 'id', storageKey: 'events/test' });
    if (url.endsWith('/part-url')) return Response.json({ uploadUrl: 'https://upload.test', authorizationToken: 'test' });
    if (url === 'https://upload.test' || url.endsWith('/complete-part')) return Response.json({});
    if (url.endsWith('/complete')) { assert.equal(finalizing, true); return Response.json({ url: 'https://media.test/video.mp4' }); }
    assert.fail(`Unexpected request ${url}`);
  });
  const result = await upload(file(), 'event', 'user', 0, true, undefined, controller.signal, () => { finalizing = true; });
  assert.equal(result.url, 'https://media.test/video.mp4');
});

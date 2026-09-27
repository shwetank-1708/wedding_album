import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadGalleryPage, isGalleryVideo } from '../src/lib/galleryMedia';
import type { GalleryMedia } from '../src/lib/adminApi';

const mixed: GalleryMedia[] = Array.from({ length: 220 }, (_, index) => ({
  id: String(index), url: 'https://example.com/media',
  media_type: index % 3 === 0 ? 'video' : null,
  resource_type: index % 7 === 0 ? 'video' : null,
}));

for (const type of ['images', 'videos'] as const) {
  test(`${type}: legacy mixed responses are filtered across pages without gaps`, async () => {
    const expected = mixed.filter(item => isGalleryVideo(item) === (type === 'videos'));
    const actual: GalleryMedia[] = [];
    for (let page = 0; ; page++) {
      const result = await loadGalleryPage(async offset => ({
        success: true, media: mixed.slice(offset, offset + 48), hasMore: offset + 48 < mixed.length,
      }), type, page);
      actual.push(...result.media);
      assert.ok(result.media.every(item => isGalleryVideo(item) === (type === 'videos')));
      if (!result.hasMore) break;
    }
    assert.deepEqual(actual, expected);
  });
}
test('updated backend uses a single filtered page request', async () => {
  const offsets: number[] = [];
  const result = await loadGalleryPage(async offset => {
    offsets.push(offset);
    return { success: true, appliedMediaType: 'videos', media: [mixed[0]], hasMore: true };
  }, 'videos', 2);
  assert.deepEqual(offsets, [96]);
  assert.equal(result.hasMore, true);
});
test('empty matching type returns an empty page', async () => {
  const result = await loadGalleryPage(async () => ({ success: true, media: [mixed[0]], hasMore: false }), 'images', 0);
  assert.deepEqual(result, { media: [], hasMore: false });
});
test('API errors are surfaced', async () => {
  await assert.rejects(loadGalleryPage(async () => ({ success: false, error: 'Access denied' }), 'images', 0), /Access denied/);
});
test('stale requests stop before scanning another page', async () => {
  await assert.rejects(loadGalleryPage(async () => ({ success: true, media: mixed.slice(0,48), hasMore: true }), 'images', 0, () => false), /cancelled/);
});

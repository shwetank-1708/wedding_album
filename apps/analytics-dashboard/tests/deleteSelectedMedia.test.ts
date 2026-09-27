import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deleteSelectedMedia } from '../src/lib/deleteSelectedMedia';

test('batch deletes each unique selection and preserves failures for retry', async () => {
  const calls: string[] = [];
  const progress: number[] = [];
  const result = await deleteSelectedMedia(['image-1', 'video-1', 'image-1', 'video-2', 'image-2'], async id => {
    calls.push(id);
    if (id === 'video-1') return { success: false, error: 'Storage denied' };
    if (id === 'video-2') throw new Error('Network failure');
    return { success: true };
  }, (completed, total) => { progress.push(completed); assert.equal(total, 4); });
  assert.deepEqual(calls, ['image-1', 'video-1', 'video-2', 'image-2']);
  assert.deepEqual(result.deleted, ['image-1', 'image-2']);
  assert.deepEqual(result.failed, [{ id: 'video-1', error: 'Storage denied' }, { id: 'video-2', error: 'Network failure' }]);
  assert.deepEqual(progress, [1, 2, 3, 4]);
});
test('empty selection sends no deletion requests', async () => {
  const result = await deleteSelectedMedia([], async () => { throw new Error('Unexpected call'); }, () => {});
  assert.deepEqual(result, { deleted: [], failed: [] });
});

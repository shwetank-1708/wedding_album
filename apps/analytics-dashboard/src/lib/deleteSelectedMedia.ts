export async function deleteSelectedMedia(
  ids: string[],
  remove: (id: string) => Promise<{ success: boolean; error?: string }>,
  onProgress: (completed: number, total: number) => void,
) {
  const uniqueIds = [...new Set(ids)];
  const deleted: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const id of uniqueIds) {
    try {
      const result = await remove(id);
      if (!result.success) throw new Error(result.error || 'Deletion failed');
      deleted.push(id);
    } catch (error) {
      failed.push({ id, error: error instanceof Error ? error.message : 'Deletion failed' });
    }
    onProgress(deleted.length + failed.length, uniqueIds.length);
  }
  return { deleted, failed };
}

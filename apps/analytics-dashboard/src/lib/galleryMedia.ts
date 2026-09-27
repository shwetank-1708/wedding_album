import { supabase } from './supabase';
import { runAdminAction, type AdminActionResult, type GalleryMedia } from './adminApi';

export type GalleryMediaType = 'images' | 'videos';
export const isGalleryVideo = (media: GalleryMedia) => media.media_type === 'video' || media.resource_type === 'video';

// Older deployments ignore mediaType. Scan their mixed pages so filtering still
// covers the entire gallery rather than just the currently displayed page.
export async function loadGalleryPage(
  fetchPage: (offset: number) => Promise<AdminActionResult>,
  mediaType: GalleryMediaType,
  page: number,
  isActive: () => boolean = () => true,
): Promise<{ media: GalleryMedia[]; hasMore: boolean }> {
  const size = 48;
  const start = page * size;
  const matches = (item: GalleryMedia) => isGalleryVideo(item) === (mediaType === 'videos');
  const read = async (offset: number) => {
    const result = await fetchPage(offset);
    if (!isActive()) throw new Error('Gallery request cancelled');
    if (!result.success) throw new Error(result.error || 'Unable to load gallery');
    return result;
  };
  let result = await read(start);
  if (result.appliedMediaType === mediaType) {
    return { media: (result.media || []).filter(matches), hasMore: !!result.hasMore };
  }
  if (start !== 0) result = await read(0);
  const matching: GalleryMedia[] = [];
  let offset = 0;
  while (true) {
    const batch = result.media || [];
    matching.push(...batch.filter(matches));
    if (matching.length > start + size || !result.hasMore) {
      return { media: matching.slice(start, start + size), hasMore: matching.length > start + size };
    }
    if (batch.length === 0) throw new Error('Unable to load the next gallery page. Please retry.');
    offset += batch.length;
    result = await read(offset);
  }
}

export async function directFetchGalleryMedia(
  eventId: string,
  offset: number = 0,
  mediaType?: GalleryMediaType
): Promise<AdminActionResult> {
  try {
    let mediaQuery = supabase
      .from('photos')
      .select('id, url, thumbnail_url, media_type, resource_type')
      .eq('event_id', eventId);

    if (mediaType === 'videos') {
      mediaQuery = mediaQuery.or('media_type.eq.video,resource_type.eq.video');
    } else if (mediaType === 'images') {
      mediaQuery = mediaQuery
        .or('media_type.is.null,media_type.neq.video')
        .or('resource_type.is.null,resource_type.neq.video');
    }

    const { data: media, error } = await mediaQuery.order('id').range(offset, offset + 48);

    if (error) {
      // Fallback query if PostgreSQL .or syntax fails on specific schemas
      const fallbackQuery = await supabase
        .from('photos')
        .select('id, url, thumbnail_url, media_type, resource_type')
        .eq('event_id', eventId)
        .order('id');

      if (fallbackQuery.error) throw fallbackQuery.error;

      let allMedia = fallbackQuery.data || [];
      if (mediaType === 'videos') {
        allMedia = allMedia.filter(m => m.media_type === 'video' || m.resource_type === 'video');
      } else if (mediaType === 'images') {
        allMedia = allMedia.filter(m => m.media_type !== 'video' && m.resource_type !== 'video');
      }

      const slice = allMedia.slice(offset, offset + 48);
      return {
        success: true,
        appliedMediaType: mediaType || null,
        media: slice.map(m => ({
          id: String(m.id),
          url: m.url,
          thumbnail_url: m.thumbnail_url,
          media_type: m.media_type,
          resource_type: m.resource_type,
        })),
        hasMore: allMedia.length > offset + 48,
      };
    }

    const list = (media || []).map(m => ({
      id: String(m.id),
      url: m.url,
      thumbnail_url: m.thumbnail_url,
      media_type: m.media_type,
      resource_type: m.resource_type,
    }));

    return {
      success: true,
      appliedMediaType: mediaType || null,
      media: list.slice(0, 48),
      hasMore: list.length > 48,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to fetch gallery media directly from database',
    };
  }
}

export async function directDeleteGalleryMedia(photoId: string, eventId: string): Promise<AdminActionResult> {
  // Try backend first if it is reachable, so B2 storage files can be cleaned up
  try {
    const backendResult = await runAdminAction('deleteGalleryMedia', { photoId, eventId, confirm: 'DELETE_MEDIA' });
    if (backendResult.success) return backendResult;
    if (backendResult.error && !backendResult.error.includes('backend API') && !backendResult.error.includes('Failed to fetch')) {
      return backendResult;
    }
  } catch {
    // Backend is offline / unreachable, fallback to direct database deletion
  }

  try {
    for (const [table, column] of [['faces', 'image_id'], ['likes', 'photo_id'], ['comments', 'photo_id']] as const) {
      await supabase.from(table).delete().eq(column, photoId);
    }
    const { error } = await supabase.from('photos').delete().eq('id', photoId).eq('event_id', eventId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Failed to delete photo from database',
    };
  }
}

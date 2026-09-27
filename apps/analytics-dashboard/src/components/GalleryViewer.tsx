import { deleteSelectedMedia } from '../lib/deleteSelectedMedia';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Event } from '../lib/analytics';
import type { GalleryMedia } from '../lib/adminApi';
import {
  directFetchGalleryMedia,
  directDeleteGalleryMedia,
  loadGalleryPage,
  isGalleryVideo as isVideo,
} from '../lib/galleryMedia';

const buttonClass = 'rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-40';

export function GalleryViewer({ initialGallery, events, onClose }: {
  initialGallery: Event;
  events: Event[];
  onClose: () => void;
}) {
  const [gallery, setGallery] = useState(initialGallery);
  const [media, setMedia] = useState<GalleryMedia[]>([]);
  const [page, setPage] = useState(0);
  const [mediaType, setMediaType] = useState<'images' | 'videos'>('images');
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [checked, setChecked] = useState<Map<string, string>>(new Map());
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number } | null>(null);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkFailures, setBulkFailures] = useState<{ id: string; label: string; error: string }[]>([]);
  const deleting = !!deletingId || !!bulkProgress;
  const toggleChecked = (id: string, label: string) => setChecked(previous => {
    const next = new Map(previous);
    if (next.has(id)) next.delete(id); else next.set(id, label);
    return next;
  });
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const parent = events.find(event => event.id === gallery.parentId);
  const children = events.filter(event => event.parentId === gallery.id);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setMedia([]);
    setHasMore(false);
    setSelected(null);
    async function load() {
      try {
        const result = await loadGalleryPage(
          offset => directFetchGalleryMedia(gallery.id, offset, mediaType),
          mediaType, page, () => active,
        );
        if (!active) return;
        setMedia(result.media || []);
        setHasMore(!!result.hasMore);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load gallery');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [gallery.id, page, mediaType, retry]);

  useEffect(() => {
    if (selected !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [selected]);

  const deleteMedia = async (item: GalleryMedia) => {
    if (deleting || !window.confirm(`Permanently delete this ${isVideo(item) ? 'video' : 'image'} from “${gallery.title}”? This cannot be undone.`)) return;
    setDeletingId(item.id);
    setDeleteError('');
    try {
      const result = await directDeleteGalleryMedia(item.id, gallery.id);
      if (!result.success) throw new Error(result.error || 'Unable to delete media');
      setChecked(previous => { const next = new Map(previous); next.delete(item.id); return next; });
      setSelected(null);
      setMedia(items => items.filter(existing => existing.id !== item.id));
      if (media.length === 1 && page > 0) setPage(value => value - 1);
      else setRetry(value => value + 1);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Unable to delete media');
    } finally {
      setDeletingId(null);
    }
  };

  const deleteChecked = async () => {
    if (deleting || checked.size === 0 || !window.confirm(`Permanently delete ${checked.size} selected images/videos from “${gallery.title}”? This includes selections on other pages and tabs. This cannot be undone.`)) return;
    const selection = new Map(checked);
    setBulkProgress({ completed: 0, total: selection.size });
    setDeleteError(''); setBulkMessage(''); setBulkFailures([]); setSelected(null);
    try {
      const result = await deleteSelectedMedia(
        [...selection.keys()],
        photoId => directDeleteGalleryMedia(photoId, gallery.id),
        (completed, total) => setBulkProgress({ completed, total }),
      );
      setChecked(new Map(result.failed.map(item => [item.id, selection.get(item.id) || item.id])));
      setBulkFailures(result.failed.map(item => ({ ...item, label: selection.get(item.id) || item.id })));
      setBulkMessage(`${result.deleted.length} deleted. ${result.failed.length} failed.${result.failed.length ? ' Failed items remain selected for retry.' : ''}`);
      setPage(0); setRetry(value => value + 1);
    } finally {
      setBulkProgress(null);
    }
  };

  const navigate = (event: Event) => { setChecked(new Map()); setBulkMessage(''); setBulkFailures([]); setDeleteError(''); setGallery(event); setPage(0); setSelected(null); };
  const current = selected === null ? null : media[selected];

  return <section className="space-y-6">
    <fieldset disabled={deleting} className="min-w-0 space-y-6">
    <button type="button" onClick={onClose} className={buttonClass}>← Back to User Accounts</button>
    <div>
      <h2 className="text-2xl font-bold text-white">{gallery.title || 'Untitled Gallery'}</h2>
      <p className="mt-1 text-sm text-slate-400">Photos and videos in this gallery’s home section</p>
    </div>
    {parent && <button type="button" onClick={() => navigate(parent)} className={buttonClass}>← {parent.title}</button>}
    {children.length > 0 && <nav aria-label="Sub-galleries" className="flex flex-wrap gap-2">
      {children.map(child => <button key={child.id} type="button" onClick={() => navigate(child)} className={buttonClass}>{child.title || 'Untitled Sub-gallery'}</button>)}
    </nav>}
    <div role="group" aria-label="Media type" className="flex gap-2">
      {(['images', 'videos'] as const).map(type => <button
        key={type}
        type="button"
        aria-pressed={mediaType === type}
        onClick={() => { if (type !== mediaType) { setMedia([]); setHasMore(false); setLoading(true); setMediaType(type); setPage(0); setSelected(null); } }}
        className={`${buttonClass} ${mediaType === type ? 'border-violet-400 bg-violet-600 text-white' : ''}`}
      >{type === 'images' ? 'Images' : 'Videos'}</button>)}
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={loading || media.length === 0} onClick={() => setChecked(previous => {
        const next = new Map(previous);
        const allChecked = media.every(item => next.has(item.id));
        media.forEach((item, index) => {
          if (allChecked) next.delete(item.id);
          else next.set(item.id, `${isVideo(item) ? 'Video' : 'Image'} ${page * 48 + index + 1}`);
        });
        return next;
      })} className={buttonClass}>{media.length > 0 && media.every(item => checked.has(item.id)) ? 'Deselect page' : 'Select page'}</button>
      <span className="text-sm text-slate-300">{checked.size} selected across pages and tabs</span>
      {checked.size > 0 && <>
        <button type="button" onClick={() => setChecked(new Map())} className={buttonClass}>Clear selection</button>
        <button type="button" onClick={() => void deleteChecked()} className="flex items-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm text-white hover:bg-rose-500 disabled:opacity-40"><Trash2 aria-hidden="true" className="h-4 w-4" />Delete selected ({checked.size})</button>
      </>}
    </div>
    {bulkProgress && <p role="status" className="text-slate-300">Deleting selected media: {bulkProgress.completed} / {bulkProgress.total}. Keep this gallery open.</p>}
    {bulkMessage && <p role="status" className="text-slate-300">{bulkMessage}</p>}
    {bulkFailures.length > 0 && <details className="text-sm text-rose-300"><summary>View failed deletions</summary><ul className="mt-2 space-y-2">{bulkFailures.map(item => <li key={item.id}>{item.label} ({item.id}): {item.error}</li>)}</ul></details>}
    {deleteError && <p role="alert" className="text-rose-300">{deleteError}</p>}
    {deletingId && <p role="status" className="text-slate-400">Deleting media…</p>}
    {loading && <p role="status" className="text-slate-400">Loading gallery…</p>}
    {error && <div role="alert" className="space-y-3 text-rose-300"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className={buttonClass}>Retry</button></div>}
    {!loading && !error && media.length === 0 && <p className="text-slate-400">No {mediaType} in this section. Select a sub-gallery above if available.</p>}
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {media.map((item, index) => <div key={item.id} className={`relative overflow-hidden rounded-xl border bg-slate-900 ${checked.has(item.id) ? 'border-violet-400 ring-2 ring-violet-400' : 'border-slate-700'}`}>
      <label className="absolute left-2 top-2 z-10 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-black/70"><input type="checkbox" checked={checked.has(item.id)} onChange={() => toggleChecked(item.id, `${isVideo(item) ? 'Video' : 'Image'} ${page * 48 + index + 1}`)} aria-label={`Select ${isVideo(item) ? 'video' : 'image'} ${page * 48 + index + 1}`} className="h-5 w-5 accent-violet-600" /></label>
      <button type="button" onClick={() => setSelected(index)} aria-label={`Open ${isVideo(item) ? 'video' : 'photo'} ${page * 48 + index + 1}`} className="block w-full overflow-hidden text-left text-slate-300">
        {isVideo(item) ? <div className="relative flex aspect-square items-center justify-center bg-black">
          {item.thumbnail_url && <img src={item.thumbnail_url} alt="" loading="lazy" className="absolute h-full w-full object-cover" />}
          <span className="relative rounded bg-black/70 px-3 py-2">▶ Video</span>
        </div> : <img src={item.thumbnail_url || item.preview_url || item.url} alt={`Photo ${page * 48 + index + 1}`} loading="lazy" className="aspect-square w-full object-cover" onError={event => { if (event.currentTarget.getAttribute('src') !== item.url) event.currentTarget.src = item.url; }} />}
        <span className="block px-3 py-2 text-xs">{isVideo(item) ? 'Video' : 'Photo'} {page * 48 + index + 1}</span>
      </button>
      <button type="button" onClick={() => void deleteMedia(item)} aria-label={`Delete ${isVideo(item) ? 'video' : 'image'} ${page * 48 + index + 1}`} title={isVideo(item) ? 'Delete video' : 'Delete image'} className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white shadow-md transition-colors hover:bg-rose-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40">{deletingId === item.id ? <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" /> : <Trash2 aria-hidden="true" className="h-5 w-5" />}</button>
      </div>)}
    </div>
    <div className="flex items-center gap-3">
      <button type="button" disabled={loading || page === 0} onClick={() => setPage(value => value - 1)} className={buttonClass}>Previous page</button>
      <span className="text-sm text-slate-400">Page {page + 1}</span>
      <button type="button" disabled={loading || !hasMore} onClick={() => setPage(value => value + 1)} className={buttonClass}>Next page</button>
    </div>
    </fieldset>
    <dialog ref={dialog} onCancel={() => setSelected(null)} onClose={() => setSelected(null)} aria-label="Gallery media viewer" className="fixed inset-0 m-auto max-h-[95vh] w-[min(1100px,95vw)] max-w-none rounded-xl border border-slate-600 bg-slate-950 p-4 text-white backdrop:bg-black/80">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setSelected(null)} className={buttonClass}>Close</button>
        <div className="flex gap-2">
          <button type="button" disabled={selected === null || selected === 0} onClick={() => setSelected(value => value === null ? null : value - 1)} className={buttonClass}>Previous</button>
          <button type="button" disabled={selected === null || selected >= media.length - 1} onClick={() => setSelected(value => value === null ? null : value + 1)} className={buttonClass}>Next</button>
        </div>
      </div>
      {current && (isVideo(current)
        ? <video key={current.id} src={current.url} poster={current.thumbnail_url || undefined} controls playsInline className="max-h-[75vh] w-full" />
        : <img key={current.id} src={current.url} alt="Selected gallery photo" className="max-h-[75vh] w-full object-contain" />)}
    </dialog>
  </section>;
}

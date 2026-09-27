import React, { useState, useMemo, useEffect } from 'react';
import type { Event, UserProfile, GuestLog, Photo } from '../lib/analytics';
import { GalleryViewer } from './GalleryViewer';
import {
  Search,
  Calendar,
  Folder,
  Database,
  Image,
  Video,
  Users,
  ShieldAlert,
  Award,
  AlertTriangle,
  CheckCircle2,
  Ghost,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  Filter,
  X,
  Eye,
  ChevronRight,
  ChevronDown,
  Layers,
} from 'lucide-react';

interface Props {
  events: Event[];
  users: UserProfile[];
  guests: GuestLog[];
  photos: Photo[];
}

interface GalleryDetailItem extends Event {
  creatorName: string;
  creatorEmail: string;
  ownPhotos: number;
  ownVideos: number;
  ownPhotoBytes: number;
  ownVideoBytes: number;
  ownDataUsed: number;
  ownGuestsCount: number;
  totalPhotos: number;
  totalVideos: number;
  photoBytes: number;
  videoBytes: number;
  dataUsed: number;
  guestsCount: number;
  totalAdmins: number;
  vendorsLinked: number;
  statusLabel: string;
  isSubGallery: boolean;
  isGhost: boolean;
  subGalleries: GalleryDetailItem[];
}

type SortColumn =
  | 'id'
  | 'title'
  | 'creatorName'
  | 'creatorEmail'
  | 'status'
  | 'photos'
  | 'videos'
  | 'dataUsed'
  | 'guests'
  | 'admins'
  | 'vendors'
  | 'createdAt';

type SortDirection = 'asc' | 'desc';

const sortColumnLabelMap: Record<SortColumn, string> = {
  id: 'Gallery ID',
  title: 'Gallery Name',
  creatorName: 'Creator Name',
  creatorEmail: 'Creator Email',
  status: 'Gallery Status',
  photos: 'Photos',
  videos: 'Videos',
  dataUsed: 'Data Used',
  guests: 'Guests',
  admins: 'Admins',
  vendors: 'Vendors',
  createdAt: 'Created Date',
};

const formatSize = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const sizeIndex = Math.min(Math.max(0, i), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2)) + ' ' + sizes[sizeIndex];
};

const getInitials = (name?: string) => {
  return (name || 'U')
    .trim()
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const getSubLetter = (index: number) => {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode(97 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
};

export const EventGrid: React.FC<Props> = ({ events, users, guests, photos }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'deleted'>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [viewingGallery, setViewingGallery] = useState<Event | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const copyToClipboard = (text: string, key: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey(prev => (prev === key ? null : prev));
      }, 1500);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 1. Group active events into Main Galleries and Sub-Galleries with metric summation rollup
  const hierarchyGalleries = useMemo<GalleryDetailItem[]>(() => {
    const knownEventIds = new Set(events.map(e => e.id));

    // Pre-calculate per-event metrics for all database events
    const rawMetricsMap = new Map<
      string,
      {
        totalPhotos: number;
        totalVideos: number;
        photoBytes: number;
        videoBytes: number;
        dataUsed: number;
        guestsCount: number;
        totalAdmins: number;
        vendorsLinked: number;
        creatorName: string;
        creatorEmail: string;
      }
    >();

    events.forEach(event => {
      const creator = users.find(u => u.id === (event.createdById || event.createdBy));
      const creatorName = creator ? (creator.name || creator.email || 'Unknown Owner') : 'Unknown Owner';
      const creatorEmail = creator ? (creator.email || 'N/A') : 'N/A';

      const eventPhotos = photos.filter(p => p.eventId === event.id);
      const totalPhotos = eventPhotos.filter(p => p.mediaType !== 'video').length;
      const totalVideos = eventPhotos.filter(p => p.mediaType === 'video').length;
      const photoBytes = eventPhotos
        .filter(p => p.mediaType !== 'video')
        .reduce((sum, p) => sum + (Number(p.size) || 0), 0);
      const videoBytes = eventPhotos
        .filter(p => p.mediaType === 'video')
        .reduce((sum, p) => sum + (Number(p.size) || 0), 0);
      const dataUsed = photoBytes + videoBytes;

      const eventGuests = guests.filter(g => g.eventId === event.id);
      const guestsCount = eventGuests.length;
      const guestAdminsCount = eventGuests.filter(g => g.canAdmin).length;
      const totalAdmins = 1 + guestAdminsCount;
      const vendorsLinked = event.vendors ? event.vendors.length : 0;

      rawMetricsMap.set(event.id, {
        totalPhotos,
        totalVideos,
        photoBytes,
        videoBytes,
        dataUsed,
        guestsCount,
        totalAdmins,
        vendorsLinked,
        creatorName,
        creatorEmail,
      });
    });

    // Separate main events and sub-events
    const mainEvents = events.filter(e => !e.parentId && e.type !== 'sub');
    const subEvents = events.filter(e => Boolean(e.parentId) || e.type === 'sub');

    // Index sub-events by parentId
    const subEventsByParent = new Map<string, Event[]>();
    const mainEventIdSet = new Set(mainEvents.map(m => m.id));
    const orphanSubEvents: Event[] = [];

    subEvents.forEach(sub => {
      const pId = sub.parentId || '';
      if (pId && mainEventIdSet.has(pId)) {
        const list = subEventsByParent.get(pId) || [];
        list.push(sub);
        subEventsByParent.set(pId, list);
      } else {
        orphanSubEvents.push(sub);
      }
    });

    // Build main gallery tree items with summation rollup
    const mainTree: GalleryDetailItem[] = mainEvents.map(event => {
      const metrics = rawMetricsMap.get(event.id)!;
      const isDeleted = Boolean(event.isDeleted) || event.status === 'deleted';

      // Build child sub-gallery items
      const childEvents = subEventsByParent.get(event.id) || [];
      const subGalleries: GalleryDetailItem[] = childEvents.map(child => {
        const cMetrics = rawMetricsMap.get(child.id)!;
        const cDeleted = Boolean(child.isDeleted) || child.status === 'deleted';
        return {
          ...child,
          creatorName: cMetrics.creatorName,
          creatorEmail: cMetrics.creatorEmail,
          ownPhotos: cMetrics.totalPhotos,
          ownVideos: cMetrics.totalVideos,
          ownPhotoBytes: cMetrics.photoBytes,
          ownVideoBytes: cMetrics.videoBytes,
          ownDataUsed: cMetrics.dataUsed,
          ownGuestsCount: cMetrics.guestsCount,
          totalPhotos: cMetrics.totalPhotos,
          totalVideos: cMetrics.totalVideos,
          photoBytes: cMetrics.photoBytes,
          videoBytes: cMetrics.videoBytes,
          dataUsed: cMetrics.dataUsed,
          guestsCount: cMetrics.guestsCount,
          totalAdmins: cMetrics.totalAdmins,
          vendorsLinked: cMetrics.vendorsLinked,
          isDeleted: cDeleted,
          statusLabel: cDeleted ? 'Deleted' : 'Active',
          isSubGallery: true,
          isGhost: false,
          subGalleries: [],
        };
      });

      // Summation rollup: main event own metrics + sum of all child sub-galleries
      const sumPhotos = metrics.totalPhotos + subGalleries.reduce((s, c) => s + c.totalPhotos, 0);
      const sumVideos = metrics.totalVideos + subGalleries.reduce((s, c) => s + c.totalVideos, 0);
      const sumPhotoBytes = metrics.photoBytes + subGalleries.reduce((s, c) => s + c.photoBytes, 0);
      const sumVideoBytes = metrics.videoBytes + subGalleries.reduce((s, c) => s + c.videoBytes, 0);
      const sumDataUsed = metrics.dataUsed + subGalleries.reduce((s, c) => s + c.dataUsed, 0);
      const sumGuests = metrics.guestsCount + subGalleries.reduce((s, c) => s + c.guestsCount, 0);

      return {
        ...event,
        creatorName: metrics.creatorName,
        creatorEmail: metrics.creatorEmail,
        ownPhotos: metrics.totalPhotos,
        ownVideos: metrics.totalVideos,
        ownPhotoBytes: metrics.photoBytes,
        ownVideoBytes: metrics.videoBytes,
        ownDataUsed: metrics.dataUsed,
        ownGuestsCount: metrics.guestsCount,
        totalPhotos: sumPhotos,
        totalVideos: sumVideos,
        photoBytes: sumPhotoBytes,
        videoBytes: sumVideoBytes,
        dataUsed: sumDataUsed,
        guestsCount: sumGuests,
        totalAdmins: metrics.totalAdmins,
        vendorsLinked: metrics.vendorsLinked,
        isDeleted,
        statusLabel: isDeleted ? 'Deleted' : 'Active',
        isSubGallery: false,
        isGhost: false,
        subGalleries,
      };
    });

    // Orphan sub-galleries (parent does not exist in mainEvents)
    const orphanItems: GalleryDetailItem[] = orphanSubEvents.map(event => {
      const metrics = rawMetricsMap.get(event.id)!;
      const isDeleted = Boolean(event.isDeleted) || event.status === 'deleted';
      return {
        ...event,
        creatorName: metrics.creatorName,
        creatorEmail: metrics.creatorEmail,
        ownPhotos: metrics.totalPhotos,
        ownVideos: metrics.totalVideos,
        ownPhotoBytes: metrics.photoBytes,
        ownVideoBytes: metrics.videoBytes,
        ownDataUsed: metrics.dataUsed,
        ownGuestsCount: metrics.guestsCount,
        totalPhotos: metrics.totalPhotos,
        totalVideos: metrics.totalVideos,
        photoBytes: metrics.photoBytes,
        videoBytes: metrics.videoBytes,
        dataUsed: metrics.dataUsed,
        guestsCount: metrics.guestsCount,
        totalAdmins: metrics.totalAdmins,
        vendorsLinked: metrics.vendorsLinked,
        isDeleted,
        statusLabel: isDeleted ? 'Deleted' : 'Active',
        isSubGallery: true,
        isGhost: false,
        subGalleries: [],
      };
    });

    // Detect Ghost Galleries (event_id exists in photos/guests but row was deleted from events table)
    const ghostEventIds = new Set<string>();
    photos.forEach(p => {
      if (p.eventId && !knownEventIds.has(p.eventId)) {
        ghostEventIds.add(p.eventId);
      }
    });
    guests.forEach(g => {
      if (g.eventId && !knownEventIds.has(g.eventId)) {
        ghostEventIds.add(g.eventId);
      }
    });

    const ghostList: GalleryDetailItem[] = Array.from(ghostEventIds).map(eventId => {
      const eventPhotos = photos.filter(p => p.eventId === eventId);
      const totalPhotos = eventPhotos.filter(p => p.mediaType !== 'video').length;
      const totalVideos = eventPhotos.filter(p => p.mediaType === 'video').length;
      const photoBytes = eventPhotos
        .filter(p => p.mediaType !== 'video')
        .reduce((sum, p) => sum + (Number(p.size) || 0), 0);
      const videoBytes = eventPhotos
        .filter(p => p.mediaType === 'video')
        .reduce((sum, p) => sum + (Number(p.size) || 0), 0);
      const dataUsed = photoBytes + videoBytes;

      const firstPhoto = eventPhotos.find(p => p.userId);
      const creator = firstPhoto ? users.find(u => u.id === firstPhoto.userId) : null;
      const creatorName = creator ? (creator.name || creator.email || 'Unknown') : 'Unknown (Deleted)';
      const creatorEmail = creator ? (creator.email || 'N/A') : 'N/A';

      const eventGuests = guests.filter(g => g.eventId === eventId);
      const guestsCount = eventGuests.length;
      const totalAdmins = eventGuests.filter(g => g.canAdmin).length;

      return {
        id: eventId,
        title: `[Ghost Gallery] ID: ${eventId.slice(0, 12)}...`,
        createdAt: eventPhotos[0]?.createdAt || undefined,
        createdById: creator?.id || '',
        createdBy: creator?.id || '',
        parentId: undefined,
        vendors: [],
        isSampleGallery: false,
        status: 'deleted',
        creatorName,
        creatorEmail,
        ownPhotos: totalPhotos,
        ownVideos: totalVideos,
        ownPhotoBytes: photoBytes,
        ownVideoBytes: videoBytes,
        ownDataUsed: dataUsed,
        ownGuestsCount: guestsCount,
        totalPhotos,
        totalVideos,
        photoBytes,
        videoBytes,
        dataUsed,
        guestsCount,
        totalAdmins,
        vendorsLinked: 0,
        isDeleted: true,
        statusLabel: 'Deleted (Ghost Gallery)',
        isSubGallery: false,
        isGhost: true,
        subGalleries: [],
      };
    });

    return [...mainTree, ...orphanItems, ...ghostList];
  }, [events, users, guests, photos]);

  // 2. Calculate overall stats for quick analytics cards
  const stats = useMemo(() => {
    const mainGalleries = hierarchyGalleries.filter(g => !g.isGhost && !g.isSubGallery);
    const totalMainGalleries = mainGalleries.length;
    const totalSubGalleries = events.filter(e => Boolean(e.parentId) || e.type === 'sub').length;
    const activeGalleries = mainGalleries.filter(g => !g.isDeleted).length;
    const ghostGalleries = hierarchyGalleries.filter(g => g.isGhost).length;
    const ghostDataUsed = hierarchyGalleries
      .filter(g => g.isGhost)
      .reduce((sum, g) => sum + g.dataUsed, 0);

    const totalPhotos = photos.filter(p => p.mediaType !== 'video').length;
    const totalVideos = photos.filter(p => p.mediaType === 'video').length;
    const totalData = photos.reduce((sum, p) => sum + (Number(p.size) || 0), 0);
    const totalVendors = events.reduce((sum, e) => sum + (e.vendors ? e.vendors.length : 0), 0);

    return {
      totalMainGalleries,
      totalSubGalleries,
      activeGalleries,
      ghostGalleries,
      ghostDataUsed,
      totalPhotos,
      totalVideos,
      totalData,
      totalVendors,
    };
  }, [hierarchyGalleries, events, photos]);

  // 3. Search and status filter
  const filteredGalleries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return hierarchyGalleries
      .map(parent => {
        const matchesStatus =
          statusFilter === 'all'
            ? true
            : statusFilter === 'active'
            ? !parent.isDeleted
            : parent.isDeleted;

        if (!matchesStatus) return null;

        if (!query) {
          return parent;
        }

        const parentMatches =
          parent.title.toLowerCase().includes(query) ||
          parent.id.toLowerCase().includes(query) ||
          parent.creatorName.toLowerCase().includes(query) ||
          parent.creatorEmail.toLowerCase().includes(query);

        const matchingChildren = parent.subGalleries.filter(
          c =>
            c.title.toLowerCase().includes(query) ||
            c.id.toLowerCase().includes(query) ||
            c.creatorName.toLowerCase().includes(query) ||
            c.creatorEmail.toLowerCase().includes(query)
        );

        if (parentMatches) {
          return parent;
        }

        if (matchingChildren.length > 0) {
          return {
            ...parent,
            subGalleries: matchingChildren,
          };
        }

        return null;
      })
      .filter((g): g is GalleryDetailItem => g !== null);
  }, [hierarchyGalleries, search, statusFilter]);

  // Auto-expand parents that have matching children when search is active
  useEffect(() => {
    if (!search.trim()) return;
    const query = search.trim().toLowerCase();
    const toExpand = new Set<string>();
    hierarchyGalleries.forEach(parent => {
      const childMatch = parent.subGalleries.some(
        c =>
          c.title.toLowerCase().includes(query) ||
          c.id.toLowerCase().includes(query) ||
          c.creatorName.toLowerCase().includes(query) ||
          c.creatorEmail.toLowerCase().includes(query)
      );
      if (childMatch) {
        toExpand.add(parent.id);
      }
    });
    if (toExpand.size > 0) {
      setExpandedIds(prev => new Set([...prev, ...toExpand]));
    }
  }, [search, hierarchyGalleries]);

  // Expandable ID set for Expand All / Collapse All
  const expandableIds = useMemo(() => {
    return filteredGalleries.filter(g => g.subGalleries.length > 0).map(g => g.id);
  }, [filteredGalleries]);

  const allExpanded =
    expandableIds.length > 0 && expandableIds.every(id => expandedIds.has(id));

  const toggleAllExpanded = () => {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(expandableIds));
    }
  };

  // 4. Sort galleries
  const sortedGalleries = useMemo(() => {
    return [...filteredGalleries].sort((a, b) => {
      let cmp = 0;

      switch (sortColumn) {
        case 'id':
          cmp = a.id.localeCompare(b.id);
          break;
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'creatorName':
          cmp = a.creatorName.localeCompare(b.creatorName);
          break;
        case 'creatorEmail':
          cmp = a.creatorEmail.localeCompare(b.creatorEmail);
          break;
        case 'status':
          cmp = (a.isDeleted ? 1 : 0) - (b.isDeleted ? 1 : 0);
          break;
        case 'photos':
          cmp = a.totalPhotos - b.totalPhotos;
          break;
        case 'videos':
          cmp = a.totalVideos - b.totalVideos;
          break;
        case 'dataUsed':
          cmp = a.dataUsed - b.dataUsed;
          break;
        case 'guests':
          cmp = a.guestsCount - b.guestsCount;
          break;
        case 'admins':
          cmp = a.totalAdmins - b.totalAdmins;
          break;
        case 'vendors':
          cmp = a.vendorsLinked - b.vendorsLinked;
          break;
        case 'createdAt': {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }
        default:
          cmp = 0;
      }

      if (cmp !== 0) {
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      return a.title.localeCompare(b.title);
    });
  }, [filteredGalleries, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      const descFirstColumns: SortColumn[] = [
        'createdAt',
        'photos',
        'videos',
        'dataUsed',
        'guests',
        'admins',
        'vendors',
      ];
      setSortDirection(descFirstColumns.includes(column) ? 'desc' : 'asc');
    }
  };

  const renderSortableHeader = (
    column: SortColumn,
    label: string,
    extraThClass: string = ''
  ) => {
    const isSorted = sortColumn === column;
    return (
      <th
        scope="col"
        onClick={() => handleSort(column)}
        className={`py-2.5 px-3 whitespace-nowrap border-b border-slate-800 border-r border-slate-700/80 cursor-pointer select-none group/col transition-colors ${
          isSorted
            ? 'text-indigo-400 bg-slate-800/60 font-bold'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
        } ${extraThClass}`}
        title={`Sort by ${label} (${
          isSorted
            ? sortDirection === 'asc'
              ? 'Ascending - click to reverse'
              : 'Descending - click to reverse'
            : 'Click to sort'
        })`}
      >
        <div className="flex items-center gap-1.5 justify-between">
          <span>{label}</span>
          <span className="shrink-0 transition-all inline-flex items-center">
            {isSorted ? (
              sortDirection === 'asc' ? (
                <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
              )
            ) : (
              <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-40 group-hover/col:opacity-100 group-hover/col:text-slate-300 transition-opacity" />
            )}
          </span>
        </div>
      </th>
    );
  };

  const openGalleryModal = (g: GalleryDetailItem) => {
    const eventObj: Event = {
      id: g.id,
      title: g.title,
      createdAt: g.createdAt,
      createdById: g.createdById,
      createdBy: g.createdBy,
      parentId: g.parentId,
      vendors: g.vendors,
      isSampleGallery: g.isSampleGallery,
      isDeleted: g.isDeleted,
      status: g.status,
    };
    setViewingGallery(eventObj);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Quick Analytics Cards Matching UserGrid Glassmorphism Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Galleries */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-indigo-500/10 blur-2xl transition-all duration-500 group-hover:bg-indigo-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Total Galleries
            </span>
            <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-2.5 text-indigo-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-indigo-500/40 group-hover:bg-indigo-500/20">
              <Folder className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-white transition-colors group-hover:text-indigo-300">
            {stats.totalMainGalleries}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>{stats.activeGalleries} active</span>
            </div>
            {stats.totalMainGalleries > 0 && (
              <span className="rounded border border-indigo-500/25 bg-indigo-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-300">
                {Math.round((stats.activeGalleries / stats.totalMainGalleries) * 100)}% active
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Total Media Files */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl transition-all duration-500 group-hover:bg-emerald-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Total Media Files
            </span>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2.5 text-emerald-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-emerald-500/40 group-hover:bg-emerald-500/20">
              <div className="flex items-center space-x-0.5">
                <Image className="h-4 w-4" />
                <span className="text-[10px] font-bold">/</span>
                <Video className="h-4 w-4" />
              </div>
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-white transition-colors group-hover:text-emerald-300">
            {(stats.totalPhotos + stats.totalVideos).toLocaleString()}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>{stats.totalPhotos.toLocaleString()} photos</span>
            </div>
            <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              {stats.totalVideos.toLocaleString()} videos
            </span>
          </div>
        </div>

        {/* Card 3: Storage Occupied */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-xl hover:shadow-sky-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-sky-500/10 blur-2xl transition-all duration-500 group-hover:bg-sky-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Storage Occupied
            </span>
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-2.5 text-sky-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-sky-500/40 group-hover:bg-sky-500/20">
              <Database className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-white transition-colors group-hover:text-sky-300">
            {formatSize(stats.totalData)}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span>Backblaze B2 Stored</span>
            </div>
            <span className="rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-sky-300">
              {stats.totalVendors} vendors
            </span>
          </div>
        </div>

        {/* Card 4: Ghost Galleries */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-500/40 hover:shadow-xl hover:shadow-rose-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-rose-500/10 blur-2xl transition-all duration-500 group-hover:bg-rose-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Ghost Galleries
            </span>
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-2.5 text-rose-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-rose-500/40 group-hover:bg-rose-500/20">
              <Ghost className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-rose-400">
            {stats.ghostGalleries}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
              <span>{stats.ghostGalleries > 0 ? 'Storage remaining' : 'Clean catalog'}</span>
            </div>
            {stats.ghostDataUsed > 0 && (
              <span className="rounded border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-rose-300">
                {formatSize(stats.ghostDataUsed)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Box */}
      <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
        {/* Table Header and Search / Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h4 className="text-lg font-bold text-white">Events & Galleries Catalog</h4>
            <p className="text-slate-400 text-xs mt-0.5">
              Showing {sortedGalleries.length} primary galleries &bull; Sorted by{' '}
              <span className="text-indigo-400 font-semibold">{sortColumnLabelMap[sortColumn]}</span>{' '}
              <span className="text-slate-500 font-mono">
                ({sortDirection === 'asc' ? 'Ascending ↑' : 'Descending ↓'})
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Expand All / Collapse All Button */}
            {expandableIds.length > 0 && (
              <button
                type="button"
                onClick={toggleAllExpanded}
                className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
                title={allExpanded ? 'Collapse all' : 'Expand all'}
              >
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>{allExpanded ? 'Collapse All' : 'Expand All'}</span>
              </button>
            )}

            {/* Search bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by ID, name, creator, email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 w-full sm:w-64 placeholder-slate-600 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter dropdown */}
            <div className="relative flex items-center">
              <Filter className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer placeholder-slate-600 transition-colors"
              >
                <option value="all">All Statuses ({hierarchyGalleries.length})</option>
                <option value="active">Active Only ({stats.activeGalleries})</option>
                <option value="deleted">Ghost / Deleted ({stats.ghostGalleries})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Galleries Table with Hierarchical Expandable Rows */}
        <div className="overflow-x-auto border border-slate-800/60 rounded-2xl">
          <table className="w-full min-w-[1720px] text-left text-sm text-slate-400 border-separate border-spacing-0">
            <thead className="text-xs text-slate-500 uppercase bg-slate-900">
              <tr>
                {/* Sr. No. (Fixed horizontally) */}
                <th
                  scope="col"
                  className="sticky left-0 z-20 bg-slate-900 py-2.5 px-2 whitespace-nowrap w-12 min-w-[48px] max-w-[48px] text-center border-b border-slate-800 border-r border-slate-700/80"
                >
                  Sr. No.
                </th>

                {/* 1. Gallery Name (Fixed horizontally) */}
                <th
                  scope="col"
                  onClick={() => handleSort('title')}
                  className={`sticky left-[48px] z-20 bg-slate-900 py-2.5 px-3 whitespace-nowrap min-w-[240px] max-w-[280px] border-b border-slate-800 border-r border-slate-700 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.5)] cursor-pointer select-none group/col transition-colors ${
                    sortColumn === 'title'
                      ? 'text-indigo-400 font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={`Sort by Gallery Name (${
                    sortColumn === 'title'
                      ? sortDirection === 'asc'
                        ? 'Ascending - click to reverse'
                        : 'Descending - click to reverse'
                      : 'Click to sort'
                  })`}
                >
                  <div className="flex items-center gap-1.5 justify-between">
                    <span>Gallery Name</span>
                    <span className="shrink-0 transition-all inline-flex items-center">
                      {sortColumn === 'title' ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-40 group-hover/col:opacity-100 group-hover/col:text-slate-300 transition-opacity" />
                      )}
                    </span>
                  </div>
                </th>

                {/* 2. Gallery ID (Second Column, Sortable) */}
                {renderSortableHeader('id', 'Gallery ID', 'min-w-[175px]')}

                {/* 3. Creator Name (Sortable) */}
                {renderSortableHeader('creatorName', 'Creator Name', 'min-w-[160px]')}

                {/* 4. Email (Sortable) */}
                {renderSortableHeader('creatorEmail', 'Email', 'min-w-[210px]')}

                {/* 5. Gallery Status (Sortable) */}
                {renderSortableHeader('status', 'Status', 'min-w-[140px]')}

                {/* 6. Photos (Sortable) */}
                {renderSortableHeader('photos', 'Photos', 'min-w-[115px]')}

                {/* 7. Videos (Sortable) */}
                {renderSortableHeader('videos', 'Videos', 'min-w-[115px]')}

                {/* 8. Data Used (Sortable) */}
                {renderSortableHeader('dataUsed', 'Data Used', 'min-w-[120px]')}

                {/* 9. Guests (Sortable) */}
                {renderSortableHeader('guests', 'Guests', 'min-w-[95px]')}

                {/* 10. Admins (Sortable) */}
                {renderSortableHeader('admins', 'Admins', 'min-w-[95px]')}

                {/* 11. Vendors (Sortable) */}
                {renderSortableHeader('vendors', 'Vendors', 'min-w-[95px]')}

                {/* 12. Created Date (Sortable) */}
                {renderSortableHeader('createdAt', 'Created Date', 'min-w-[125px]')}

                {/* 13. Actions (Non-sortable) */}
                <th
                  scope="col"
                  className="py-2.5 px-3 whitespace-nowrap min-w-[100px] border-b border-slate-800 text-center"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedGalleries.map((gallery, parentIdx) => {
                const regDate = gallery.createdAt
                  ? new Date(gallery.createdAt).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'N/A';

                const hasChildren = gallery.subGalleries.length > 0;
                const isExpanded = expandedIds.has(gallery.id);

                return (
                  <React.Fragment key={gallery.id || parentIdx}>
                    {/* Primary / Main Gallery Row */}
                    <tr
                      className={`group transition-colors ${
                        parentIdx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0c1322]'
                      } hover:bg-slate-800/50`}
                    >
                      {/* Sr. No. (Fixed horizontally) */}
                      <td
                        className={`sticky left-0 z-10 ${
                          parentIdx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0c1322]'
                        } group-hover:bg-[#1e293b] transition-colors py-2 px-2 whitespace-nowrap w-12 min-w-[48px] max-w-[48px] text-center font-mono text-xs text-slate-400 border-b border-slate-700 border-r border-slate-700/80`}
                      >
                        {parentIdx + 1}
                      </td>

                      {/* 1. Gallery Name (Fixed horizontally with expand toggle) */}
                      <td
                        className={`sticky left-[48px] z-10 ${
                          parentIdx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0c1322]'
                        } group-hover:bg-[#1e293b] transition-colors py-2 px-3 whitespace-nowrap min-w-[240px] max-w-[280px] border-b border-slate-700 border-r border-slate-700 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.5)]`}
                      >
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openGalleryModal(gallery)}
                            className={`font-semibold text-xs truncate max-w-[190px] text-left transition-colors cursor-pointer hover:underline ${
                              gallery.isDeleted
                                ? 'text-rose-200 hover:text-rose-100'
                                : gallery.isSampleGallery
                                ? 'text-amber-300 hover:text-amber-200'
                                : 'text-white hover:text-indigo-300'
                            }`}
                            title={gallery.isSampleGallery ? `${gallery.title} (Sample Gallery)` : gallery.title}
                          >
                            {gallery.title}
                          </button>

                          {hasChildren && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(gallery.id)}
                              className="w-5 h-5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                              title={isExpanded ? 'Collapse' : 'Expand'}
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 2. Gallery ID (Second Column) */}
                      <td className="py-2 px-2.5 min-w-[175px] max-w-[175px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        <div className="flex items-center justify-between gap-1.5 font-mono text-[11px] text-slate-300 bg-slate-950/80 px-2 py-1 rounded-md border border-slate-800/80 max-w-[165px]">
                          <span className="truncate" title={gallery.id}>
                            {gallery.id}
                          </span>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              copyToClipboard(gallery.id, `id-${gallery.id}`);
                            }}
                            className="text-slate-500 hover:text-indigo-400 transition-colors shrink-0 p-0.5 cursor-pointer"
                            title="Copy Gallery ID"
                          >
                            {copiedKey === `id-${gallery.id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 3. Creator Name */}
                      <td className="py-2 px-3 min-w-[160px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-6 h-6 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center font-bold text-[10px] text-slate-200 shrink-0"
                            title={gallery.creatorName}
                          >
                            {getInitials(gallery.creatorName)}
                          </div>
                          <span
                            className="font-semibold text-white text-xs truncate max-w-[125px]"
                            title={gallery.creatorName}
                          >
                            {gallery.creatorName}
                          </span>
                        </div>
                      </td>

                      {/* 4. Email */}
                      <td className="py-2 px-3 min-w-[210px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        <div className="flex items-center justify-between gap-1.5 group/email max-w-[195px]">
                          <span
                            className={`text-xs truncate ${
                              gallery.creatorEmail !== 'N/A'
                                ? 'text-slate-300'
                                : 'text-slate-600 italic'
                            }`}
                            title={gallery.creatorEmail}
                          >
                            {gallery.creatorEmail}
                          </span>
                          {gallery.creatorEmail !== 'N/A' && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                copyToClipboard(gallery.creatorEmail, `email-${gallery.id}`);
                              }}
                              className="text-slate-600 hover:text-indigo-400 opacity-0 group-hover/email:opacity-100 transition-all shrink-0 p-0.5 cursor-pointer"
                              title="Copy Email"
                            >
                              {copiedKey === `email-${gallery.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 5. Gallery Status */}
                      <td className="py-2 px-3 min-w-[140px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        {gallery.isDeleted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-rose-500/25 bg-rose-500/10 text-rose-300 text-[11px] font-bold">
                            <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
                            <span>Deleted / Ghost</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 text-[11px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>Active</span>
                          </span>
                        )}
                      </td>

                      {/* 6. Photos (Sum of main + children) */}
                      <td className="py-2 px-3 min-w-[115px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-white">
                            {gallery.totalPhotos.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {formatSize(gallery.photoBytes)}
                          </span>
                        </div>
                      </td>

                      {/* 7. Videos (Sum of main + children) */}
                      <td className="py-2 px-3 min-w-[115px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        <div className="flex flex-col">
                          <span className="font-semibold text-xs text-white">
                            {gallery.totalVideos.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {formatSize(gallery.videoBytes)}
                          </span>
                        </div>
                      </td>

                      {/* 8. Data Used (Sum of main + children) */}
                      <td className="py-2 px-3 min-w-[120px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        <div className="inline-flex items-center px-2 py-0.5 rounded-lg border border-sky-500/25 bg-sky-500/10 text-sky-300 font-semibold text-xs">
                          <span>{formatSize(gallery.dataUsed)}</span>
                        </div>
                      </td>

                      {/* 9. Guests */}
                      <td className="py-2 px-3 min-w-[95px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-300">
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-semibold">{gallery.guestsCount}</span>
                        </div>
                      </td>

                      {/* 10. Admins */}
                      <td className="py-2 px-3 min-w-[95px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-300">
                          <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-semibold">{gallery.totalAdmins}</span>
                        </div>
                      </td>

                      {/* 11. Vendors */}
                      <td className="py-2 px-3 min-w-[95px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-300">
                          <Award className="w-3.5 h-3.5 text-slate-500" />
                          <span className="font-semibold">{gallery.vendorsLinked}</span>
                        </div>
                      </td>

                      {/* 12. Created Date */}
                      <td className="py-2 px-3 min-w-[125px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-300 whitespace-nowrap">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{regDate}</span>
                        </div>
                      </td>

                      {/* 13. Actions */}
                      <td className="py-2 px-3 min-w-[100px] whitespace-nowrap border-b border-slate-700 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => openGalleryModal(gallery)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700 hover:border-indigo-500/60 hover:text-indigo-300 text-slate-300 text-xs font-medium transition-all cursor-pointer shadow-sm"
                            title="View gallery photos and videos"
                          >
                            <Eye className="w-3 h-3 text-indigo-400" />
                            <span>View</span>
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Sub-Galleries Expanded Inline Rows */}
                    {hasChildren &&
                      isExpanded &&
                      gallery.subGalleries.map((sub, childIdx) => {
                        const subRegDate = sub.createdAt
                          ? new Date(sub.createdAt).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'N/A';

                        return (
                          <tr
                            key={sub.id || childIdx}
                            className="bg-[#080d19]/90 hover:bg-[#10182b] transition-colors"
                          >
                            {/* Sr. No. (Hierarchical: e.g. 1.a, 1.b) */}
                            <td className="sticky left-0 z-10 bg-[#080d19] group-hover:bg-[#10182b] transition-colors py-2 px-2 whitespace-nowrap w-12 min-w-[48px] max-w-[48px] text-center font-mono text-[11px] font-semibold text-indigo-400/90 border-b border-slate-800/80 border-r border-slate-700/80">
                              {parentIdx + 1}.{getSubLetter(childIdx)}
                            </td>

                            {/* 1. Sub-Gallery Name (Indented with branch icon) */}
                            <td className="sticky left-[48px] z-10 bg-[#080d19] group-hover:bg-[#10182b] transition-colors py-2 px-3 whitespace-nowrap min-w-[240px] max-w-[280px] border-b border-slate-800/80 border-r border-slate-700 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.5)]">
                              <div className="flex items-center space-x-2 pl-3">
                                <span className="text-slate-600 font-mono text-xs select-none">
                                  └─
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openGalleryModal(sub)}
                                  className={`font-medium text-xs truncate max-w-[200px] text-left cursor-pointer transition-colors hover:underline ${
                                    sub.isDeleted
                                      ? 'text-rose-200 hover:text-rose-100'
                                      : sub.isSampleGallery
                                      ? 'text-amber-300 hover:text-amber-200'
                                      : 'text-slate-200 hover:text-indigo-300'
                                  }`}
                                  title={sub.isSampleGallery ? `${sub.title} (Sample Gallery)` : sub.title}
                                >
                                  {sub.title}
                                </button>
                              </div>
                            </td>

                            {/* 2. Sub-Gallery ID */}
                            <td className="py-2 px-2.5 min-w-[175px] max-w-[175px] whitespace-nowrap border-b border-slate-800/80 border-r border-slate-700/80">
                              <div className="flex items-center justify-between gap-1.5 font-mono text-[11px] text-slate-400 bg-slate-950/60 px-2 py-1 rounded-md border border-slate-800/60 max-w-[165px]">
                                <span className="truncate" title={sub.id}>
                                  {sub.id}
                                </span>
                                <button
                                  type="button"
                                  onClick={e => {
                                    e.stopPropagation();
                                    copyToClipboard(sub.id, `id-${sub.id}`);
                                  }}
                                  className="text-slate-500 hover:text-indigo-400 transition-colors shrink-0 p-0.5 cursor-pointer"
                                  title="Copy Gallery ID"
                                >
                                  {copiedKey === `id-${sub.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* 3. Sub-Gallery Creator */}
                            <td className="py-2 px-3 min-w-[160px] whitespace-nowrap border-b border-slate-800/80 border-r border-slate-700/80">
                              <div className="flex items-center space-x-2">
                                <div
                                  className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-[9px] text-slate-300 shrink-0"
                                  title={sub.creatorName}
                                >
                                  {getInitials(sub.creatorName)}
                                </div>
                                <span
                                  className="text-xs text-slate-300 truncate max-w-[125px]"
                                  title={sub.creatorName}
                                >
                                  {sub.creatorName}
                                </span>
                              </div>
                            </td>

                            {/* 4. Sub-Gallery Email */}
                            <td className="py-2 px-3 min-w-[210px] whitespace-nowrap border-b border-slate-800/80 border-r border-slate-700/80">
                              <div className="flex items-center justify-between gap-1.5 group/email max-w-[195px]">
                                <span
                                  className={`text-xs truncate ${
                                    sub.creatorEmail !== 'N/A'
                                      ? 'text-slate-400'
                                      : 'text-slate-600 italic'
                                  }`}
                                  title={sub.creatorEmail}
                                >
                                  {sub.creatorEmail}
                                </span>
                                {sub.creatorEmail !== 'N/A' && (
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      copyToClipboard(sub.creatorEmail, `email-${sub.id}`);
                                    }}
                                    className="text-slate-600 hover:text-indigo-400 opacity-0 group-hover/email:opacity-100 transition-all shrink-0 p-0.5 cursor-pointer"
                                    title="Copy Email"
                                  >
                                    {copiedKey === `email-${sub.id}` ? (
                                      <Check className="w-3 h-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* 5. Sub-Gallery Status */}
                            <td className="py-2 px-3 min-w-[140px] whitespace-nowrap border-b border-slate-800/80 border-r border-slate-700/80">
                              {sub.isDeleted ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full border border-rose-500/20 bg-rose-500/10 text-rose-300 text-[10px] font-semibold">
                                  Deleted
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-[10px] font-semibold">
                                  Active
                                </span>
                              )}
                            </td>

                            {/* 6. Sub-Gallery Own Photos */}
                            <td className="py-2 px-3 min-w-[115px] whitespace-nowrap border-b border-slate-800/80 border-r border-slate-700/80">
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-300">
                                  {sub.totalPhotos.toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {formatSize(sub.photoBytes)}
                                </span>
                              </div>
                            </td>

                            {/* 7. Sub-Gallery Own Videos */}
                            <td className="py-2 px-3 min-w-[115px] whitespace-nowrap border-b border-slate-800/80 border-r border-slate-700/80">
                              <div className="flex flex-col">
                                <span className="text-xs text-slate-300">
                                  {sub.totalVideos.toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {formatSize(sub.videoBytes)}
                                </span>
                              </div>
                            </td>

                            {/* 8. Sub-Gallery Own Data Used */}
                            <td className="py-2 px-3 min-w-[120px] whitespace-nowrap border-b border-slate-800/80 border-r border-slate-700/80">
                              <div className="inline-flex items-center px-1.5 py-0.2 rounded border border-slate-700/80 bg-slate-900/60 text-slate-300 text-xs">
                                <span>{formatSize(sub.dataUsed)}</span>
                              </div>
                            </td>

                            {/* 9. Sub-Gallery Guests */}
                            <td className="py-2 px-3 min-w-[95px] whitespace-nowrap border-b border-slate-800/80 border-r border-slate-700/80">
                              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                                <Users className="w-3.5 h-3.5 text-slate-600" />
                                <span>{sub.guestsCount}</span>
                              </div>
                            </td>

                            {/* 10. Sub-Gallery Admins */}
                            <td className="py-2 px-3 min-w-[95px] whitespace-nowrap border-b border-slate-800/80 border-r border-slate-700/80">
                              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                                <ShieldAlert className="w-3.5 h-3.5 text-slate-600" />
                                <span>{sub.totalAdmins}</span>
                              </div>
                            </td>

                            {/* 11. Sub-Gallery Vendors */}
                            <td className="py-2 px-3 min-w-[95px] whitespace-nowrap border-b border-slate-800/80 border-r border-slate-700/80">
                              <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                                <Award className="w-3.5 h-3.5 text-slate-600" />
                                <span>{sub.vendorsLinked}</span>
                              </div>
                            </td>

                            {/* 12. Sub-Gallery Created Date */}
                            <td className="py-2 px-3 min-w-[125px] whitespace-nowrap border-b border-slate-800/80 border-r border-slate-700/80">
                              <div className="flex items-center space-x-1.5 text-xs text-slate-400 whitespace-nowrap">
                                <Calendar className="w-3.5 h-3.5 text-slate-600" />
                                <span>{subRegDate}</span>
                              </div>
                            </td>

                            {/* 13. Sub-Gallery Actions */}
                            <td className="py-2 px-3 min-w-[100px] whitespace-nowrap border-b border-slate-800/80 text-center">
                              <div className="flex items-center justify-center space-x-1.5">
                                <button
                                  type="button"
                                  onClick={() => openGalleryModal(sub)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-slate-700/60 bg-slate-800/60 hover:bg-slate-700 text-slate-400 hover:text-indigo-300 text-[11px] transition-all cursor-pointer"
                                  title="View photos and videos"
                                >
                                  <Eye className="w-3 h-3 text-indigo-400" />
                                  <span>View</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}

              {sortedGalleries.length === 0 && (
                <tr>
                  <td
                    colSpan={14}
                    className="py-12 text-center text-slate-500 bg-slate-900/10 border-b border-slate-700"
                  >
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Folder className="w-8 h-8 text-slate-600" />
                      <p className="text-base font-semibold text-slate-300">No galleries found</p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        No galleries match your search criteria or status filter. Try clearing or modifying your filter.
                      </p>
                      {(search || statusFilter !== 'all') && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearch('');
                            setStatusFilter('all');
                          }}
                          className="mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Embedded Gallery Viewer Modal */}
      {viewingGallery && (
        <GalleryViewer
          initialGallery={viewingGallery}
          events={events}
          onClose={() => setViewingGallery(null)}
        />
      )}
    </div>
  );
};

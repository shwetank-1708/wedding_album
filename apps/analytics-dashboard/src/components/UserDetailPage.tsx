import React, { useState, useMemo, useEffect } from 'react';
import type { Event, Photo, UserProfile, DeletedEventArchive } from '../lib/analytics';
import { isProtectedSuperAdmin, fetchDeletedEvents } from '../lib/analytics';
import { supabase } from '../lib/supabase';
import { runAdminAction } from '../lib/adminApi';
import { GalleryViewer } from './GalleryViewer';
import {
  ArrowLeft,
  ArrowLeftRight,
  User,
  HardDrive,
  CreditCard,
  IndianRupee,
  DollarSign,
  Calendar,
  Clock,
  ShieldCheck,
  Copy,
  Check,
  FolderTree,
  Image as ImageIcon,
  Video as VideoIcon,
  Sparkles,
  Zap,
  Layers,
  Eye,
  Star,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Search,
  Filter,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Banknote,
} from 'lucide-react';

export type UserDetailTabType = 'info' | 'events' | 'storage' | 'plan' | 'cost';

interface UserDetailPageProps {
  user: UserProfile;
  events?: Event[];
  photos?: Photo[];
  onBack: () => void;
  initialTab?: UserDetailTabType;
  onPlanChange?: (userId: string, role: string) => Promise<void> | void;
  onDurationChange?: (userId: string, duration: string) => Promise<void> | void;
  onPlanDatesChange?: (userId: string, planStartDate: string, planEndDate: string) => Promise<void> | void;
  onDeleteEvent?: (eventId: string) => Promise<void> | void;
  onToggleSampleGallery?: (eventId: string, isSample: boolean) => Promise<void> | void;
}

const planTiers = [
  { role: 'free', label: 'Free Plan', storage: '1 GB', storageBytes: 1 * 1024 * 1024 * 1024, monthlyPriceInr: 0 },
  { role: 'starter', label: 'Starter Plan', storage: '10 GB', storageBytes: 10 * 1024 * 1024 * 1024, monthlyPriceInr: 150 },
  { role: 'basic', label: 'Basic Plan', storage: '25 GB', storageBytes: 25 * 1024 * 1024 * 1024, monthlyPriceInr: 300 },
  { role: 'standard', label: 'Standard Plan', storage: '50 GB', storageBytes: 50 * 1024 * 1024 * 1024, monthlyPriceInr: 450 },
  { role: 'premium', label: 'Premium Plan', storage: '100 GB', storageBytes: 100 * 1024 * 1024 * 1024, monthlyPriceInr: 750 },
  { role: 'pro', label: 'Pro Plan', storage: '200 GB', storageBytes: 200 * 1024 * 1024 * 1024, monthlyPriceInr: 1500 },
  { role: 'elite', label: 'Elite Plan', storage: '500 GB', storageBytes: 500 * 1024 * 1024 * 1024, monthlyPriceInr: 3200 },
  { role: 'ultimate', label: 'Ultimate Plan', storage: '1 TB', storageBytes: 1024 * 1024 * 1024 * 1024, monthlyPriceInr: 5500 },
  { role: 'admin', label: 'Super Admin', storage: 'Unlimited', storageBytes: Infinity, monthlyPriceInr: 0 },
];

export interface BackblazeRow {
  id: string;
  galId: string;
  title: string;
  type: 'active' | 'deleted';
  isSample?: boolean;
  photoCount: number;
  videoCount: number;
  totalMediaCount: number;
  bytes: number;
  gb: number;
  windowDurationHours: number;
  gbHours: number;
  billableGbMonths: number;
  storageCostInr: number;
  storageCostUsd: number;
  classCUploads: number;
  classCDeletions: number;
  classCTotal: number;
  classCCostInr: number;
  classBReads: number;
  classBCostInr: number;
  totalTransactionsCount: number;
  totalTransactionsCostInr: number;
  bandwidthCostInr: number;
  totalCostInr: number;
  totalCostUsd: number;
  searchableText: string;
}

const durationOptions = [
  { value: 'monthly', label: '1 Month', months: 1 },
  { value: 'quarterly', label: '3 Months (Quarterly)', months: 3 },
  { value: 'half_yearly', label: '6 Months (Half-Yearly)', months: 6 },
  { value: 'yearly', label: '1 Year (Annual)', months: 12 },
];

export { ModalLogo } from './ModalLogo';
import { ModalLogo } from './ModalLogo';
export { BackblazeLogo } from './BackblazeLogo';
import { BackblazeLogo } from './BackblazeLogo';
import { useCurrency } from '../lib/currency';

export const UserDetailPage: React.FC<UserDetailPageProps> = ({
  user,
  events = [],
  photos = [],
  onBack,
  initialTab = 'info',
  onPlanChange,
  onDurationChange,
  onPlanDatesChange,
  onDeleteEvent,
  onToggleSampleGallery,
}) => {
  const [activeTab, setActiveTab] = useState<UserDetailTabType>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (activeTab === 'cost') {
      setCostRefreshKey(k => k + 1);
      setPaymentRefreshKey(k => k + 1);
    }
  }, [activeTab]);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Shared Currency Engine (USD/INR Mode & Live Forex Rate)
  const {
    currency,
    setCurrency,
    rate: usdToInrRate,
    rateInput: usdToInrRateInput,
    handleRateInputChange,
    syncLiveRate,
    isSyncing: isSyncingRate,
    marketRate,
  } = useCurrency();

  const fmtCost = (valUsd: number, decimals: number = 2): string => {
    if (valUsd == null || isNaN(valUsd)) return currency === 'USD' ? '$0.00' : '₹0.00';
    if (currency === 'USD') return `$${valUsd.toFixed(decimals)}`;
    return `₹${(valUsd * usdToInrRate).toFixed(decimals)}`;
  };

  const fmtCostFromInr = (valInr: number, decimals: number = 2): string => {
    if (valInr == null || isNaN(valInr)) return currency === 'USD' ? '$0.00' : '₹0.00';
    if (currency === 'USD') return `$${(valInr / usdToInrRate).toFixed(decimals)}`;
    return `₹${valInr.toFixed(decimals)}`;
  };

  const fmtSub = (valUsd: number, suffix: string = ''): string => {
    if (valUsd == null || isNaN(valUsd)) return '';
    const cleanSuffix = suffix ? ` ${suffix}` : '';
    if (currency === 'USD') {
      return `₹${(valUsd * usdToInrRate).toFixed(2)} INR${cleanSuffix}`;
    }
    const d = Math.abs(valUsd) < 0.01 && Math.abs(valUsd) > 0 ? 4 : 2;
    return `$${valUsd.toFixed(d)} USD${cleanSuffix}`;
  };

  const fmtSubFromInr = (valInr: number, suffix: string = ''): string => {
    if (valInr == null || isNaN(valInr)) return '';
    const valUsd = valInr / usdToInrRate;
    return fmtSub(valUsd, suffix);
  };

  // Gallery viewer state for inspecting user uploads
  const [viewingGallery, setViewingGallery] = useState<Event | null>(null);

  // Events subpage search, filters, and expanded states
  const [eventSearch, setEventSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<'all' | 'with-subs' | 'with-media'>('all');
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());
  const [costTablePage, setCostTablePage] = useState<number>(1);
  const [costTablePerPage, setCostTablePerPage] = useState<number>(10);
  const [costTableSearch, setCostTableSearch] = useState<string>('');
  const [costTableFilter, setCostTableFilter] = useState<'all' | 'active' | 'deleted'>('all');
  const [sampleUpdatingEventId, setSampleUpdatingEventId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  // Global Economics Timeframe Filter & Metering state
  const [economicsTimeFilter, setEconomicsTimeFilter] = useState<'1d' | '1w' | '1m' | 'custom' | 'all'>('all');
  const [economicsCustomStartDate, setEconomicsCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [economicsCustomEndDate, setEconomicsCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Editable form state for Plan Data
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingDates, setSavingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState(user.planStartDate || '');
  const [editEndDate, setEditEndDate] = useState(user.planEndDate || '');

  // Payments ledger state
  const [payments, setPayments] = useState<any[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentRefreshKey, setPaymentRefreshKey] = useState(0);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentPlanId, setPaymentPlanId] = useState('starter');
  const [paymentBillingDuration, setPaymentBillingDuration] = useState('yearly');
  const [paymentGateway, setPaymentGateway] = useState('manual_upi');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentUpdateRole, setPaymentUpdateRole] = useState(true);
  const [recordingPayment, setRecordingPayment] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadPayments() {
      setLoadingPayments(true);
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (!error && data && mounted) {
          setPayments(data);
        }
      } catch (err) {
        console.warn('[Payments] fetch error:', err);
      } finally {
        if (mounted) setLoadingPayments(false);
      }
    }
    loadPayments();
    return () => { mounted = false; };
  }, [user.id, paymentRefreshKey]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid payment amount in INR');
      return;
    }

    setRecordingPayment(true);
    try {
      const res = await runAdminAction('recordPayment', {
        uid: user.id,
        amount: amt,
        planId: paymentPlanId,
        billingDuration: paymentBillingDuration,
        paymentGateway,
        notes: paymentNotes,
        updateRole: paymentUpdateRole,
      });

      if (res.success) {
        setShowRecordPaymentModal(false);
        setPaymentAmount('');
        setPaymentNotes('');
        setPaymentRefreshKey(k => k + 1);
        if (paymentUpdateRole && onPlanChange) {
          await onPlanChange(user.id, paymentPlanId);
        }
      } else {
        alert(res.error || 'Failed to record payment');
      }
    } catch (err: any) {
      alert(err.message || 'Error recording payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment record?')) return;
    try {
      const res = await runAdminAction('deletePayment', { paymentId });
      if (res.success) {
        setPaymentRefreshKey(k => k + 1);
      } else {
        alert(res.error || 'Failed to delete payment');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting payment');
    }
  };

  const isProtected = isProtectedSuperAdmin(user);
  const cleanRole = (user.role || 'free').toLowerCase();
  const currentPlan = planTiers.find(p => p.role === cleanRole) || planTiers[0];

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const toggleExpandEvent = (eventId: string) => {
    setExpandedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const expandAllEvents = (ids: string[]) => {
    setExpandedEventIds(new Set(ids));
  };

  const collapseAllEvents = () => {
    setExpandedEventIds(new Set());
  };

  const handleDeleteEvent = async (evt: Event & { subGalleriesCount?: number }) => {
    if (!onDeleteEvent || deletingEventId) return;
    const title = evt.title || 'Untitled Event';
    const subCount = evt.subGalleriesCount || 0;
    const cascadeNote = subCount > 0
      ? `\n\nThis will also delete ${subCount} sub-event${subCount === 1 ? '' : 's'} inside this event.`
      : '';
    const confirmed = window.confirm(
      `Delete "${title}"?\n\nThis will permanently delete the event, its media, guest records, and uploaded files.${cascadeNote}`
    );
    if (!confirmed) return;

    const typed = window.prompt(`Type DELETE to confirm deletion of "${title}".`);
    if (typed !== 'DELETE') return;

    setDeletingEventId(evt.id);
    try {
      await onDeleteEvent(evt.id);
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleToggleSampleGallery = async (evt: Event) => {
    if (!onToggleSampleGallery || sampleUpdatingEventId) return;
    const nextStatus = !evt.isSampleGallery;
    const title = evt.title || 'Untitled Event';
    const confirmed = window.confirm(
      nextStatus
        ? `Add "${title}" to Sample Galleries?`
        : `Remove "${title}" from Sample Galleries?`
    );
    if (!confirmed) return;

    setSampleUpdatingEventId(evt.id);
    try {
      await onToggleSampleGallery(evt.id, nextStatus);
    } finally {
      setSampleUpdatingEventId(null);
    }
  };

  // Compute storage and events for this specific user
  const userEventMetrics = useMemo(() => {
    // Pre-index all user identifiers with variations
    const userIdentifiers = new Set<string>();
    if (user.id) userIdentifiers.add(user.id.toLowerCase());
    if (user.email) userIdentifiers.add(user.email.toLowerCase());
    if (user.username) userIdentifiers.add(user.username.toLowerCase());
    if (user.phone) {
      const rawPhone = user.phone.toLowerCase();
      userIdentifiers.add(rawPhone);
      const digits = rawPhone.replace(/\D/g, '');
      if (digits) {
        userIdentifiers.add(digits);
        if (digits.length === 10) {
          userIdentifiers.add(`+91${digits}`);
          userIdentifiers.add(`91${digits}`);
        } else if (digits.length === 12 && digits.startsWith('91')) {
          userIdentifiers.add(digits.slice(2));
          userIdentifiers.add(`+${digits}`);
        }
      }
    }

    // 1. Direct events owned by user or assigned to user
    const directUserEvents = events.filter(e => {
      const owner = (e.createdBy || e.createdById || '').toLowerCase();
      const isOwner = Boolean(owner && userIdentifiers.has(owner));
      const isAssigned = Boolean(user.assignedEvents && user.assignedEvents.includes(e.id));
      return isOwner || isAssigned;
    });

    // 2. Map all events related to user (including nested sub-events under their events)
    const allUserEventsMap = new Map<string, Event>();
    directUserEvents.forEach(e => allUserEventsMap.set(e.id, e));

    let addedMore = true;
    while (addedMore) {
      addedMore = false;
      events.forEach(e => {
        if (e.parentId && allUserEventsMap.has(e.parentId) && !allUserEventsMap.has(e.id)) {
          allUserEventsMap.set(e.id, e);
          addedMore = true;
        }
      });
    }

    const allUserEvents = Array.from(allUserEventsMap.values());
    const allUserEventIds = new Set(allUserEvents.map(e => (e.id || '').toLowerCase()));

    // 3. User photos belonging to any of their events OR standalone photos directly uploaded by user
    const userPhotos = photos.filter(p => {
      const pUploader = (p.userId || '').toLowerCase();
      const pEventId = (p.eventId || '').toLowerCase();
      const belongsByEvent = Boolean(pEventId && allUserEventIds.has(pEventId));
      // Only attribute by uploader if the photo is NOT part of another host's event
      const belongsByUser = Boolean(!pEventId && pUploader && userIdentifiers.has(pUploader));
      return belongsByEvent || belongsByUser;
    });

    interface EventStats {
      imageCount: number;
      imageBytes: number;
      videoCount: number;
      videoBytes: number;
      totalCount: number;
      totalBytes: number;
    }

    const statsByEventId = new Map<string, EventStats>();

    userPhotos.forEach(p => {
      const size = Number(p.size) || 0;
      const mediaType = String(p.mediaType || '').toLowerCase();
      const resourceType = String(p.resourceType || '').toLowerCase();
      const rawFormat = String((p as any).format || '').toLowerCase();
      const rawPath = String((p as any).storageKey || (p as any).url || '').toLowerCase();
      const hasDuration = p.duration != null && Number(p.duration) > 0;
      const isVideoByExtension = 
        ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi'].includes(rawFormat) ||
        /\.(mp4|mov|webm|mkv|m4v|avi)(\?.*)?$/i.test(rawPath);
      const isVideo = mediaType === 'video' || resourceType === 'video' || hasDuration || isVideoByExtension;

      const eventKey = (p.eventId || '').toLowerCase();
      const current = statsByEventId.get(eventKey) || statsByEventId.get(p.eventId) || {
        imageCount: 0,
        imageBytes: 0,
        videoCount: 0,
        videoBytes: 0,
        totalCount: 0,
        totalBytes: 0,
      };

      if (isVideo) {
        current.videoBytes += size;
        current.videoCount += 1;
      } else {
        current.imageBytes += size;
        current.imageCount += 1;
      }
      current.totalCount = current.imageCount + current.videoCount;
      current.totalBytes = current.imageBytes + current.videoBytes;

      statsByEventId.set(eventKey, current);
      if (p.eventId) statsByEventId.set(p.eventId, current);
    });

    let totalImageBytes = 0;
    let totalVideoBytes = 0;
    let totalImageCount = 0;
    let totalVideoCount = 0;

    userPhotos.forEach(p => {
      const size = Number(p.size) || 0;
      const mediaType = String(p.mediaType || '').toLowerCase();
      const resourceType = String(p.resourceType || '').toLowerCase();
      const rawFormat = String((p as any).format || '').toLowerCase();
      const rawPath = String((p as any).storageKey || (p as any).url || '').toLowerCase();
      const hasDuration = p.duration != null && Number(p.duration) > 0;
      const isVideoByExtension = 
        ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi'].includes(rawFormat) ||
        /\.(mp4|mov|webm|mkv|m4v|avi)(\?.*)?$/i.test(rawPath);
      const isVideo = mediaType === 'video' || resourceType === 'video' || hasDuration || isVideoByExtension;
      if (isVideo) {
        totalVideoBytes += size;
        totalVideoCount += 1;
      } else {
        totalImageBytes += size;
        totalImageCount += 1;
      }
    });

    const totalBytes = totalImageBytes + totalVideoBytes;

    const mainEvents = allUserEvents.filter(e => !e.parentId && e.type !== 'sub');
    const subGalleries = allUserEvents.filter(e => Boolean(e.parentId) || e.type === 'sub');

    const subEventsByParent = new Map<string, Event[]>();
    subGalleries.forEach(s => {
      const pid = s.parentId || '';
      if (pid) {
        const list = subEventsByParent.get(pid) || [];
        list.push(s);
        subEventsByParent.set(pid, list);
      }
    });

    const sortByDateDesc = (a: Event, b: Event) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    };

    const mainEventBreakdown = mainEvents.sort(sortByDateDesc).map(evt => {
      const directStats = statsByEventId.get((evt.id || '').toLowerCase()) || statsByEventId.get(evt.id) || {
        imageCount: 0,
        imageBytes: 0,
        videoCount: 0,
        videoBytes: 0,
        totalCount: 0,
        totalBytes: 0,
      };

      const children = (subEventsByParent.get(evt.id) || []).sort(sortByDateDesc).map(child => {
        const childStats = statsByEventId.get((child.id || '').toLowerCase()) || statsByEventId.get(child.id) || {
          imageCount: 0,
          imageBytes: 0,
          videoCount: 0,
          videoBytes: 0,
          totalCount: 0,
          totalBytes: 0,
        };
        return {
          event: child,
          stats: childStats,
        };
      });

      const combinedImageCount = directStats.imageCount + children.reduce((s, c) => s + c.stats.imageCount, 0);
      const combinedImageBytes = directStats.imageBytes + children.reduce((s, c) => s + c.stats.imageBytes, 0);
      const combinedVideoCount = directStats.videoCount + children.reduce((s, c) => s + c.stats.videoCount, 0);
      const combinedVideoBytes = directStats.videoBytes + children.reduce((s, c) => s + c.stats.videoBytes, 0);
      const combinedTotalCount = combinedImageCount + combinedVideoCount;
      const combinedTotalBytes = combinedImageBytes + combinedVideoBytes;

      return {
        event: evt,
        directStats,
        children,
        combined: {
          imageCount: combinedImageCount,
          imageBytes: combinedImageBytes,
          videoCount: combinedVideoCount,
          videoBytes: combinedVideoBytes,
          totalCount: combinedTotalCount,
          totalBytes: combinedTotalBytes,
        },
      };
    });

    const knownMainIds = new Set(mainEvents.map(m => m.id));
    const orphanSubEvents = subGalleries.filter(s => !s.parentId || !knownMainIds.has(s.parentId)).map(child => {
      const childStats = statsByEventId.get(child.id) || {
        imageCount: 0,
        imageBytes: 0,
        videoCount: 0,
        videoBytes: 0,
        totalCount: 0,
        totalBytes: 0,
      };
      return {
        event: child,
        stats: childStats,
      };
    });

    // Backwards-compatible eventBreakdown for existing Storage tab table
    const eventBreakdown = mainEventBreakdown.map(item => ({
      event: item.event,
      subGalleriesCount: item.children.length,
      photoCount: item.combined.imageCount,
      videoCount: item.combined.videoCount,
      totalBytes: item.combined.totalBytes,
    }));

    return {
      allUserEvents,
      allUserEventIds,
      userIdentifiers,
      userPhotos,
      mainEventsCount: mainEvents.length,
      subGalleriesCount: subGalleries.length,
      imageBytes: totalImageBytes,
      videoBytes: totalVideoBytes,
      totalBytes,
      imageCount: totalImageCount,
      videoCount: totalVideoCount,
      totalMediaCount: userPhotos.length,
      mainEventBreakdown,
      orphanSubEvents,
      statsByEventId,
      eventBreakdown,
    };
  }, [user, events, photos]);

  // ── Historical Compute & Deleted Media State ─────────────────────────────
  const [deletedEvents, setDeletedEvents] = useState<DeletedEventArchive[]>([]);
  const [modalLogs, setModalLogs] = useState<any[]>([]);
  const [loadingCostLogs, setLoadingCostLogs] = useState(false);
  const [costRefreshKey, setCostRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const loadHistoricalCostData = async () => {
      setLoadingCostLogs(true);
      try {
        // 1. Fetch deleted events archive
        const allDeleted = await fetchDeletedEvents();
        const userDeleted = allDeleted.filter(d =>
          d.userId === user.id ||
          (user.email && d.userId?.toLowerCase() === user.email.toLowerCase()) ||
          (user.phone && d.userId === user.phone)
        );
        if (isMounted) {
          setDeletedEvents(userDeleted);
        }

        // 2. Collect all valid user identifiers & event IDs
        const validUserIds = Array.from(new Set([
          user.id,
          user.email,
          user.phone,
        ].filter(Boolean))) as string[];

        const activeIds = userEventMetrics.allUserEvents.map(e => e.id);
        const deletedIds = userDeleted.map(d => d.eventId);
        const allEventIds = Array.from(new Set([...activeIds, ...deletedIds])).filter(Boolean);
        const allEventIdSet = new Set(allEventIds.map(id => (id || '').toLowerCase()));
        const knownOtherEventIds = new Set(
          events
            .filter(e => !allEventIdSet.has((e.id || '').toLowerCase()))
            .map(e => (e.id || '').toLowerCase())
        );

        // Deduplication map by unique log id / signature
        const logsById = new Map<string, any>();

        // A. Query logs attributed directly to user's identifiers
        if (validUserIds.length > 0) {
          let from = 0;
          const batchSize = 1000;
          while (true) {
            const { data: pageLogs, error: logsErr } = await supabase
              .from('modal_cost_logs')
              .select('*')
              .in('user_id', validUserIds)
              .order('created_at', { ascending: false })
              .range(from, from + batchSize - 1);

            if (logsErr || !pageLogs || pageLogs.length === 0) break;
            pageLogs.forEach(log => {
              const eid = (log.event_id || '').toLowerCase();
              // If the log is for an event owned by another host, skip it (belongs to that event's host)
              if (eid && knownOtherEventIds.has(eid)) {
                return;
              }
              const logKey = log.id || `${log.photo_id || ''}-${log.created_at || ''}-${log.function_name || ''}`;
              logsById.set(logKey, log);
            });
            if (pageLogs.length < batchSize || logsById.size >= 20000) break;
            from += batchSize;
          }
        }

        // B. Query logs by associated event IDs in batches of 50 to avoid URL query limits
        const chunkSize = 50;
        for (let i = 0; i < allEventIds.length; i += chunkSize) {
          const chunk = allEventIds.slice(i, i + chunkSize);
          let from = 0;
          const batchSize = 1000;
          while (true) {
            const { data: pageLogs, error: logsErr } = await supabase
              .from('modal_cost_logs')
              .select('*')
              .in('event_id', chunk)
              .order('created_at', { ascending: false })
              .range(from, from + batchSize - 1);

            if (logsErr || !pageLogs || pageLogs.length === 0) break;
            pageLogs.forEach(log => {
              const logKey = log.id || `${log.photo_id || ''}-${log.created_at || ''}-${log.function_name || ''}`;
              logsById.set(logKey, log);
            });
            if (pageLogs.length < batchSize || logsById.size >= 20000) break;
            from += batchSize;
          }
        }

        if (isMounted) {
          setModalLogs(Array.from(logsById.values()));
        }
      } catch (err) {
        console.warn('Failed to load historical cost data:', err);
      } finally {
        if (isMounted) setLoadingCostLogs(false);
      }
    };

    loadHistoricalCostData();
    return () => {
      isMounted = false;
    };
  }, [user.id, user.email, user.phone, userEventMetrics.allUserEvents, costRefreshKey]);

  // ── Unified Economics Timeframe Window & Helper Functions ─────────────────
  const formatDurationHours = (hours: number | null | undefined): string => {
    if (!hours || hours <= 0 || isNaN(hours)) return '0h';
    if (hours < 24) return `${hours.toFixed(1)}h`;
    const days = hours / 24;
    return `${days.toFixed(1)}d (${hours.toFixed(0)}h)`;
  };

  const economicsWindow = useMemo(() => {
    const now = Date.now();
    const nowDate = new Date();
    let windowStartMs = now - 30 * 24 * 3600 * 1000;
    let windowEndMs = now;
    let isAllTime = false;

    if (economicsTimeFilter === '1d') {
      // Running calendar day starting at 12:00 AM to 11:59:59.999 PM
      const startOfDay = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate(), 23, 59, 59, 999);
      windowStartMs = startOfDay.getTime();
      windowEndMs = endOfDay.getTime();
    } else if (economicsTimeFilter === '1w') {
      // Running calendar week: Sunday 12:00 AM to Saturday 11:59:59.999 PM
      const dayOfWeek = nowDate.getDay(); // 0 is Sunday, 6 is Saturday
      const sunday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - dayOfWeek, 0, 0, 0, 0);
      const saturday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() + (6 - dayOfWeek), 23, 59, 59, 999);
      windowStartMs = sunday.getTime();
      windowEndMs = saturday.getTime();
    } else if (economicsTimeFilter === '1m') {
      // Running calendar month: 1st of month 12:00 AM to last day of month 11:59:59.999 PM (28, 29, 30, or 31)
      const startOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1, 0, 0, 0, 0);
      const endOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0, 23, 59, 59, 999);
      windowStartMs = startOfMonth.getTime();
      windowEndMs = endOfMonth.getTime();
    } else if (economicsTimeFilter === 'custom') {
      const s = new Date(economicsCustomStartDate + 'T00:00:00').getTime();
      const e = new Date(economicsCustomEndDate + 'T23:59:59.999').getTime();
      windowStartMs = !isNaN(s) ? s : (now - 30 * 86400000);
      windowEndMs = !isNaN(e) ? e : now;
      if (windowStartMs > windowEndMs) {
        const t = windowStartMs;
        windowStartMs = windowEndMs;
        windowEndMs = t;
      }
    } else if (economicsTimeFilter === 'all') {
      isAllTime = true;
      const uCreated = user.createdAt ? new Date(user.createdAt).getTime() : 0;
      windowStartMs = (uCreated > 0 && uCreated <= now) ? uCreated : (now - 365 * 86400000);
      windowEndMs = now;
    }

    const windowDurationHours = Math.max(0.1, (windowEndMs - windowStartMs) / 3600000);
    const windowDurationDays = windowDurationHours / 24;

    const startDateObj = new Date(windowStartMs);
    const endDateObj = new Date(windowEndMs);
    const formattedRange = startDateObj.toDateString() === endDateObj.toDateString()
      ? startDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : `${startDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ${endDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const durationLabel = formatDurationHours(windowDurationHours);

    return {
      windowStartMs,
      windowEndMs,
      isAllTime,
      windowDurationHours,
      windowDurationDays,
      formattedRange,
      durationLabel,
    };
  }, [economicsTimeFilter, economicsCustomStartDate, economicsCustomEndDate, user.createdAt]);

  // Modal logs filtered by selected timeframe window
  const windowModalLogs = useMemo(() => {
    if (economicsWindow.isAllTime) return modalLogs;
    return modalLogs.filter(log => {
      if (!log.created_at) return false;
      const t = new Date(log.created_at).getTime();
      return !isNaN(t) && t >= economicsWindow.windowStartMs && t <= economicsWindow.windowEndMs;
    });
  }, [modalLogs, economicsWindow]);

  // Payments filtered by selected timeframe window
  const windowPayments = useMemo(() => {
    if (economicsWindow.isAllTime) return payments;
    return payments.filter(p => {
      if (!p.created_at) return false;
      const t = new Date(p.created_at).getTime();
      return !isNaN(t) && t >= economicsWindow.windowStartMs && t <= economicsWindow.windowEndMs;
    });
  }, [payments, economicsWindow]);

  // ── High-Precision Actual Compute Metrics from modal_cost_logs ────────────
  const actualComputeMetrics = useMemo(() => {
    let totalPhotoActualUsd = 0;
    let totalPhotoActualInr = 0;
    let totalPhotoSeconds = 0;
    let totalPhotoRuns = 0;

    let totalBatchActualUsd = 0;
    let totalBatchActualInr = 0;
    let totalBatchSeconds = 0;
    let totalBatchRuns = 0;

    let totalVideoCpuActualUsd = 0;
    let totalVideoCpuActualInr = 0;
    let totalVideoCpuSeconds = 0;
    let totalVideoCpuRuns = 0;

    let totalVideoGpuActualUsd = 0;
    let totalVideoGpuActualInr = 0;
    let totalVideoGpuSeconds = 0;
    let totalVideoGpuRuns = 0;

    let totalSelfieActualUsd = 0;
    let totalSelfieActualInr = 0;
    let totalSelfieSeconds = 0;
    let totalSelfieRuns = 0;

    // Per-event compute details
    const eventComputeMap = new Map<string, {
      photoUsd: number;
      photoInr: number;
      photoSeconds: number;
      photoRuns: number;
      videoCpuUsd: number;
      videoCpuInr: number;
      videoCpuSeconds: number;
      videoCpuRuns: number;
      videoGpuUsd: number;
      videoGpuInr: number;
      videoGpuSeconds: number;
      videoGpuRuns: number;
      selfieUsd: number;
      selfieInr: number;
      selfieSeconds: number;
      selfieRuns: number;
      totalUsd: number;
      totalInr: number;
      totalSeconds: number;
    }>();

    const getOrCreateEventStats = (eventId: string) => {
      const key = (eventId || '').toLowerCase().trim();
      let stats = eventComputeMap.get(key);
      if (!stats) {
        stats = {
          photoUsd: 0,
          photoInr: 0,
          photoSeconds: 0,
          photoRuns: 0,
          videoCpuUsd: 0,
          videoCpuInr: 0,
          videoCpuSeconds: 0,
          videoCpuRuns: 0,
          videoGpuUsd: 0,
          videoGpuInr: 0,
          videoGpuSeconds: 0,
          videoGpuRuns: 0,
          selfieUsd: 0,
          selfieInr: 0,
          selfieSeconds: 0,
          selfieRuns: 0,
          totalUsd: 0,
          totalInr: 0,
          totalSeconds: 0,
        };
        eventComputeMap.set(key, stats);
      }
      return stats;
    };

    windowModalLogs.forEach(log => {
      const dur = Number(log.execution_time_seconds) || 0;
      const cpu = Number(log.cpu_cores) || 1.0;
      const mem = Number(log.memory_gb) || 1.0;
      const gpuType = String(log.gpu_type || 'None');
      const fn = String(log.function_name || 'process_single_photo').toLowerCase();
      const mediaType = String(log.media_type || '').toLowerCase();
      const workerType = String(log.worker_type || '').toLowerCase();

      const isGpu = 
        gpuType.toLowerCase().includes('l4') || 
        gpuType.toLowerCase().includes('a10g') || 
        gpuType.toLowerCase().includes('t4') || 
        fn.includes('video_gpu') || 
        fn.includes('gpu') || 
        workerType.includes('gpu') || 
        workerType.includes('l4');

      const isVideo = 
        mediaType === 'video' || 
        fn.includes('video') || 
        workerType.includes('video') || 
        isGpu;

      const isSelfie = 
        fn === 'find_matching_photos' || 
        fn.includes('selfie') || 
        fn.includes('face_match') || 
        workerType.includes('selfie');

      const isBatch = 
        fn === 'process_media_batch' || 
        fn.includes('batch') || 
        mediaType === 'batch' || 
        workerType.includes('batch');

      let gpuRateUsd = 0;
      if (isGpu) {
        if (gpuType.toLowerCase().includes('a10g')) gpuRateUsd = 0.0002778; // $1.00/hr
        else if (gpuType.toLowerCase().includes('t4')) gpuRateUsd = 0.0001639; // $0.59/hr
        else gpuRateUsd = 0.0002222; // $0.80/hr default L4
      }

      // Exact per-second compute rate from COST_ANALYSIS.md
      // CPU: $0.0000131/vCPU/s
      // RAM: $0.00000222/GB/s
      // L4 GPU: $0.0002222/s
      const calculatedCostUsd = dur * ((cpu * 0.0000131) + (mem * 0.00000222) + gpuRateUsd);
      const costUsd = (typeof log.cost_usd === 'number' && !isNaN(log.cost_usd) && log.cost_usd > 0)
        ? log.cost_usd
        : (typeof log.estimated_cost_inr === 'number' && !isNaN(log.estimated_cost_inr) && log.estimated_cost_inr > 0)
          ? log.estimated_cost_inr / 100
          : calculatedCostUsd;
      const costInr = costUsd * usdToInrRate;

      const eventId = log.event_id || '';
      const eventStats = eventId ? getOrCreateEventStats(eventId) : null;

      if (isSelfie) {
        totalSelfieActualUsd += costUsd;
        totalSelfieActualInr += costInr;
        totalSelfieSeconds += dur;
        totalSelfieRuns += 1;
        if (eventStats) {
          eventStats.selfieUsd += costUsd;
          eventStats.selfieInr += costInr;
          eventStats.selfieSeconds += dur;
          eventStats.selfieRuns += 1;
          eventStats.totalUsd += costUsd;
          eventStats.totalInr += costInr;
          eventStats.totalSeconds += dur;
        }
      } else if (isGpu) {
        totalVideoGpuActualUsd += costUsd;
        totalVideoGpuActualInr += costInr;
        totalVideoGpuSeconds += dur;
        totalVideoGpuRuns += 1;
        if (eventStats) {
          eventStats.videoGpuUsd += costUsd;
          eventStats.videoGpuInr += costInr;
          eventStats.videoGpuSeconds += dur;
          eventStats.videoGpuRuns += 1;
          eventStats.totalUsd += costUsd;
          eventStats.totalInr += costInr;
          eventStats.totalSeconds += dur;
        }
      } else if (isVideo) {
        totalVideoCpuActualUsd += costUsd;
        totalVideoCpuActualInr += costInr;
        totalVideoCpuSeconds += dur;
        totalVideoCpuRuns += 1;
        if (eventStats) {
          eventStats.videoCpuUsd += costUsd;
          eventStats.videoCpuInr += costInr;
          eventStats.videoCpuSeconds += dur;
          eventStats.videoCpuRuns += 1;
          eventStats.totalUsd += costUsd;
          eventStats.totalInr += costInr;
          eventStats.totalSeconds += dur;
        }
      } else if (isBatch) {
        totalBatchActualUsd += costUsd;
        totalBatchActualInr += costInr;
        totalBatchSeconds += dur;
        totalBatchRuns += 1;
        if (eventStats) {
          eventStats.photoUsd += costUsd;
          eventStats.photoInr += costInr;
          eventStats.totalUsd += costUsd;
          eventStats.totalInr += costInr;
          eventStats.totalSeconds += dur;
        }
      } else {
        totalPhotoActualUsd += costUsd;
        totalPhotoActualInr += costInr;
        totalPhotoSeconds += dur;
        totalPhotoRuns += 1;
        if (eventStats) {
          eventStats.photoUsd += costUsd;
          eventStats.photoInr += costInr;
          eventStats.photoSeconds += dur;
          eventStats.photoRuns += 1;
          eventStats.totalUsd += costUsd;
          eventStats.totalInr += costInr;
          eventStats.totalSeconds += dur;
        }
      }
    });

    const totalVideoActualUsd = totalVideoCpuActualUsd + totalVideoGpuActualUsd;
    const totalVideoActualInr = totalVideoCpuActualInr + totalVideoGpuActualInr;
    const totalVideoSeconds = totalVideoCpuSeconds + totalVideoGpuSeconds;
    const totalVideoRuns = totalVideoCpuRuns + totalVideoGpuRuns;

    const activePhotos = userEventMetrics.imageCount;
    const activeVideos = userEventMetrics.videoCount;

    // Remaining unlogged media gets added at observed user average (or COST_ANALYSIS benchmark if 0 runs)
    const avgObservedPhotoCostUsd = totalPhotoRuns > 0 ? (totalPhotoActualUsd / totalPhotoRuns) : 0.000082;
    const avgObservedVideoCpuCostUsd = totalVideoCpuRuns > 0 ? (totalVideoCpuActualUsd / totalVideoCpuRuns) : 0.0035;
    const avgObservedVideoGpuCostUsd = totalVideoGpuRuns > 0 ? (totalVideoGpuActualUsd / totalVideoGpuRuns) : 0.0175;
    const avgObservedVideoCostUsd = totalVideoRuns > 0 ? (totalVideoActualUsd / totalVideoRuns) : 0.0035;

    const avgObservedPhotoCost = avgObservedPhotoCostUsd * usdToInrRate;
    const avgObservedVideoCpuCost = avgObservedVideoCpuCostUsd * usdToInrRate;
    const avgObservedVideoGpuCost = avgObservedVideoGpuCostUsd * usdToInrRate;
    const avgObservedVideoCost = avgObservedVideoCostUsd * usdToInrRate;

    let lifetimePhotosCount = totalPhotoRuns;
    let lifetimeVideosCount = totalVideoRuns;
    let unloggedPhotos = 0;
    let unloggedVideos = 0;

    if (economicsWindow.isAllTime) {
      const deletedArchivePhotoCount = deletedEvents.reduce((s, d) => s + (Number(d.photosCount) || 0), 0);
      const deletedArchiveVideoCount = deletedEvents.reduce((s, d) => s + (Number(d.videosCount) || 0), 0);
      lifetimePhotosCount = Math.max(activePhotos + deletedArchivePhotoCount, totalPhotoRuns);
      lifetimeVideosCount = Math.max(activeVideos + deletedArchiveVideoCount, totalVideoRuns);
      unloggedPhotos = Math.max(0, lifetimePhotosCount - totalPhotoRuns);
      unloggedVideos = Math.max(0, lifetimeVideosCount - totalVideoRuns);
    } else {
      const uploadsInWindow = photos.filter(p => {
        const rawTime = p.uploadedAt ? new Date(p.uploadedAt).getTime() : 0;
        return rawTime >= economicsWindow.windowStartMs && rawTime <= economicsWindow.windowEndMs;
      });
      const windowImgCount = uploadsInWindow.filter(p => {
        const isVid = p.mediaType === 'video' || p.resourceType === 'video' || (p.duration != null && Number(p.duration) > 0);
        return !isVid;
      }).length;
      const windowVidCount = uploadsInWindow.length - windowImgCount;
      lifetimePhotosCount = Math.max(windowImgCount, totalPhotoRuns);
      lifetimeVideosCount = Math.max(windowVidCount, totalVideoRuns);
      unloggedPhotos = Math.max(0, lifetimePhotosCount - totalPhotoRuns);
      unloggedVideos = Math.max(0, lifetimeVideosCount - totalVideoRuns);
    }

    // Inspect user's actual videos to see how many qualify as GPU candidates (>10m or >350MB)
    let activeGpuVideosCandidateCount = 0;
    userEventMetrics.userPhotos.forEach(p => {
      const size = Number(p.size) || 0;
      const mediaType = String(p.mediaType || '').toLowerCase();
      const resourceType = String(p.resourceType || '').toLowerCase();
      const rawFormat = String((p as any).format || '').toLowerCase();
      const rawPath = String((p as any).storageKey || (p as any).url || '').toLowerCase();
      const hasDuration = p.duration != null && Number(p.duration) > 0;
      const isVideoByExtension = 
        ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi'].includes(rawFormat) ||
        /\.(mp4|mov|webm|mkv|m4v|avi)(\?.*)?$/i.test(rawPath);
      const isVideo = mediaType === 'video' || resourceType === 'video' || hasDuration || isVideoByExtension;
      if (isVideo) {
        const isLong = (hasDuration && Number(p.duration) > 600) || size > 350 * 1024 * 1024;
        if (isLong) activeGpuVideosCandidateCount++;
      }
    });

    const unloggedGpuVideos = Math.min(unloggedVideos, Math.max(0, activeGpuVideosCandidateCount - totalVideoGpuRuns));
    const unloggedCpuVideos = Math.max(0, unloggedVideos - unloggedGpuVideos);

    const effectivePhotoUsd = totalPhotoActualUsd + totalBatchActualUsd + (unloggedPhotos * avgObservedPhotoCostUsd);
    const effectiveVideoCpuUsd = totalVideoCpuActualUsd + (unloggedCpuVideos * avgObservedVideoCpuCostUsd);
    const effectiveVideoGpuUsd = totalVideoGpuActualUsd + (unloggedGpuVideos * avgObservedVideoGpuCostUsd);
    const effectiveVideoUsd = effectiveVideoCpuUsd + effectiveVideoGpuUsd;
    const effectiveSelfieUsd = totalSelfieActualUsd;
    const totalModalUsd = effectivePhotoUsd + effectiveVideoUsd + effectiveSelfieUsd;

    const effectivePhotoInr = effectivePhotoUsd * usdToInrRate;
    const effectiveVideoCpuInr = effectiveVideoCpuUsd * usdToInrRate;
    const effectiveVideoGpuInr = effectiveVideoGpuUsd * usdToInrRate;
    const effectiveVideoInr = effectiveVideoUsd * usdToInrRate;
    const effectiveSelfieInr = effectiveSelfieUsd * usdToInrRate;
    const totalModalInr = totalModalUsd * usdToInrRate;

    const totalComputeSeconds = totalPhotoSeconds + totalBatchSeconds + totalVideoSeconds + totalSelfieSeconds;

    return {
      totalPhotoActualUsd,
      totalPhotoActualInr,
      totalPhotoSeconds,
      totalPhotoRuns,
      totalBatchActualUsd,
      totalBatchActualInr,
      totalBatchSeconds,
      totalBatchRuns,
      totalVideoCpuActualUsd,
      totalVideoCpuActualInr,
      totalVideoCpuSeconds,
      totalVideoCpuRuns,
      totalVideoGpuActualUsd,
      totalVideoGpuActualInr,
      totalVideoGpuSeconds,
      totalVideoGpuRuns,
      totalVideoActualUsd,
      totalVideoActualInr,
      totalVideoSeconds,
      totalVideoRuns,
      totalSelfieActualUsd,
      totalSelfieActualInr,
      totalSelfieSeconds,
      totalSelfieRuns,
      totalComputeSeconds,
      effectivePhotoUsd,
      effectivePhotoInr,
      effectiveVideoCpuUsd,
      effectiveVideoCpuInr,
      effectiveVideoGpuUsd,
      effectiveVideoGpuInr,
      effectiveVideoUsd,
      effectiveVideoInr,
      effectiveSelfieUsd,
      effectiveSelfieInr,
      totalModalUsd,
      totalModalInr,
      lifetimePhotosCount,
      lifetimeVideosCount,
      activePhotos,
      activeVideos,
      unloggedCpuVideos,
      unloggedGpuVideos,
      deletedPhotosCount: Math.max(0, lifetimePhotosCount - activePhotos),
      deletedVideosCount: Math.max(0, lifetimeVideosCount - activeVideos),
      totalLifetimeMedia: lifetimePhotosCount + lifetimeVideosCount,
      eventComputeMap,
      avgObservedPhotoCostUsd,
      avgObservedPhotoCost,
      avgObservedVideoCostUsd,
      avgObservedVideoCost,
      avgObservedVideoCpuCostUsd,
      avgObservedVideoCpuCost,
      avgObservedVideoGpuCostUsd,
      avgObservedVideoGpuCost,
    };
  }, [windowModalLogs, userEventMetrics.imageCount, userEventMetrics.videoCount, userEventMetrics.userPhotos, deletedEvents, economicsWindow, photos, usdToInrRate]);

  // Formatted helpers
  const formatBytes = (bytes: number | null | undefined): string => {
    if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const sizeIndex = Math.min(Math.max(0, i), sizes.length - 1);
    return `${parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2))} ${sizes[sizeIndex]}`;
  };

  const usedGb = userEventMetrics.totalBytes / (1024 * 1024 * 1024);
  const quotaBytes = currentPlan.storageBytes;
  const storagePercentage = quotaBytes === Infinity ? 0 : Math.min(100, Math.round((userEventMetrics.totalBytes / quotaBytes) * 100));

  // Compute Days Remaining in Plan
  const planDaysRemaining = useMemo(() => {
    if (!user.planEndDate) return null;
    const end = new Date(`${user.planEndDate}T23:59:59Z`).getTime();
    const now = Date.now();
    const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return diffDays;
  }, [user.planEndDate]);

  // ── Backblaze B2 Metering Matrix (Window-Aware) ───────────────────────────
  const b2MeteringData = useMemo(() => {
    const now = Date.now();
    const { windowStartMs, windowEndMs, windowDurationHours, windowDurationDays, formattedRange, durationLabel } = economicsWindow;

    const rows: BackblazeRow[] = [];
    const meteredPhotoIds = new Set<string>();

    // 1. Active Main Events (with their children sub-galleries)
    userEventMetrics.mainEventBreakdown.forEach(({ event, children, combined }) => {
      const relatedIds = new Set([event.id, ...children.map(c => c.event.id)].map(id => (id || '').toLowerCase()));
      const galleryPhotos = photos.filter(p => p.eventId && relatedIds.has(p.eventId.toLowerCase()));

      let totalGbHours = 0;
      let maxOverlapHours = 0;
      let uploadsInWindow = 0;

      galleryPhotos.forEach(p => {
        meteredPhotoIds.add(p.id);
        const pBytes = Number(p.size) || 0;
        const pGb = pBytes / (1024 * 1024 * 1024);
        const rawTime = p.uploadedAt ? new Date(p.uploadedAt).getTime() : (event.createdAt ? new Date(event.createdAt).getTime() : windowStartMs);
        const pStart = !isNaN(rawTime) && rawTime > 0 ? rawTime : windowStartMs;
        const pEnd = now;

        const oStart = Math.max(pStart, windowStartMs);
        const oEnd = Math.min(pEnd, windowEndMs);
        let oHours = Math.max(0, (oEnd - oStart) / 3600000);
        if (oHours > 0 && oHours < 1) oHours = 1;

        if (oHours > maxOverlapHours) maxOverlapHours = oHours;
        totalGbHours += pGb * oHours;

        if (pStart >= windowStartMs && pStart <= windowEndMs) {
          uploadsInWindow += 1;
        }
      });

      if (galleryPhotos.length === 0 && combined.totalBytes > 0) {
        const cGb = combined.totalBytes / (1024 * 1024 * 1024);
        const evCreated = event.createdAt ? new Date(event.createdAt).getTime() : windowStartMs;
        const oStart = Math.max(evCreated, windowStartMs);
        const oEnd = Math.min(now, windowEndMs);
        let oHours = Math.max(0, (oEnd - oStart) / 3600000);
        if (oHours > 0 && oHours < 1) oHours = 1;
        maxOverlapHours = oHours;
        totalGbHours = cGb * oHours;
      }

      const billableGbMonths = totalGbHours / 720;
      const storageCostInr = billableGbMonths * 0.60;
      const classCUploads = uploadsInWindow;
      const classCDeletions = 0;
      const classCTotal = classCUploads + classCDeletions;
      const classCCostInr = (classCTotal / 1000) * 0.40;

      const classBReads = combined.totalCount > 0 ? Math.min(1000, combined.totalCount * 2 + 10) : 0;
      const classBCostInr = (classBReads / 10000) * 0.40;

      const totalCostInr = storageCostInr + classCCostInr + classBCostInr;
      const title = event.title || 'Untitled Event';

      rows.push({
        id: `b2-active-${event.id}`,
        galId: event.id,
        title,
        type: 'active',
        isSample: !!event.isSampleGallery,
        photoCount: combined.imageCount,
        videoCount: combined.videoCount,
        totalMediaCount: combined.totalCount,
        bytes: combined.totalBytes,
        gb: combined.totalBytes / (1024 * 1024 * 1024),
        windowDurationHours: maxOverlapHours,
        gbHours: totalGbHours,
        billableGbMonths,
        storageCostInr,
        storageCostUsd: storageCostInr / 100,
        classCUploads,
        classCDeletions,
        classCTotal,
        classCCostInr,
        classBReads,
        classBCostInr,
        totalTransactionsCount: classCTotal + classBReads,
        totalTransactionsCostInr: classCCostInr + classBCostInr,
        bandwidthCostInr: 0,
        totalCostInr,
        totalCostUsd: totalCostInr / 100,
        searchableText: `${title} ${event.id} active`.toLowerCase(),
      });
    });

    // 2. Orphan Sub-events
    userEventMetrics.orphanSubEvents.forEach(({ event, stats }) => {
      const galleryPhotos = photos.filter(p => p.eventId === event.id);
      let totalGbHours = 0;
      let maxOverlapHours = 0;
      let uploadsInWindow = 0;

      galleryPhotos.forEach(p => {
        meteredPhotoIds.add(p.id);
        const pBytes = Number(p.size) || 0;
        const pGb = pBytes / (1024 * 1024 * 1024);
        const rawTime = p.uploadedAt ? new Date(p.uploadedAt).getTime() : (event.createdAt ? new Date(event.createdAt).getTime() : windowStartMs);
        const pStart = !isNaN(rawTime) && rawTime > 0 ? rawTime : windowStartMs;
        const pEnd = now;

        const oStart = Math.max(pStart, windowStartMs);
        const oEnd = Math.min(pEnd, windowEndMs);
        let oHours = Math.max(0, (oEnd - oStart) / 3600000);
        if (oHours > 0 && oHours < 1) oHours = 1;

        if (oHours > maxOverlapHours) maxOverlapHours = oHours;
        totalGbHours += pGb * oHours;

        if (pStart >= windowStartMs && pStart <= windowEndMs) {
          uploadsInWindow += 1;
        }
      });

      if (galleryPhotos.length === 0 && stats.totalBytes > 0) {
        const cGb = stats.totalBytes / (1024 * 1024 * 1024);
        const evCreated = event.createdAt ? new Date(event.createdAt).getTime() : windowStartMs;
        const oStart = Math.max(evCreated, windowStartMs);
        const oEnd = Math.min(now, windowEndMs);
        let oHours = Math.max(0, (oEnd - oStart) / 3600000);
        if (oHours > 0 && oHours < 1) oHours = 1;
        maxOverlapHours = oHours;
        totalGbHours = cGb * oHours;
      }

      const billableGbMonths = totalGbHours / 720;
      const storageCostInr = billableGbMonths * 0.60;
      const classCUploads = uploadsInWindow;
      const classCDeletions = 0;
      const classCTotal = classCUploads + classCDeletions;
      const classCCostInr = (classCTotal / 1000) * 0.40;
      const classBReads = stats.totalCount > 0 ? Math.min(500, stats.totalCount * 2 + 5) : 0;
      const classBCostInr = (classBReads / 10000) * 0.40;
      const totalCostInr = storageCostInr + classCCostInr + classBCostInr;
      const title = event.title || 'Untitled Sub-Gallery';

      rows.push({
        id: `b2-orphan-${event.id}`,
        galId: event.id,
        title,
        type: 'active',
        isSample: !!event.isSampleGallery,
        photoCount: stats.imageCount,
        videoCount: stats.videoCount,
        totalMediaCount: stats.totalCount,
        bytes: stats.totalBytes,
        gb: stats.totalBytes / (1024 * 1024 * 1024),
        windowDurationHours: maxOverlapHours,
        gbHours: totalGbHours,
        billableGbMonths,
        storageCostInr,
        storageCostUsd: storageCostInr / 100,
        classCUploads,
        classCDeletions,
        classCTotal,
        classCCostInr,
        classBReads,
        classBCostInr,
        totalTransactionsCount: classCTotal + classBReads,
        totalTransactionsCostInr: classCCostInr + classBCostInr,
        bandwidthCostInr: 0,
        totalCostInr,
        totalCostUsd: totalCostInr / 100,
        searchableText: `${title} ${event.id} active sub`.toLowerCase(),
      });
    });

    // 2b. Standalone / Direct Active User Photos (media uploaded by user not grouped under above events)
    const standalonePhotos = photos.filter(p => {
      if (meteredPhotoIds.has(p.id)) return false;
      const pUploader = (p.userId || '').toLowerCase();
      const belongsByUser = Boolean(pUploader && userEventMetrics.userIdentifiers.has(pUploader));
      const belongsByEvent = Boolean(p.eventId && userEventMetrics.allUserEventIds.has(p.eventId));
      return belongsByUser || belongsByEvent;
    });

    if (standalonePhotos.length > 0) {
      let totalGbHours = 0;
      let maxOverlapHours = 0;
      let uploadsInWindow = 0;
      let totalBytes = 0;
      let photoCount = 0;
      let videoCount = 0;

      standalonePhotos.forEach(p => {
        meteredPhotoIds.add(p.id);
        const pBytes = Number(p.size) || 0;
        totalBytes += pBytes;
        const pGb = pBytes / (1024 * 1024 * 1024);
        const rawTime = p.uploadedAt ? new Date(p.uploadedAt).getTime() : windowStartMs;
        const pStart = !isNaN(rawTime) && rawTime > 0 ? rawTime : windowStartMs;
        const pEnd = now;

        const oStart = Math.max(pStart, windowStartMs);
        const oEnd = Math.min(pEnd, windowEndMs);
        let oHours = Math.max(0, (oEnd - oStart) / 3600000);
        if (oHours > 0 && oHours < 1) oHours = 1;

        if (oHours > maxOverlapHours) maxOverlapHours = oHours;
        totalGbHours += pGb * oHours;

        if (pStart >= windowStartMs && pStart <= windowEndMs) {
          uploadsInWindow += 1;
        }

        const isVideo = p.mediaType === 'video' || p.resourceType === 'video';
        if (isVideo) videoCount++;
        else photoCount++;
      });

      const billableGbMonths = totalGbHours / 720;
      const storageCostInr = billableGbMonths * 0.60;
      const classCUploads = uploadsInWindow;
      const classCDeletions = 0;
      const classCTotal = classCUploads + classCDeletions;
      const classCCostInr = (classCTotal / 1000) * 0.40;
      const classBReads = standalonePhotos.length > 0 ? Math.min(500, standalonePhotos.length * 2 + 5) : 0;
      const classBCostInr = (classBReads / 10000) * 0.40;
      const totalCostInr = storageCostInr + classCCostInr + classBCostInr;

      rows.push({
        id: `b2-standalone-${user.id}`,
        galId: user.id,
        title: 'Direct / Standalone Media',
        type: 'active',
        isSample: false,
        photoCount,
        videoCount,
        totalMediaCount: photoCount + videoCount,
        bytes: totalBytes,
        gb: totalBytes / (1024 * 1024 * 1024),
        windowDurationHours: maxOverlapHours,
        gbHours: totalGbHours,
        billableGbMonths,
        storageCostInr,
        storageCostUsd: storageCostInr / 100,
        classCUploads,
        classCDeletions,
        classCTotal,
        classCCostInr,
        classBReads,
        classBCostInr,
        totalTransactionsCount: classCTotal + classBReads,
        totalTransactionsCostInr: classCCostInr + classBCostInr,
        bandwidthCostInr: 0,
        totalCostInr,
        totalCostUsd: totalCostInr / 100,
        searchableText: `direct standalone media ${user.id} active`.toLowerCase(),
      });
    }

    // 3. Deleted / Archived Events
    deletedEvents.forEach(del => {
      const delBytes = Number(del.totalBytes) || 0;
      const delGb = delBytes / (1024 * 1024 * 1024);
      const delAtMs = new Date(del.deletedAt).getTime();

      const cLogs = modalLogs.filter(l => l.event_id === del.eventId);
      const earliestLogMs = cLogs.length > 0
        ? Math.min(...cLogs.map(l => new Date(l.created_at).getTime()).filter(t => !isNaN(t) && t > 0))
        : NaN;
      const parsedCreatedAtMs = del.eventCreatedAt ? new Date(del.eventCreatedAt).getTime() : NaN;
      const validCreatedAtMs = !isNaN(parsedCreatedAtMs) && parsedCreatedAtMs > 0 ? parsedCreatedAtMs : NaN;

      const delStartMs = !isNaN(validCreatedAtMs)
        ? validCreatedAtMs
        : (!isNaN(earliestLogMs) && earliestLogMs > 0 ? earliestLogMs : (delAtMs - 14 * 86400000));

      const oStart = Math.max(delStartMs, windowStartMs);
      const oEnd = Math.min(delAtMs, windowEndMs);
      const oHours = Math.max(0, (oEnd - oStart) / 3600000);

      const gbHours = delGb * oHours;
      const billableGbMonths = gbHours / 720;
      const storageCostInr = billableGbMonths * 0.60;

      const wasUploadedInWindow = delStartMs >= windowStartMs && delStartMs <= windowEndMs;
      const wasDeletedInWindow = delAtMs >= windowStartMs && delAtMs <= windowEndMs;

      const mediaCount = (Number(del.photosCount) || 0) + (Number(del.videosCount) || 0);
      const classCUploads = wasUploadedInWindow ? mediaCount : 0;
      const classCDeletions = wasDeletedInWindow ? mediaCount : 0;
      const classCTotal = classCUploads + classCDeletions;
      const classCCostInr = (classCTotal / 1000) * 0.40;
      const classBReads = oHours > 0 ? Math.min(30, mediaCount) : 0;
      const classBCostInr = (classBReads / 10000) * 0.40;

      const totalCostInr = storageCostInr + classCCostInr + classBCostInr;
      const title = del.eventTitle || 'Untitled Gallery';

      rows.push({
        id: `b2-deleted-${del.id}`,
        galId: del.eventId,
        title,
        type: 'deleted',
        photoCount: Number(del.photosCount) || 0,
        videoCount: Number(del.videosCount) || 0,
        totalMediaCount: mediaCount,
        bytes: delBytes,
        gb: delGb,
        windowDurationHours: oHours,
        gbHours,
        billableGbMonths,
        storageCostInr,
        storageCostUsd: storageCostInr / 100,
        classCUploads,
        classCDeletions,
        classCTotal,
        classCCostInr,
        classBReads,
        classBCostInr,
        totalTransactionsCount: classCTotal + classBReads,
        totalTransactionsCostInr: classCCostInr + classBCostInr,
        bandwidthCostInr: 0,
        totalCostInr,
        totalCostUsd: totalCostInr / 100,
        searchableText: `${title} ${del.eventId} deleted`.toLowerCase(),
      });
    });

    // 4. Orphaned historical deleted event logs in modal_cost_logs
    const allUserEventIds = new Set(userEventMetrics.allUserEvents.map(e => e.id));
    const allDeletedEventIds = new Set(deletedEvents.map(d => d.eventId));

    Array.from(actualComputeMetrics.eventComputeMap.keys()).forEach(orphanedId => {
      if (!orphanedId || allUserEventIds.has(orphanedId) || allDeletedEventIds.has(orphanedId)) return;
      const oStats = actualComputeMetrics.eventComputeMap.get(orphanedId);
      if (!oStats || (oStats.photoRuns === 0 && oStats.videoCpuRuns === 0 && oStats.videoGpuRuns === 0 && oStats.selfieRuns === 0)) return;

      const orphanedLogs = modalLogs.filter(l => l.event_id === orphanedId);
      const knownBytes = orphanedLogs.reduce((s, l) => s + (Number(l.media_size) || 0), 0);
      const totalPhotos = oStats.photoRuns;
      const totalVideos = oStats.videoCpuRuns + oStats.videoGpuRuns;
      const totalMedia = totalPhotos + totalVideos;
      
      const estimatedBytes = (totalPhotos * 4.5 * 1024 * 1024) + (totalVideos * 45 * 1024 * 1024);
      const delBytes = knownBytes > 0 ? knownBytes : estimatedBytes;
      const delGb = delBytes / (1024 * 1024 * 1024);

      const timestamps = orphanedLogs
        .map(l => new Date(l.created_at).getTime())
        .filter(t => !isNaN(t) && t > 0);
      
      const firstUploadMs = timestamps.length > 0 ? Math.min(...timestamps) : (now - 30 * 86400000);
      const lastUploadMs = timestamps.length > 0 ? Math.max(...timestamps) : firstUploadMs;
      const estimatedDeletedAtMs = Math.min(now, lastUploadMs + (30 * 86400000));

      const oStart = Math.max(firstUploadMs, windowStartMs);
      const oEnd = Math.min(estimatedDeletedAtMs, windowEndMs);
      let oHours = Math.max(0, (oEnd - oStart) / 3600000);
      if (oHours > 0 && oHours < 1) oHours = 1;

      const gbHours = delGb * oHours;
      const billableGbMonths = gbHours / 720;
      const storageCostInr = billableGbMonths * 0.60;

      const wasUploadedInWindow = firstUploadMs >= windowStartMs && firstUploadMs <= windowEndMs;
      const wasDeletedInWindow = estimatedDeletedAtMs >= windowStartMs && estimatedDeletedAtMs <= windowEndMs;

      const classCUploads = wasUploadedInWindow ? totalMedia : 0;
      const classCDeletions = wasDeletedInWindow ? totalMedia : 0;
      const classCTotal = classCUploads + classCDeletions;
      const classCCostInr = (classCTotal / 1000) * 0.40;
      const classBReads = oHours > 0 ? Math.min(30, totalMedia) : 0;
      const classBCostInr = (classBReads / 10000) * 0.40;

      const totalCostInr = storageCostInr + classCCostInr + classBCostInr;
      const title = `Historical Gallery (${orphanedId.slice(0, 8)}...)`;

      rows.push({
        id: `b2-orphaned-${orphanedId}`,
        galId: orphanedId,
        title,
        type: 'deleted',
        photoCount: totalPhotos,
        videoCount: totalVideos,
        totalMediaCount: totalMedia,
        bytes: delBytes,
        gb: delGb,
        windowDurationHours: oHours,
        gbHours,
        billableGbMonths,
        storageCostInr,
        storageCostUsd: storageCostInr / 100,
        classCUploads,
        classCDeletions,
        classCTotal,
        classCCostInr,
        classBReads,
        classBCostInr,
        totalTransactionsCount: classCTotal + classBReads,
        totalTransactionsCostInr: classCCostInr + classBCostInr,
        bandwidthCostInr: 0,
        totalCostInr,
        totalCostUsd: totalCostInr / 100,
        searchableText: `historical gallery ${orphanedId} deleted`.toLowerCase(),
      });
    });

    // Filter to rows that actually existed or had activity within the active timeframe window
    const rowsInWindow = rows.filter(r => r.windowDurationHours > 0 || r.classCTotal > 0);

    const activeRows = rows.filter(r => r.type === 'active');
    const totalGbStored = activeRows.reduce((s, r) => s + r.gb, 0);

    const totalGbHours = rows.reduce((s, r) => s + r.gbHours, 0);
    const totalBillableGbMonths = totalGbHours / 720;
    const totalStorageCostUsd = totalBillableGbMonths * 0.006;
    const totalStorageCostInr = totalStorageCostUsd * usdToInrRate;

    const totalClassCUploads = rows.reduce((s, r) => s + r.classCUploads, 0);
    const totalClassCDeletions = rows.reduce((s, r) => s + r.classCDeletions, 0);
    const totalClassC = totalClassCUploads + totalClassCDeletions;
    const totalClassCCostUsd = (totalClassC / 1000) * 0.004;
    const totalClassCCostInr = totalClassCCostUsd * usdToInrRate;

    const totalClassB = rows.reduce((s, r) => s + r.classBReads, 0);
    const totalClassBCostUsd = (totalClassB / 10000) * 0.004;
    const totalClassBCostInr = totalClassBCostUsd * usdToInrRate;

    const totalTransactionCostUsd = totalClassCCostUsd + totalClassBCostUsd;
    const totalTransactionCostInr = totalTransactionCostUsd * usdToInrRate;
    const grandTotalB2CostUsd = totalStorageCostUsd + totalTransactionCostUsd;
    const grandTotalB2CostInr = grandTotalB2CostUsd * usdToInrRate;

    const freeTierStorageCreditInr = 0;
    const netBilledB2CostInr = grandTotalB2CostInr;

    // Window-specific metrics (only events active or present during this selected timeframe):
    const windowPhotos = rowsInWindow.reduce((s, r) => s + r.photoCount, 0);
    const windowVideos = rowsInWindow.reduce((s, r) => s + r.videoCount, 0);
    const windowMediaCount = windowPhotos + windowVideos;
    const windowBytes = rowsInWindow.reduce((s, r) => s + r.bytes, 0);
    const windowPeakGb = rowsInWindow.reduce((s, r) => s + r.gb, 0);
    const windowAvgGb = windowDurationHours > 0 ? (totalGbHours / windowDurationHours) : 0;

    // Lifetime/all-time totals for reference
    const lifetimePeakGb = rows.reduce((s, r) => s + r.gb, 0);
    const lifetimeTotalBytes = rows.reduce((s, r) => s + r.bytes, 0);

    return {
      rows,
      rowsInWindow,
      windowStartMs,
      windowEndMs,
      windowDurationHours,
      windowDurationDays,
      formattedRange,
      durationLabel,
      totalPhotos: windowPhotos,
      totalVideos: windowVideos,
      totalMediaCount: windowMediaCount,
      totalBytes: windowBytes,
      windowBytes,
      windowPeakGb,
      windowAvgGb,
      lifetimePeakGb,
      lifetimeTotalBytes,
      totalGbStored,
      totalPeakGb: windowPeakGb,
      totalGbHours,
      totalBillableGbMonths,
      totalStorageCostInr,
      totalStorageCostUsd,
      totalClassCUploads,
      totalClassCDeletions,
      totalClassC,
      totalClassCCostInr,
      totalClassCCostUsd,
      totalClassB,
      totalClassBCostInr,
      totalClassBCostUsd,
      totalTransactionCostInr,
      totalTransactionCostUsd,
      grandTotalB2CostInr,
      grandTotalB2CostUsd,
      freeTierStorageCreditInr,
      netBilledB2CostInr,
    };
  }, [
    economicsWindow,
    userEventMetrics,
    actualComputeMetrics,
    photos,
    deletedEvents,
    modalLogs,
    user.createdAt,
    usdToInrRate,
  ]);

  // Cost calculations strictly adhering to COST_ANALYSIS.md ($1 = ₹100 fallback, live forex supported)
  // Actual per-second hardware billing for Compute; State-based for B2 Storage
  const costBreakdown = useMemo(() => {
    // 1. Backblaze B2 Storage (State-Based / Monthly Recurring):
    // Only ACTIVE media currently occupying B2 disk space is billed recurringly monthly.
    // Rate: $0.006 / GB / month (~₹0.60 / GB / month at $1=₹100)
    const b2MonthlyUsd = usedGb * 0.006;
    const b2MonthlyInr = b2MonthlyUsd * usdToInrRate;
    const b2YearlyUsd = b2MonthlyUsd * 12;
    const b2YearlyInr = b2MonthlyInr * 12;

    // 2. Modal.com Serverless Compute Workers (Actual Per-Second Hardware Consumption in window):
    const modalPhotoUsd = actualComputeMetrics.effectivePhotoUsd;
    const modalPhotoInr = actualComputeMetrics.effectivePhotoInr;
    const modalVideoCpuUsd = actualComputeMetrics.effectiveVideoCpuUsd;
    const modalVideoCpuInr = actualComputeMetrics.effectiveVideoCpuInr;
    const modalVideoGpuUsd = actualComputeMetrics.effectiveVideoGpuUsd;
    const modalVideoGpuInr = actualComputeMetrics.effectiveVideoGpuInr;
    const modalVideoUsd = actualComputeMetrics.effectiveVideoUsd;
    const modalVideoInr = actualComputeMetrics.effectiveVideoInr;
    const modalSelfieUsd = actualComputeMetrics.effectiveSelfieUsd;
    const modalSelfieInr = actualComputeMetrics.effectiveSelfieInr;
    const modalTotalUsd = actualComputeMetrics.totalModalUsd;
    const modalTotalInr = actualComputeMetrics.totalModalInr;

    // Platform-level fixed infrastructure (Supabase DB & Upstash Queue) excluded from per-user unit economics

    // Calculate duration user has been registered (in fractional months)
    let monthsActive = 1;
    if (user.createdAt) {
      const createdTime = new Date(user.createdAt).getTime();
      if (!isNaN(createdTime) && createdTime > 0) {
        const now = Date.now();
        const diffDays = Math.max(0, (now - createdTime) / (1000 * 60 * 60 * 24));
        monthsActive = Math.max(0.01, diffDays / 30.4375);
      }
    }

    // High-Precision Continuous Byte-Hour Integration for Lifetime B2 Storage Endured:
    const now = Date.now();
    const allUserEventIds = new Set(userEventMetrics.allUserEvents.map(e => e.id));
    const userPhotos = photos.filter(p => p.eventId && allUserEventIds.has(p.eventId));
    let lifetimeGbHours = 0;

    userPhotos.forEach(p => {
      const pBytes = Number(p.size) || 0;
      const pGb = pBytes / (1024 * 1024 * 1024);
      const rawTime = p.uploadedAt ? new Date(p.uploadedAt).getTime() : (user.createdAt ? new Date(user.createdAt).getTime() : now);
      const pStart = !isNaN(rawTime) && rawTime > 0 ? rawTime : (now - 30 * 86400000);
      const hours = Math.max(1, (now - pStart) / 3600000);
      lifetimeGbHours += pGb * hours;
    });

    deletedEvents.forEach(del => {
      const delBytes = Number(del.totalBytes) || 0;
      const delGb = delBytes / (1024 * 1024 * 1024);
      const delAtMs = new Date(del.deletedAt).getTime();
      const cLogs = modalLogs.filter(l => l.event_id === del.eventId);
      const earliestLogMs = cLogs.length > 0 
        ? Math.min(...cLogs.map(l => new Date(l.created_at).getTime()).filter(t => !isNaN(t) && t > 0))
        : (delAtMs - 14 * 86400000);
      const delStartMs = !isNaN(earliestLogMs) && earliestLogMs > 0 ? earliestLogMs : (delAtMs - 14 * 86400000);
      const hours = Math.max(1, (delAtMs - delStartMs) / 3600000);
      lifetimeGbHours += delGb * hours;
    });

    // Also include historical orphaned deleted events from modal_cost_logs
    const allDeletedEventIds = new Set(deletedEvents.map(d => d.eventId));
    Array.from(actualComputeMetrics.eventComputeMap.keys()).forEach(orphanedId => {
      if (!orphanedId || allUserEventIds.has(orphanedId) || allDeletedEventIds.has(orphanedId)) return;
      const oStats = actualComputeMetrics.eventComputeMap.get(orphanedId);
      if (!oStats || (oStats.photoRuns === 0 && oStats.videoCpuRuns === 0 && oStats.videoGpuRuns === 0 && oStats.selfieRuns === 0)) return;

      const orphanedLogs = modalLogs.filter(l => l.event_id === orphanedId);
      const knownBytes = orphanedLogs.reduce((s, l) => s + (Number(l.media_size) || 0), 0);
      const totalPhotos = oStats.photoRuns;
      const totalVideos = oStats.videoCpuRuns + oStats.videoGpuRuns;
      const estimatedBytes = (totalPhotos * 4.5 * 1024 * 1024) + (totalVideos * 45 * 1024 * 1024);
      const delBytes = knownBytes > 0 ? knownBytes : estimatedBytes;
      const delGb = delBytes / (1024 * 1024 * 1024);

      // Assume standard 30-day (720h) gallery existence before deletion
      lifetimeGbHours += delGb * 720;
    });

    const lifetimeStorageCostUsd = (lifetimeGbHours / 720) * 0.006;
    const lifetimeTxCostUsd = ((actualComputeMetrics.totalLifetimeMedia + deletedEvents.reduce((s, d) => s + (Number(d.photosCount) || 0) + (Number(d.videosCount) || 0), 0)) / 1000) * 0.004;
    const b2CostTillNowUsd = Math.max(b2MonthlyUsd * monthsActive, lifetimeStorageCostUsd + lifetimeTxCostUsd);
    const b2CostTillNowInr = b2CostTillNowUsd * usdToInrRate;

    // Total Monthly Cost to EveBash (Active recurring storage only: Backblaze B2)
    const totalMonthlyCostUsd = b2MonthlyUsd;
    const totalMonthlyCostInr = b2MonthlyInr;

    // Cumulative Cost to EveBash ENDURED TILL NOW (Direct user costs: Modal compute + B2 storage endured)
    const totalLifetimeCostUsd = modalTotalUsd + b2CostTillNowUsd;
    const totalLifetimeCostInr = totalLifetimeCostUsd * usdToInrRate;

    // Real captured / offline revenue from payments ledger
    const capturedPayments = payments.filter(p => p.status === 'captured' || p.status === 'manual_offline');
    const totalCollectedRevenueInr = capturedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalCollectedRevenueUsd = totalCollectedRevenueInr / usdToInrRate;
    const hasRecordedPayments = capturedPayments.length > 0;

    // Actual Net Profit: Cash collected minus actual infrastructure cost endured
    const actualNetProfitInr = totalCollectedRevenueInr - totalLifetimeCostInr;
    const actualNetProfitUsd = totalCollectedRevenueUsd - totalLifetimeCostUsd;
    const actualMarginPercentage = totalCollectedRevenueInr > 0
      ? Math.round((actualNetProfitInr / totalCollectedRevenueInr) * 100)
      : null;

    // Windowed calculations (for the selected global timeframe filter)
    const windowCapturedPayments = windowPayments.filter(p => p.status === 'captured' || p.status === 'manual_offline');
    const windowCollectedRevenueInr = windowCapturedPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const windowCollectedRevenueUsd = windowCollectedRevenueInr / usdToInrRate;
    const windowHasRecordedPayments = windowCapturedPayments.length > 0;

    // Window Infrastructure Cost (B2 Storage & Tx + Modal Compute):
    const currentB2InWindowUsd = economicsWindow.isAllTime ? b2CostTillNowUsd : b2MeteringData.grandTotalB2CostUsd;
    const currentB2InWindowInr = currentB2InWindowUsd * usdToInrRate;
    const currentModalInWindowUsd = modalTotalUsd;
    const currentModalInWindowInr = modalTotalInr;

    const windowInfraCostUsd = economicsWindow.isAllTime
      ? totalLifetimeCostUsd
      : (currentB2InWindowUsd + currentModalInWindowUsd);
    const windowInfraCostInr = windowInfraCostUsd * usdToInrRate;

    const windowNetProfitInr = windowCollectedRevenueInr - windowInfraCostInr;
    const windowNetProfitUsd = windowCollectedRevenueUsd - windowInfraCostUsd;
    const windowMarginPercentage = windowCollectedRevenueInr > 0
      ? Math.round((windowNetProfitInr / windowCollectedRevenueInr) * 100)
      : null;

    // User Subscription Theoretical Revenue
    const monthlyRevenueInr = currentPlan.monthlyPriceInr;
    const monthlyRevenueUsd = monthlyRevenueInr / usdToInrRate;
    const yearlyRevenueInr = monthlyRevenueInr * 12;
    const yearlyRevenueUsd = monthlyRevenueUsd * 12;

    const monthlyGrossMarginInr = monthlyRevenueInr - totalMonthlyCostInr;
    const monthlyGrossMarginUsd = monthlyRevenueUsd - totalMonthlyCostUsd;
    const monthlyMarginPercentage = monthlyRevenueInr > 0
      ? Math.round((monthlyGrossMarginInr / monthlyRevenueInr) * 100)
      : null;

    return {
      b2MonthlyUsd,
      b2MonthlyInr,
      b2YearlyUsd,
      b2YearlyInr,
      b2CostTillNowUsd,
      b2CostTillNowInr,
      b2MonthlyCostUsd: b2MonthlyUsd,
      b2MonthlyCostInr: b2MonthlyInr,
      b2YearlyCostUsd: b2YearlyUsd,
      b2YearlyCostInr: b2YearlyInr,
      modalPhotoUsd,
      modalPhotoInr,
      modalVideoCpuUsd,
      modalVideoCpuInr,
      modalVideoGpuUsd,
      modalVideoGpuInr,
      modalVideoUsd,
      modalVideoInr,
      modalSelfieUsd,
      modalSelfieInr,
      modalTotalUsd,
      modalTotalInr,
      modalInr: modalTotalInr, // backwards-compatible alias
      qstashInr: 0,
      supabaseMonthlyInr: 0,
      supabaseYearlyInr: 0,
      supabaseCostTillNowInr: 0,
      supabaseWindowInr: 0,
      totalMonthlyCostUsd,
      totalMonthlyCostInr,
      totalLifetimeCostUsd,
      totalLifetimeCostInr,
      totalCostTillNowInr: totalLifetimeCostInr,
      totalYearlyCostInr: totalLifetimeCostInr, // backwards-compatible alias
      monthsActive,
      monthlyRevenueUsd,
      monthlyRevenueInr,
      yearlyRevenueUsd,
      yearlyRevenueInr,
      monthlyGrossMarginUsd,
      monthlyGrossMarginInr,
      monthlyMarginPercentage,
      totalCollectedRevenueUsd,
      totalCollectedRevenueInr,
      hasRecordedPayments,
      actualNetProfitUsd,
      actualNetProfitInr,
      actualMarginPercentage,
      totalPaymentsCount: payments.length,
      capturedPaymentsCount: capturedPayments.length,
      failedPaymentsCount: payments.filter(p => p.status === 'failed').length,
      // Windowed properties
      windowInfraCostUsd,
      windowInfraCostInr,
      windowB2Usd: currentB2InWindowUsd,
      windowB2Inr: currentB2InWindowInr,
      windowModalUsd: currentModalInWindowUsd,
      windowModalInr: currentModalInWindowInr,
      windowQstashInr: 0,
      windowSupabaseInr: 0,
      windowCollectedRevenueUsd,
      windowCollectedRevenueInr,
      windowHasRecordedPayments,
      windowNetProfitUsd,
      windowNetProfitInr,
      windowMarginPercentage,
      windowPaymentsCount: windowPayments.length,
      windowCapturedPaymentsCount: windowCapturedPayments.length,
      windowFailedPaymentsCount: windowPayments.filter(p => p.status === 'failed').length,
    };
  }, [usedGb, actualComputeMetrics, userEventMetrics, photos, deletedEvents, modalLogs, currentPlan, user.createdAt, payments, windowPayments, economicsWindow, b2MeteringData.grandTotalB2CostInr, b2MeteringData.grandTotalB2CostUsd, usdToInrRate]);

  // Unified cost table gallery row representation
  interface CostGalleryRowActive {
    type: 'active';
    id: string;
    title: string;
    searchableText: string;
    event: Event;
    children: Array<{
      event: Event;
      stats: {
        imageCount: number;
        imageBytes: number;
        videoCount: number;
        videoBytes: number;
        totalCount: number;
        totalBytes: number;
      };
    }>;
    combined: {
      imageCount: number;
      imageBytes: number;
      videoCount: number;
      videoBytes: number;
      totalCount: number;
      totalBytes: number;
    };
  }

  interface CostGalleryRowDeleted {
    type: 'deleted';
    id: string;
    title: string;
    searchableText: string;
    deleted: DeletedEventArchive;
  }

  interface CostGalleryRowOrphanedLog {
    type: 'orphaned_log';
    id: string;
    title: string;
    searchableText: string;
    orphanedId: string;
    stats: {
      photoUsd: number;
      photoInr: number;
      photoSeconds: number;
      photoRuns: number;
      videoCpuUsd: number;
      videoCpuInr: number;
      videoCpuSeconds: number;
      videoCpuRuns: number;
      videoGpuUsd: number;
      videoGpuInr: number;
      videoGpuSeconds: number;
      videoGpuRuns: number;
      selfieUsd?: number;
      selfieInr?: number;
      selfieSeconds?: number;
      selfieRuns?: number;
      totalUsd: number;
      totalInr: number;
      totalSeconds: number;
    };
  }

  type CostGalleryRow = CostGalleryRowActive | CostGalleryRowDeleted | CostGalleryRowOrphanedLog;

  const allCostRows = useMemo<CostGalleryRow[]>(() => {
    const rows: CostGalleryRow[] = [];

    // 1. Active Main Events (with children sub-galleries)
    userEventMetrics.mainEventBreakdown.forEach(({ event, children, combined }) => {
      const title = event.title || 'Untitled Event';
      const searchTerms = [
        title,
        event.id,
        event.type || '',
        ...children.map(c => `${c.event.title || ''} ${c.event.id}`),
      ].join(' ').toLowerCase();

      rows.push({
        type: 'active',
        id: event.id,
        title,
        searchableText: searchTerms,
        event,
        children,
        combined,
      });
    });

    // 2. Orphan Sub-events (if any exist without parent)
    userEventMetrics.orphanSubEvents.forEach(({ event, stats }) => {
      const title = event.title || 'Untitled Sub-Gallery';
      rows.push({
        type: 'active',
        id: event.id,
        title,
        searchableText: `${title} ${event.id}`.toLowerCase(),
        event,
        children: [],
        combined: stats,
      });
    });

    // 3. Deleted / Archived Events from Audit Ledger
    deletedEvents.forEach(del => {
      const title = del.eventTitle || 'Untitled Gallery';
      rows.push({
        type: 'deleted',
        id: `deleted-${del.id}`,
        title,
        searchableText: `${title} ${del.eventId} ${del.id}`.toLowerCase(),
        deleted: del,
      });
    });

    // 4. Orphaned historical deleted event logs in modal_cost_logs
    const allUserEventIds = new Set(userEventMetrics.allUserEvents.map(e => e.id));
    const allDeletedEventIds = new Set(deletedEvents.map(d => d.eventId));

    Array.from(actualComputeMetrics.eventComputeMap.keys()).forEach(orphanedId => {
      if (!orphanedId || allUserEventIds.has(orphanedId) || allDeletedEventIds.has(orphanedId)) return;
      const oStats = actualComputeMetrics.eventComputeMap.get(orphanedId);
      if (!oStats || (oStats.photoRuns === 0 && oStats.videoCpuRuns === 0 && oStats.videoGpuRuns === 0 && oStats.selfieRuns === 0)) return;

      rows.push({
        type: 'orphaned_log',
        id: `orphaned-${orphanedId}`,
        title: 'Historical Gallery',
        searchableText: `historical gallery ${orphanedId}`.toLowerCase(),
        orphanedId,
        stats: oStats,
      });
    });

    return rows;
  }, [userEventMetrics, deletedEvents, actualComputeMetrics]);

  const filteredCostRows = useMemo(() => {
    const query = costTableSearch.toLowerCase().trim();
    return allCostRows.filter(row => {
      if (costTableFilter === 'active' && row.type !== 'active') return false;
      if (costTableFilter === 'deleted' && row.type !== 'deleted' && row.type !== 'orphaned_log') return false;
      if (query && !row.searchableText.includes(query)) return false;
      return true;
    });
  }, [allCostRows, costTableFilter, costTableSearch]);

  const totalCostPages = Math.max(1, Math.ceil(filteredCostRows.length / costTablePerPage));

  // Reset to page 1 whenever search, filter, or perPage changes
  useEffect(() => {
    setCostTablePage(1);
  }, [costTableSearch, costTableFilter, costTablePerPage]);

  const paginatedCostRows = useMemo(() => {
    const start = (costTablePage - 1) * costTablePerPage;
    return filteredCostRows.slice(start, start + costTablePerPage);
  }, [filteredCostRows, costTablePage, costTablePerPage]);

  const costPageNumbers = useMemo(() => {
    const range: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, costTablePage - 2);
    let end = Math.min(totalCostPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }, [costTablePage, totalCostPages]);

  const initials = (user.name || user.email || 'U')
    .trim()
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleUpdatePlanTier = async (newRole: string) => {
    if (!onPlanChange) return;
    if (isProtected && newRole !== 'admin') {
      alert('This Super Admin account is permanently protected and cannot be changed.');
      return;
    }
    setSavingPlan(true);
    try {
      await onPlanChange(user.id, newRole);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleUpdateDuration = async (newDuration: string) => {
    if (!onDurationChange) return;
    setSavingPlan(true);
    try {
      await onDurationChange(user.id, newDuration);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleSaveDates = async () => {
    if (!onPlanDatesChange) return;
    if (!editStartDate || !editEndDate) {
      alert('Both Start Date and End Date are required.');
      return;
    }
    setSavingDates(true);
    try {
      await onPlanDatesChange(user.id, editStartDate, editEndDate);
      alert('Plan dates updated successfully.');
    } finally {
      setSavingDates(false);
    }
  };

  if (viewingGallery) {
    return (
      <div className="space-y-6 animate-fadeIn">
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <button
              type="button"
              onClick={() => setViewingGallery(null)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-semibold transition-colors cursor-pointer w-fit shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to {user.name || user.email || 'User'}&apos;s Detail Page
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Viewing Gallery:</span>
              <span className="text-xs font-bold text-white bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                {viewingGallery.title || 'Untitled Event'}
              </span>
            </div>
          </div>
        </div>
        <GalleryViewer
          initialGallery={viewingGallery}
          events={events}
          onClose={() => setViewingGallery(null)}
        />
      </div>
    );
  }

  const renderUserPaymentsSection = () => {
    return (
      <div className="space-y-6">

        {/* Customer Payments & Invoices Ledger Table Container */}
        <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2.5 flex-wrap">
                  <span>Customer Payment Ledger</span>
                  <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                    {windowPayments.length} {windowPayments.length === 1 ? 'record' : 'records'}
                  </span>
                  <span className="text-xs font-mono text-slate-400 bg-slate-800/80 border border-slate-700/80 px-2.5 py-0.5 rounded-full">
                    {economicsWindow.formattedRange}
                  </span>
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setShowRecordPaymentModal(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-emerald-950"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Record Offline Payment</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentRefreshKey(k => k + 1)}
                disabled={loadingPayments}
                className="p-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-500 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                title="Reload payments"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingPayments ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Payments Table - Always visible with full headers */}
          <div className="overflow-x-auto rounded-2xl border border-slate-800/80 bg-slate-950/60">
            <table className="w-full min-w-[1100px] text-xs text-left text-slate-300 border-separate border-spacing-0">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th scope="col" className="py-2.5 px-3 w-12 text-center border-b border-slate-800 border-r border-slate-800/80">
                    Sr.
                  </th>
                  <th scope="col" className="py-2.5 px-3 min-w-[140px] border-b border-slate-800">
                    Date & Time
                  </th>
                  <th scope="col" className="py-2.5 px-3 min-w-[140px] border-b border-slate-800">
                    Plan & Duration
                  </th>
                  <th scope="col" className="py-2.5 px-3 min-w-[120px] border-b border-slate-800">
                    Amount
                  </th>
                  <th scope="col" className="py-2.5 px-3 min-w-[130px] border-b border-slate-800">
                    Status
                  </th>
                  <th scope="col" className="py-2.5 px-3 min-w-[120px] border-b border-slate-800">
                    Gateway
                  </th>
                  <th scope="col" className="py-2.5 px-3 min-w-[200px] border-b border-slate-800">
                    Payment / Order ID
                  </th>
                  <th scope="col" className="py-2.5 px-3 min-w-[200px] border-b border-slate-800">
                    Reference / Error Reason
                  </th>
                  <th scope="col" className="py-2.5 px-3 w-20 text-right border-b border-slate-800 pr-4">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {windowPayments.map((p, idx) => {
                  const isCaptured = p.status === 'captured';
                  const isManual = p.status === 'manual_offline';
                  const isFailed = p.status === 'failed';
                  const isRefunded = p.status === 'refunded';
                  const rowBg = idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0c1322]';

                  return (
                    <tr key={p.id} className={`hover:bg-slate-800/50 transition-colors ${rowBg}`}>
                      {/* Sr. No. */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center font-mono text-slate-400 border-r border-slate-800/80">
                        {idx + 1}
                      </td>

                      {/* Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-300">
                        {p.created_at
                          ? new Date(p.created_at).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>

                      {/* Plan & Duration */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-200 capitalize">
                          {p.plan_id || 'Starter'}
                          <span className="text-[10px] text-slate-400 font-normal">
                            ({p.billing_duration || 'yearly'})
                          </span>
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-2.5 px-3 font-mono font-bold whitespace-nowrap text-sm">
                        {isFailed ? (
                          <span className="text-slate-500 line-through">₹{Number(p.amount || 0).toFixed(2)}</span>
                        ) : (
                          <span className="text-emerald-400">
                            ₹{Number(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isCaptured && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            <CheckCircle2 className="w-3 h-3" /> Paid (Online)
                          </span>
                        )}
                        {isManual && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/25">
                            <Banknote className="w-3 h-3" /> Manual Offline
                          </span>
                        )}
                        {isFailed && (
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25"
                            title={p.failure_reason || 'Checkout dropped off or failed'}
                          >
                            <XCircle className="w-3 h-3" /> Failed
                          </span>
                        )}
                        {isRefunded && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                            <AlertCircle className="w-3 h-3" /> Refunded
                          </span>
                        )}
                      </td>

                      {/* Gateway */}
                      <td className="py-2.5 px-3 capitalize font-mono text-slate-300">
                        {p.payment_gateway ? p.payment_gateway.replace('_', ' ') : 'Razorpay'}
                      </td>

                      {/* Payment / Order IDs */}
                      <td className="py-2.5 px-3 font-mono text-[11px] whitespace-nowrap">
                        {p.razorpay_payment_id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-300 truncate max-w-[130px]" title={p.razorpay_payment_id}>
                              {p.razorpay_payment_id}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(p.razorpay_payment_id, `pay-${p.id}`)}
                              className="text-slate-500 hover:text-white p-0.5 rounded cursor-pointer"
                              title="Copy Payment ID"
                            >
                              {copiedField === `pay-${p.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : p.razorpay_order_id ? (
                          <span className="text-slate-400 truncate max-w-[130px]" title={p.razorpay_order_id}>
                            {p.razorpay_order_id}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Notes / Reason */}
                      <td className="py-2.5 px-3 max-w-[220px] truncate" title={p.failure_reason || p.notes || ''}>
                        {p.failure_reason ? (
                          <span className="text-rose-400 font-mono text-[11px]">{p.failure_reason}</span>
                        ) : p.notes ? (
                          <span className="text-slate-300">{p.notes}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-right pr-4">
                        <button
                          type="button"
                          onClick={() => handleDeletePayment(p.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Delete payment record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {/* Empty State row when zero payments exist */}
                {windowPayments.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-500 bg-[#0f1422]/60 border-b border-slate-800">
                      <CreditCard className="w-10 h-10 mx-auto mb-3 text-slate-600 opacity-60" />
                      <h5 className="text-base font-bold text-slate-300">
                        {economicsWindow.isAllTime
                          ? 'No Payment Records Found for This User'
                          : 'No Payment Records in Selected Timeframe'}
                      </h5>
                      <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                        {economicsWindow.isAllTime
                          ? (cleanRole !== 'free' && cleanRole !== 'freemium'
                              ? 'This user is on a paid plan tier without a recorded transaction (e.g. promotional access). Click "Record Offline Payment" above if they paid offline.'
                              : 'Transactions will appear here automatically when this customer completes online Razorpay checkouts or when you record an offline payment.')
                          : `No transactions occurred between ${economicsWindow.formattedRange}. Select "All Time" in the timeframe filter above to view all historical records.`}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb Navigation & Super Admin Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:bg-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-white text-xs font-medium transition-all shadow-sm cursor-pointer w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Registered Accounts</span>
          <span className="text-slate-600">/</span>
          <span className="text-slate-300 font-semibold">{user.name || user.email || 'User Profile'}</span>
        </button>

        {/* Protection / Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          {isProtected && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              Protected Super Admin
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm ${
            cleanRole === 'admin' ? 'bg-amber-500/10 text-amber-300 border-amber-500/25' :
            cleanRole === 'ultimate' ? 'bg-rose-500/10 text-rose-300 border-rose-500/25' :
            cleanRole === 'pro' || cleanRole === 'premium' ? 'bg-purple-500/10 text-purple-300 border-purple-500/25' :
            cleanRole === 'standard' || cleanRole === 'basic' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/25' :
            cleanRole === 'starter' ? 'bg-orange-500/10 text-orange-300 border-orange-500/25' :
            'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {currentPlan.label}
          </span>
        </div>
      </div>

      {/* User Hero Profile Banner Card */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 via-[#0e1626]/90 to-[#0a0f1d]/90 p-6 md:p-8 shadow-2xl backdrop-blur-md">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Avatar & User Details */}
          <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0">
            <div className="relative group shrink-0">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 p-0.5 shadow-xl shadow-indigo-500/15">
                <div className="w-full h-full rounded-[14px] bg-[#0c1322] flex items-center justify-center text-white font-black text-xl sm:text-2xl tracking-tight">
                  {initials || 'U'}
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight truncate">
                  {user.name || 'Anonymous User'}
                </h1>
                {user.username && (
                  <span className="font-mono text-xs font-semibold text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-lg">
                    @{user.username}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap text-xs text-slate-400">
                {user.email ? (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(user.email, 'email')}
                    className="inline-flex items-center gap-1.5 hover:text-white transition-colors group cursor-pointer font-mono"
                    title="Click to copy email"
                  >
                    <span>{user.email}</span>
                    {copiedField === 'email' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                    )}
                  </button>
                ) : (
                  <span className="italic text-slate-500">No email registered</span>
                )}

                {user.phone && (
                  <>
                    <span className="text-slate-700">&bull;</span>
                    <span className="font-mono text-slate-300">{user.phone}</span>
                  </>
                )}

                <span className="text-slate-700">&bull;</span>
                <span className="text-slate-400">
                  Joined {user.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Cluster */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 shrink-0">
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3 sm:px-4 sm:py-3 text-center backdrop-blur-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-0.5">
                Storage
              </span>
              <span className="text-sm sm:text-base font-extrabold text-white font-mono">
                {formatBytes(userEventMetrics.totalBytes)}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3 sm:px-4 sm:py-3 text-center backdrop-blur-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-0.5">
                Events
              </span>
              <span className="text-sm sm:text-base font-extrabold text-white">
                {userEventMetrics.mainEventsCount}
              </span>
            </div>

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3 sm:px-4 sm:py-3 text-center backdrop-blur-sm">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-0.5">
                Media Files
              </span>
              <span className="text-sm sm:text-base font-extrabold text-white">
                {userEventMetrics.totalMediaCount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* 5 Subpage Navigation Tabs (Segmented Floating Pill Design) */}
        <div className="mt-8 pt-6 border-t border-slate-800/80">
          <div className="inline-flex p-1.5 rounded-2xl bg-slate-950/70 border border-slate-800/90 shadow-inner gap-1.5 flex-wrap">
            {/* Tab 1: Info */}
            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`h-9 shrink-0 inline-flex items-center gap-2 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer select-none ${
                activeTab === 'info'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>Info</span>
            </button>

            {/* Tab 2: Events */}
            <button
              type="button"
              onClick={() => setActiveTab('events')}
              className={`h-9 shrink-0 inline-flex items-center gap-2 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer select-none ${
                activeTab === 'events'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Events</span>
            </button>

            {/* Tab 3: Storage */}
            <button
              type="button"
              onClick={() => setActiveTab('storage')}
              className={`h-9 shrink-0 inline-flex items-center gap-2 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer select-none ${
                activeTab === 'storage'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5 shrink-0" />
              <span>Storage</span>
            </button>

            {/* Tab 4: Plan */}
            <button
              type="button"
              onClick={() => setActiveTab('plan')}
              className={`h-9 shrink-0 inline-flex items-center gap-2 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer select-none ${
                activeTab === 'plan'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5 shrink-0" />
              <span>Plan</span>
            </button>

            {/* Tab 5: Economics */}
            <button
              type="button"
              onClick={() => setActiveTab('cost')}
              className={`h-9 shrink-0 inline-flex items-center gap-2 px-3.5 rounded-xl text-xs font-bold transition-colors cursor-pointer select-none ${
                activeTab === 'cost'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <IndianRupee className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
              <span>Economics</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUBPAGE 1: USER INFO */}
      {activeTab === 'info' && (
        <div className="grid md:grid-cols-2 gap-6 animate-fadeIn">
          {/* Card: Profile & Contact Details */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
              <h2 className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <User className="w-4 h-4" />
                </div>
                <span>Profile & Contact Details</span>
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Identity</span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Full Name</span>
                <span className="font-semibold text-white text-sm">{user.name || 'Not provided'}</span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Email Address</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-200 select-all">{user.email || 'No email'}</span>
                  {user.email && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(user.email, 'email')}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Copy email"
                    >
                      {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Username</span>
                <span className="font-mono font-semibold text-indigo-300">
                  {user.username ? `@${user.username}` : <span className="text-slate-600 font-normal italic">None</span>}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Phone Number</span>
                <span className="font-mono text-slate-200">
                  {user.phone || <span className="text-slate-600 font-normal italic">No phone registered</span>}
                </span>
              </div>

              <div className="flex items-center justify-between py-2">
                <span className="text-slate-400 font-medium">Supabase User ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-400 bg-slate-900/80 border border-slate-800 px-2 py-0.5 rounded-lg select-all max-w-[200px] truncate">
                    {user.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(user.id, 'id')}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Copy User ID"
                  >
                    {copiedField === 'id' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Account Security & Timestamps */}
          <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
              <h2 className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Clock className="w-4 h-4" />
                </div>
                <span>Activity & Role Classification</span>
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Security</span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Account Role</span>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-bold uppercase tracking-wider text-[11px]">
                    {user.role || 'free'}
                  </span>
                  {user.roleType && (
                    <span className="px-2 py-0.5 rounded-md border border-slate-700 bg-slate-800 text-slate-400 text-[10px] font-semibold">
                      {user.roleType}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Account Created Date</span>
                <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Last Active Date</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${user.lastLogin ? 'bg-sky-400 animate-pulse' : 'bg-slate-600'}`} />
                  <span className={user.lastLogin ? 'text-sky-300 font-medium' : 'text-slate-500'}>
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never recorded'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-800/60">
                <span className="text-slate-400 font-medium">Delegated Administration</span>
                <span className="text-slate-300">
                  {user.delegatedBy ? (
                    <span className="text-amber-400 font-medium">Delegated by: <strong className="font-mono text-[11px]">{user.delegatedBy}</strong></span>
                  ) : (
                    <span className="text-slate-500">None (Primary account holder)</span>
                  )}
                </span>
              </div>

              {user.assignedEvents && user.assignedEvents.length > 0 && (
                <div className="pt-2 space-y-2">
                  <span className="text-slate-400 font-medium block">Assigned Events</span>
                  <div className="flex flex-wrap gap-1.5">
                    {user.assignedEvents.map(eventId => (
                      <span key={eventId} className="font-mono text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                        {eventId}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUBPAGE: EVENTS & SUB-EVENTS */}
      {activeTab === 'events' && (() => {
        const query = eventSearch.trim().toLowerCase();
        const filteredEvents = userEventMetrics.mainEventBreakdown.filter(({ event, children, combined }) => {
          if (query) {
            const matchesTitle = (event.title || '').toLowerCase().includes(query);
            const matchesId = (event.id || '').toLowerCase().includes(query);
            const matchesChild = children.some(c => (c.event.title || '').toLowerCase().includes(query) || (c.event.id || '').toLowerCase().includes(query));
            if (!matchesTitle && !matchesId && !matchesChild) return false;
          }

          if (eventFilter === 'with-subs') {
            return children.length > 0;
          }
          if (eventFilter === 'with-media') {
            return combined.totalCount > 0;
          }
          return true;
        });

        const allExpandableIds = userEventMetrics.mainEventBreakdown.filter(m => m.children.length > 0).map(m => m.event.id);

        return (
          <div className="space-y-6 animate-fadeIn">
            {/* Top KPI Cards (Sleek Glassmorphic Tiles) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
              <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322] p-4 shadow-lg backdrop-blur-sm transition-all hover:border-emerald-500/30">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Main Events</span>
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <FolderTree className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white">{userEventMetrics.mainEventsCount}</div>
                <span className="text-[11px] text-slate-500">Primary galleries</span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322] p-4 shadow-lg backdrop-blur-sm transition-all hover:border-indigo-500/30">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sub-Events</span>
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white">{userEventMetrics.subGalleriesCount}</div>
                <span className="text-[11px] text-slate-500">Sub-galleries created</span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322] p-4 shadow-lg backdrop-blur-sm transition-all hover:border-sky-500/30">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Photos</span>
                  <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <ImageIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white">{userEventMetrics.imageCount.toLocaleString()}</div>
                <span className="text-[11px] text-sky-400 font-mono font-semibold">{formatBytes(userEventMetrics.imageBytes)}</span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322] p-4 shadow-lg backdrop-blur-sm transition-all hover:border-violet-500/30">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Videos</span>
                  <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                    <VideoIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white">{userEventMetrics.videoCount.toLocaleString()}</div>
                <span className="text-[11px] text-violet-400 font-mono font-semibold">{formatBytes(userEventMetrics.videoBytes)}</span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322] p-4 shadow-lg backdrop-blur-sm transition-all hover:border-purple-500/30 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Storage</span>
                  <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <HardDrive className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="text-2xl font-black text-white font-mono">{formatBytes(userEventMetrics.totalBytes)}</div>
                <span className="text-[11px] text-slate-500">{userEventMetrics.totalMediaCount.toLocaleString()} total files</span>
              </div>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="rounded-2xl border border-slate-800/80 bg-[#111827]/90 p-3.5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-3.5 backdrop-blur-sm">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search events by title or ID..."
                  value={eventSearch}
                  onChange={e => setEventSearch(e.target.value)}
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-colors"
                />
                {eventSearch && (
                  <button
                    type="button"
                    onClick={() => setEventSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Pills & Expand Toggles */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800/90 p-1">
                  <Filter className="w-3 h-3 text-slate-500 ml-2 mr-1 shrink-0" />
                  <button
                    type="button"
                    onClick={() => setEventFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      eventFilter === 'all'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({userEventMetrics.mainEventsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventFilter('with-subs')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      eventFilter === 'with-subs'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    With Sub-events ({userEventMetrics.mainEventBreakdown.filter(m => m.children.length > 0).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setEventFilter('with-media')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      eventFilter === 'with-media'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    With Media ({userEventMetrics.mainEventBreakdown.filter(m => m.combined.totalCount > 0).length})
                  </button>
                </div>

                {allExpandableIds.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => expandAllEvents(allExpandableIds)}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 transition-colors cursor-pointer shadow-sm"
                    >
                      Expand All
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllEvents}
                      className="px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-[11px] font-semibold text-slate-300 transition-colors cursor-pointer shadow-sm"
                    >
                      Collapse All
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Events List */}
            {filteredEvents.length === 0 ? (
              <div className="rounded-3xl border border-slate-800/80 bg-[#111827]/90 p-12 text-center shadow-xl space-y-3">
                <FolderTree className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-base font-bold text-white">No Events Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {userEventMetrics.mainEventsCount === 0
                    ? 'This user has not created any events or galleries yet.'
                    : 'No events match your current search or filter criteria.'}
                </p>
                {eventSearch && (
                  <button
                    type="button"
                    onClick={() => setEventSearch('')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredEvents.map(({ event, directStats, children, combined }) => {
                  const isExpanded = expandedEventIds.has(event.id);
                  const hasSubs = children.length > 0;

                  return (
                    <div
                      key={event.id}
                      className="rounded-3xl border border-slate-800/80 hover:border-slate-700/80 bg-gradient-to-b from-[#111827] to-[#0c1322] shadow-xl transition-all overflow-hidden"
                    >
                      {/* Event Header Card */}
                      <div className="p-5 sm:p-6 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          {/* Title & Badges */}
                          <div className="min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-white truncate">
                                {event.title || 'Untitled Event'}
                              </h3>

                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                                Main Event
                              </span>

                              {event.isSampleGallery && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-300">
                                  Sample Gallery
                                </span>
                              )}
                            </div>

                            {/* Event ID with copy */}
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span className="font-semibold uppercase tracking-wider text-[10px] text-slate-600">Event ID:</span>
                              <code className="font-mono text-[11px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg select-all">
                                {event.id}
                              </code>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(event.id, `evt-${event.id}`)}
                                className="text-slate-500 hover:text-white transition-colors cursor-pointer"
                                title="Copy Event ID"
                              >
                                {copiedField === `evt-${event.id}` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            {/* View Gallery Button */}
                            <button
                              type="button"
                              onClick={() => setViewingGallery(event)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/20 hover:border-sky-400/50 text-xs font-bold transition-all shadow-sm cursor-pointer"
                              title="Inspect photos and videos uploaded to this event"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Uploads
                            </button>

                            {/* Sample Gallery Toggle */}
                            {onToggleSampleGallery && (
                              <button
                                type="button"
                                disabled={sampleUpdatingEventId === event.id}
                                onClick={() => handleToggleSampleGallery(event)}
                                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-50 ${
                                  event.isSampleGallery
                                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                                    : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white hover:border-slate-700'
                                }`}
                                title={event.isSampleGallery ? 'Remove from Sample Galleries' : 'Mark as Sample Gallery'}
                              >
                                <Star className={`w-3.5 h-3.5 ${event.isSampleGallery ? 'fill-current' : ''}`} />
                                {sampleUpdatingEventId === event.id ? 'Saving' : event.isSampleGallery ? 'Sample' : 'Add Sample'}
                              </button>
                            )}

                            {/* Delete Event Button */}
                            {onDeleteEvent && (
                              <button
                                type="button"
                                disabled={deletingEventId === event.id}
                                onClick={() => handleDeleteEvent({ ...event, subGalleriesCount: children.length })}
                                className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:border-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
                                title="Permanently delete this event and its media"
                                aria-label="Delete event"
                              >
                                <Trash2 className={`w-3.5 h-3.5 ${deletingEventId === event.id ? 'animate-pulse' : ''}`} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Event-Wise Storage & Media Stats Ribbon */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2.5 pt-3 border-t border-slate-800/80">
                          {/* 1. Direct Photos */}
                          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">
                              Main Photos
                            </span>
                            <div className="flex items-baseline justify-between">
                              <span className="font-bold text-xs text-white">
                                {directStats.imageCount}
                              </span>
                              <span className="text-[11px] font-mono text-sky-400 font-semibold">
                                {formatBytes(directStats.imageBytes)}
                              </span>
                            </div>
                          </div>

                          {/* 2. Direct Videos */}
                          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">
                              Main Videos
                            </span>
                            <div className="flex items-baseline justify-between">
                              <span className="font-bold text-xs text-white">
                                {directStats.videoCount}
                              </span>
                              <span className="text-[11px] font-mono text-violet-400 font-semibold">
                                {formatBytes(directStats.videoBytes)}
                              </span>
                            </div>
                          </div>

                          {/* 3. Direct Total */}
                          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">
                              Direct Media Size
                            </span>
                            <div className="flex items-baseline justify-between">
                              <span className="font-bold text-xs text-slate-300">
                                {directStats.totalCount} items
                              </span>
                              <span className="text-[11px] font-mono font-bold text-slate-200">
                                {formatBytes(directStats.totalBytes)}
                              </span>
                            </div>
                          </div>

                          {/* 4. Sub-events count */}
                          <div className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-2.5">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">
                              Sub-Events
                            </span>
                            <div className="flex items-baseline justify-between">
                              <span className="font-bold text-xs text-indigo-300">
                                {children.length} sub
                              </span>
                              <span className="text-[11px] font-mono text-indigo-400 font-semibold">
                                {formatBytes(combined.totalBytes - directStats.totalBytes)}
                              </span>
                            </div>
                          </div>

                          {/* 5. Combined Grand Total */}
                          <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-2.5 col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 block mb-0.5">
                              Combined Total
                            </span>
                            <div className="flex items-baseline justify-between">
                              <span className="font-bold text-xs text-white">
                                {combined.totalCount} items
                              </span>
                              <span className="text-[11px] font-mono font-bold text-emerald-400">
                                {formatBytes(combined.totalBytes)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Sub-Events Toggle Bar */}
                        {hasSubs && (
                          <button
                            type="button"
                            onClick={() => toggleExpandEvent(event.id)}
                            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-colors cursor-pointer shadow-sm"
                          >
                            <div className="flex items-center gap-2">
                              <Layers className="w-3.5 h-3.5 text-indigo-400" />
                              <span>
                                {isExpanded ? 'Hide' : 'Show'} Sub-Events / Sub-Galleries ({children.length})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-500 font-mono">
                                {children.reduce((sum, c) => sum + c.stats.totalCount, 0)} items &bull; {formatBytes(combined.totalBytes - directStats.totalBytes)}
                              </span>
                              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </button>
                        )}
                      </div>

                      {/* Nested Sub-Events Tree Content */}
                      {hasSubs && isExpanded && (
                        <div className="border-t border-slate-800/80 bg-slate-950/60 p-5 space-y-3">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                            <Layers className="w-3 h-3 text-indigo-400" />
                            Sub-Events Inside “{event.title || 'Untitled'}”
                          </div>

                          <div className="space-y-2.5 border-l-2 border-indigo-500/20 pl-3 sm:pl-4 ml-1">
                            {children.map(child => (
                              <div
                                key={child.event.id}
                                className="rounded-2xl border border-slate-800/80 hover:border-slate-700/80 bg-slate-900/60 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors"
                              >
                                {/* Sub-event Info */}
                                <div className="min-w-0 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-xs font-bold text-white truncate">
                                      {child.event.title || 'Untitled Sub-gallery'}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                                      Sub-Gallery
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                    <span>ID:</span>
                                    <code className="font-mono text-[10px] text-slate-400 bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded select-all">
                                      {child.event.id}
                                    </code>
                                    <button
                                      type="button"
                                      onClick={() => copyToClipboard(child.event.id, `evt-${child.event.id}`)}
                                      className="text-slate-500 hover:text-white transition-colors cursor-pointer"
                                      title="Copy Sub-event ID"
                                    >
                                      {copiedField === `evt-${child.event.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                </div>

                                {/* Sub-event Metrics & Actions */}
                                <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                                  <div className="flex items-center gap-2.5 text-xs bg-slate-950/80 border border-slate-800/80 px-3 py-1.5 rounded-xl">
                                    <span className="text-slate-400">
                                      Photos: <strong className="text-white font-mono">{child.stats.imageCount}</strong> <span className="text-sky-400 text-[10px]">({formatBytes(child.stats.imageBytes)})</span>
                                    </span>
                                    <span className="text-slate-700">|</span>
                                    <span className="text-slate-400">
                                      Videos: <strong className="text-white font-mono">{child.stats.videoCount}</strong> <span className="text-violet-400 text-[10px]">({formatBytes(child.stats.videoBytes)})</span>
                                    </span>
                                    <span className="text-slate-700">|</span>
                                    <span className="font-bold text-slate-200 font-mono">
                                      {formatBytes(child.stats.totalBytes)}
                                    </span>
                                  </div>

                                  {/* View Sub-Gallery Button */}
                                  <button
                                    type="button"
                                    onClick={() => setViewingGallery(child.event)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/20 text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                                    title="View media uploaded to this sub-event"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    View Uploads
                                  </button>

                                  {/* Delete Sub-event Button */}
                                  {onDeleteEvent && (
                                    <button
                                      type="button"
                                      disabled={deletingEventId === child.event.id}
                                      onClick={() => handleDeleteEvent(child.event)}
                                      className="inline-flex items-center justify-center h-7 w-7 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:border-red-400 hover:bg-red-500/20 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
                                      title="Delete this sub-event"
                                      aria-label="Delete sub-event"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Orphan/Standalone Sub-events (if any exist) */}
            {userEventMetrics.orphanSubEvents.length > 0 && (
              <div className="rounded-3xl border border-slate-800/80 bg-[#111827] p-6 shadow-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">
                    Additional Sub-Galleries ({userEventMetrics.orphanSubEvents.length})
                  </h3>
                  <span className="text-xs text-slate-500">
                    Sub-galleries with parent event outside the main events list
                  </span>
                </div>

                <div className="space-y-2">
                  {userEventMetrics.orphanSubEvents.map(child => (
                    <div
                      key={child.event.id}
                      className="rounded-2xl bg-slate-900/70 border border-slate-800 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-white">{child.event.title || 'Untitled Sub-gallery'}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span>ID:</span>
                          <code className="font-mono text-slate-400 bg-slate-950 px-1 rounded">{child.event.id}</code>
                          {child.event.parentId && <span>(Parent: <code className="font-mono text-slate-400">{child.event.parentId}</code>)</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-300 font-mono">
                          {child.stats.imageCount} photos ({formatBytes(child.stats.imageBytes)}) &bull; {child.stats.videoCount} videos ({formatBytes(child.stats.videoBytes)}) &bull; <strong className="text-white">{formatBytes(child.stats.totalBytes)}</strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => setViewingGallery(child.event)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/20 text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Uploads
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* SUBPAGE 3: STORAGE DATA */}
      {activeTab === 'storage' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Storage Quota & Visual Progress Bar Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Storage Allocation & Quota</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Active cloud object storage usage against allotted tier limits
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Allotted Quota:</span>
                <span className="px-3 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 font-extrabold text-xs tracking-wide">
                  {currentPlan.storage}
                </span>
              </div>
            </div>

            {/* Quota Progress Meter */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-200">
                  <strong className="text-white font-mono">{formatBytes(userEventMetrics.totalBytes)}</strong> used of <span className="font-mono text-slate-400">{currentPlan.storage}</span>
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  storagePercentage > 90 ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                  storagePercentage > 70 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {quotaBytes === Infinity ? 'Unlimited' : `${storagePercentage}% consumed`}
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden p-0.5 shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-700 shadow-sm ${
                    storagePercentage > 90
                      ? 'bg-gradient-to-r from-rose-500 to-red-400'
                      : storagePercentage > 70
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400'
                      : 'bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400'
                  }`}
                  style={{ width: `${quotaBytes === Infinity ? 5 : Math.max(2, storagePercentage)}%` }}
                />
              </div>
            </div>

            {/* Storage Metric Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-colors hover:border-slate-700/80">
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                  Photos Storage
                </div>
                <div className="text-xl font-black text-white font-mono">{formatBytes(userEventMetrics.imageBytes)}</div>
                <span className="text-xs text-slate-500 mt-0.5 block">{userEventMetrics.imageCount.toLocaleString()} total photos</span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-colors hover:border-slate-700/80">
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  <VideoIcon className="w-3.5 h-3.5 text-violet-400" />
                  Videos Storage
                </div>
                <div className="text-xl font-black text-white font-mono">{formatBytes(userEventMetrics.videoBytes)}</div>
                <span className="text-xs text-slate-500 mt-0.5 block">{userEventMetrics.videoCount.toLocaleString()} total videos</span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-colors hover:border-slate-700/80">
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
                  Primary Events
                </div>
                <div className="text-xl font-black text-white">{userEventMetrics.mainEventsCount}</div>
                <span className="text-xs text-slate-500 mt-0.5 block">Main event galleries</span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-colors hover:border-slate-700/80">
                <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  Sub-Galleries
                </div>
                <div className="text-xl font-black text-white">{userEventMetrics.subGalleriesCount}</div>
                <span className="text-xs text-slate-500 mt-0.5 block">Nested wedding functions</span>
              </div>
            </div>
          </div>

          {/* User's Events Breakdown Table Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
              <h2 className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                  <FolderTree className="w-4 h-4" />
                </div>
                <span>Events & Media Storage Distribution</span>
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {userEventMetrics.mainEventsCount} active events
              </span>
            </div>

            {userEventMetrics.eventBreakdown.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No events created by this user yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
                <table className="w-full text-left text-xs text-slate-400">
                  <thead className="bg-slate-950/80 text-slate-500 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-bold">Event Title</th>
                      <th className="py-3 px-4 font-bold">Sub-Galleries</th>
                      <th className="py-3 px-4 font-bold">Photos</th>
                      <th className="py-3 px-4 font-bold">Videos</th>
                      <th className="py-3 px-4 font-bold">Total Storage</th>
                      <th className="py-3 px-4 font-bold">Created Date</th>
                      <th className="py-3 px-4 text-right font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {userEventMetrics.mainEventBreakdown.map(({ event, children, combined }) => (
                      <tr key={event.id} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{event.title || 'Untitled Event'}</span>
                            {event.isSampleGallery && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                                Sample
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 mt-0.5">{event.id}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">{children.length} sub</td>
                        <td className="py-3.5 px-4 font-mono text-sky-400 font-semibold">{combined.imageCount} photos ({formatBytes(combined.imageBytes)})</td>
                        <td className="py-3.5 px-4 font-mono text-violet-400 font-semibold">{combined.videoCount} videos ({formatBytes(combined.videoBytes)})</td>
                        <td className="py-3.5 px-4 font-bold text-white font-mono">{formatBytes(combined.totalBytes)}</td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {event.createdAt ? new Date(event.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setViewingGallery(event)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-300 hover:bg-sky-500/20 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBPAGE 4: PLAN DATA */}
      {activeTab === 'plan' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Current Plan Overview Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Active Plan & Subscription</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Subscription plan tier, validity period, and renewal schedule
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 font-extrabold text-xs uppercase tracking-wider">
                  {currentPlan.label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Billing Duration</span>
                <span className="text-base font-bold text-white capitalize flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  {user.subscriptionDuration || 'Monthly'}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Start Date</span>
                <span className="text-base font-bold text-slate-200 flex items-center gap-2 font-mono">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  {user.planStartDate ? new Date(user.planStartDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">End Date & Validity</span>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-slate-200 flex items-center gap-2 font-mono">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    {user.planEndDate ? new Date(user.planEndDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
                  </span>
                  {planDaysRemaining !== null && (
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      planDaysRemaining > 7 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      planDaysRemaining > 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {planDaysRemaining > 0 ? `${planDaysRemaining}d left` : 'Expired'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Admin Plan Modification Controls Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
              <h2 className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Zap className="w-4 h-4" />
                </div>
                <span>Manage Plan & Validity</span>
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Administration</span>
            </div>

            {isProtected ? (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 shrink-0 text-amber-400" />
                <span>
                  This account (<strong>{user.email || user.username}</strong>) is permanently protected as a Global Super Admin. The plan and admin role cannot be demoted.
                </span>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Plan Tier Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Change Subscription Plan Tier
                  </label>
                  <select
                    value={cleanRole === 'user' ? 'free' : cleanRole}
                    disabled={savingPlan || !onPlanChange}
                    onChange={e => handleUpdatePlanTier(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500/60 transition-colors cursor-pointer"
                  >
                    {planTiers.map(tier => (
                      <option key={tier.role} value={tier.role}>
                        {tier.label} ({tier.storage}) · ₹{tier.monthlyPriceInr}/mo
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Switching to a paid tier will automatically calculate storage limits and billing dates.
                  </p>
                </div>

                {/* Duration Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 block">
                    Change Billing Duration
                  </label>
                  <select
                    value={user.subscriptionDuration || 'monthly'}
                    disabled={savingPlan || !onDurationChange}
                    onChange={e => handleUpdateDuration(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500/60 transition-colors cursor-pointer"
                  >
                    {durationOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Updates the billing renewal interval and recalculates the end date.
                  </p>
                </div>

                {/* Custom Plan Dates Editor */}
                <div className="md:col-span-2 pt-5 border-t border-slate-800/80 space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Manual Validity Dates</h3>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Plan Start Date</label>
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={e => setEditStartDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-400">Plan End Date</label>
                      <input
                        type="date"
                        value={editEndDate}
                        onChange={e => setEditEndDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 outline-none focus:border-rose-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveDates}
                    disabled={savingDates || !onPlanDatesChange}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    {savingDates ? 'Saving Dates...' : 'Update Validity Dates'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBPAGE 5: ECONOMICS */}
      {activeTab === 'cost' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Global Economics Controls Toolbar */}
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Dollar - INR Conversion (Positioned Above Economics Container on Top Left) */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800/90 rounded-2xl p-1.5 shadow-sm">
                  {/* Badge Label */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300">
                    <ArrowLeftRight className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">Dollar – INR Conversion</span>
                  </div>

                  {/* Currency Toggle (INR / USD) */}
                  <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 shrink-0">
                    <button
                      type="button"
                      onClick={() => setCurrency('INR')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currency === 'INR'
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Display all user costs in Indian Rupees (INR)"
                    >
                      ₹ INR
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrency('USD')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currency === 'USD'
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="Display all user costs in US Dollars (USD)"
                    >
                      $ USD
                    </button>
                  </div>

                  {/* Conversion Rate Setter ($1 = ₹Rate) */}
                  <div className="flex items-center space-x-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1 shrink-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      Rate:
                    </span>
                    <span className="font-mono font-bold text-xs text-sky-400">$1</span>
                    <span className="text-slate-500 text-xs font-bold">=</span>
                    <div className="flex items-center font-mono font-bold text-white text-xs">
                      <span className="text-emerald-400 mr-0.5">₹</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={usdToInrRateInput}
                        onChange={e => handleRateInputChange(e.target.value)}
                        className="bg-transparent text-white text-xs border-0 outline-none w-11 text-center font-bold font-mono focus:ring-0"
                        title="Edit USD to INR exchange rate"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={syncLiveRate}
                      disabled={isSyncingRate}
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition-colors disabled:opacity-50 cursor-pointer"
                      title={marketRate ? `Market rate: ₹${marketRate}. Click to re-sync.` : "Sync live USD/INR exchange rate"}
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingRate ? 'animate-spin text-emerald-400' : ''}`} />
                    </button>
                  </div>

                  {/* Live Forex sync status pill */}
                  {marketRate && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg shrink-0">
                      Live: ₹{marketRate}
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Filters */}
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shadow-sm shrink-0 self-end sm:self-auto">
                {(['1d', '1w', '1m', 'custom', 'all'] as const).map((filterKey) => {
                  const labels: Record<typeof filterKey, string> = {
                    '1d': '1 Day',
                    '1w': '1 Week',
                    '1m': '1 Month',
                    'custom': 'Custom',
                    'all': 'All Time',
                  };
                  const isActive = economicsTimeFilter === filterKey;
                  return (
                    <button
                      key={filterKey}
                      type="button"
                      onClick={() => setEconomicsTimeFilter(filterKey)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {labels[filterKey]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Date Pickers (Positioned Below Timeframe Chooser with Calendar Trigger) */}
            {economicsTimeFilter === 'custom' && (
              <div className="flex flex-wrap items-center gap-2.5 bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 shadow-lg animate-fadeIn">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider">Custom Range:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">From</span>
                  <input
                    type="date"
                    value={economicsCustomStartDate}
                    onChange={e => setEconomicsCustomStartDate(e.target.value)}
                    onClick={e => { try { e.currentTarget.showPicker(); } catch {} }}
                    onFocus={e => { try { e.currentTarget.showPicker(); } catch {} }}
                    className="bg-slate-950 border border-slate-700/80 hover:border-sky-500/80 rounded-lg px-2.5 py-1 text-white text-xs outline-none focus:border-sky-500 cursor-pointer [color-scheme:dark] transition-colors"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">To</span>
                  <input
                    type="date"
                    value={economicsCustomEndDate}
                    onChange={e => setEconomicsCustomEndDate(e.target.value)}
                    onClick={e => { try { e.currentTarget.showPicker(); } catch {} }}
                    onFocus={e => { try { e.currentTarget.showPicker(); } catch {} }}
                    className="bg-slate-950 border border-slate-700/80 hover:border-sky-500/80 rounded-lg px-2.5 py-1 text-white text-xs outline-none focus:border-sky-500 cursor-pointer [color-scheme:dark] transition-colors"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Header & Financial Model Summary Card */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  {currency === 'USD' ? <DollarSign className="w-5 h-5" /> : <IndianRupee className="w-5 h-5" />}
                </div>
                <h2 className="text-base font-bold text-white">Economics</h2>
              </div>

              {/* Formatted Date Range Indicator Badge (Top Right inside Economics Container) */}
              <div className="flex items-center gap-1.5 text-xs font-mono text-sky-300 bg-sky-500/10 border border-sky-500/20 px-3.5 py-1.5 rounded-xl shrink-0 shadow-sm self-start sm:self-auto">
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>
                  {economicsWindow.formattedRange} ({economicsWindow.durationLabel})
                </span>
              </div>
            </div>

            {/* ── Row 1: Infrastructure Cost Cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              {/* Card 1: Total Cost Incurred in Window (Shows exact summation breakdown) */}
              <div className="rounded-2xl border border-purple-500/20 bg-purple-950/10 p-4 transition-all hover:border-purple-500/40 flex flex-col justify-between">
                <div>
                  <div className="mb-1">
                    <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                      {economicsWindow.isAllTime ? 'Cost Endured Till Now' : 'Cost Incurred'}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-purple-200 font-mono">
                    {fmtCost(costBreakdown.windowInfraCostUsd)}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    {fmtSub(costBreakdown.windowInfraCostUsd, '(Total Incurred)')}
                  </span>
                </div>

                {/* Sub-item Summation Breakdown */}
                <div className="mt-3 pt-2.5 border-t border-purple-500/20 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <HardDrive className="w-3 h-3 text-sky-400 shrink-0" />
                      Backblaze B2:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{fmtCost(costBreakdown.windowB2Usd)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                      Modal AI Compute:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{fmtCost(costBreakdown.modalTotalUsd)}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Monthly Recurring Cost */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    Monthly Recurring
                  </span>
                  <div className="text-2xl font-black text-white font-mono">
                    {fmtCost(costBreakdown.totalMonthlyCostUsd)}
                  </div>
                  <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                    {fmtSub(costBreakdown.totalMonthlyCostUsd, '/mo (B2 Storage)')}
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <HardDrive className="w-3 h-3 text-sky-400 shrink-0" />
                      B2 Disk Storage:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{fmtCost(costBreakdown.b2MonthlyUsd)}/mo</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      {currency === 'USD' ? <DollarSign className="w-3 h-3 text-slate-500 shrink-0" /> : <IndianRupee className="w-3 h-3 text-slate-500 shrink-0" />}
                      Annual Baseline:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{fmtCost(costBreakdown.totalMonthlyCostUsd * 12)}/yr</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                      Active Duration:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{costBreakdown.monthsActive.toFixed(1)} mo</span>
                  </div>
                </div>
              </div>

              {/* Card 3: One-Time Compute Endured in Window */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {economicsWindow.isAllTime ? 'Compute Incurred' : `Compute Incurred (${economicsWindow.durationLabel})`}
                  </span>
                  <div className="text-2xl font-black text-white font-mono">
                    {fmtCost(costBreakdown.modalTotalUsd)}
                  </div>
                  <span className="text-xs text-slate-400 mt-0.5 block">
                    Modal GPU/CPU Workers
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <ImageIcon className="w-3 h-3 text-sky-400 shrink-0" />
                      Photo AI Worker:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{fmtCost(costBreakdown.modalPhotoUsd)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <VideoIcon className="w-3 h-3 text-purple-400 shrink-0" />
                      Video Workers:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{fmtCost(costBreakdown.modalVideoUsd)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Sparkles className="w-3 h-3 text-pink-400 shrink-0" />
                      Selfie Search:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{fmtCost(costBreakdown.modalSelfieUsd)}</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Net Profit / Margin from User in Window */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {costBreakdown.windowHasRecordedPayments
                      ? (economicsWindow.isAllTime ? 'Actual Net Profit' : `Net Profit (${economicsWindow.durationLabel})`)
                      : 'Gross Margin'}
                  </span>
                  <div className={`text-2xl font-black font-mono ${
                    costBreakdown.windowHasRecordedPayments
                      ? (costBreakdown.windowNetProfitInr >= 0 ? 'text-emerald-400' : 'text-rose-400')
                      : (costBreakdown.monthlyMarginPercentage !== null ? 'text-emerald-400' : 'text-slate-400')
                  }`}>
                    {costBreakdown.windowHasRecordedPayments
                      ? (currency === 'USD'
                          ? (costBreakdown.windowNetProfitUsd >= 0 ? `$${costBreakdown.windowNetProfitUsd.toFixed(2)}` : `-$${Math.abs(costBreakdown.windowNetProfitUsd).toFixed(2)}`)
                          : (costBreakdown.windowNetProfitInr >= 0 ? `₹${costBreakdown.windowNetProfitInr.toFixed(2)}` : `-₹${Math.abs(costBreakdown.windowNetProfitInr).toFixed(2)}`))
                      : (costBreakdown.monthlyMarginPercentage !== null ? `${costBreakdown.monthlyMarginPercentage}%` : 'Free Tier')}
                  </div>
                  <span className="text-xs text-slate-400 mt-0.5 block">
                    {costBreakdown.windowHasRecordedPayments
                      ? `${costBreakdown.windowMarginPercentage ?? 0}% margin (${fmtCostFromInr(costBreakdown.windowCollectedRevenueInr, 0)} collected)`
                      : (cleanRole !== 'free' && cleanRole !== 'freemium'
                        ? (economicsWindow.isAllTime ? `Promotional / Unpaid Role (${currency === 'USD' ? '$0' : '₹0'} paid)` : `${currency === 'USD' ? '$0' : '₹0'} collected in ${economicsWindow.durationLabel}`)
                        : 'Non-paying user account')}
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Banknote className="w-3 h-3 text-emerald-400 shrink-0" />
                      Cash Collected:
                    </span>
                    <span className="font-mono text-emerald-300 font-medium">{fmtCostFromInr(costBreakdown.windowCollectedRevenueInr)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <CreditCard className="w-3 h-3 text-rose-400 shrink-0" />
                      Incurred Cost:
                    </span>
                    <span className="font-mono text-rose-300 font-medium">-{fmtCost(costBreakdown.windowInfraCostUsd)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <ShieldCheck className="w-3 h-3 text-sky-400 shrink-0" />
                      Effective Margin:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{costBreakdown.windowMarginPercentage !== null ? `${costBreakdown.windowMarginPercentage}%` : 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <CheckCircle2 className="w-3 h-3 text-purple-400 shrink-0" />
                      Paid Transactions:
                    </span>
                    <span className="font-mono text-slate-200 font-medium">{costBreakdown.windowCapturedPaymentsCount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Row 2: Customer Payments & Realized Revenue (INSIDE Economics Container) ── */}
            {(() => {
              const validPmts = windowPayments.filter(p => p.status === 'captured' || p.status === 'manual_offline');
              const totalCollected = validPmts.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
              const failedPmts = windowPayments.filter(p => p.status === 'failed').length;
              const netProfit = totalCollected - costBreakdown.windowInfraCostInr;
              const onlinePmts = validPmts.filter(p => p.payment_gateway === 'razorpay');
              const offlinePmts = validPmts.filter(p => p.payment_gateway !== 'razorpay');
              const onlineCollected = onlinePmts.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
              const offlineCollected = offlinePmts.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
              const onlineCount = onlinePmts.length;
              const offlineCount = offlinePmts.length;

              return (
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <Banknote className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider">Customer Collections & Realized Net</h3>
                        <p className="text-[11px] text-slate-500">
                          Actual cash collected, net margins, and payment activity for this customer
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                        {validPmts.length} {validPmts.length === 1 ? 'Payment' : 'Payments'}
                      </span>
                      {failedPmts > 0 && (
                        <span className="text-[11px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                          {failedPmts} Failed
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* Card 1: Total Cash Collected */}
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-4 transition-all hover:border-emerald-500/40 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                          {economicsWindow.isAllTime ? 'Total Cash Collected' : 'Cash Collected'}
                        </span>
                        <div className="text-2xl font-black text-emerald-300 font-mono">
                          {fmtCostFromInr(totalCollected)}
                        </div>
                        <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                          {fmtSubFromInr(totalCollected, `(${validPmts.length} captured)`)}
                        </span>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-emerald-500/20 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <CreditCard className="w-3 h-3 text-sky-400 shrink-0" />
                            Razorpay Online:
                          </span>
                          <span className="font-mono text-slate-200 font-medium">{fmtCostFromInr(onlineCollected)} ({onlineCount})</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Banknote className="w-3 h-3 text-emerald-400 shrink-0" />
                            Manual Offline:
                          </span>
                          <span className="font-mono text-slate-200 font-medium">{fmtCostFromInr(offlineCollected)} ({offlineCount})</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            {currency === 'USD' ? <DollarSign className="w-3 h-3 text-slate-500 shrink-0" /> : <IndianRupee className="w-3 h-3 text-slate-500 shrink-0" />}
                            Avg Order Value:
                          </span>
                          <span className="font-mono text-slate-200 font-medium">
                            {validPmts.length > 0 ? fmtCostFromInr(totalCollected / validPmts.length) : (currency === 'USD' ? '$0.00' : '₹0.00')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Actual Net Profit */}
                    <div className={`rounded-2xl border ${
                      netProfit >= 0
                        ? 'border-emerald-500/20 bg-emerald-950/10 hover:border-emerald-500/40'
                        : 'border-rose-500/20 bg-rose-950/10 hover:border-rose-500/40'
                    } p-4 transition-all flex flex-col justify-between`}>
                      <div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${
                          netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {economicsWindow.isAllTime ? 'Actual Net Profit' : 'Net Profit'}
                        </span>
                        <div className={`text-2xl font-black font-mono ${
                          netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {currency === 'USD'
                            ? (netProfit / usdToInrRate >= 0 ? `$${(netProfit / usdToInrRate).toFixed(2)}` : `-$${Math.abs(netProfit / usdToInrRate).toFixed(2)}`)
                            : (netProfit >= 0 ? `₹${netProfit.toFixed(2)}` : `-₹${Math.abs(netProfit).toFixed(2)}`)}
                        </div>
                        <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                          Collected ({fmtCostFromInr(totalCollected, 0)}) − Infra ({fmtCost(costBreakdown.windowInfraCostUsd, 0)})
                        </span>
                      </div>
                      <div className={`mt-3 pt-2.5 border-t ${
                        netProfit >= 0 ? 'border-emerald-500/20' : 'border-rose-500/20'
                      } space-y-1.5 text-[11px]`}>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <ShieldCheck className="w-3 h-3 text-sky-400 shrink-0" />
                            Net Margin:
                          </span>
                          <span className="font-mono text-slate-200 font-medium">
                            {costBreakdown.windowMarginPercentage !== null ? `${costBreakdown.windowMarginPercentage}%` : (totalCollected > 0 ? `${Math.round((netProfit / totalCollected) * 100)}%` : '0%')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <HardDrive className="w-3 h-3 text-purple-400 shrink-0" />
                            Infra Coverage:
                          </span>
                          <span className="font-mono text-slate-200 font-medium">
                            {costBreakdown.windowInfraCostInr > 0 ? Math.round((totalCollected / costBreakdown.windowInfraCostInr) * 100) : 100}% recovered
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            {netProfit >= 0 ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                            )}
                            Account Position:
                          </span>
                          <span className={`font-mono font-medium ${netProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {netProfit >= 0 ? 'Profitable Customer' : 'Net Subsidized'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Lifetime / Window Infra Cost */}
                    <div className="rounded-2xl border border-purple-500/20 bg-purple-950/10 p-4 transition-all hover:border-purple-500/40 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block mb-1">
                          {economicsWindow.isAllTime ? 'Lifetime Infra Cost' : 'Infra Cost'}
                        </span>
                        <div className="text-2xl font-black text-purple-200 font-mono">
                          {fmtCost(costBreakdown.windowInfraCostUsd)}
                        </div>
                        <span className="text-xs font-mono text-slate-400 mt-0.5 block">
                          B2 Storage + Modal AI Compute
                        </span>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-purple-500/20 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <HardDrive className="w-3 h-3 text-sky-400 shrink-0" />
                            Backblaze B2:
                          </span>
                          <span className="font-mono text-slate-200 font-medium">{fmtCost(costBreakdown.windowB2Usd)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Sparkles className="w-3 h-3 text-pink-400 shrink-0" />
                            Modal.com AI:
                          </span>
                          <span className="font-mono text-slate-200 font-medium">{fmtCost(costBreakdown.modalTotalUsd)}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                            Storage Burn/day:
                          </span>
                          <span className="font-mono text-slate-200 font-medium">{fmtCost(costBreakdown.b2MonthlyUsd / 30, 3)}/day</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 4: Checkout Activity & Drop-offs */}
                    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          {economicsWindow.isAllTime ? 'Checkout Activity' : 'Checkout Activity'}
                        </span>
                        <div className="text-2xl font-black text-white font-mono flex items-baseline gap-2">
                          <span>{windowPayments.length}</span>
                          {failedPmts > 0 && (
                            <span className="text-xs font-semibold text-rose-400 font-sans">({failedPmts} failed)</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 mt-0.5 block">
                          {onlineCount} online · {offlineCount} offline
                        </span>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            Conversion Rate:
                          </span>
                          <span className="font-mono text-slate-200 font-medium">
                            {windowPayments.length > 0 ? Math.round((validPmts.length / windowPayments.length) * 100) : 0}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                            Captured Payments:
                          </span>
                          <span className="font-mono text-slate-200 font-medium">{validPmts.length}</span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="flex items-center gap-1.5 text-slate-400">
                            <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                            Drop-offs / Failures:
                          </span>
                          <span className="font-mono text-slate-200 font-medium">{failedPmts}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Dedicated Customer Payments Record & Ledger */}
          {renderUserPaymentsSection()}

          {/* 1. Backblaze B2 Storage & Metering Cost Matrix */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            {/* Header & Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2 px-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-center">
                  <BackblazeLogo className="h-5 w-auto text-white" />
                </div>
                <h3 className="font-bold text-white text-base">B2 Matrix</h3>
              </div>

              {/* Global Timeframe Sync Indicator */}
              <div className="flex items-center gap-1.5 text-xs font-mono text-rose-300 bg-rose-500/10 border border-rose-500/20 px-3.5 py-1.5 rounded-xl shrink-0 self-start sm:self-auto">
                <Clock className="w-3.5 h-3.5 text-rose-400" />
                <span>
                  Synced: {economicsWindow.formattedRange} ({economicsWindow.durationLabel})
                </span>
              </div>
            </div>

            {/* 4 Executive B2 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-1">
              {/* Card 1: Data Metered */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80">
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-1">
                  Data Metered
                </span>
                <div className="text-xl font-black text-white font-mono flex items-baseline gap-2">
                  <span>{b2MeteringData.totalGbStored.toFixed(2)} GB</span>
                  {b2MeteringData.totalGbStored === 0 && b2MeteringData.totalPeakGb > 0 ? (
                    <span className="text-xs text-rose-400/90 font-sans font-medium">
                      (Peak in window: {b2MeteringData.totalPeakGb.toFixed(2)} GB)
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 font-sans font-normal">
                      active
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-400 mt-1 block">
                  {b2MeteringData.totalGbHours.toFixed(1)} GB-h ({b2MeteringData.totalBillableGbMonths.toFixed(3)} GB-mo)
                </span>
              </div>

              {/* Card 2: Storage Cost */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Storage Cost
                </span>
                <div className="text-xl font-black text-sky-300 font-mono">
                  {fmtCost(b2MeteringData.totalStorageCostUsd)}
                </div>
                <span className="text-[11px] font-mono text-slate-400 mt-1 block">
                  {fmtSub(b2MeteringData.totalStorageCostUsd, '(@ $0.006/GB-mo)')}
                </span>
              </div>

              {/* Card 3: API Transactions */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 transition-all hover:border-slate-700/80">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                  API Transactions
                </span>
                <div className="text-xl font-black text-amber-300 font-mono">
                  {fmtCost(b2MeteringData.totalTransactionCostUsd)}
                </div>
                <span className="text-[11px] font-mono text-slate-400 mt-1 block">
                  {b2MeteringData.totalClassC} Class C &bull; {b2MeteringData.totalClassB} Class B
                </span>
              </div>

              {/* Card 4: Total B2 Incurred */}
              <div className="rounded-2xl border border-sky-500/30 bg-sky-950/20 p-4 transition-all hover:border-sky-500/50">
                <span className="text-[10px] font-bold text-sky-400 uppercase tracking-wider block mb-1">
                  Total BB Incurred
                </span>
                <div className="text-xl font-black text-sky-200 font-mono">
                  {fmtCost(b2MeteringData.grandTotalB2CostUsd)}
                </div>
                <span className="text-[11px] font-mono text-slate-300 mt-1 block">
                  {fmtSub(b2MeteringData.grandTotalB2CostUsd)}
                </span>
              </div>
            </div>

            {/* Consolidated Backblaze B2 Metering Table (Single Row for Selected Timeframe) */}
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <BackblazeLogo className="h-4 w-auto text-white" />
                    <span>Consolidated B2 Matrix</span>
                  </h4>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                  <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-3 py-1.5 rounded-full">
                    Total B2 Cost: {fmtCost(b2MeteringData.grandTotalB2CostUsd)}
                  </span>
                </div>
              </div>

              {/* Single Consolidated Row Table */}
              <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-950/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-400">
                    <thead className="bg-slate-950/90 text-slate-400 uppercase tracking-wider border-b border-slate-800 text-[10px]">
                      <tr className="divide-x divide-slate-800">
                        <th className="py-3 px-3.5 font-bold whitespace-nowrap">Media Metered</th>
                        <th className="py-3 px-3 text-right font-bold whitespace-nowrap">Byte-Hours (GB-h)</th>
                        <th className="py-3 px-3 text-right font-bold whitespace-nowrap">Storage Cost</th>
                        <th className="py-3 px-3 text-right font-bold whitespace-nowrap">Class C</th>
                        <th className="py-3 px-3 text-right font-bold whitespace-nowrap">Class B</th>
                        <th className="py-3 px-3.5 text-right font-bold whitespace-nowrap">Total B2 Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      <tr className="divide-x divide-slate-800 hover:bg-slate-900/40 transition-colors">
                        {/* 1. Media Metered */}
                        <td className="py-3.5 px-3.5 font-mono tabular-nums whitespace-nowrap">
                          <span className="text-white font-bold">{b2MeteringData.totalMediaCount} files</span>
                        </td>

                        {/* 2. Byte-Hours (GB-h) */}
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="text-slate-200 font-bold">{b2MeteringData.totalGbHours.toFixed(2)} GB-h</span>
                        </td>

                        {/* 4. Storage Cost */}
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="text-sky-300 font-bold">{fmtCost(b2MeteringData.totalStorageCostUsd)}</span>
                        </td>

                        {/* 5. Class C (Uploads & Deletions) */}
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="text-amber-300 font-bold">{fmtCost(b2MeteringData.totalClassCCostUsd, 4)}</span>
                        </td>

                        {/* 6. Class B (Reads) */}
                        <td className="py-3.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span className="text-amber-200 font-bold">{fmtCost(b2MeteringData.totalClassBCostUsd, 4)}</span>
                        </td>

                        {/* 7. Total B2 Cost */}
                        <td className="py-3.5 px-3.5 text-right font-mono tabular-nums whitespace-nowrap bg-sky-950/20">
                          <span className="text-sky-200 font-black text-sm">{fmtCost(b2MeteringData.grandTotalB2CostUsd)}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Matrix (Unified Serverless Workers + Event Processing Ledger) */}
          <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-[#111827] to-[#0c1322] p-6 sm:p-7 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="p-2 px-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <ModalLogo className="h-5 w-auto" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Modal Matrix</h3>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCostRefreshKey(k => k + 1)}
                  disabled={loadingCostLogs}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-slate-500 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Reload latest compute logs from database"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingCostLogs ? 'animate-spin text-purple-400' : 'text-slate-400'}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Modular Worker Breakdown (3 Cards across full row) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Photo AI Worker */}
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between font-semibold text-slate-200">
                    <span className="flex items-center gap-1.5 text-sm">
                      <ImageIcon className="w-4 h-4 text-sky-400" />
                      Photo AI Worker
                    </span>
                    <span className="font-mono text-white font-bold text-sm">{fmtCost(costBreakdown.modalPhotoUsd)}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    <code>process_single_photo</code> &bull; <code>process_media_batch</code>
                  </div>
                  <div className="text-xs text-slate-400 mt-2 space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <span>Single Photo (Worker):</span>
                      <span className="font-mono text-slate-200">
                        {fmtCost(actualComputeMetrics.totalPhotoActualUsd)} <span className="text-[11px] text-slate-400">({actualComputeMetrics.lifetimePhotosCount} photos &bull; {actualComputeMetrics.totalPhotoSeconds.toFixed(1)}s)</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span>Batch Dispatcher:</span>
                      <span className="font-mono text-slate-200">
                        {fmtCost(actualComputeMetrics.totalBatchActualUsd, 3)} <span className="text-[11px] text-slate-400">({actualComputeMetrics.totalBatchRuns} batches &bull; {actualComputeMetrics.totalBatchSeconds.toFixed(1)}s)</span>
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-800/60">
                      <span>Total Execution:</span>
                      <span className="font-mono text-slate-300">{(actualComputeMetrics.totalPhotoSeconds + actualComputeMetrics.totalBatchSeconds).toFixed(1)}s</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Avg ~{fmtCost(costBreakdown.modalPhotoUsd / Math.max(1, actualComputeMetrics.lifetimePhotosCount), 4)}/photo</span>
                  {actualComputeMetrics.deletedPhotosCount > 0 && (
                    <span className="text-amber-400/90 text-[10px] font-medium">({actualComputeMetrics.deletedPhotosCount} deleted retained)</span>
                  )}
                </div>
              </div>

              {/* Standard Video Worker (CPU) */}
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between font-semibold text-slate-200">
                    <span className="flex items-center gap-1.5 text-sm">
                      <VideoIcon className="w-4 h-4 text-violet-400" />
                      Standard Video Worker
                    </span>
                    <span className="font-mono text-white font-bold text-sm">{fmtCost(costBreakdown.modalVideoCpuUsd)}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    <code>process_video_cpu (&le; 10 min)</code>
                  </div>
                  <div className="text-xs text-slate-400 mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Hardware:</span>
                      <span className="font-mono text-slate-300">4.0 vCPU + 4GB RAM ({fmtCost((4 * 0.0000131) + (4 * 0.00000222), 5)}/s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Execution:</span>
                      <span className="font-mono text-slate-300">{actualComputeMetrics.totalVideoCpuSeconds.toFixed(1)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Videos Processed:</span>
                      <span className="font-mono text-slate-300">{actualComputeMetrics.totalVideoCpuRuns} short clips</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                  HLS multi-pass encoding (1080p, 720p, 480p)
                </div>
              </div>

              {/* High-Capacity Video Worker (GPU) */}
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between font-semibold text-slate-200">
                    <span className="flex items-center gap-1.5 text-sm">
                      <VideoIcon className="w-4 h-4 text-fuchsia-400" />
                      High-Capacity Video Worker
                    </span>
                    <span className="font-mono text-white font-bold text-sm">{fmtCost(costBreakdown.modalVideoGpuUsd)}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1">
                    <code>process_video_gpu (&gt; 10 min)</code>
                  </div>
                  <div className="text-xs text-slate-400 mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span>Hardware:</span>
                      <span className="font-mono text-slate-300">Nvidia L4 GPU + 4.0 vCPU ({fmtCost(0.0002222 + (4 * 0.0000131), 5)}/s)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Execution:</span>
                      <span className="font-mono text-slate-300">{actualComputeMetrics.totalVideoGpuSeconds.toFixed(1)}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Videos Processed:</span>
                      <span className="font-mono text-slate-300">{actualComputeMetrics.totalVideoGpuRuns} long videos</span>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                  Hardware NVENC accelerated full ceremony highlights
                </div>
              </div>
            </div>

            {/* Guest Face Match Worker (if any runs) */}
            {actualComputeMetrics.totalSelfieRuns > 0 && (
              <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-white">Guest Face Match Worker (<code>find_matching_photos</code>)</span>
                  <span className="text-slate-400">&bull; 0.125 vCPU + 1GB RAM &bull; {actualComputeMetrics.totalSelfieSeconds.toFixed(1)}s ({actualComputeMetrics.totalSelfieRuns} searches)</span>
                </div>
                <span className="font-mono text-white font-bold">{fmtCost(costBreakdown.modalSelfieUsd, 3)}</span>
              </div>
            )}

            {/* Modal Bottom Summary Bar */}
            <div className="flex items-center justify-end gap-4 pt-3 border-t border-slate-800/80 text-xs font-mono">
              <span className="text-slate-400">
                Execution: <strong className="text-slate-200">{actualComputeMetrics.totalComputeSeconds.toFixed(1)}s</strong>
              </span>
              <span className="text-slate-400">
                Total Modal Compute: <strong className="text-purple-300 text-sm">{fmtCost(costBreakdown.modalTotalUsd)}</strong>
              </span>
            </div>

            {/* Event-Wise Modal.com Processing Expenditure Table */}
            <div className="space-y-4 pt-3 border-t border-slate-800/80">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <ModalLogo className="h-4 w-auto" />
                    <span>Event Cost</span>
                  </h4>
                </div>
              </div>

            {/* Filter and Search Toolbar */}
            {allCostRows.length > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-0.5">
                {/* Search */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={costTableSearch}
                    onChange={e => setCostTableSearch(e.target.value)}
                    placeholder="Search gallery title or ID..."
                    className="w-full pl-9 pr-7 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                  {costTableSearch && (
                    <button
                      onClick={() => setCostTableSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                      title="Clear search"
                    >
                      &times;
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800 shrink-0 self-start sm:self-auto">
                  <button
                    onClick={() => setCostTableFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      costTableFilter === 'all'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    All ({allCostRows.length})
                  </button>
                  <button
                    onClick={() => setCostTableFilter('active')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      costTableFilter === 'active'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    Active ({allCostRows.filter(r => r.type === 'active').length})
                  </button>
                  <button
                    onClick={() => setCostTableFilter('deleted')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                      costTableFilter === 'deleted'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    }`}
                  >
                    Deleted ({allCostRows.filter(r => r.type === 'deleted' || r.type === 'orphaned_log').length})
                  </button>
                </div>
              </div>
            )}

            {allCostRows.length === 0 ? (
              <p className="text-sm text-slate-500 py-8 text-center">No events created by this user yet.</p>
            ) : (
              <div className="rounded-2xl border border-slate-800/80 overflow-hidden bg-slate-950/30">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-400">
                    <thead className="bg-slate-950/80 text-slate-500 uppercase tracking-wider border-b border-slate-800 text-[10px]">
                      <tr className="divide-x divide-slate-700/80">
                        <th className="py-2.5 px-3 font-bold">Gallery</th>
                        <th className="py-2.5 px-2.5 font-bold whitespace-nowrap">gal_ID</th>
                        <th className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap">Photos</th>
                        <th className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap">P_cost ({currency === 'USD' ? '$' : '₹'})</th>
                        <th className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap">Videos CPU</th>
                        <th className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap">V_C_cost ({currency === 'USD' ? '$' : '₹'})</th>
                        <th className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap">Videos GPU</th>
                        <th className="py-2.5 px-2.5 text-right font-bold whitespace-nowrap">V_G_cost ({currency === 'USD' ? '$' : '₹'})</th>
                        <th className="py-2.5 px-3 text-right font-bold whitespace-nowrap">Total ({currency === 'USD' ? '$' : '₹'})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {paginatedCostRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-500">
                            No galleries match the current filter or search criteria.
                          </td>
                        </tr>
                      ) : (
                        paginatedCostRows.map(row => {
                          if (row.type === 'active') {
                            const { event, children, combined } = row;

                            // Aggregate compute stats across main event AND all child sub-events
                            const allRelatedIds = [event.id, ...children.map(c => c.event.id)];
                            const allStats = allRelatedIds
                              .map(id => actualComputeMetrics.eventComputeMap.get((id || '').toLowerCase().trim()))
                              .filter(Boolean);

                            const eventPhotoRuns = allStats.reduce((s, st) => s + (st?.photoRuns || 0), 0);
                            const eventPhotoActualUsd = allStats.reduce((s, st) => s + (st?.photoUsd || 0), 0);

                            const eventVideoCpuRuns = allStats.reduce((s, st) => s + (st?.videoCpuRuns || 0), 0);
                            const eventVideoGpuRuns = allStats.reduce((s, st) => s + (st?.videoGpuRuns || 0), 0);
                            const eventVideoRuns = eventVideoCpuRuns + eventVideoGpuRuns;

                            // Accurate photo counts & cost
                            const galleryPhotoCount = Math.max(combined.imageCount, eventPhotoRuns);
                            const unloggedPhotos = Math.max(0, galleryPhotoCount - eventPhotoRuns);
                            const eventPhotoCostUsd = eventPhotoActualUsd + (unloggedPhotos * actualComputeMetrics.avgObservedPhotoCostUsd);

                            // Accurate video counts & cost split by CPU and GPU
                            const galleryVideoCount = Math.max(combined.videoCount, eventVideoRuns);
                            const unloggedVideos = Math.max(0, galleryVideoCount - eventVideoRuns);

                            // Identify GPU candidates in this gallery
                            let galleryGpuCandidates = 0;
                            const galleryRelatedEventIds = new Set(allRelatedIds.map(id => (id || '').toLowerCase().trim()));
                            userEventMetrics.userPhotos.forEach(p => {
                              const pid = (p.eventId || '').toLowerCase().trim();
                              if (!galleryRelatedEventIds.has(pid)) return;
                              const size = Number(p.size) || 0;
                              const mediaType = String(p.mediaType || '').toLowerCase();
                              const resourceType = String(p.resourceType || '').toLowerCase();
                              const rawFormat = String((p as any).format || '').toLowerCase();
                              const rawPath = String((p as any).storageKey || (p as any).url || '').toLowerCase();
                              const hasDuration = p.duration != null && Number(p.duration) > 0;
                              const isVideoByExtension = 
                                ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi'].includes(rawFormat) ||
                                /\.(mp4|mov|webm|mkv|m4v|avi)(\?.*)?$/i.test(rawPath);
                              const isVideo = mediaType === 'video' || resourceType === 'video' || hasDuration || isVideoByExtension;
                              if (isVideo) {
                                const isLong = (hasDuration && Number(p.duration) > 600) || size > 350 * 1024 * 1024;
                                if (isLong) galleryGpuCandidates++;
                              }
                            });

                            const unloggedGpuVideos = Math.min(unloggedVideos, Math.max(0, galleryGpuCandidates - eventVideoGpuRuns));
                            const unloggedCpuVideos = Math.max(0, unloggedVideos - unloggedGpuVideos);

                            const eventVideoCpuActualUsd = allStats.reduce((s, st) => s + (st?.videoCpuUsd || 0), 0);
                            const eventVideoGpuActualUsd = allStats.reduce((s, st) => s + (st?.videoGpuUsd || 0), 0);

                            const eventVideoCpuCostUsd = eventVideoCpuActualUsd + (unloggedCpuVideos * actualComputeMetrics.avgObservedVideoCpuCostUsd);
                            const eventVideoGpuCostUsd = eventVideoGpuActualUsd + (unloggedGpuVideos * actualComputeMetrics.avgObservedVideoGpuCostUsd);
                            const eventSelfieActualUsd = allStats.reduce((s, st) => s + (st?.selfieUsd || 0), 0);
                            const eventTotalModalCostUsd = eventPhotoCostUsd + eventVideoCpuCostUsd + eventVideoGpuCostUsd + eventSelfieActualUsd;

                            return (
                              <tr key={row.id} className="divide-x divide-slate-700/60 hover:bg-slate-900/50 transition-colors">
                                {/* 1. Gallery (Green text indicates active / exists) */}
                                <td className="py-2 px-3 font-semibold">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="truncate max-w-[200px] text-emerald-400 font-semibold" title={event.title || 'Untitled Event'}>
                                      {event.title || 'Untitled Event'}
                                    </span>
                                    {event.isSampleGallery && (
                                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                                        Sample
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* 2. Gallery ID with easy copy */}
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(event.id, `cost-gal-${event.id}`)}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-500 text-slate-300 hover:text-white font-mono text-[11px] transition-all cursor-pointer group"
                                    title="Click to copy gallery ID"
                                  >
                                    <span className="truncate max-w-[130px] select-all">{event.id}</span>
                                    {copiedField === `cost-gal-${event.id}` ? (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-semibold font-sans">
                                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                        Copied
                                      </span>
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-500 group-hover:text-slate-300 shrink-0 transition-colors" />
                                    )}
                                  </button>
                                </td>

                                {/* 3. Photos (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-sky-400 font-semibold">
                                  {galleryPhotoCount} {galleryPhotoCount === 1 ? 'photo' : 'photos'}
                                </td>

                                {/* 4. Photo Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-300 font-semibold">
                                  {fmtCost(eventPhotoCostUsd, 3)}
                                </td>

                                {/* 5. Videos CPU (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-violet-400 font-semibold">
                                  {eventVideoCpuRuns > 0
                                    ? `${eventVideoCpuRuns} ${eventVideoCpuRuns === 1 ? 'run' : 'runs'}`
                                    : unloggedCpuVideos > 0
                                    ? `${unloggedCpuVideos} ${unloggedCpuVideos === 1 ? 'vid' : 'vids'}`
                                    : '0 runs'}
                                </td>

                                {/* 6. CPU Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-300 font-semibold">
                                  {fmtCost(eventVideoCpuCostUsd)}
                                </td>

                                {/* 7. Videos GPU (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-fuchsia-400 font-semibold">
                                  {eventVideoGpuRuns > 0
                                    ? `${eventVideoGpuRuns} ${eventVideoGpuRuns === 1 ? 'run' : 'runs'}`
                                    : unloggedGpuVideos > 0
                                    ? `${unloggedGpuVideos} ${unloggedGpuVideos === 1 ? 'vid' : 'vids'}`
                                    : '0 runs'}
                                </td>

                                {/* 8. GPU Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-300 font-semibold">
                                  {fmtCost(eventVideoGpuCostUsd)}
                                </td>

                                {/* 9. Total Cost */}
                                <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap font-bold text-white">
                                  {fmtCost(eventTotalModalCostUsd)}
                                </td>
                              </tr>
                            );
                          }

                          if (row.type === 'deleted') {
                            const del = row.deleted;
                            const delStats = actualComputeMetrics.eventComputeMap.get((del.eventId || '').toLowerCase().trim());
                            const delPhotoCostUsd = delStats ? delStats.photoUsd : (del.photosCount * 0.000082);

                            const delVideoCpuRuns = delStats?.videoCpuRuns || 0;
                            const delVideoGpuRuns = delStats?.videoGpuRuns || 0;

                            const delVideoCpuCostUsd = delStats ? delStats.videoCpuUsd : (del.videosCount * 0.0035);
                            const delVideoGpuCostUsd = delStats ? delStats.videoGpuUsd : 0;
                            const delSelfieCostUsd = delStats ? delStats.selfieUsd : 0;
                            const delTotalCostUsd = delStats 
                              ? (delPhotoCostUsd + delVideoCpuCostUsd + delVideoGpuCostUsd + delSelfieCostUsd) 
                              : (Number(del.estimatedModalCostInr) > 0 
                                  ? Number(del.estimatedModalCostInr) / usdToInrRate 
                                  : (delPhotoCostUsd + delVideoCpuCostUsd + delVideoGpuCostUsd));
                            const delPhotoCount = Math.max(del.photosCount, delStats?.photoRuns || 0);

                            return (
                              <tr key={row.id} className="divide-x divide-slate-700/60 hover:bg-slate-900/50 transition-colors bg-rose-950/10">
                                {/* 1. Gallery (Red text indicates deleted / does not exist) */}
                                <td className="py-2 px-3 font-semibold">
                                  <div className="truncate max-w-[200px] text-rose-400 font-semibold" title={del.eventTitle || 'Untitled Gallery'}>
                                    {del.eventTitle || 'Untitled Gallery'}
                                  </div>
                                </td>

                                {/* 2. Gallery ID with easy copy */}
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(del.eventId, `cost-gal-${del.eventId}`)}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-500 text-slate-400 hover:text-slate-200 font-mono text-[11px] transition-all cursor-pointer group"
                                    title="Click to copy deleted gallery ID"
                                  >
                                    <span className="truncate max-w-[130px] select-all">{del.eventId}</span>
                                    {copiedField === `cost-gal-${del.eventId}` ? (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-semibold font-sans">
                                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                        Copied
                                      </span>
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-500 group-hover:text-slate-300 shrink-0 transition-colors" />
                                    )}
                                  </button>
                                </td>

                                {/* 3. Photos (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                                  {delPhotoCount} {delPhotoCount === 1 ? 'photo' : 'photos'}
                                </td>

                                {/* 4. Photo Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400 font-semibold">
                                  {fmtCost(delPhotoCostUsd, 3)}
                                </td>

                                {/* 5. Videos CPU (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                                  {delVideoCpuRuns > 0
                                    ? `${delVideoCpuRuns} ${delVideoCpuRuns === 1 ? 'run' : 'runs'}`
                                    : del.videosCount > 0
                                    ? `${del.videosCount} ${del.videosCount === 1 ? 'vid' : 'vids'}`
                                    : '0 runs'}
                                </td>

                                {/* 6. CPU Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400 font-semibold">
                                  {fmtCost(delVideoCpuCostUsd)}
                                </td>

                                {/* 7. Videos GPU (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                                  {delVideoGpuRuns > 0 ? `${delVideoGpuRuns} ${delVideoGpuRuns === 1 ? 'run' : 'runs'}` : '0 runs'}
                                </td>

                                {/* 8. GPU Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400 font-semibold">
                                  {fmtCost(delVideoGpuCostUsd)}
                                </td>

                                {/* 9. Total Cost */}
                                <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap font-bold text-amber-300">
                                  {fmtCost(delTotalCostUsd)}
                                </td>
                              </tr>
                            );
                          }

                          if (row.type === 'orphaned_log') {
                            const { orphanedId, stats: oStats } = row;

                            return (
                              <tr key={row.id} className="divide-x divide-slate-700/60 hover:bg-slate-900/50 transition-colors bg-rose-950/10">
                                {/* 1. Gallery (Red text indicates archived / does not exist) */}
                                <td className="py-2 px-3 font-semibold">
                                  <div className="text-rose-400 font-semibold">Historical Gallery</div>
                                </td>

                                {/* 2. Gallery ID with easy copy */}
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(orphanedId, `cost-gal-${orphanedId}`)}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-500 text-slate-400 hover:text-slate-200 font-mono text-[11px] transition-all cursor-pointer group"
                                    title="Click to copy historical gallery ID"
                                  >
                                    <span className="truncate max-w-[130px] select-all">{orphanedId}</span>
                                    {copiedField === `cost-gal-${orphanedId}` ? (
                                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400 font-semibold font-sans">
                                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                                        Copied
                                      </span>
                                    ) : (
                                      <Copy className="w-3 h-3 text-slate-500 group-hover:text-slate-300 shrink-0 transition-colors" />
                                    )}
                                  </button>
                                </td>

                                {/* 3. Photos (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                                  {oStats.photoRuns} {oStats.photoRuns === 1 ? 'photo' : 'photos'}
                                </td>

                                {/* 4. Photo Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400 font-semibold">
                                  {fmtCost(oStats.photoUsd, 3)}
                                </td>

                                {/* 5. Videos CPU (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                                  {oStats.videoCpuRuns} {oStats.videoCpuRuns === 1 ? 'run' : 'runs'}
                                </td>

                                {/* 6. CPU Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400 font-semibold">
                                  {fmtCost(oStats.videoCpuUsd)}
                                </td>

                                {/* 7. Videos GPU (Clean count only, no running time) */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400">
                                  {oStats.videoGpuRuns} {oStats.videoGpuRuns === 1 ? 'run' : 'runs'}
                                </td>

                                {/* 8. GPU Cost */}
                                <td className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-400 font-semibold">
                                  {fmtCost(oStats.videoGpuUsd)}
                                </td>

                                {/* 9. Total Cost */}
                                <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap font-bold text-amber-300">
                                  {fmtCost(oStats.totalUsd)}
                                </td>
                              </tr>
                            );
                          }

                          return null;
                        })
                      )}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-800 font-bold bg-slate-950/70 text-slate-200">
                      <tr className="divide-x divide-slate-700/80">
                        <td className="py-2.5 px-3">
                          Grand Total
                        </td>
                        <td className="py-2.5 px-2.5 text-slate-600 font-mono text-[11px]">
                          —
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-sky-400 font-semibold">
                          {actualComputeMetrics.lifetimePhotosCount} photos
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-white">
                          {fmtCost(costBreakdown.modalPhotoUsd)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-violet-400 font-semibold">
                          {actualComputeMetrics.totalVideoCpuRuns} runs
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-white">
                          {fmtCost(costBreakdown.modalVideoCpuUsd)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-fuchsia-400 font-semibold">
                          {actualComputeMetrics.totalVideoGpuRuns} runs
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-white">
                          {fmtCost(costBreakdown.modalVideoGpuUsd)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap text-purple-400 text-sm">
                          {fmtCost(costBreakdown.modalTotalUsd)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Pagination Controls Footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80 px-3.5 py-2.5 bg-slate-950/80">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-xs text-slate-400">
                      Showing <span className="font-semibold text-white">{filteredCostRows.length === 0 ? 0 : (costTablePage - 1) * costTablePerPage + 1}</span> to{' '}
                      <span className="font-semibold text-white">{Math.min(filteredCostRows.length, costTablePage * costTablePerPage)}</span> of{' '}
                      <span className="font-semibold text-white">{filteredCostRows.length}</span> {filteredCostRows.length === 1 ? 'gallery' : 'galleries'}
                      {filteredCostRows.length !== allCostRows.length && (
                        <span className="text-slate-500 ml-1">(filtered from {allCostRows.length})</span>
                      )}
                    </p>

                    <div className="flex items-center gap-1.5 pl-3 border-l border-slate-800">
                      <span className="text-[11px] text-slate-500">Per page:</span>
                      {[5, 10, 20].map(sz => (
                        <button
                          key={sz}
                          onClick={() => setCostTablePerPage(sz)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            costTablePerPage === sz
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : 'text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  {totalCostPages > 1 && (
                    <div className="flex items-center gap-2">
                      <div className="flex sm:hidden items-center gap-2">
                        <button
                          onClick={() => setCostTablePage(prev => Math.max(prev - 1, 1))}
                          disabled={costTablePage === 1}
                          className="px-3 py-1 rounded-lg border border-slate-800 bg-slate-950 text-xs font-medium text-slate-400 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Previous
                        </button>
                        <span className="text-xs text-slate-400">
                          {costTablePage} / {totalCostPages}
                        </span>
                        <button
                          onClick={() => setCostTablePage(prev => Math.min(prev + 1, totalCostPages))}
                          disabled={costTablePage === totalCostPages}
                          className="px-3 py-1 rounded-lg border border-slate-800 bg-slate-950 text-xs font-medium text-slate-400 hover:bg-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Next
                        </button>
                      </div>

                      <nav className="hidden sm:inline-flex isolate -space-x-px rounded-xl border border-slate-800/80 bg-slate-950 p-1 gap-1" aria-label="Cost Table Pagination">
                        <button
                          onClick={() => setCostTablePage(prev => Math.max(prev - 1, 1))}
                          disabled={costTablePage === 1}
                          className="relative inline-flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          title="Previous page"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>

                        {costPageNumbers.map(page => {
                          const isActive = page === costTablePage;
                          return (
                            <button
                              key={page}
                              onClick={() => setCostTablePage(page)}
                              className={`relative inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-purple-600 text-white shadow-sm'
                                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}

                        <button
                          onClick={() => setCostTablePage(prev => Math.min(prev + 1, totalCostPages))}
                          disabled={costTablePage === totalCostPages}
                          className="relative inline-flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-900 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                          title="Next page"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </nav>
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Record Offline Payment Modal */}
      {showRecordPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-400" />
                <span>Record Customer Payment</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowRecordPaymentModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Payment Amount (INR ₹)*</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 25000"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Plan</label>
                  <select
                    value={paymentPlanId}
                    onChange={e => setPaymentPlanId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  >
                    {planTiers.map(p => (
                      <option key={p.role} value={p.role}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Duration</label>
                  <select
                    value={paymentBillingDuration}
                    onChange={e => setPaymentBillingDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly (3 Mo)</option>
                    <option value="half_yearly">Half Yearly (6 Mo)</option>
                    <option value="yearly">Yearly (12 Mo)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Payment Method / Gateway</label>
                <select
                  value={paymentGateway}
                  onChange={e => setPaymentGateway(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="manual_upi">Direct UPI (GPay / PhonePe / Paytm)</option>
                  <option value="bank_transfer">Bank Transfer (IMPS / NEFT / RTGS)</option>
                  <option value="cash">Cash in hand</option>
                  <option value="cheque">Cheque</option>
                  <option value="razorpay_offline">Razorpay (Offline invoice)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Reference / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. PhonePe UTR 4829103948..."
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={paymentUpdateRole}
                    onChange={e => setPaymentUpdateRole(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                  />
                  <span>Also update user's plan and expiry date to this tier</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRecordPaymentModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-900 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {recordingPayment ? 'Recording...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

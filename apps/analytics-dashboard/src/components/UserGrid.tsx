import { UserDetailPage, type UserDetailTabType } from './UserDetailPage';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  fetchAllModalCostLogs,
  fetchDeletedEvents,
  computeUserEveBashCost,
  type Event,
  type Photo,
  type UserProfile,
  type DeletedEventArchive,
  type ModalCostLogRow,
  type UserEveBashCostMetrics
} from '../lib/analytics';
import { Search, Calendar, Clock, Filter, Users, CreditCard, Activity, X, Check, HardDrive, IndianRupee, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

const RefreshCcwIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

const TrashOffIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M10 11v6" />
    <path d="M14 17v-3" />
    <path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-1.576.768" />
    <path d="M19 6v7.344" />
    <path d="m2 2 20 20" />
    <path d="M21 6h-9.344" />
    <path d="M3 6h3" />
    <path d="M5 6v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
  </svg>
);

interface Props {
  users: UserProfile[];
  events?: Event[];
  photos?: Photo[];
  onPlanChange?: (userId: string, role: string) => Promise<void> | void;
  onDurationChange?: (userId: string, duration: string) => Promise<void> | void;
  onPlanDatesChange?: (userId: string, startDate: string, endDate: string) => Promise<void> | void;
  onResetUserData?: (userId: string) => Promise<void> | void;
  onDeleteUser?: (userId: string) => Promise<void> | void;
  onDeleteEvent?: (eventId: string) => Promise<void> | void;
  onToggleSampleGallery?: (eventId: string, isSampleGallery: boolean) => Promise<void> | void;
  resetTrigger?: number;
}

const planOptions = [
  { role: 'free', label: 'Free Plan', storage: '1 GB' },
  { role: 'starter', label: 'Starter Plan', storage: '10 GB' },
  { role: 'basic', label: 'Basic Plan', storage: '25 GB' },
  { role: 'standard', label: 'Standard Plan', storage: '50 GB' },
  { role: 'premium', label: 'Premium Plan', storage: '100 GB' },
  { role: 'pro', label: 'Pro Plan', storage: '200 GB' },
  { role: 'elite', label: 'Elite Plan', storage: '500 GB' },
  { role: 'ultimate', label: 'Ultimate Plan', storage: '1 TB' },
];

const durationOptions = [
  { value: 'monthly', label: '1 Month', period: '30 Days', description: 'Standard monthly billing renewal' },
  { value: 'quarterly', label: '3 Month', period: '90 Days', description: 'Quarterly billing cycle' },
  { value: 'half_yearly', label: '6 Month', period: '180 Days', description: 'Bi-annual billing cycle' },
  { value: 'yearly', label: 'Yearly', period: '365 Days', description: 'Full 1-year annual billing cycle' },
];

const getDurationLabel = (duration?: string) => {
  const norm = normalizeDurationValue(duration);
  return durationOptions.find(opt => opt.value === norm)?.label || '1 Month';
};

const getDurationBadgeStyle = (duration?: string) => {
  const norm = normalizeDurationValue(duration);
  switch (norm) {
    case 'yearly':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-400 hover:bg-amber-500/20';
    case 'half_yearly':
      return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:border-indigo-400 hover:bg-indigo-500/20';
    case 'quarterly':
      return 'border-teal-500/30 bg-teal-500/10 text-teal-300 hover:border-teal-400 hover:bg-teal-500/20';
    case 'monthly':
    default:
      return 'border-sky-500/30 bg-sky-500/10 text-sky-300 hover:border-sky-400 hover:bg-sky-500/20';
  }
};

const getDurationCardTheme = (value: string) => {
  switch (value) {
    case 'yearly':
      return {
        text: 'text-amber-400',
        border: 'border-amber-500/40',
        bg: 'bg-amber-500/10',
        ring: 'ring-amber-500',
        badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
      };
    case 'half_yearly':
      return {
        text: 'text-indigo-400',
        border: 'border-indigo-500/40',
        bg: 'bg-indigo-500/10',
        ring: 'ring-indigo-500',
        badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
      };
    case 'quarterly':
      return {
        text: 'text-teal-400',
        border: 'border-teal-500/40',
        bg: 'bg-teal-500/10',
        ring: 'ring-teal-500',
        badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30'
      };
    case 'monthly':
    default:
      return {
        text: 'text-sky-400',
        border: 'border-sky-500/40',
        bg: 'bg-sky-500/10',
        ring: 'ring-sky-500',
        badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30'
      };
  }
};


const isPaidPlan = (role?: string) => {
  const cleanRole = (role || 'free').toLowerCase();
  return cleanRole !== 'admin' && cleanRole !== 'free' && cleanRole !== 'user' && cleanRole !== 'freemium';
};

const normalizeDurationValue = (value?: string) => {
  const normalized = String(value || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === '1_month') return 'monthly';
  if (normalized === '3_month' || normalized === '3_months') return 'quarterly';
  if (normalized === '6_month' || normalized === '6_months') return 'half_yearly';
  if (normalized === 'annual') return 'yearly';
  return durationOptions.some(option => option.value === normalized) ? normalized : 'monthly';
};

const getStoragePlan = (role: string) => {
  const cleanRole = (role || 'free').toLowerCase();
  if (cleanRole === 'admin') return "Unlimited";
  return planOptions.find(plan => plan.role === cleanRole)?.storage || "1 GB";
};

const getPlanOptionLabel = (plan: typeof planOptions[number]) => `${plan.label} · ${plan.storage}`;


const getPlanBadgeStyle = (role?: string) => {
  const clean = (role || 'free').toLowerCase();
  switch (clean) {
    case 'admin':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-400 hover:bg-amber-500/20';
    case 'ultimate': // 1 TB - Rose / Red
      return 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:border-rose-400 hover:bg-rose-500/20';
    case 'elite': // 500 GB - Gold / Yellow
      return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300 hover:border-yellow-400 hover:bg-yellow-500/20';
    case 'pro': // 200 GB - Fuchsia / Magenta
      return 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300 hover:border-fuchsia-400 hover:bg-fuchsia-500/20';
    case 'premium': // 100 GB - Purple
      return 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:border-purple-400 hover:bg-purple-500/20';
    case 'standard': // 50 GB - Indigo
      return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:border-indigo-400 hover:bg-indigo-500/20';
    case 'basic': // 25 GB - Sky Blue
      return 'border-sky-500/30 bg-sky-500/10 text-sky-300 hover:border-sky-400 hover:bg-sky-500/20';
    case 'starter': // 10 GB - Orange
      return 'border-orange-500/30 bg-orange-500/10 text-orange-300 hover:border-orange-400 hover:bg-orange-500/20';
    case 'free': // 1 GB - Emerald Green
    default:
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/20';
  }
};

const getPlanCardTheme = (role: string) => {
  switch (role) {
    case 'free':
      return { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', ring: 'ring-emerald-500', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'starter':
      return { text: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10', ring: 'ring-orange-500', badge: 'bg-orange-500/15 text-orange-300 border-orange-500/30' };
    case 'basic':
      return { text: 'text-sky-400', border: 'border-sky-500/30', bg: 'bg-sky-500/10', ring: 'ring-sky-500', badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30' };
    case 'standard':
      return { text: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', ring: 'ring-indigo-500', badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' };
    case 'premium':
      return { text: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10', ring: 'ring-purple-500', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
    case 'pro':
      return { text: 'text-fuchsia-400', border: 'border-fuchsia-500/30', bg: 'bg-fuchsia-500/10', ring: 'ring-fuchsia-500', badge: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30' };
    case 'elite':
      return { text: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', ring: 'ring-yellow-500', badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' };
    case 'ultimate':
      return { text: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', ring: 'ring-rose-500', badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30' };
    default:
      return { text: 'text-slate-300', border: 'border-slate-700', bg: 'bg-slate-800/60', ring: 'ring-slate-500', badge: 'bg-slate-800 text-slate-300 border-slate-700' };
  }
};

const bytesToGb = (bytes: number) => bytes / (1024 ** 3);

const formatGb = (bytes: number) => {
  const gb = bytesToGb(bytes);
  if (gb === 0) return '0.00';
  if (gb < 0.01) return '<0.01';
  return gb.toFixed(2);
};

const formatDateInputValue = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const addDurationToDate = (startDate: string, duration: string) => {
  const parsed = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return '';

  const monthsByDuration: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    half_yearly: 6,
    yearly: 12,
  };

  parsed.setUTCMonth(parsed.getUTCMonth() + (monthsByDuration[duration] || 1));
  return parsed.toISOString().slice(0, 10);
};

const openDatePicker = (event: React.MouseEvent<HTMLInputElement>) => {
  const input = event.currentTarget as HTMLInputElement & { showPicker?: () => void };
  input.focus();
  try {
    input.showPicker?.();
  } catch {
    // Some browsers only allow the native picker from their built-in date control.
  }
};

export type SortColumn =
  | 'name'
  | 'email'
  | 'joinDate'
  | 'lastActive'
  | 'storage'
  | 'images'
  | 'videos'
  | 'totalGb'
  | 'cost'
  | 'paid'
  | 'duration'
  | 'planStart'
  | 'planEnd';

export type SortDirection = 'asc' | 'desc';

const getStorageQuotaGb = (role?: string): number => {
  const clean = (role || 'free').toLowerCase();
  switch (clean) {
    case 'admin':
      return 999999;
    case 'ultimate':
      return 1000;
    case 'elite':
      return 500;
    case 'pro':
      return 200;
    case 'premium':
      return 100;
    case 'standard':
      return 50;
    case 'basic':
      return 25;
    case 'starter':
      return 10;
    case 'free':
    case 'freemium':
    case 'user':
    default:
      return 1;
  }
};

const getDurationWeight = (user: UserProfile): number => {
  if (!isPaidPlan(user.role)) return 0;
  const norm = normalizeDurationValue(user.subscriptionDuration);
  switch (norm) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 2;
    case 'half_yearly':
      return 3;
    case 'yearly':
      return 4;
    default:
      return 0;
  }
};

const sortColumnLabelMap: Record<SortColumn, string> = {
  name: 'Name',
  email: 'Email',
  joinDate: 'Joined Date',
  lastActive: 'Last Active',
  storage: 'Storage Plan',
  images: 'Images GB',
  videos: 'Videos GB',
  totalGb: 'Total GB',
  cost: 'Cost',
  paid: 'Paid',
  duration: 'Duration',
  planStart: 'Plan Start Date',
  planEnd: 'Plan End Date',
};

export const UserGrid: React.FC<Props> = ({ users, events = [], photos = [], resetTrigger, onPlanChange, onDurationChange, onPlanDatesChange, onResetUserData, onDeleteUser, onDeleteEvent, onToggleSampleGallery }) => {
  const accountScroll = useRef(0);

  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      const descFirstColumns: SortColumn[] = [
        'joinDate',
        'lastActive',
        'storage',
        'images',
        'videos',
        'totalGb',
        'cost',
        'paid',
        'duration',
        'planStart',
        'planEnd',
      ];
      setSortDirection(descFirstColumns.includes(column) ? 'desc' : 'asc');
    }
  };
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingDurationUserId, setSavingDurationUserId] = useState<string | null>(null);
  const [savingDatesUserId, setSavingDatesUserId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [planModalUser, setPlanModalUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('free');
  const [durationModalUser, setDurationModalUser] = useState<UserProfile | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<string>('monthly');
  const [selectedDetailUserId, setSelectedDetailUserId] = useState<string | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<UserDetailTabType>('info');
  const [deletedEvents, setDeletedEvents] = useState<DeletedEventArchive[]>([]);
  const [userPaymentsMap, setUserPaymentsMap] = useState<Map<string, { totalPaid: number; count: number }>>(new Map());

  useEffect(() => {
    let active = true;
    async function loadAllPayments() {
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('user_id, amount, status');
        if (!error && data && active) {
          const map = new Map<string, { totalPaid: number; count: number }>();
          data.forEach((p: any) => {
            const uid = (p.user_id || '').toLowerCase().trim();
            if (!uid) return;
            const prev = map.get(uid) || { totalPaid: 0, count: 0 };
            if (p.status === 'captured' || p.status === 'manual_offline') {
              prev.totalPaid += Number(p.amount) || 0;
            }
            prev.count += 1;
            map.set(uid, prev);
          });
          setUserPaymentsMap(map);
        }
      } catch (err) {
        console.warn('[UserGrid] payments load error:', err);
      }
    }
    loadAllPayments();
    return () => { active = false; };
  }, [resetTrigger]);

  useEffect(() => {
    if (resetTrigger) {
      setSelectedDetailUserId(null);
      setPlanModalUser(null);
      setDurationModalUser(null);
    }
  }, [resetTrigger]);
  const [modalLogs, setModalLogs] = useState<ModalCostLogRow[]>([]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetchDeletedEvents(),
      fetchAllModalCostLogs(),
    ]).then(([deleted, logs]) => {
      if (isMounted) {
        setDeletedEvents(deleted);
        setModalLogs(logs);
      }
    }).catch(err => {
      console.warn('Error loading cost data for user table:', err);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const openUserDetail = (userId: string, tab: UserDetailTabType = 'info') => {
    accountScroll.current = window.scrollY;
    setDetailInitialTab(tab);
    setSelectedDetailUserId(userId);
    window.scrollTo(0, 0);
  };

  const openPlanModal = (user: UserProfile) => {
    const currentRole = (user.role || 'free') === 'user' ? 'free' : (user.role || 'free');
    setSelectedRole(currentRole);
    setPlanModalUser(user);
  };

  const closePlanModal = () => {
    if (savingUserId) return;
    setPlanModalUser(null);
  };

  const handleSavePlan = async () => {
    if (!planModalUser || !onPlanChange) return;
    try {
      await handlePlanChange(planModalUser.id, selectedRole);
      setPlanModalUser(null);
    } catch {
      // Error handled
    }
  };

  const openDurationModal = (user: UserProfile) => {
    setSelectedDuration(normalizeDurationValue(user.subscriptionDuration));
    setDurationModalUser(user);
  };

  const closeDurationModal = () => {
    if (savingDurationUserId) return;
    setDurationModalUser(null);
  };

  const handleSaveDuration = async () => {
    if (!durationModalUser || !onDurationChange) return;
    try {
      await handleDurationChange(durationModalUser.id, selectedDuration);
      setDurationModalUser(null);
    } catch {
      // Error handled
    }
  };

  const handlePlanChange = async (userId: string, role: string) => {
    if (!onPlanChange) return;
    setSavingUserId(userId);
    try {
      await onPlanChange(userId, role);
    } finally {
      setSavingUserId(null);
    }
  };

  const handleDurationChange = async (userId: string, duration: string) => {
    if (!onDurationChange) return;
    setSavingDurationUserId(userId);
    try {
      await onDurationChange(userId, duration);
    } finally {
      setSavingDurationUserId(null);
    }
  };

  const handlePlanDateChange = async (
    userId: string,
    currentStartDate: string,
    currentEndDate: string,
    field: 'start' | 'end',
    value: string,
    duration?: string
  ) => {
    if (!onPlanDatesChange) return;
    const nextStartDate = field === 'start' ? value : currentStartDate;
    const nextEndDate = field === 'start'
      ? addDurationToDate(value, normalizeDurationValue(duration)) || currentEndDate
      : value;
    setSavingDatesUserId(userId);
    try {
      await onPlanDatesChange(userId, nextStartDate, nextEndDate);
    } finally {
      setSavingDatesUserId(null);
    }
  };

  const handleResetUserData = async (user: UserProfile) => {
    if (!onResetUserData || resettingUserId) return;
    const label = user.email || user.name || user.id;
    const confirmed = window.confirm(
      `Clear uploaded data for ${label}?\n\nThis will delete this user's galleries, media, guest access records, face-search data, and uploaded files. The user account itself will remain.`
    );
    if (!confirmed) return;

    const typed = window.prompt(`Type RESET to confirm clearing uploaded data for ${label}.`);
    if (typed !== 'RESET') return;

    setResettingUserId(user.id);
    try {
      await onResetUserData(user.id);
    } finally {
      setResettingUserId(null);
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (!onDeleteUser || deletingUserId) return;
    const label = user.email || user.name || user.id;
    const confirmed = window.confirm(
      `Permanently delete ${label}?\n\nThis will first clear uploaded data, then delete the login account and profile. This cannot be undone.`
    );
    if (!confirmed) return;

    const typed = window.prompt(`Type DELETE USER to permanently delete ${label}.`);
    if (typed !== 'DELETE USER') return;

    setDeletingUserId(user.id);
    try {
      await onDeleteUser(user.id);
    } finally {
      setDeletingUserId(null);
    }
  };

  const stats = useMemo(() => {
    const total = users.length;
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const active24h = users.filter(u => {
      if (!u.lastLogin) return false;
      const lastLoginDate = new Date(u.lastLogin);
      return !isNaN(lastLoginDate.getTime()) && lastLoginDate >= oneDayAgo;
    }).length;

    const paid = users.filter(u => {
      const cleanRole = (u.role || 'free').toLowerCase();
      return cleanRole !== 'admin' && cleanRole !== 'free' && cleanRole !== 'user' && cleanRole !== 'freemium';
    }).length;

    const admins = users.filter(u => (u.role || '').toLowerCase() === 'admin').length;

    return { total, active24h, paid, admins };
  }, [users]);

  const userUsageMetrics = useMemo(() => {
    const metrics = new Map<string, {
      mainEventCount: number;
      subGalleryCount: number;
      imageBytes: number;
      videoBytes: number;
      imageCount: number;
      videoCount: number;
      totalBytes: number;
      allEventIds: Set<string>;
      mainEvents: Array<Event & { mediaBytes: number; totalMediaBytes: number; subGalleries: Array<Event & { mediaBytes: number }> }>;
    }>();
    const userKeyByIdentifier = new Map<string, string>();
    const eventMediaBytes = new Map<string, number>();

    photos.forEach(photo => {
      if (!photo.eventId) return;
      eventMediaBytes.set(photo.eventId, (eventMediaBytes.get(photo.eventId) || 0) + (Number(photo.size) || 0));
    });

    users.forEach(user => {
      metrics.set(user.id, {
        mainEventCount: 0,
        subGalleryCount: 0,
        imageBytes: 0,
        videoBytes: 0,
        imageCount: 0,
        videoCount: 0,
        totalBytes: 0,
        allEventIds: new Set<string>(),
        mainEvents: []
      });
      if (user.id) userKeyByIdentifier.set(user.id.toLowerCase(), user.id);
      if (user.email) userKeyByIdentifier.set(user.email.toLowerCase(), user.id);
      if (user.username) userKeyByIdentifier.set(user.username.toLowerCase(), user.id);
      if (user.phone) {
        const rawPhone = user.phone.toLowerCase();
        userKeyByIdentifier.set(rawPhone, user.id);
        const digits = rawPhone.replace(/\D/g, '');
        if (digits) {
          userKeyByIdentifier.set(digits, user.id);
          if (digits.length === 10) {
            userKeyByIdentifier.set(`+91${digits}`, user.id);
            userKeyByIdentifier.set(`91${digits}`, user.id);
          } else if (digits.length === 12 && digits.startsWith('91')) {
            userKeyByIdentifier.set(digits.slice(2), user.id);
            userKeyByIdentifier.set(`+${digits}`, user.id);
          }
        }
      }
    });

    const eventById = new Map<string, Event>();
    events.forEach(e => { if (e.id) eventById.set(e.id, e); });

    const eventOwnerById = new Map<string, string>();
    const allEventsByUser = new Map<string, Event[]>();

    // Recursively resolve event owner up to parent event if sub-event has no direct owner
    const resolveEventUserId = (eventId: string, visited = new Set<string>()): string | undefined => {
      if (!eventId || visited.has(eventId)) return undefined;
      visited.add(eventId);
      const ev = eventById.get(eventId);
      if (!ev) return undefined;
      const directOwner = (ev.createdBy || ev.createdById || '').toLowerCase();
      if (directOwner && userKeyByIdentifier.has(directOwner)) {
        return userKeyByIdentifier.get(directOwner);
      }
      if (ev.parentId) {
        return resolveEventUserId(ev.parentId, visited);
      }
      return undefined;
    };

    events.forEach(event => {
      if (!event.id) return;
      const userId = resolveEventUserId(event.id);
      if (!userId) return;

      eventOwnerById.set(event.id, userId);

      const currentEvents = allEventsByUser.get(userId) || [];
      currentEvents.push(event);
      allEventsByUser.set(userId, currentEvents);
      metrics.get(userId)?.allEventIds.add(event.id);
    });

    // Also attach any events explicitly assigned to users
    users.forEach(user => {
      if (user.assignedEvents && Array.isArray(user.assignedEvents)) {
        user.assignedEvents.forEach(eid => {
          if (!eid) return;
          eventOwnerById.set(eid, user.id);
          metrics.get(user.id)?.allEventIds.add(eid);
          const ev = eventById.get(eid);
          if (ev) {
            const currentEvents = allEventsByUser.get(user.id) || [];
            if (!currentEvents.some(e => e.id === eid)) {
              currentEvents.push(ev);
              allEventsByUser.set(user.id, currentEvents);
            }
          }
        });
      }
    });

    allEventsByUser.forEach((userEvents, userId) => {
      const metric = metrics.get(userId);
      if (!metric) return;

      const subGalleriesByParent = new Map<string, Event[]>();
      const orphanSubGalleries: Event[] = [];
      const mainEvents: Event[] = [];

      userEvents.forEach(event => {
        if (event.id) {
          metric.allEventIds.add(event.id);
        }
        const isSubGallery = Boolean(event.parentId) || event.type === 'sub';
        if (isSubGallery) {
          const parentId = event.parentId || '';
          if (parentId) {
            const current = subGalleriesByParent.get(parentId) || [];
            current.push(event);
            subGalleriesByParent.set(parentId, current);
          } else {
            orphanSubGalleries.push(event);
          }
        } else {
          mainEvents.push(event);
        }
      });

      const sortByDateDesc = (a: Event, b: Event) => {
        const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bDate - aDate;
      };

      metric.mainEvents = mainEvents
        .sort(sortByDateDesc)
        .map(event => {
          const homeMediaBytes = eventMediaBytes.get(event.id) || 0;
          const subGalleries = (subGalleriesByParent.get(event.id) || [])
            .sort(sortByDateDesc)
            .map(subGallery => {
              if (subGallery.id) {
                metric.allEventIds.add(subGallery.id);
              }
              return {
                ...subGallery,
                mediaBytes: eventMediaBytes.get(subGallery.id) || 0,
              };
            });
          const totalMediaBytes = subGalleries.reduce((sum, subGallery) => sum + subGallery.mediaBytes, homeMediaBytes);

          return {
            ...event,
            mediaBytes: homeMediaBytes,
            totalMediaBytes,
            subGalleries,
          };
        });
      metric.mainEventCount = metric.mainEvents.length;
      metric.subGalleryCount = Array.from(subGalleriesByParent.values()).reduce((sum, list) => sum + list.length, 0) + orphanSubGalleries.length;
    });

    photos.forEach(photo => {
      const explicitUploader = (photo.userId || '').toLowerCase();
      const uploaderUserId = userKeyByIdentifier.get(explicitUploader);
      const eventOwnerUserId = eventOwnerById.get(photo.eventId);
      const userId = eventOwnerUserId || uploaderUserId;
      if (!userId) return;

      const current = metrics.get(userId);
      if (!current) return;

      const size = Number(photo.size) || 0;
      const mediaType = String(photo.mediaType || '').toLowerCase();
      const resourceType = String(photo.resourceType || '').toLowerCase();
      const isVideo = mediaType === 'video' || resourceType === 'video';

      if (isVideo) {
        current.videoBytes += size;
        current.videoCount += 1;
      } else {
        current.imageBytes += size;
        current.imageCount += 1;
      }
      current.totalBytes += size;
    });

    return metrics;
  }, [users, events, photos]);

  const userCostMetrics = useMemo(() => {
    const costMap = new Map<string, UserEveBashCostMetrics>();

    // Pre-index user identifiers
    const userByIdentifier = new Map<string, string>();
    users.forEach(u => {
      if (u.id) userByIdentifier.set(u.id.toLowerCase(), u.id);
      if (u.email) userByIdentifier.set(u.email.toLowerCase(), u.id);
      if (u.phone) userByIdentifier.set(u.phone.toLowerCase(), u.id);
    });

    // Pre-index deleted events by user
    const deletedByUser = new Map<string, DeletedEventArchive[]>();
    users.forEach(u => deletedByUser.set(u.id, []));

    deletedEvents.forEach(d => {
      const uid = d.userId ? userByIdentifier.get(d.userId.toLowerCase()) : undefined;
      if (uid) {
        deletedByUser.get(uid)?.push(d);
      }
    });

    // Map all active and deleted event IDs to users
    const eventIdToUserId = new Map<string, string>();
    userUsageMetrics.forEach((metric, uid) => {
      metric.allEventIds.forEach(eid => eventIdToUserId.set(eid, uid));
    });
    deletedEvents.forEach(d => {
      const uid = d.userId ? userByIdentifier.get(d.userId.toLowerCase()) : undefined;
      if (uid && d.eventId) {
        eventIdToUserId.set(d.eventId, uid);
      }
    });

    // Pre-index modal logs by user
    const modalLogsByUser = new Map<string, ModalCostLogRow[]>();
    users.forEach(u => modalLogsByUser.set(u.id, []));

    modalLogs.forEach(log => {
      // If the log is tied to an event/gallery, attribute compute to the event owner (host),
      // matching how photo storage bytes are attributed to eventOwnerUserId.
      const eventOwnerUid = log.event_id ? eventIdToUserId.get(log.event_id) : undefined;
      const directUid = log.user_id ? userByIdentifier.get(log.user_id.toLowerCase()) : undefined;
      const uid = eventOwnerUid || directUid;
      if (uid) {
        modalLogsByUser.get(uid)?.push(log);
      }
    });

    // Compute cost for each user
    users.forEach(u => {
      const usage = userUsageMetrics.get(u.id) || {
        imageCount: 0,
        videoCount: 0,
        totalBytes: 0,
      };
      const userDeleted = deletedByUser.get(u.id) || [];
      const userLogs = modalLogsByUser.get(u.id) || [];

      const cost = computeUserEveBashCost({
        imageCount: usage.imageCount,
        videoCount: usage.videoCount,
        totalBytes: usage.totalBytes,
        modalLogs: userLogs,
        deletedEvents: userDeleted,
        userCreatedAt: u.createdAt,
      });

      costMap.set(u.id, cost);
    });

    return costMap;
  }, [users, deletedEvents, modalLogs, userUsageMetrics]);

  const overallCostMetrics = useMemo(() => {
    let totalLifetimeInr = 0;
    let totalMonthlyInr = 0;
    userCostMetrics.forEach(cost => {
      totalLifetimeInr += cost.totalLifetimeCostInr;
      totalMonthlyInr += cost.totalMonthlyCostInr;
    });
    return {
      totalLifetimeInr,
      totalMonthlyInr,
    };
  }, [userCostMetrics]);

  const filteredUsers = useMemo(() => {
    const query = search.toLowerCase();
    const filtered = users.filter(user => {
      const matchesSearch =
        (user.name || '').toLowerCase().includes(query) ||
        (user.email || '').toLowerCase().includes(query) ||
        (user.username && user.username.toLowerCase().includes(query)) ||
        (user.phone && user.phone.includes(search));

      const matchesPlan =
        planFilter === 'all' ||
        (user.role || 'free').toLowerCase() === planFilter.toLowerCase();

      return matchesSearch && matchesPlan;
    });

    return filtered.sort((a, b) => {
      let cmp = 0;

      switch (sortColumn) {
        case 'name': {
          const aName = (a.name || a.email || '').trim().toLowerCase();
          const bName = (b.name || b.email || '').trim().toLowerCase();
          cmp = aName.localeCompare(bName);
          break;
        }

        case 'email': {
          const aEmail = (a.email || '').trim().toLowerCase();
          const bEmail = (b.email || '').trim().toLowerCase();
          cmp = aEmail.localeCompare(bEmail);
          break;
        }

        case 'joinDate': {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          cmp = aTime - bTime;
          break;
        }

        case 'lastActive': {
          const aTime = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
          const bTime = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
          if (aTime === 0 && bTime === 0) {
            cmp = 0;
          } else if (aTime === 0) {
            return 1;
          } else if (bTime === 0) {
            return -1;
          } else {
            cmp = aTime - bTime;
          }
          break;
        }

        case 'storage': {
          const aStorage = getStorageQuotaGb(a.role);
          const bStorage = getStorageQuotaGb(b.role);
          cmp = aStorage - bStorage;
          break;
        }

        case 'images': {
          const aImages = userUsageMetrics.get(a.id)?.imageBytes || 0;
          const bImages = userUsageMetrics.get(b.id)?.imageBytes || 0;
          cmp = aImages - bImages;
          break;
        }

        case 'videos': {
          const aVideos = userUsageMetrics.get(a.id)?.videoBytes || 0;
          const bVideos = userUsageMetrics.get(b.id)?.videoBytes || 0;
          cmp = aVideos - bVideos;
          break;
        }

        case 'totalGb': {
          const aUsage = userUsageMetrics.get(a.id);
          const aTotal = (aUsage?.imageBytes || 0) + (aUsage?.videoBytes || 0);
          const bUsage = userUsageMetrics.get(b.id);
          const bTotal = (bUsage?.imageBytes || 0) + (bUsage?.videoBytes || 0);
          cmp = aTotal - bTotal;
          break;
        }

        case 'cost': {
          const aCost = userCostMetrics.get(a.id)?.totalLifetimeCostInr || 0;
          const bCost = userCostMetrics.get(b.id)?.totalLifetimeCostInr || 0;
          cmp = aCost - bCost;
          break;
        }

        case 'paid': {
          const aPaid = userPaymentsMap.get((a.id || '').toLowerCase().trim())?.totalPaid || 0;
          const bPaid = userPaymentsMap.get((b.id || '').toLowerCase().trim())?.totalPaid || 0;
          cmp = aPaid - bPaid;
          break;
        }

        case 'duration': {
          const aDur = getDurationWeight(a);
          const bDur = getDurationWeight(b);
          if (aDur === 0 && bDur === 0) {
            cmp = 0;
          } else if (aDur === 0) {
            return 1;
          } else if (bDur === 0) {
            return -1;
          } else {
            cmp = aDur - bDur;
          }
          break;
        }

        case 'planStart': {
          const aPaid = isPaidPlan(a.role);
          const bPaid = isPaidPlan(b.role);
          const aTime = aPaid && a.planStartDate ? new Date(a.planStartDate).getTime() : 0;
          const bTime = bPaid && b.planStartDate ? new Date(b.planStartDate).getTime() : 0;
          if (aTime === 0 && bTime === 0) {
            cmp = 0;
          } else if (aTime === 0) {
            return 1;
          } else if (bTime === 0) {
            return -1;
          } else {
            cmp = aTime - bTime;
          }
          break;
        }

        case 'planEnd': {
          const aPaid = isPaidPlan(a.role);
          const bPaid = isPaidPlan(b.role);
          const aTime = aPaid && a.planEndDate ? new Date(a.planEndDate).getTime() : 0;
          const bTime = bPaid && b.planEndDate ? new Date(b.planEndDate).getTime() : 0;
          if (aTime === 0 && bTime === 0) {
            cmp = 0;
          } else if (aTime === 0) {
            return 1;
          } else if (bTime === 0) {
            return -1;
          } else {
            cmp = aTime - bTime;
          }
          break;
        }

        default:
          cmp = 0;
      }

      if (cmp !== 0) {
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      const aName = (a.name || a.email || '').trim().toLowerCase();
      const bName = (b.name || b.email || '').trim().toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [
    users,
    search,
    planFilter,
    sortColumn,
    sortDirection,
    userUsageMetrics,
    userCostMetrics,
    userPaymentsMap,
  ]);

  const detailUser = useMemo(() => {
    if (!selectedDetailUserId) return null;
    return users.find(u => u.id === selectedDetailUserId) || null;
  }, [users, selectedDetailUserId]);

  if (detailUser) {
    return (
      <UserDetailPage
        user={detailUser}
        events={events}
        photos={photos}
        initialTab={detailInitialTab}
        onBack={() => setSelectedDetailUserId(null)}
        onPlanChange={onPlanChange}
        onDurationChange={onDurationChange}
        onPlanDatesChange={onPlanDatesChange}
        onDeleteEvent={onDeleteEvent}
        onToggleSampleGallery={onToggleSampleGallery}
      />
    );
  }

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
        className={`py-2.5 px-2.5 whitespace-nowrap border-b border-slate-800 cursor-pointer select-none group/col transition-colors ${
          isSorted
            ? 'text-indigo-400 bg-slate-800/60 font-bold'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
        } ${extraThClass}`}
        title={`Sort by ${label} (${isSorted ? (sortDirection === 'asc' ? 'Ascending - click to reverse' : 'Descending - click to reverse') : 'Click to sort'})`}
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

  return (
    <>
    <div className="space-y-8 animate-fadeIn">
      {/* Quick Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Registered */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl transition-all duration-500 group-hover:bg-emerald-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Total Accounts
            </span>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2.5 text-emerald-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-emerald-500/40 group-hover:bg-emerald-500/20">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-white transition-colors group-hover:text-emerald-300">
            {stats.total}
          </h3>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>Registered database profiles</span>
          </div>
        </div>

        {/* Card 2: Active Users */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-xl hover:shadow-sky-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-sky-500/10 blur-2xl transition-all duration-500 group-hover:bg-sky-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Active Users
            </span>
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-2.5 text-sky-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-sky-500/40 group-hover:bg-sky-500/20">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-white transition-colors group-hover:text-sky-300">
            {stats.active24h}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-sky-400" />
              <span>Active within last 24h</span>
            </div>
            <span className="rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-sky-300">
              {stats.total > 0 ? Math.round((stats.active24h / stats.total) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Card 3: Premium Subscriptions */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-indigo-500/10 blur-2xl transition-all duration-500 group-hover:bg-indigo-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Premium Subs
            </span>
            <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-2.5 text-indigo-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-indigo-500/40 group-hover:bg-indigo-500/20">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-white transition-colors group-hover:text-indigo-300">
            {stats.paid}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <span>Paid tier subscriptions</span>
            </div>
            <span className="rounded border border-indigo-500/25 bg-indigo-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-300">
              {stats.total > 0 ? Math.round((stats.paid / stats.total) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Card 4: Total Cost Endured */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-purple-500/10 blur-2xl transition-all duration-500 group-hover:bg-purple-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Total Cost Endured
            </span>
            <div className="rounded-xl border border-purple-500/25 bg-purple-500/10 p-2.5 text-purple-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-purple-500/40 group-hover:bg-purple-500/20">
              <IndianRupee className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-white transition-colors group-hover:text-purple-300">
            ₹{overallCostMetrics.totalLifetimeInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-400" />
              <span>Lifetime compute & storage</span>
            </div>
            <span
              className="rounded border border-purple-500/25 bg-purple-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-purple-300"
              title="Active monthly recurring B2 + DB storage across all users"
            >
              ₹{overallCostMetrics.totalMonthlyInr.toFixed(2)}/mo
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Box */}
      <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
      {/* Table Header and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h4 className="text-lg font-bold text-white">Registered Accounts</h4>
          <p className="text-slate-400 text-xs mt-0.5">
            Showing {filteredUsers.length} of {users.length} users &bull; Sorted by{' '}
            <span className="text-indigo-400 font-semibold">{sortColumnLabelMap[sortColumn]}</span>{' '}
            <span className="text-slate-500 font-mono">({sortDirection === 'asc' ? 'Ascending ↑' : 'Descending ↓'})</span>
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, username..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-sky-500/50 w-full sm:w-64 placeholder-slate-600 transition-colors"
            />
          </div>

          {/* Filter dropdown */}
          <div className="relative flex items-center">
            <Filter className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
            <select
              value={planFilter}
              onChange={e => setPlanFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer placeholder-slate-600 transition-colors"
            >
              <option value="all">All Plans</option>
              {planOptions.slice().reverse().map(plan => (
                <option key={plan.role} value={plan.role}>
                  {getPlanOptionLabel(plan)}
                </option>
              ))}
              <option value="admin">Super Admin</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto border border-slate-800/60 rounded-2xl">
        <table className="w-full min-w-[1920px] text-left text-sm text-slate-400 border-separate border-spacing-0">
          <thead className="text-xs text-slate-500 uppercase bg-slate-900">
            <tr>
              {/* Sr. No. (Fixed) */}
              <th scope="col" className="sticky left-0 z-20 bg-slate-900 py-2.5 px-2 whitespace-nowrap w-12 min-w-[48px] max-w-[48px] text-center border-b border-slate-800 border-r border-slate-700/80">
                Sr. No.
              </th>

              {/* 1. Email (Sticky + Sortable) */}
              <th
                scope="col"
                onClick={() => handleSort('email')}
                className={`sticky left-[48px] z-20 bg-slate-900 py-2.5 px-2.5 whitespace-nowrap min-w-[210px] max-w-[210px] border-b border-slate-800 border-r border-slate-700 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.5)] cursor-pointer select-none group/col transition-colors ${
                  sortColumn === 'email' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title={`Sort by Email (${sortColumn === 'email' ? (sortDirection === 'asc' ? 'Ascending - click to reverse' : 'Descending - click to reverse') : 'Click to sort'})`}
              >
                <div className="flex items-center gap-1.5 justify-between">
                  <span>Email</span>
                  <span className="shrink-0 transition-all inline-flex items-center">
                    {sortColumn === 'email' ? (
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

              {/* 2. Name (Sortable) */}
              {renderSortableHeader('name', 'Name', 'min-w-[160px]')}

              {/* Username (Non-sortable) */}
              <th scope="col" className="py-2.5 px-2.5 whitespace-nowrap min-w-[120px] border-b border-slate-800">
                Username
              </th>

              {/* Phone (Non-sortable) */}
              <th scope="col" className="py-2.5 px-2.5 whitespace-nowrap min-w-[110px] border-b border-slate-800">
                Phone
              </th>

              {/* 3. Joined Date (Sortable) */}
              {renderSortableHeader('joinDate', 'Joined Date', 'min-w-[105px]')}

              {/* 4. Last Active (Sortable) */}
              {renderSortableHeader('lastActive', 'Last Active', 'min-w-[105px]')}

              {/* Role (Non-sortable) */}
              <th scope="col" className="py-2.5 px-2.5 whitespace-nowrap min-w-[85px] border-b border-slate-800">
                Role
              </th>

              {/* 5. Storage Plan (Sortable) */}
              {renderSortableHeader('storage', 'Storage Plan', 'min-w-[95px]')}

              {/* #events (Non-sortable) */}
              <th scope="col" className="py-2.5 px-2.5 whitespace-nowrap min-w-[115px] border-b border-slate-800">
                #events
              </th>

              {/* 6. Images GB (Sortable) */}
              {renderSortableHeader('images', 'Images GB', 'min-w-[85px]')}

              {/* 7. Videos GB (Sortable) */}
              {renderSortableHeader('videos', 'Videos GB', 'min-w-[85px]')}

              {/* 8. Total GB (Sortable) */}
              {renderSortableHeader('totalGb', 'Total GB', 'min-w-[85px]')}

              {/* 9. Cost (Sortable) */}
              {renderSortableHeader('cost', 'Cost', 'min-w-[95px]')}

              {/* 10. Paid (Sortable) */}
              {renderSortableHeader('paid', 'Paid', 'min-w-[100px]')}

              {/* 11. Duration (Sortable) */}
              {renderSortableHeader('duration', 'Duration', 'min-w-[115px]')}

              {/* 12. Plan Start Date (Sortable) */}
              {renderSortableHeader('planStart', 'Plan Start Date', 'min-w-[135px]')}

              {/* 13. Plan End Date (Sortable) */}
              {renderSortableHeader('planEnd', 'Plan End Date', 'min-w-[135px]')}

              {/* Manage User (Non-sortable) */}
              <th scope="col" className="py-2.5 px-2.5 whitespace-nowrap min-w-[85px] border-b border-slate-800">
                Manage User
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user, idx) => {
              const initials = (user.name || user.email || 'U')
                .trim()
                .split(' ')
                .map(n => n[0])
                .filter(Boolean)
                .slice(0, 2)
                .join('')
                .toUpperCase();
              
              const regDate = user.createdAt 
                ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) 
                : 'N/A';
              const logDate = user.lastLogin 
                ? new Date(user.lastLogin).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) 
                : 'Never';
              const paidPlan = isPaidPlan(user.role);
              const planStartDate = formatDateInputValue(user.planStartDate);
              const planEndDate = formatDateInputValue(user.planEndDate);
              const usage = userUsageMetrics.get(user.id) || { mainEventCount: 0, subGalleryCount: 0, imageBytes: 0, videoBytes: 0, mainEvents: [] };
              const totalBytes = usage.imageBytes + usage.videoBytes;
              const userCost = userCostMetrics.get(user.id) || { totalLifetimeCostInr: 0, totalMonthlyCostInr: 0 };

              return (
                <React.Fragment key={user.id || idx}>
                  <tr className={`group transition-colors ${idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0c1322]'} hover:bg-slate-800/50`}>
                    {/* Sr. No. (Fixed horizontally) */}
                    <td className={`sticky left-0 z-10 ${idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0c1322]'} group-hover:bg-[#1e293b] transition-colors py-2 px-2 whitespace-nowrap w-12 min-w-[48px] max-w-[48px] text-center font-mono text-xs text-slate-400 border-b border-slate-700 border-r border-slate-700/80`}>
                      {idx + 1}
                    </td>

                    {/* Email (Fixed horizontally) */}
                    <td className={`sticky left-[48px] z-10 ${idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0c1322]'} group-hover:bg-[#1e293b] transition-colors py-2 px-2.5 whitespace-nowrap min-w-[210px] max-w-[210px] border-b border-slate-700 border-r border-slate-700 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.5)]`}>
                      <button
                        type="button"
                        onClick={() => openUserDetail(user.id, 'info')}
                        className="font-medium text-xs text-indigo-400 hover:text-indigo-300 hover:underline truncate block max-w-[200px] text-left cursor-pointer transition-colors"
                        title={`Click to open user page for ${user.email || user.name || user.id}`}
                      >
                        {user.email || <span className="italic text-slate-600">No email</span>}
                      </button>
                    </td>

                    {/* Name */}
                    <td className="py-2 px-2.5 min-w-[160px] whitespace-nowrap border-b border-slate-700">
                      <div className="flex items-center space-x-2">
                        <div
                          onClick={() => openUserDetail(user.id, 'info')}
                          className="w-6 h-6 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center font-bold text-[10px] text-slate-200 shrink-0 cursor-pointer hover:border-indigo-500/80 transition-colors"
                          title="Open user page"
                        >
                          {initials || 'U'}
                        </div>
                        <button
                          type="button"
                          onClick={() => openUserDetail(user.id, 'info')}
                          className="font-semibold text-white hover:text-indigo-300 hover:underline text-xs truncate max-w-[125px] text-left cursor-pointer transition-colors"
                          title={user.name}
                        >
                          {user.name || 'Anonymous'}
                        </button>
                      </div>
                    </td>

                    {/* Username */}
                    <td className="py-2 px-2.5 min-w-[120px] whitespace-nowrap border-b border-slate-700">
                      {user.username ? (
                        <span className="inline-flex items-center font-mono text-[11px] text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded-md border border-indigo-500/20">
                          @{user.username}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600 italic">No username</span>
                      )}
                    </td>

                    {/* Phone */}
                    <td className="py-2 px-2.5 min-w-[110px] whitespace-nowrap text-xs text-slate-400 border-b border-slate-700">
                      <span>{user.phone || <span className="italic text-slate-600">No phone</span>}</span>
                    </td>

                    {/* Date Joined */}
                    <td className="py-2 px-2.5 min-w-[105px] text-xs whitespace-nowrap border-b border-slate-700">
                      <div className="flex items-center space-x-1.5 text-slate-300 whitespace-nowrap">
                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                        <span>{regDate}</span>
                      </div>
                    </td>
                    
                    {/* Last Active */}
                    <td className="py-2 px-2.5 min-w-[105px] text-xs whitespace-nowrap border-b border-slate-700">
                      <div className="flex items-center space-x-1.5 text-slate-300 whitespace-nowrap">
                        <Clock className="w-3.5 h-3.5 text-slate-600" />
                        <span className={user.lastLogin ? 'text-sky-400' : 'text-slate-500'}>{logDate}</span>
                      </div>
                    </td>

                    {/* Subscription Plan */}
                    <td className="py-2 px-2.5 min-w-[85px] whitespace-nowrap border-b border-slate-700">
                      <span className={`inline-block whitespace-nowrap px-2 py-0.5 text-[11px] font-semibold rounded-full border ${
                        user.role === 'admin' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        user.role === 'ultimate' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        user.role === 'elite' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        user.role === 'pro' ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' :
                        user.role === 'premium' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        user.role === 'standard' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        user.role === 'basic' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                        user.role === 'starter' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {user.role ? user.role.toUpperCase() : 'FREE'}
                      </span>
                    </td>

                    {/* Storage Plan */}
                    <td className="py-2 px-2.5 min-w-[95px] whitespace-nowrap border-b border-slate-700">
                      {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                          <span className="whitespace-nowrap">{getStoragePlan(user.role)}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!onPlanChange || savingUserId === user.id}
                          onClick={() => openPlanModal(user)}
                          className={`group inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-2 py-1 text-xs font-bold transition-all shadow-sm ${getPlanBadgeStyle(user.role)} ${
                            savingUserId === user.id ? 'cursor-wait opacity-60' : 'cursor-pointer hover:shadow-md'
                          }`}
                          title="Click to change storage plan"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse shrink-0" />
                          <span className="whitespace-nowrap">{getStoragePlan(user.role || 'free')}</span>
                        </button>
                      )}
                    </td>

                    {/* #events */}
                    <td className="py-2 px-2.5 min-w-[115px] whitespace-nowrap text-xs font-semibold text-slate-300 border-b border-slate-700">
                      <button
                        type="button"
                        onClick={() => openUserDetail(user.id, 'events')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700/80 bg-slate-800/80 hover:bg-slate-700 hover:border-sky-500/60 hover:text-sky-300 transition-all cursor-pointer group shadow-sm"
                        title={`Click to view ${usage.mainEventCount} events in User Detail Page`}
                      >
                        <Calendar className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-white group-hover:text-sky-300 transition-colors">{usage.mainEventCount}</span>
                        <span className="text-[11px] text-slate-400 font-normal group-hover:text-slate-300">({usage.subGalleryCount} sub)</span>
                      </button>
                    </td>

                    {/* Image Storage */}
                    <td className="py-2 px-2.5 min-w-[85px] whitespace-nowrap text-xs font-semibold text-emerald-300 border-b border-slate-700">
                      {formatGb(usage.imageBytes)} GB
                    </td>

                    {/* Video Storage */}
                    <td className="py-2 px-2.5 min-w-[85px] whitespace-nowrap text-xs font-semibold text-violet-300 border-b border-slate-700">
                      {formatGb(usage.videoBytes)} GB
                    </td>

                    {/* Total Storage */}
                    <td className="py-2 px-2.5 min-w-[85px] whitespace-nowrap text-xs font-bold text-white border-b border-slate-700">
                      {formatGb(totalBytes)} GB
                    </td>

                    {/* Cost */}
                    <td className="py-2 px-2.5 min-w-[95px] whitespace-nowrap border-b border-slate-700">
                      <button
                        type="button"
                        onClick={() => openUserDetail(user.id, 'cost')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 hover:border-purple-400 text-purple-300 transition-all cursor-pointer group shadow-sm"
                        title={`Click to view Economics subpage for ${user.email || user.name || user.id}`}
                      >
                        <IndianRupee className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-white group-hover:text-purple-200 transition-colors">
                          ₹{userCost.totalLifetimeCostInr.toFixed(2)}
                        </span>
                      </button>
                    </td>

                    {/* Paid */}
                    <td className="py-2 px-2.5 min-w-[100px] whitespace-nowrap border-b border-slate-700">
                      <button
                        type="button"
                        onClick={() => openUserDetail(user.id, 'cost')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 hover:border-emerald-400 text-emerald-300 transition-all cursor-pointer group shadow-sm"
                        title={`Click to view Payment Ledger & Economics for ${user.email || user.name || user.id}`}
                      >
                        <CreditCard className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-white group-hover:text-emerald-200 transition-colors">
                          ₹{(userPaymentsMap.get((user.id || '').toLowerCase().trim())?.totalPaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </button>
                    </td>

                    {/* Duration */}
                    <td className="py-2 px-2.5 min-w-[115px] whitespace-nowrap border-b border-slate-700">
                      {paidPlan ? (
                        <button
                          type="button"
                          disabled={!onDurationChange || savingDurationUserId === user.id}
                          onClick={() => openDurationModal(user)}
                          className={`group inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 rounded-lg border px-2 py-1 text-xs font-bold transition-all shadow-sm ${getDurationBadgeStyle(user.subscriptionDuration)} ${
                            savingDurationUserId === user.id ? 'cursor-wait opacity-60' : 'cursor-pointer hover:shadow-md'
                          }`}
                          title="Click to change billing duration"
                        >
                          <Clock className="h-3 w-3 shrink-0 opacity-80 group-hover:opacity-100" />
                          <span className="whitespace-nowrap">{getDurationLabel(user.subscriptionDuration)}</span>
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-slate-600">-</span>
                      )}
                    </td>

                    {/* Plan Start Date */}
                    <td className="py-2 px-2.5 min-w-[135px] whitespace-nowrap border-b border-slate-700">
                      {paidPlan ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={planStartDate}
                            disabled={!onPlanDatesChange || savingDatesUserId === user.id}
                            onClick={openDatePicker}
                            onChange={event => handlePlanDateChange(user.id, planStartDate, planEndDate, 'start', event.target.value, user.subscriptionDuration)}
                            className="w-28 cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-medium text-slate-200 outline-none transition-colors focus:border-emerald-500 disabled:cursor-wait disabled:opacity-60"
                          />
                          {savingDatesUserId === user.id && (
                            <RefreshCcwIcon className="h-3 w-3 animate-spin text-emerald-400" />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-600">-</span>
                      )}
                    </td>

                    {/* Plan End Date */}
                    <td className="py-2 px-2.5 min-w-[135px] whitespace-nowrap border-b border-slate-700">
                      {paidPlan ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="date"
                            value={planEndDate}
                            disabled={!onPlanDatesChange || savingDatesUserId === user.id}
                            onClick={openDatePicker}
                            onChange={event => handlePlanDateChange(user.id, planStartDate, planEndDate, 'end', event.target.value)}
                            className="w-28 cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-medium text-slate-200 outline-none transition-colors focus:border-rose-500 disabled:cursor-wait disabled:opacity-60"
                          />
                          {savingDatesUserId === user.id && (
                            <RefreshCcwIcon className="h-3 w-3 animate-spin text-rose-400" />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-slate-600">-</span>
                      )}
                    </td>

                    {/* Manage User (Clear Data & Delete User - at the end) */}
                    <td className="py-2 px-2.5 min-w-[85px] whitespace-nowrap border-b border-slate-700">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={!onResetUserData || resettingUserId === user.id}
                          onClick={() => handleResetUserData(user)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 transition-colors hover:border-yellow-400 hover:bg-yellow-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                          title={resettingUserId === user.id ? 'Clearing user data...' : 'Clear uploaded and created data for this user'}
                          aria-label="Clear user data"
                        >
                          <RefreshCcwIcon className={`h-3.5 w-3.5 ${resettingUserId === user.id ? 'animate-spin' : ''}`} />
                        </button>

                        <button
                          type="button"
                          disabled={!onDeleteUser || deletingUserId === user.id || user.role === 'admin'}
                          onClick={() => handleDeleteUser(user)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 transition-colors hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                          title={user.role === 'admin' ? 'Super admin deletion is disabled' : deletingUserId === user.id ? 'Deleting user...' : 'Delete this user account permanently'}
                          aria-label="Delete user"
                        >
                          <TrashOffIcon className={`h-3.5 w-3.5 ${deletingUserId === user.id ? 'animate-pulse' : ''}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
            
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={19} className="py-12 text-center text-slate-500 bg-slate-900/10 border-b border-slate-700">
                  <p className="text-base font-semibold">No accounts found</p>
                  <p className="text-xs text-slate-600 mt-1">Try adjusting your filters or search query.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  {/* Change Storage Plan Modal */}
  {planModalUser && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={closePlanModal}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-[#111827] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-white">
              <HardDrive className="h-5 w-5 text-indigo-400" />
              Change Storage Plan
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Account: <span className="font-semibold text-white">{planModalUser.name || planModalUser.email}</span>
              {planModalUser.username && (
                <span className="ml-1 font-mono text-indigo-400">(@{planModalUser.username})</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={closePlanModal}
            disabled={savingUserId === planModalUser.id}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Plan selection grid */}
        <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Select Storage Tier
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {planOptions.map(plan => {
              const currentRole = (planModalUser.role || 'free') === 'user' ? 'free' : (planModalUser.role || 'free');
              const isCurrent = currentRole === plan.role;
              const isSelected = selectedRole === plan.role;
              const theme = getPlanCardTheme(plan.role);

              return (
                <button
                  key={plan.role}
                  type="button"
                  onClick={() => setSelectedRole(plan.role)}
                  className={`relative flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                    isSelected
                      ? `${theme.border} ${theme.bg} ring-2 ${theme.ring} shadow-lg shadow-black/40`
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-bold text-white">{plan.label}</span>
                    {isSelected && (
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full ${theme.bg} ${theme.text}`}>
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className={`text-lg font-black ${theme.text}`}>{plan.storage}</span>
                    <span className="text-[11px] font-medium text-slate-400">allocated</span>
                  </div>

                  {isCurrent && (
                    <span className={`mt-2 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${theme.badge}`}>
                      Active Plan
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800/80 pt-4">
          <button
            type="button"
            onClick={closePlanModal}
            disabled={savingUserId === planModalUser.id}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              savingUserId === planModalUser.id ||
              selectedRole === ((planModalUser.role || 'free') === 'user' ? 'free' : (planModalUser.role || 'free'))
            }
            onClick={handleSavePlan}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingUserId === planModalUser.id ? (
              <>
                <RefreshCcwIcon className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              'Update Plan'
            )}
          </button>
        </div>
      </div>
    </div>
  )}

  {/* Change Billing Duration Modal */}
  {durationModalUser && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={closeDurationModal}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-[#111827] p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-white">
              <Clock className="h-5 w-5 text-sky-400" />
              Change Billing Duration
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Account: <span className="font-semibold text-white">{durationModalUser.name || durationModalUser.email}</span>
              {durationModalUser.username && (
                <span className="ml-1 font-mono text-sky-400">(@{durationModalUser.username})</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={closeDurationModal}
            disabled={savingDurationUserId === durationModalUser.id}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Duration selection grid */}
        <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Select Billing Duration
          </p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {durationOptions.map(option => {
              const currentDuration = normalizeDurationValue(durationModalUser.subscriptionDuration);
              const isCurrent = currentDuration === option.value;
              const isSelected = selectedDuration === option.value;
              const theme = getDurationCardTheme(option.value);

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedDuration(option.value)}
                  className={`relative flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
                    isSelected
                      ? `${theme.border} ${theme.bg} ring-2 ${theme.ring} shadow-lg shadow-black/40`
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-xs font-bold text-white">{option.label}</span>
                    {isSelected && (
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full ${theme.bg} ${theme.text}`}>
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className={`text-base font-extrabold ${theme.text}`}>{option.period}</span>
                    <span className="text-[11px] font-medium text-slate-400">cycle</span>
                  </div>

                  <p className="mt-1 text-[11px] text-slate-400">{option.description}</p>

                  {isCurrent && (
                    <span className={`mt-2.5 inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${theme.badge}`}>
                      Active Duration
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800/80 pt-4">
          <button
            type="button"
            onClick={closeDurationModal}
            disabled={savingDurationUserId === durationModalUser.id}
            className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              savingDurationUserId === durationModalUser.id ||
              selectedDuration === normalizeDurationValue(durationModalUser.subscriptionDuration)
            }
            onClick={handleSaveDuration}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-lg transition-colors hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingDurationUserId === durationModalUser.id ? (
              <>
                <RefreshCcwIcon className="h-3.5 w-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              'Update Duration'
            )}
          </button>
        </div>
      </div>
    </div>
  )}
    </>
  );
};

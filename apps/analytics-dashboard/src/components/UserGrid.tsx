import React, { useState, useMemo } from 'react';
import type { Event, Photo, UserProfile } from '../lib/analytics';
import { Search, Mail, Phone, Calendar, Clock, Filter, Users, ShieldCheck, CreditCard, Activity, ChevronDown, RotateCcw, Trash2, UserX, Star } from 'lucide-react';

interface Props {
  users: UserProfile[];
  events?: Event[];
  photos?: Photo[];
  onPlanChange?: (userId: string, role: string) => Promise<void> | void;
  onDurationChange?: (userId: string, duration: string) => Promise<void> | void;
  onPlanDatesChange?: (userId: string, startDate: string, endDate: string) => Promise<void> | void;
  onPromoteSuperAdmin?: (userId: string) => Promise<void> | void;
  onRevokeSuperAdmin?: (userId: string) => Promise<void> | void;
  onResetUserData?: (userId: string) => Promise<void> | void;
  onDeleteUser?: (userId: string) => Promise<void> | void;
  onDeleteEvent?: (eventId: string) => Promise<void> | void;
  onToggleSampleGallery?: (eventId: string, isSampleGallery: boolean) => Promise<void> | void;
  currentAdminId?: string;
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
  { value: 'monthly', label: '1 Month' },
  { value: 'quarterly', label: '3 Month' },
  { value: 'half_yearly', label: '6 Month' },
  { value: 'yearly', label: 'Yearly' },
];

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

const bytesToGb = (bytes: number) => bytes / (1024 ** 3);

const formatGb = (bytes: number) => {
  const gb = bytesToGb(bytes);
  if (gb === 0) return '0.00';
  if (gb < 0.01) return '<0.01';
  return gb.toFixed(2);
};

const formatMediaSize = (bytes: number) => {
  if (!bytes) return '0 MB';
  const gb = bytesToGb(bytes);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return '<1 MB';
};

const formatDateInputValue = (value?: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const formatDisplayDate = (value?: string) => {
  if (!value) return 'No date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
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

export const UserGrid: React.FC<Props> = ({ users, events = [], photos = [], onPlanChange, onDurationChange, onPlanDatesChange, onPromoteSuperAdmin, onRevokeSuperAdmin, onResetUserData, onDeleteUser, onDeleteEvent, onToggleSampleGallery, currentAdminId }) => {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [savingDurationUserId, setSavingDurationUserId] = useState<string | null>(null);
  const [savingDatesUserId, setSavingDatesUserId] = useState<string | null>(null);
  const [promotingUserId, setPromotingUserId] = useState<string | null>(null);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [sampleUpdatingEventId, setSampleUpdatingEventId] = useState<string | null>(null);
  const [expandedEventsUserId, setExpandedEventsUserId] = useState<string | null>(null);
  const [expandedSubGalleriesEventId, setExpandedSubGalleriesEventId] = useState<string | null>(null);

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

  const handlePromoteSuperAdmin = async (user: UserProfile) => {
    if (!onPromoteSuperAdmin || promotingUserId) return;
    const label = user.email || user.name || user.id;
    const confirmed = window.confirm(
      `Make ${label} a Super Admin?\n\nThis will give full Analytics Dashboard access, including user management, pricing management, and destructive admin actions.`
    );
    if (!confirmed) return;

    const typed = window.prompt(`Type SUPER ADMIN to confirm full dashboard access for ${label}.`);
    if (typed !== 'SUPER ADMIN') return;

    setPromotingUserId(user.id);
    try {
      await onPromoteSuperAdmin(user.id);
    } finally {
      setPromotingUserId(null);
    }
  };

  const handleRevokeSuperAdmin = async (user: UserProfile) => {
    if (!onRevokeSuperAdmin || revokingUserId) return;
    const label = user.email || user.name || user.id;
    const confirmed = window.confirm(
      `Revoke Super Admin access for ${label}?\n\nThis will remove full Analytics Dashboard access and move the user back to the Free plan.`
    );
    if (!confirmed) return;

    const typed = window.prompt(`Type REVOKE SUPER ADMIN to confirm removing full dashboard access for ${label}.`);
    if (typed !== 'REVOKE SUPER ADMIN') return;

    setRevokingUserId(user.id);
    try {
      await onRevokeSuperAdmin(user.id);
    } finally {
      setRevokingUserId(null);
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

  const handleDeleteEvent = async (event: Event & { subGalleries?: Event[] }) => {
    if (!onDeleteEvent || deletingEventId) return;
    const title = event.title || 'Untitled Event';
    const subGalleryCount = event.subGalleries?.length || 0;
    const cascadeNote = subGalleryCount > 0
      ? `\n\nThis will also delete ${subGalleryCount} sub-gallery${subGalleryCount === 1 ? '' : 'ies'} inside this event.`
      : '';
    const confirmed = window.confirm(
      `Delete "${title}"?\n\nThis will delete the event, its media, guest records, and uploaded files.${cascadeNote}`
    );
    if (!confirmed) return;

    const typed = window.prompt(`Type DELETE to confirm deletion of "${title}".`);
    if (typed !== 'DELETE') return;

    setDeletingEventId(event.id);
    try {
      await onDeleteEvent(event.id);
    } finally {
      setDeletingEventId(null);
    }
  };

  const handleToggleSampleGallery = async (event: Event) => {
    if (!onToggleSampleGallery || sampleUpdatingEventId) return;
    const nextStatus = !event.isSampleGallery;
    const title = event.title || 'Untitled Event';
    const confirmed = window.confirm(
      nextStatus
        ? `Add "${title}" to Sample Galleries?`
        : `Remove "${title}" from Sample Galleries?`
    );
    if (!confirmed) return;

    setSampleUpdatingEventId(event.id);
    try {
      await onToggleSampleGallery(event.id, nextStatus);
    } finally {
      setSampleUpdatingEventId(null);
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

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase()) ||
        (user.phone && user.phone.includes(search));
      
      const matchesPlan = 
        planFilter === 'all' || 
        (user.role || 'free').toLowerCase() === planFilter.toLowerCase();

      return matchesSearch && matchesPlan;
    }).sort((a, b) => {
      const aLabel = (a.name || a.email || '').trim().toLowerCase();
      const bLabel = (b.name || b.email || '').trim().toLowerCase();
      return aLabel.localeCompare(bLabel);
    });
  }, [users, search, planFilter]);

  const userUsageMetrics = useMemo(() => {
    const metrics = new Map<string, {
      mainEventCount: number;
      subGalleryCount: number;
      imageBytes: number;
      videoBytes: number;
      mainEvents: Array<Event & { mediaBytes: number; totalMediaBytes: number; subGalleries: Array<Event & { mediaBytes: number }> }>;
    }>();
    const userKeyByIdentifier = new Map<string, string>();
    const eventMediaBytes = new Map<string, number>();

    photos.forEach(photo => {
      if (!photo.eventId) return;
      eventMediaBytes.set(photo.eventId, (eventMediaBytes.get(photo.eventId) || 0) + (Number(photo.size) || 0));
    });

    users.forEach(user => {
      metrics.set(user.id, { mainEventCount: 0, subGalleryCount: 0, imageBytes: 0, videoBytes: 0, mainEvents: [] });
      if (user.id) userKeyByIdentifier.set(user.id.toLowerCase(), user.id);
      if (user.email) userKeyByIdentifier.set(user.email.toLowerCase(), user.id);
    });

    const eventOwnerById = new Map<string, string>();
    const allEventsByUser = new Map<string, Event[]>();

    events.forEach(event => {
      const ownerId = (event.createdBy || event.createdById || '').toLowerCase();
      const userId = userKeyByIdentifier.get(ownerId);

      if (event.id && ownerId) {
        eventOwnerById.set(event.id, ownerId);
      }

      if (!userId) return;
      const currentEvents = allEventsByUser.get(userId) || [];
      currentEvents.push(event);
      allEventsByUser.set(userId, currentEvents);
    });

    allEventsByUser.forEach((userEvents, userId) => {
      const metric = metrics.get(userId);
      if (!metric) return;

      const subGalleriesByParent = new Map<string, Event[]>();
      const orphanSubGalleries: Event[] = [];
      const mainEvents: Event[] = [];

      userEvents.forEach(event => {
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
            .map(subGallery => ({
              ...subGallery,
              mediaBytes: eventMediaBytes.get(subGallery.id) || 0,
            }));
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
      const eventOwner = (eventOwnerById.get(photo.eventId) || '').toLowerCase();
      const userId = userKeyByIdentifier.get(explicitUploader) || userKeyByIdentifier.get(eventOwner);
      if (!userId) return;

      const current = metrics.get(userId);
      if (!current) return;

      const size = Number(photo.size) || 0;
      const mediaType = String(photo.mediaType || '').toLowerCase();
      const resourceType = String(photo.resourceType || '').toLowerCase();
      const isVideo = mediaType === 'video' || resourceType === 'video';

      if (isVideo) {
        current.videoBytes += size;
      } else {
        current.imageBytes += size;
      }
    });

    return metrics;
  }, [users, events, photos]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Quick Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Registered */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 hover:border-emerald-500/50 transition-all duration-300 shadow-lg group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Accounts</p>
              <h3 className="text-2xl font-black text-white mt-1 group-hover:text-emerald-400 transition-colors">
                {stats.total}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Registered in database</p>
        </div>

        {/* Card 2: Active Users */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 hover:border-sky-500/50 transition-all duration-300 shadow-lg group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Active Users</p>
              <h3 className="text-2xl font-black text-white mt-1 group-hover:text-sky-400 transition-colors">
                {stats.active24h}
              </h3>
            </div>
            <div className="p-2.5 bg-sky-500/10 rounded-xl text-sky-400">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Active within last 24h</p>
        </div>

        {/* Card 3: Premium Subscriptions */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 hover:border-indigo-500/50 transition-all duration-300 shadow-lg group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Premium Subs</p>
              <h3 className="text-2xl font-black text-white mt-1 group-hover:text-indigo-400 transition-colors">
                {stats.paid}
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Paid tiers (10GB - 500GB)</p>
        </div>

        {/* Card 4: Super Admins */}
        <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 hover:border-amber-500/50 transition-all duration-300 shadow-lg group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Super Admins</p>
              <h3 className="text-2xl font-black text-white mt-1 group-hover:text-amber-400 transition-colors">
                {stats.admins}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">Administrative privileges</p>
        </div>
      </div>

      {/* Main Table Box */}
      <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
      {/* Table Header and Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h4 className="text-lg font-bold text-white">Registered Accounts</h4>
          <p className="text-slate-400 text-xs mt-0.5">
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email..."
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
        <table className="w-full min-w-[2320px] text-left text-sm text-slate-400">
          <thead className="text-xs text-slate-500 uppercase bg-slate-900/30 border-b border-slate-800">
            <tr>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">User Details</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Role</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Storage Plan</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Super Admin</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Events Created</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Images GB</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Videos GB</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Total GB</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Duration</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Plan Start Date</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Plan End Date</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Clear Data</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Delete User</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Joined Date</th>
              <th scope="col" className="py-3.5 px-4 whitespace-nowrap">Last Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {filteredUsers.map((user, idx) => {
              const initials = user.name
                .split(' ')
                .map(n => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();
              
              const regDate = user.createdAt 
                ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) 
                : 'N/A';
              const logTime = user.lastLogin 
                ? new Date(user.lastLogin).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                : 'Never';
              const paidPlan = isPaidPlan(user.role);
              const planStartDate = formatDateInputValue(user.planStartDate);
              const planEndDate = formatDateInputValue(user.planEndDate);
              const usage = userUsageMetrics.get(user.id) || { mainEventCount: 0, subGalleryCount: 0, imageBytes: 0, videoBytes: 0, mainEvents: [] };
              const totalBytes = usage.imageBytes + usage.videoBytes;
              const isEventsExpanded = expandedEventsUserId === user.id;

              return (
                <React.Fragment key={user.id || idx}>
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    {/* Name & Avatar */}
                    <td className="py-3.5 px-4 flex min-w-72 items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center font-bold text-xs text-slate-200">
                        {initials || 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-white leading-tight">{user.name}</p>
                        <p className="text-xs text-slate-500 leading-tight mt-0.5 flex items-center">
                          <Mail className="w-3 h-3 mr-1 text-slate-600" />
                          {user.email}
                        </p>
                        <p className="text-xs text-slate-500 leading-tight mt-1 flex items-center">
                          <Phone className="w-3 h-3 mr-1 text-slate-600" />
                          {user.phone || <span className="italic text-slate-600">No phone</span>}
                        </p>
                      </div>
                    </td>

                    {/* Subscription Plan */}
                    <td className="py-3.5 px-4 min-w-28">
                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                        user.role === 'admin' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        user.role === 'ultimate' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                        user.role === 'elite' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        user.role === 'pro' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                        user.role === 'premium' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        user.role === 'standard' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                        user.role === 'basic' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        user.role === 'starter' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                        {user.role ? user.role.toUpperCase() : 'FREE'}
                      </span>
                    </td>

                    {/* Storage Plan */}
                    <td className="py-3.5 px-4 min-w-44">
                      {user.role === 'admin' ? (
                        <span className="inline-flex rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">
                          Super Admin · {getStoragePlan(user.role)}
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <select
                            value={(user.role || 'free') === 'user' ? 'free' : (user.role || 'free')}
                            disabled={!onPlanChange || savingUserId === user.id}
                            onChange={event => handlePlanChange(user.id, event.target.value)}
                            className="min-w-36 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 outline-none transition-colors focus:border-indigo-500 disabled:cursor-wait disabled:opacity-60"
                          >
                            {planOptions.map(plan => (
                              <option key={plan.role} value={plan.role}>
                                {getPlanOptionLabel(plan)}
                              </option>
                            ))}
                          </select>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            {savingUserId === user.id ? 'Saving...' : `${getStoragePlan(user.role || 'free')} allotted`}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Super Admin Promotion */}
                    <td className="py-3.5 px-4 min-w-40">
                      {user.role === 'admin' && !user.delegatedBy ? (
                        <div className="flex flex-col gap-2">
                          <span className="inline-flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Super Admin
                          </span>
                          <button
                            type="button"
                            disabled={!onRevokeSuperAdmin || revokingUserId === user.id || user.id === currentAdminId}
                            onClick={() => handleRevokeSuperAdmin(user)}
                            className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 transition-colors hover:border-rose-400 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                            title={user.id === currentAdminId ? 'You cannot revoke your own Super Admin access' : 'Remove full Analytics Dashboard access'}
                          >
                            <UserX className="h-3.5 w-3.5" />
                            {revokingUserId === user.id ? 'Revoking...' : 'Revoke'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!onPromoteSuperAdmin || promotingUserId === user.id}
                          onClick={() => handlePromoteSuperAdmin(user)}
                          className="inline-flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-bold text-indigo-300 transition-colors hover:border-indigo-400 hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                          title="Grant full Analytics Dashboard access"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {promotingUserId === user.id ? 'Promoting...' : 'Make Super Admin'}
                        </button>
                      )}
                    </td>

                  {/* Events Created */}
                    <td className="py-3.5 px-4 min-w-36 whitespace-nowrap text-xs font-semibold text-slate-300">
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <span>{usage.mainEventCount}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                            {usage.subGalleryCount} sub galleries
                          </span>
                        </div>
                        {usage.mainEventCount > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedEventsUserId(isEventsExpanded ? null : user.id);
                              setExpandedSubGalleriesEventId(null);
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700 bg-slate-950 text-slate-300 transition-colors hover:border-indigo-500/60 hover:text-white"
                            aria-label={isEventsExpanded ? 'Hide created events' : 'Show created events'}
                          >
                            <ChevronDown className={`h-4 w-4 transition-transform ${isEventsExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                    </td>

                  {/* Image Storage */}
                    <td className="py-3.5 px-4 min-w-32 whitespace-nowrap text-xs font-semibold text-emerald-300">
                    {formatGb(usage.imageBytes)} GB
                  </td>

                  {/* Video Storage */}
                    <td className="py-3.5 px-4 min-w-32 whitespace-nowrap text-xs font-semibold text-violet-300">
                    {formatGb(usage.videoBytes)} GB
                  </td>

                  {/* Total Storage */}
                    <td className="py-3.5 px-4 min-w-32 whitespace-nowrap text-xs font-bold text-white">
                    {formatGb(totalBytes)} GB
                  </td>

                  {/* Duration */}
                  <td className="py-3.5 px-4 min-w-40">
                    {paidPlan ? (
                      <div className="flex flex-col gap-1">
                        <select
                          value={normalizeDurationValue(user.subscriptionDuration)}
                          disabled={!onDurationChange || savingDurationUserId === user.id}
                          onChange={event => handleDurationChange(user.id, event.target.value)}
                          className="min-w-32 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 outline-none transition-colors focus:border-sky-500 disabled:cursor-wait disabled:opacity-60"
                        >
                          {durationOptions.map(duration => (
                            <option key={duration.value} value={duration.value}>
                              {duration.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {savingDurationUserId === user.id ? 'Saving...' : 'Billing duration'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-600">-</span>
                    )}
                  </td>

                  {/* Plan Start Date */}
                  <td className="py-3.5 px-4 min-w-44">
                    {paidPlan ? (
                      <div className="flex flex-col gap-1">
                        <input
                          type="date"
                          value={planStartDate}
                          disabled={!onPlanDatesChange || savingDatesUserId === user.id}
                          onClick={openDatePicker}
                          onChange={event => handlePlanDateChange(user.id, planStartDate, planEndDate, 'start', event.target.value, user.subscriptionDuration)}
                          className="min-w-36 cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 outline-none transition-colors focus:border-emerald-500 disabled:cursor-wait disabled:opacity-60"
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {savingDatesUserId === user.id ? 'Saving...' : 'Start date'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-600">-</span>
                    )}
                  </td>

                  {/* Plan End Date */}
                  <td className="py-3.5 px-4 min-w-44">
                    {paidPlan ? (
                      <div className="flex flex-col gap-1">
                        <input
                          type="date"
                          value={planEndDate}
                          disabled={!onPlanDatesChange || savingDatesUserId === user.id}
                          onClick={openDatePicker}
                          onChange={event => handlePlanDateChange(user.id, planStartDate, planEndDate, 'end', event.target.value)}
                          className="min-w-36 cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 outline-none transition-colors focus:border-rose-500 disabled:cursor-wait disabled:opacity-60"
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {savingDatesUserId === user.id ? 'Saving...' : 'End date'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs font-semibold text-slate-600">-</span>
                    )}
                  </td>

                  {/* Clear Data */}
                  <td className="py-3.5 px-4 min-w-36">
                    <button
                      type="button"
                      disabled={!onResetUserData || resettingUserId === user.id}
                      onClick={() => handleResetUserData(user)}
                      className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                      title="Clear uploaded and created data for this user"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      {resettingUserId === user.id ? 'Clearing Data...' : 'Clear Data'}
                    </button>
                  </td>

                  {/* Delete User */}
                  <td className="py-3.5 px-4 min-w-36">
                    <button
                      type="button"
                      disabled={!onDeleteUser || deletingUserId === user.id || user.role === 'admin'}
                      onClick={() => handleDeleteUser(user)}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 transition-colors hover:border-rose-400 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                      title={user.role === 'admin' ? 'Super admin deletion is disabled' : 'Delete this user account permanently'}
                    >
                      <UserX className="h-3.5 w-3.5" />
                      {deletingUserId === user.id ? 'Deleting User...' : 'Delete User'}
                    </button>
                  </td>
                  
                  {/* Date Joined */}
                  <td className="py-3.5 px-4 min-w-40 text-xs whitespace-nowrap">
                    <div className="flex items-center space-x-1.5 text-slate-300 whitespace-nowrap">
                      <Calendar className="w-3.5 h-3.5 text-slate-600" />
                      <span>{regDate}</span>
                    </div>
                  </td>
                  
                  {/* Last Login */}
                  <td className="py-3.5 px-4 min-w-48 text-xs whitespace-nowrap">
                    <div className="flex items-center space-x-1.5 text-slate-300 whitespace-nowrap">
                      <Clock className="w-3.5 h-3.5 text-slate-600" />
                      <span className={user.lastLogin ? 'text-sky-400' : 'text-slate-500'}>{logTime}</span>
                    </div>
                  </td>

                  </tr>
                  {isEventsExpanded && (
                    <tr className="bg-slate-950/70">
                      <td colSpan={15} className="px-4 py-4">
                        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Events created by {user.name || user.email}
                            </p>
                            <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                              {usage.mainEventCount} main · {usage.subGalleryCount} sub
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {usage.mainEvents.map(event => {
                              const subExpandedKey = `${user.id}:${event.id}`;
                              const subGalleriesOpen = expandedSubGalleriesEventId === subExpandedKey;
                              return (
                              <div
                                key={event.id}
                                className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-3"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                      <p className="truncate text-sm font-bold text-white">
                                        {event.title || 'Untitled Event'}
                                      </p>
                                      <span className="shrink-0 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                                        {formatMediaSize(event.totalMediaBytes)}
                                      </span>
                                      {event.isSampleGallery && (
                                        <span className="shrink-0 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                                          Sample
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {formatDisplayDate(event.createdAt)}
                                    </p>
                                  </div>
                                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                  }`}>
                                    Main
                                  </span>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                                    ID: {event.id}
                                  </p>
                                  <div className="flex shrink-0 items-center gap-2">
                                    <button
                                      type="button"
                                      disabled={!onToggleSampleGallery || sampleUpdatingEventId === event.id}
                                      onClick={() => handleToggleSampleGallery(event)}
                                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors disabled:cursor-wait disabled:opacity-50 ${
                                        event.isSampleGallery
                                          ? 'border-amber-500/25 bg-amber-500/10 text-amber-300 hover:border-amber-400/60 hover:bg-amber-500/20'
                                          : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/60 hover:bg-emerald-500/20'
                                      }`}
                                      title={event.isSampleGallery ? 'Remove this event from Sample Galleries' : 'Add this event to Sample Galleries'}
                                    >
                                      <Star className={`h-3 w-3 ${event.isSampleGallery ? 'fill-current' : ''}`} />
                                      {sampleUpdatingEventId === event.id ? 'Saving' : event.isSampleGallery ? 'Remove Sample' : 'Add Sample'}
                                    </button>
                                    {event.subGalleries.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => setExpandedSubGalleriesEventId(subGalleriesOpen ? null : subExpandedKey)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-sky-500/20 bg-sky-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-300 transition-colors hover:border-sky-400/50 hover:text-sky-100"
                                      >
                                        {event.subGalleries.length} sub
                                        <ChevronDown className={`h-3 w-3 transition-transform ${subGalleriesOpen ? 'rotate-180' : ''}`} />
                                      </button>
                                    ) : (
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">
                                        No sub
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      disabled={!onDeleteEvent || deletingEventId === event.id}
                                      onClick={() => handleDeleteEvent(event)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/25 bg-rose-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-300 transition-colors hover:border-rose-400/60 hover:bg-rose-500/20 disabled:cursor-wait disabled:opacity-50"
                                      title="Delete this event and its uploaded data"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      {deletingEventId === event.id ? 'Deleting' : 'Delete'}
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-3 rounded-lg border border-emerald-500/10 bg-emerald-500/[0.04] px-3 py-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                                        <p className="truncate text-xs font-bold text-emerald-100">
                                          Home Section
                                        </p>
                                        <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                                          {formatMediaSize(event.mediaBytes)}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-[10px] text-slate-500">
                                        Primary gallery media
                                      </p>
                                    </div>
                                    <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                                      Home
                                    </span>
                                  </div>
                                </div>
                                {subGalleriesOpen && (
                                  <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                                    {event.subGalleries.map(subGallery => (
                                      <div
                                        key={subGallery.id}
                                        className="rounded-lg border border-sky-500/10 bg-sky-500/[0.04] px-3 py-2"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                              <p className="truncate text-xs font-bold text-sky-100">
                                                {subGallery.title || 'Untitled Sub-gallery'}
                                              </p>
                                              <span className="shrink-0 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-300">
                                                {formatMediaSize(subGallery.mediaBytes)}
                                              </span>
                                            </div>
                                            <p className="mt-1 text-[10px] text-slate-500">
                                              {formatDisplayDate(subGallery.createdAt)}
                                            </p>
                                          </div>
                                          <span className="shrink-0 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-300">
                                            Sub
                                          </span>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between gap-3">
                                          <p className="truncate text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                                            ID: {subGallery.id}
                                          </p>
                                          <button
                                            type="button"
                                            disabled={!onDeleteEvent || deletingEventId === subGallery.id}
                                            onClick={() => handleDeleteEvent(subGallery)}
                                            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-rose-300 transition-colors hover:border-rose-400/60 hover:bg-rose-500/20 disabled:cursor-wait disabled:opacity-50"
                                            title="Delete this sub-gallery and its uploaded data"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                            {deletingEventId === subGallery.id ? 'Deleting' : 'Delete'}
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={15} className="py-12 text-center text-slate-500 bg-slate-900/10">
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
  );
};

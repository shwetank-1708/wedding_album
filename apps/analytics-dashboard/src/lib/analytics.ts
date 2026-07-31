import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
  roleType?: string;
  delegatedBy?: string;
  subscriptionDuration?: string;
  planStartDate?: string;
  planEndDate?: string;
  assignedEvents?: string[];
  createdAt?: string;
  lastLogin?: string;
  profileImage?: string;
}

export interface GuestLog {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  eventId?: string;
  eventTitle?: string;
  loginAt?: string;
  status?: string;
  canAdmin?: boolean;
  canUpload?: boolean;
  canComment?: boolean;
  parentEventId?: string;
  parentEventOwnerId?: string;
}

export interface Event {
  id: string;
  title: string;
  createdAt?: string;
  createdById?: string;
  createdBy?: string;
  parentId?: string;
  type?: string;
  vendors?: string[];
  isSampleGallery?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  status?: string;
}

export interface DashboardStats {
  totalUsers: number;
  totalEvents: number;
  totalGuests: number;
  totalStorage: number;
  dau: number;
  mau: number;
  stickiness: number; // DAU/MAU ratio
  planBreakdown: { name: string; count: number; percentage: number; color: string }[];
  durationBreakdown: { name: string; count: number; percentage: number; color: string }[];
  storageBreakdown: { name: string; count: number; percentage: number; color: string }[];
  timeline: { date: string; registrations: number; logins: number }[];
  recentSignups: UserProfile[];
  recentLogins: { name: string; emailOrPhone: string; type: 'User' | 'Guest'; time: string }[];
}

export type ContactMessageStatus = 'new' | 'read' | 'replied' | 'closed';

export interface ContactMessage {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  message: string;
  source: 'web' | 'mobile';
  status: ContactMessageStatus;
  createdAt: string;
  readAt?: string;
}

export async function fetchUsers(): Promise<UserProfile[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, phone, role, role_type, delegated_by, subscription_duration, plan_start_date, plan_end_date, created_at, last_login, profile_image')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const users = (data || []).map(d => ({
      id: d.id,
      name: d.name || 'Anonymous',
      email: d.email || '',
      phone: d.phone || '',
      role: d.role || 'free',
      roleType: d.role_type || '',
      delegatedBy: d.delegated_by || '',
      subscriptionDuration: d.subscription_duration || '',
      planStartDate: d.plan_start_date || '',
      planEndDate: d.plan_end_date || '',
      createdAt: d.created_at,
      lastLogin: d.last_login,
      profileImage: d.profile_image || ''
    }));

    const { data: assignments } = await supabase
      .from('profile_assigned_events')
      .select('profile_id, event_id');

    const assignedByUser = new Map<string, string[]>();
    (assignments || []).forEach(row => {
      if (!row.profile_id || !row.event_id) return;
      const existing = assignedByUser.get(row.profile_id) || [];
      existing.push(row.event_id);
      assignedByUser.set(row.profile_id, existing);
    });

    return users.map(user => ({
      ...user,
      assignedEvents: assignedByUser.get(user.id) || []
    }));
  } catch (err) {
    console.error("Error fetching users:", err);
    return [];
  }
}

export async function fetchEvents(): Promise<Event[]> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, date, created_by, parent_id, type, vendors, is_sample_gallery')
      .order('date', { ascending: false });

    if (error) throw error;
    return (data || []).map(d => ({
      id: d.id,
      title: d.title || 'Untitled Event',
      createdAt: d.date,
      createdById: d.created_by || '',
      createdBy: d.created_by || '',
      parentId: d.parent_id || '',
      type: d.type || (d.parent_id ? 'sub' : 'main'),
      vendors: d.vendors || [],
      isSampleGallery: !!d.is_sample_gallery
    }));
  } catch (err) {
    console.error("Error fetching events:", err);
    return [];
  }
}

export async function fetchGuests(): Promise<GuestLog[]> {
  try {
    const { data, error } = await supabase
      .from('guests')
      .select('id, name, phone, event_id, parent_event_id, parent_event_owner_id, event_title, login_at, status, can_admin, can_upload, can_comment')
      .order('login_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(d => {
      let email = '';
      if (d.id && typeof d.id === 'string') {
        const candidate = d.id.split('_')[0];
        if (candidate.includes('@')) {
          email = candidate;
        }
      }

      return {
        id: d.id,
        name: d.name || 'Guest User',
        phone: d.phone || '',
        email: email,
        eventId: d.event_id,
        parentEventId: d.parent_event_id,
        parentEventOwnerId: d.parent_event_owner_id,
        eventTitle: d.event_title || '',
        loginAt: d.login_at,
        status: d.status,
        canAdmin: d.can_admin || false,
        canUpload: d.can_upload || false,
        canComment: d.can_comment || false
      };
    });
  } catch (err) {
    console.error("Error fetching guests:", err);
    return [];
  }
}

export interface Photo {
  id: string;
  eventId: string;
  size: number;
  mediaType: string;
  resourceType?: string;
  userId?: string;
}

export async function fetchPhotos(): Promise<Photo[]> {
  try {
    const pageSize = 1000;
    const rows: any[] = [];

    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('photos')
        .select('id, event_id, size, media_type, resource_type, user_id')
        .range(from, from + pageSize - 1);

      if (error) throw error;

      rows.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }

    return rows.map(d => ({
      id: d.id,
      eventId: d.event_id || '',
      size: Number(d.size) || 0,
      mediaType: d.media_type || 'photo',
      resourceType: d.resource_type || '',
      userId: d.user_id || ''
    }));
  } catch (err) {
    console.error("Error fetching photos:", err);
    return [];
  }
}

export async function fetchContactMessages(): Promise<ContactMessage[]> {
  try {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('id, first_name, last_name, email, message, source, status, created_at, read_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      email: row.email || '',
      message: row.message || '',
      source: row.source === 'mobile' ? 'mobile' : 'web',
      status: (row.status || 'new') as ContactMessageStatus,
      createdAt: row.created_at,
      readAt: row.read_at || '',
    }));
  } catch (err) {
    console.error('Error fetching contact messages:', err);
    return [];
  }
}

export async function updateContactMessageStatus(id: string, status: ContactMessageStatus) {
  const { error } = await supabase
    .from('contact_messages')
    .update({
      status,
      read_at: status === 'new' ? null : new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw error;
}

export function computeDashboardStats(
  users: UserProfile[],
  events: Event[],
  guests: GuestLog[],
  photos: Photo[]
): DashboardStats {
  const now = new Date();
  
  const parseDate = (d?: string) => {
    if (!d) return null;
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Compute DAU (Unique users active in last 24h)
  const activeIdsDAU = new Set<string>();
  users.forEach(u => {
    const login = parseDate(u.lastLogin);
    if (login && login >= oneDayAgo) {
      activeIdsDAU.add(u.email ? u.email.toLowerCase() : u.id);
    }
  });
  guests.forEach(g => {
    const login = parseDate(g.loginAt);
    if (login && login >= oneDayAgo) {
      activeIdsDAU.add(g.email ? g.email.toLowerCase() : (g.phone || g.id));
    }
  });
  const dau = activeIdsDAU.size;

  // Compute MAU (Unique users active in last 30d)
  const activeIdsMAU = new Set<string>();
  users.forEach(u => {
    const login = parseDate(u.lastLogin);
    if (login && login >= thirtyDaysAgo) {
      activeIdsMAU.add(u.email ? u.email.toLowerCase() : u.id);
    }
  });
  guests.forEach(g => {
    const login = parseDate(g.loginAt);
    if (login && login >= thirtyDaysAgo) {
      activeIdsMAU.add(g.email ? g.email.toLowerCase() : (g.phone || g.id));
    }
  });
  const mau = activeIdsMAU.size;

  const stickiness = mau > 0 ? parseFloat(((dau / mau) * 100).toFixed(1)) : 0;

  // Plans Breakdown
  const totalUsers = users.length;
  const plansMap = {
    ultimate: { name: 'Ultimate Plan', count: 0, color: 'bg-orange-500' },
    elite: { name: 'Elite Plan', count: 0, color: 'bg-amber-500' },
    pro: { name: 'Pro Plan', count: 0, color: 'bg-purple-500' },
    premium: { name: 'Premium Plan', count: 0, color: 'bg-indigo-500' },
    standard: { name: 'Standard Plan', count: 0, color: 'bg-sky-500' },
    basic: { name: 'Basic Plan', count: 0, color: 'bg-emerald-500' },
    starter: { name: 'Starter Plan', count: 0, color: 'bg-teal-500' },
    free: { name: 'Free Plan', count: 0, color: 'bg-slate-400' }
  };

  // Duration Breakdown
  const durationMap = {
    "1 Month": { name: "1 Month Plan", count: 0, color: "bg-indigo-500" },
    "3 Month": { name: "3 Month Plan", count: 0, color: "bg-sky-500" },
    "6 Month": { name: "6 Month Plan", count: 0, color: "bg-emerald-500" },
    "Yearly": { name: "Yearly Plan", count: 0, color: "bg-amber-500" }
  };

  // Storage Breakdown
  const storageMap = {
    "Free Plan": { name: "Free Plan (1 GB)", count: 0, color: "bg-slate-500" },
    "10 GB": { name: "10 GB Plan", count: 0, color: "bg-teal-500" },
    "25 GB": { name: "25 GB Plan", count: 0, color: "bg-emerald-500" },
    "50 GB": { name: "50 GB Plan", count: 0, color: "bg-sky-500" },
    "100 GB": { name: "100 GB Plan", count: 0, color: "bg-indigo-500" },
    "200 GB": { name: "200 GB Plan", count: 0, color: "bg-purple-500" },
    "500 GB": { name: "500 GB Plan", count: 0, color: "bg-purple-500" },
    "1 TB": { name: "1 TB Plan", count: 0, color: "bg-orange-500" }
  };

  const normalizeDuration = (value?: string) => {
    const normalized = String(value || '').toLowerCase().replace(/[\s-]+/g, '_');
    if (normalized === 'monthly' || normalized === '1_month') return '1 Month';
    if (normalized === 'quarterly' || normalized === '3_month' || normalized === '3_months') return '3 Month';
    if (normalized === 'half_yearly' || normalized === '6_month' || normalized === '6_months') return '6 Month';
    if (normalized === 'yearly' || normalized === 'annual') return 'Yearly';
    return '1 Month';
  };

  users.forEach(u => {
    const role = (u.role || 'free').toLowerCase();
    
    // Core Role breakdown
    if (role !== 'admin') {
      if (role in plansMap) {
        plansMap[role as keyof typeof plansMap].count++;
      } else {
        plansMap.free.count++;
      }
    }

    // Duration breakdown (only for paid users, excluding free and admin)
    if (role !== 'admin' && role !== 'free' && role !== 'user' && role !== 'freemium') {
      const duration = normalizeDuration(u.subscriptionDuration);
      durationMap[duration as keyof typeof durationMap].count++;
    }

    // Storage breakdown
    if (role === 'admin' || role === 'ultimate') {
      storageMap["1 TB"].count++;
    } else if (role === 'elite') {
      storageMap["500 GB"].count++;
    } else if (role === 'pro') {
      storageMap["200 GB"].count++;
    } else if (role === 'premium') {
      storageMap["100 GB"].count++;
    } else if (role === 'standard') {
      storageMap["50 GB"].count++;
    } else if (role === 'basic') {
      storageMap["25 GB"].count++;
    } else if (role === 'starter') {
      storageMap["10 GB"].count++;
    } else {
      storageMap["Free Plan"].count++;
    }
  });

  const planBreakdown = Object.values(plansMap).map(p => ({
    name: p.name,
    count: p.count,
    percentage: totalUsers > 0 ? parseFloat(((p.count / totalUsers) * 100).toFixed(1)) : 0,
    color: p.color
  }));

  const totalPaidUsers = Object.values(durationMap).reduce((sum, d) => sum + d.count, 0);

  const durationBreakdown = Object.values(durationMap).map(d => ({
    name: d.name,
    count: d.count,
    percentage: totalPaidUsers > 0 ? parseFloat(((d.count / totalPaidUsers) * 100).toFixed(1)) : 0,
    color: d.color
  }));

  const storageBreakdown = Object.values(storageMap).map(s => ({
    name: s.name,
    count: s.count,
    percentage: totalUsers > 0 ? parseFloat(((s.count / totalUsers) * 100).toFixed(1)) : 0,
    color: s.color
  }));

  // Timeline (Last 7 Days)
  const timeline = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - idx);
    const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

    const registrations = users.filter(u => {
      const reg = parseDate(u.createdAt);
      return reg && reg.getTime() >= startOfDay && reg.getTime() < endOfDay;
    }).length;

    const registeredLogins = users.filter(u => {
      const login = parseDate(u.lastLogin);
      return login && login.getTime() >= startOfDay && login.getTime() < endOfDay;
    }).length;

    const guestLogins = guests.filter(g => {
      const login = parseDate(g.loginAt);
      return login && login.getTime() >= startOfDay && login.getTime() < endOfDay;
    }).length;

    return {
      date: dateStr,
      registrations,
      logins: registeredLogins + guestLogins
    };
  }).reverse();

  // Recent Signups (Last 5 users)
  const recentSignups = [...users]
    .sort((a, b) => {
      const da = parseDate(a.createdAt)?.getTime() || 0;
      const db = parseDate(b.createdAt)?.getTime() || 0;
      return db - da;
    })
    .slice(0, 5);

  // Recent Logins (Last 5 guest logins or user logins)
  const loginsPool: { name: string; emailOrPhone: string; type: 'User' | 'Guest'; time: string; dateObj: Date }[] = [];
  
  users.forEach(u => {
    const login = parseDate(u.lastLogin);
    if (login) {
      loginsPool.push({
        name: u.name,
        emailOrPhone: u.email || 'No Email',
        type: 'User',
        time: login.toLocaleString(),
        dateObj: login
      });
    }
  });

  guests.forEach(g => {
    const login = parseDate(g.loginAt);
    if (login) {
      loginsPool.push({
        name: `${g.name} (Guest)`,
        emailOrPhone: g.email || g.phone || 'No Contact Info',
        type: 'Guest',
        time: login.toLocaleString(),
        dateObj: login
      });
    }
  });

  const recentLogins = loginsPool
    .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime())
    .slice(0, 5)
    .map(({ name, emailOrPhone, type, time }) => ({ name, emailOrPhone, type, time }));

  const totalStorage = photos.reduce((sum, p) => sum + (Number(p.size) || 0), 0);

  return {
    totalUsers,
    totalEvents: events.length,
    totalGuests: guests.length,
    totalStorage,
    dau,
    mau,
    stickiness,
    planBreakdown,
    durationBreakdown,
    storageBreakdown,
    timeline,
    recentSignups,
    recentLogins
  };
}

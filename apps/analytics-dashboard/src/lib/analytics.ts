import { supabase } from './supabase';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  username?: string;
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

export interface DeletedEventArchive {
  id: string;
  eventId: string;
  userId: string;
  eventTitle: string;
  photosCount: number;
  videosCount: number;
  totalBytes: number;
  estimatedModalCostInr: number;
  deletedAt: string;
  deletedBy?: string;
  eventCreatedAt?: string;
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
      .select('id, name, email, username, phone, role, role_type, delegated_by, subscription_duration, plan_start_date, plan_end_date, created_at, last_login, profile_image')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const users = (data || []).map(d => ({
      id: d.id,
      name: d.name || 'Anonymous',
      email: d.email || '',
      username: d.username || '',
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
    const pageSize = 1000;
    const allEvents: any[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, date, created_by, parent_id, type, vendors, is_sample_gallery')
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1);

      if (error) throw error;
      const batch = data || [];
      allEvents.push(...batch);
      if (batch.length < pageSize) break;
    }

    return allEvents.map(d => ({
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
  duration?: number;
  storageKey?: string;
  url?: string;
  format?: string;
  uploadedAt?: string;
  createdAt?: string;
}

let cachedWorkingPhotosSelect: string | null = null;

export async function fetchPhotos(): Promise<Photo[]> {
  try {
    const pageSize = 1000;
    const rows: any[] = [];

    // The photos table schema uses uploaded_at (not created_at) and does not have duration.
    const candidateColumns = [
      'id, event_id, size, media_type, resource_type, user_id, storage_key, url, format, uploaded_at',
      'id, event_id, size, media_type, resource_type, user_id, url, uploaded_at',
      'id, event_id, size, media_type, resource_type, user_id, url',
      'id, event_id, size, media_type, resource_type'
    ];

    let candidateIndex = cachedWorkingPhotosSelect
      ? Math.max(0, candidateColumns.indexOf(cachedWorkingPhotosSelect))
      : 0;

    for (let from = 0; ; from += pageSize) {
      let batch: any[] = [];
      let success = false;

      while (!success && candidateIndex < candidateColumns.length) {
        const selectCols = candidateColumns[candidateIndex];
        const res = await supabase
          .from('photos')
          .select(selectCols)
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);

        if (!res.error && res.data) {
          batch = res.data;
          success = true;
          cachedWorkingPhotosSelect = selectCols;
        } else {
          // If error was due to missing column (e.g. code 42703), step to next candidate and retry
          candidateIndex++;
        }
      }

      if (!success) {
        console.warn('Could not fetch photos with any candidate column selection');
        break;
      }

      rows.push(...batch);
      if (batch.length < pageSize) break;
    }

    return rows.map(d => {
      const rawMediaType = String(d.media_type || '').toLowerCase();
      const rawResourceType = String(d.resource_type || '').toLowerCase();
      const rawFormat = String(d.format || '').toLowerCase();
      const rawPath = String(d.storage_key || d.url || '').toLowerCase();
      const hasDuration = d.duration != null && Number(d.duration) > 0;
      const isVideoByExtension = 
        ['mp4', 'mov', 'webm', 'mkv', 'm4v', 'avi'].includes(rawFormat) ||
        /\.(mp4|mov|webm|mkv|m4v|avi)(\?.*)?$/i.test(rawPath);

      const isVid = 
        rawMediaType === 'video' ||
        rawResourceType === 'video' ||
        hasDuration ||
        isVideoByExtension;

      return {
        id: d.id,
        eventId: d.event_id || '',
        size: Number(d.size) || 0,
        mediaType: isVid ? 'video' : (d.media_type || 'photo'),
        resourceType: isVid ? 'video' : (d.resource_type || ''),
        userId: d.user_id || '',
        duration: d.duration != null ? Number(d.duration) : undefined,
        storageKey: d.storage_key,
        url: d.url,
        format: d.format,
        uploadedAt: d.uploaded_at || d.created_at || undefined,
        createdAt: d.created_at || d.uploaded_at || undefined,
      };
    });
  } catch (err) {
    console.error("Error fetching photos:", err);
    return [];
  }
}

export async function fetchDeletedEvents(): Promise<DeletedEventArchive[]> {
  try {
    const { data, error } = await supabase
      .from('deleted_events_archive')
      .select('*')
      .order('deleted_at', { ascending: false });

    if (error) {
      console.warn('Could not fetch deleted_events_archive (table may be pending migration):', error.message);
      return [];
    }

    return (data || []).map(d => ({
      id: d.id,
      eventId: d.event_id,
      userId: d.user_id,
      eventTitle: d.event_title || 'Untitled Gallery',
      photosCount: Number(d.photos_count) || 0,
      videosCount: Number(d.videos_count) || 0,
      totalBytes: Number(d.total_bytes) || 0,
      estimatedModalCostInr: Number(d.estimated_modal_cost_inr) || 0,
      deletedAt: d.deleted_at,
      deletedBy: d.deleted_by || 'admin',
      eventCreatedAt: d.event_created_at || undefined,
    }));
  } catch (err) {
    console.warn('Failed to fetch deleted events archive:', err);
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

function toDateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDurationToDate(startDateStr: string, durationStr: string): string {
  const dt = new Date(`${startDateStr}T00:00:00.000Z`);
  if (isNaN(dt.getTime())) return '';
  const d = (durationStr || 'monthly').toLowerCase();
  let months = 1;
  if (d === 'quarterly' || d === '3_months' || d === '3_month') months = 3;
  else if (d === 'half_yearly' || d === '6_months' || d === '6_month') months = 6;
  else if (d === 'yearly' || d === 'annual') months = 12;
  dt.setUTCMonth(dt.getUTCMonth() + months);
  return dt.toISOString().slice(0, 10);
}

export function isProtectedSuperAdmin(user?: { email?: string; username?: string; id?: string; name?: string } | null): boolean {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();

  const protectedEmails = [
    'code4sarthak@gmail.com',
    'shwetank.chauhan17@gmail.com',
  ];

  return protectedEmails.includes(email);
}

export async function directPromoteSuperAdmin(userId: string) {
  if (!userId) throw new Error('User ID is required.');

  const { error } = await supabase
    .from('profiles')
    .update({
      role: 'admin',
      delegated_by: null,
      role_type: 'primary',
      plan_start_date: null,
      plan_end_date: null,
    })
    .eq('id', userId);

  if (error) throw error;

  await supabase
    .from('profile_assigned_events')
    .delete()
    .eq('profile_id', userId);
}

export async function directRevokeSuperAdmin(userId: string, currentAdminId?: string) {
  if (!userId) throw new Error('User ID is required.');
  if (currentAdminId && userId === currentAdminId) {
    throw new Error('You cannot revoke your own Super Admin access.');
  }

  // Guard against revoking protected accounts
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, username')
    .eq('id', userId)
    .maybeSingle();

  if (profile && isProtectedSuperAdmin(profile)) {
    throw new Error('This Super Admin account is permanently protected and cannot be removed.');
  }

  const { count, error: countError } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')
    .is('delegated_by', null);

  if (!countError && (count ?? 0) <= 1) {
    throw new Error('At least one Super Admin must remain in the system.');
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      role: 'free',
      delegated_by: null,
      role_type: 'primary',
      subscription_duration: 'monthly',
      plan_start_date: null,
      plan_end_date: null,
    })
    .eq('id', userId);

  if (error) throw error;

  await supabase
    .from('profile_assigned_events')
    .delete()
    .eq('profile_id', userId);
}

export async function directUpdateUserRole(
  userId: string,
  role: string,
  payload?: { delegatedBy?: string; roleType?: string; assignedEvents?: string[] }
) {
  if (!userId) throw new Error('User ID is required.');

  if (role !== 'admin') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, username')
      .eq('id', userId)
      .maybeSingle();

    if (profile && isProtectedSuperAdmin(profile)) {
      throw new Error('This Super Admin account is permanently protected and cannot be demoted.');
    }
  }

  const cleanRole = role.toLowerCase();
  const isPaidRole = cleanRole !== 'admin' && cleanRole !== 'free' && cleanRole !== 'user' && cleanRole !== 'freemium';

  const updateData: Record<string, any> = {
    role,
  };

  if (isPaidRole) {
    const today = toDateOnly(new Date());
    updateData.subscription_duration = 'monthly';
    updateData.plan_start_date = today;
    updateData.plan_end_date = addDurationToDate(today, 'monthly');
  } else {
    updateData.plan_start_date = null;
    updateData.plan_end_date = null;
  }

  if (payload?.delegatedBy) {
    updateData.delegated_by = payload.delegatedBy;
    updateData.role_type = payload.roleType || 'primary';
  } else {
    updateData.delegated_by = null;
    updateData.role_type = null;
  }

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId);

  if (error) throw error;

  await supabase
    .from('profile_assigned_events')
    .delete()
    .eq('profile_id', userId);

  if (payload?.delegatedBy && payload?.roleType === 'event' && payload?.assignedEvents?.length) {
    await supabase
      .from('profile_assigned_events')
      .insert(payload.assignedEvents.map(eventId => ({ profile_id: userId, event_id: eventId })));
  }
}

export async function directUpdateUserDuration(userId: string, duration: string) {
  if (!userId) throw new Error('User ID is required.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, plan_start_date')
    .eq('id', userId)
    .maybeSingle();

  const updateData: Record<string, string> = { subscription_duration: duration };
  const cleanRole = (profile?.role || '').toLowerCase();
  const isPaidRole = cleanRole !== 'admin' && cleanRole !== 'free' && cleanRole !== 'user' && cleanRole !== 'freemium';

  if (isPaidRole) {
    const startDate = profile?.plan_start_date || toDateOnly(new Date());
    updateData.plan_start_date = startDate;
    updateData.plan_end_date = addDurationToDate(startDate, duration);
  }

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId);

  if (error) throw error;
}

export async function directUpdateUserPlanDates(userId: string, planStartDate: string, planEndDate: string) {
  if (!userId) throw new Error('User ID is required.');

  const { error } = await supabase
    .from('profiles')
    .update({
      plan_start_date: planStartDate || null,
      plan_end_date: planEndDate || null,
    })
    .eq('id', userId);

  if (error) throw error;
}

export async function directDeleteGuest(guestId: string) {
  if (!guestId) throw new Error('Guest ID is required.');
  const { error } = await supabase.from('guests').delete().eq('id', guestId);
  if (error) throw error;
}

export async function directToggleSampleGallery(eventId: string, isSampleGallery: boolean) {
  if (!eventId) throw new Error('Event ID is required.');
  const { error } = await supabase
    .from('events')
    .update({ is_sample_gallery: isSampleGallery })
    .eq('id', eventId);
  if (error) throw error;
}

export async function directDeleteEvent(eventId: string) {
  if (!eventId) throw new Error('Event ID is required.');

  // Delete sub-events recursively
  const { data: children } = await supabase
    .from('events')
    .select('id')
    .eq('parent_id', eventId);

  for (const child of children || []) {
    await directDeleteEvent(child.id);
  }

  // Fetch event metadata before deletion
  const { data: eventData } = await supabase
    .from('events')
    .select('id, title, created_by')
    .eq('id', eventId)
    .maybeSingle();

  // Delete related photos, faces, likes, comments
  const { data: photos } = await supabase
    .from('photos')
    .select('id, size, media_type, resource_type, user_id')
    .eq('event_id', eventId);

  const photoRows = photos || [];
  const photoIds = photoRows.map(p => p.id);

  const imageCount = photoRows.filter(p => (p.media_type || p.resource_type) !== 'video').length;
  const videoCount = photoRows.filter(p => (p.media_type || p.resource_type) === 'video').length;
  const totalBytes = photoRows.reduce((sum, p) => sum + (Number(p.size) || 0), 0);
  const userId = eventData?.created_by || photoRows[0]?.user_id || 'unknown';

  // Fetch actual per-second compute cost logged in modal_cost_logs
  const { data: eventLogs } = await supabase
    .from('modal_cost_logs')
    .select('execution_time_seconds, estimated_cost_inr, cpu_cores, memory_gb, gpu_type')
    .eq('event_id', eventId);

  let actualModalCost = 0;
  if (eventLogs && eventLogs.length > 0) {
    actualModalCost = eventLogs.reduce((sum, log) => {
      if (typeof log.estimated_cost_inr === 'number' && !isNaN(log.estimated_cost_inr)) {
        return sum + log.estimated_cost_inr;
      }
      const dur = Number(log.execution_time_seconds) || 0;
      const cpu = Number(log.cpu_cores) || 1.0;
      const mem = Number(log.memory_gb) || 1.0;
      const gpuRate = log.gpu_type === 'l4' ? 0.0222 : 0;
      return sum + (dur * ((cpu * 0.00131) + (mem * 0.000222) + gpuRate));
    }, 0);
  } else {
    actualModalCost = (imageCount * 0.0082) + (videoCount * 0.35);
  }

  // Snapshot into deleted_events_archive so compute cost is permanently retained
  if (eventData) {
    try {
      await supabase.from('deleted_events_archive').insert({
        event_id: eventId,
        user_id: userId,
        event_title: eventData.title || 'Untitled Gallery',
        photos_count: imageCount,
        videos_count: videoCount,
        total_bytes: totalBytes,
        estimated_modal_cost_inr: actualModalCost,
        deleted_by: 'admin_dashboard',
      });
    } catch (archiveErr) {
      console.warn('Could not archive deleted event:', archiveErr);
    }
  }

  // Stamp user_id onto modal_cost_logs for this event if missing
  try {
    await supabase
      .from('modal_cost_logs')
      .update({ user_id: userId })
      .eq('event_id', eventId)
      .is('user_id', null);
  } catch (logErr) {
    console.warn('Could not update modal_cost_logs user_id:', logErr);
  }

  if (photoIds.length > 0) {
    for (let i = 0; i < photoIds.length; i += 50) {
      const chunk = photoIds.slice(i, i + 50);
      await supabase.from('faces').delete().in('image_id', chunk);
      await supabase.from('likes').delete().in('photo_id', chunk);
      await supabase.from('comments').delete().in('photo_id', chunk);
    }
  }

  await supabase.from('photos').delete().eq('event_id', eventId);
  await supabase.from('profile_assigned_events').delete().eq('event_id', eventId);
  await supabase.from('guests').delete().or(`event_id.eq.${eventId},parent_event_id.eq.${eventId}`);
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw error;
}

export async function directResetUserData(userId: string) {
  if (!userId) throw new Error('User ID is required.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, phone, role, username')
    .eq('id', userId)
    .maybeSingle();

  if (profile && isProtectedSuperAdmin(profile)) {
    throw new Error('This Super Admin account is permanently protected and cannot be reset.');
  }

  const identifiers = [userId, profile?.email, profile?.phone].filter(Boolean) as string[];
  const { data: events } = await supabase
    .from('events')
    .select('id')
    .in('created_by', identifiers);

  for (const ev of events || []) {
    await directDeleteEvent(ev.id);
  }

  const { data: userPhotos } = await supabase
    .from('photos')
    .select('id')
    .in('user_id', identifiers);

  const userPhotoIds = (userPhotos || []).map(p => p.id);
  if (userPhotoIds.length > 0) {
    for (let i = 0; i < userPhotoIds.length; i += 50) {
      const chunk = userPhotoIds.slice(i, i + 50);
      await supabase.from('faces').delete().in('image_id', chunk);
      await supabase.from('likes').delete().in('photo_id', chunk);
      await supabase.from('comments').delete().in('photo_id', chunk);
      await supabase.from('photos').delete().in('id', chunk);
    }
  }

  await supabase.from('profile_assigned_events').delete().eq('profile_id', userId);
}

export async function directDeleteUser(userId: string) {
  if (!userId) throw new Error('User ID is required.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, username')
    .eq('id', userId)
    .maybeSingle();

  if (profile && isProtectedSuperAdmin(profile)) {
    throw new Error('This Super Admin account is permanently protected and cannot be deleted.');
  }

  await directResetUserData(userId);

  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  if (error) throw error;
}

export async function directUpdatePricingPlans(plans: any[]) {
  if (!plans || plans.length === 0) {
    throw new Error('At least one pricing plan is required.');
  }

  const rows = plans.map((plan, index) => ({
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline || '',
    badge: plan.badge || null,
    price_monthly: Number(plan.priceMonthly ?? plan.price_monthly ?? 0),
    price_annual: Number(plan.priceAnnual ?? plan.price_annual ?? 0),
    storage_limit_gb: Number(plan.storageLimitGb ?? plan.storage_limit_gb ?? 0),
    features: Array.isArray(plan.features) ? plan.features : [],
    display_order: Number(plan.displayOrder ?? plan.display_order ?? index + 1),
    is_active: plan.isActive !== undefined ? Boolean(plan.isActive) : true,
    is_highlighted: plan.isHighlighted !== undefined ? Boolean(plan.isHighlighted) : false,
    cta_text: plan.ctaText || 'Get Started',
    cta_link: plan.ctaLink || '/signup',
  }));

  const { error } = await supabase
    .from('pricing_plans')
    .upsert(rows, { onConflict: 'id' });

  if (error) throw error;
  return { success: true, count: rows.length };
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

export interface ModalCostLogRow {
  id?: string;
  event_id?: string;
  user_id?: string;
  function_name?: string;
  execution_time_seconds?: number;
  cpu_cores?: number;
  memory_gb?: number;
  gpu_type?: string;
  estimated_cost_inr?: number;
  media_type?: string;
  worker_type?: string;
  created_at?: string;
}

export interface UserEveBashCostMetrics {
  b2MonthlyInr: number;
  b2YearlyInr: number;
  b2CostTillNowInr: number;
  b2MonthlyUsd?: number;
  modalPhotoInr: number;
  modalBatchInr?: number;
  modalVideoCpuInr: number;
  modalVideoGpuInr: number;
  modalVideoInr: number;
  modalSelfieInr: number;
  modalTotalInr: number;
  modalTotalUsd?: number;
  qstashInr: number;
  supabaseMonthlyInr: number;
  supabaseYearlyInr: number;
  supabaseCostTillNowInr: number;
  totalMonthlyCostInr: number;
  totalLifetimeCostInr: number;
  totalLifetimeCostUsd?: number;
  totalCostTillNowInr: number;
  monthsActive: number;
}

export async function fetchAllModalCostLogs(): Promise<ModalCostLogRow[]> {
  try {
    let allLogs: ModalCostLogRow[] = [];
    let from = 0;
    const batchSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('modal_cost_logs')
        .select('id, event_id, user_id, execution_time_seconds, estimated_cost_inr, cpu_cores, memory_gb, gpu_type, function_name, media_type, worker_type, created_at')
        .range(from, from + batchSize - 1);

      if (error || !data || data.length === 0) break;
      allLogs = allLogs.concat(data);
      if (data.length < batchSize || allLogs.length >= 20000) break;
      from += batchSize;
    }
    return allLogs;
  } catch (err) {
    console.warn('Failed to fetch modal cost logs:', err);
    return [];
  }
}

export function computeUserEveBashCost({
  imageCount,
  videoCount,
  totalBytes,
  modalLogs = [],
  deletedEvents = [],
  userCreatedAt,
  usdToInrRate = 100,
}: {
  imageCount: number;
  videoCount: number;
  totalBytes: number;
  modalLogs?: ModalCostLogRow[];
  deletedEvents?: DeletedEventArchive[];
  userCreatedAt?: string;
  usdToInrRate?: number;
}): UserEveBashCostMetrics {
  const rate = (typeof usdToInrRate === 'number' && usdToInrRate > 0) ? usdToInrRate : 100;

  let totalPhotoActualInr = 0;
  let totalPhotoSeconds = 0;
  let totalPhotoRuns = 0;

  let totalBatchActualInr = 0;
  let totalBatchSeconds = 0;
  let totalBatchRuns = 0;

  let totalVideoCpuActualInr = 0;
  let totalVideoCpuSeconds = 0;
  let totalVideoCpuRuns = 0;

  let totalVideoGpuActualInr = 0;
  let totalVideoGpuSeconds = 0;
  let totalVideoGpuRuns = 0;

  let totalSelfieActualInr = 0;
  let totalSelfieSeconds = 0;
  let totalSelfieRuns = 0;

  modalLogs.forEach(log => {
    const dur = Number(log.execution_time_seconds) || 0;
    const cpu = Number(log.cpu_cores) || 1.0;
    const mem = Number(log.memory_gb) || 1.0;
    const gpuType = log.gpu_type || 'None';
    const gpuRate = (gpuType === 'l4' || log.function_name === 'process_video_gpu') ? 0.0222 : 0;

    // Exact per-second compute rate from COST_ANALYSIS.md ($1 = ₹100 benchmark):
    // CPU: $0.0000131/vCPU/s
    // RAM: $0.00000222/GB/s
    // L4 GPU: $0.000222/s
    const calculatedCostUsd = dur * ((cpu * 0.0000131) + (mem * 0.00000222) + (gpuRate / 100));
    const calculatedCost = calculatedCostUsd * rate;
    const cost = (typeof log.estimated_cost_inr === 'number' && !isNaN(log.estimated_cost_inr) && log.estimated_cost_inr > 0)
      ? (rate === 100 ? log.estimated_cost_inr : (log.estimated_cost_inr / 100) * rate)
      : calculatedCost;

    const fn = log.function_name || 'process_single_photo';

    if (fn === 'process_single_photo') {
      totalPhotoActualInr += cost;
      totalPhotoSeconds += dur;
      totalPhotoRuns += 1;
    } else if (fn === 'process_media_batch' || fn.includes('batch')) {
      totalBatchActualInr += cost;
      totalBatchSeconds += dur;
      totalBatchRuns += 1;
    } else if (fn === 'process_video_gpu' || gpuType === 'l4') {
      totalVideoGpuActualInr += cost;
      totalVideoGpuSeconds += dur;
      totalVideoGpuRuns += 1;
    } else if (fn.startsWith('process_video')) {
      totalVideoCpuActualInr += cost;
      totalVideoCpuSeconds += dur;
      totalVideoCpuRuns += 1;
    } else if (fn === 'find_matching_photos') {
      totalSelfieActualInr += cost;
      totalSelfieSeconds += dur;
      totalSelfieRuns += 1;
    }
  });

  const totalVideoActualInr = totalVideoCpuActualInr + totalVideoGpuActualInr;
  const totalVideoRuns = totalVideoCpuRuns + totalVideoGpuRuns;

  const activePhotos = imageCount;
  const activeVideos = videoCount;

  // Remaining unlogged media gets added at observed user average (or COST_ANALYSIS benchmark if 0 runs)
  const avgObservedPhotoCost = totalPhotoRuns > 0 ? (totalPhotoActualInr / totalPhotoRuns) : (0.000082 * rate);
  const avgObservedVideoCost = totalVideoRuns > 0 ? (totalVideoActualInr / totalVideoRuns) : (0.0035 * rate);

  const deletedArchivePhotoCount = deletedEvents.reduce((s, d) => s + (Number(d.photosCount) || 0), 0);
  const deletedArchiveVideoCount = deletedEvents.reduce((s, d) => s + (Number(d.videosCount) || 0), 0);

  const lifetimePhotosCount = Math.max(activePhotos + deletedArchivePhotoCount, totalPhotoRuns);
  const lifetimeVideosCount = Math.max(activeVideos + deletedArchiveVideoCount, totalVideoRuns);

  const unloggedPhotos = Math.max(0, lifetimePhotosCount - totalPhotoRuns);
  const unloggedVideos = Math.max(0, lifetimeVideosCount - totalVideoRuns);

  const effectivePhotoInr = totalPhotoActualInr + totalBatchActualInr + (unloggedPhotos * avgObservedPhotoCost);
  const effectiveVideoCpuInr = totalVideoCpuActualInr + (unloggedVideos * avgObservedVideoCost);
  const effectiveVideoGpuInr = totalVideoGpuActualInr;
  const effectiveVideoInr = effectiveVideoCpuInr + effectiveVideoGpuInr;
  const effectiveSelfieInr = totalSelfieActualInr;

  const modalTotalInr = effectivePhotoInr + effectiveVideoInr + effectiveSelfieInr;
  const totalLifetimeMedia = lifetimePhotosCount + lifetimeVideosCount;

  // Calculate duration user has been registered (in fractional months)
  let monthsActive = 1;
  if (userCreatedAt) {
    const createdTime = new Date(userCreatedAt).getTime();
    if (!isNaN(createdTime) && createdTime > 0) {
      const now = Date.now();
      const diffDays = Math.max(0, (now - createdTime) / (1000 * 60 * 60 * 24));
      monthsActive = Math.max(0.01, diffDays / 30.4375);
    }
  }

  // 1. Backblaze B2 Storage (State-Based / Monthly Recurring):
  // Rate: $0.006 / GB / month
  const usedGb = totalBytes / (1024 * 1024 * 1024);
  const b2MonthlyUsd = usedGb * 0.006;
  const b2MonthlyInr = b2MonthlyUsd * rate;
  const b2YearlyInr = b2MonthlyInr * 12;
  const b2CostTillNowInr = b2MonthlyInr * monthsActive;

  // 2. Upstash QStash (Historical Queue Ingestion):
  // Rate: $1.00 / 100,000 messages (~$0.00001 / photo or video message dispatched)
  const qstashInr = totalLifetimeMedia * 0.00001 * rate;

  // 3. Supabase DB: Metadata & Auth share (~$0.00003 / active media row)
  const totalActiveMedia = activePhotos + activeVideos;
  const supabaseMonthlyInr = totalActiveMedia > 0 ? Math.max(0.5, totalActiveMedia * 0.00003 * rate) : 0;
  const supabaseYearlyInr = supabaseMonthlyInr * 12;
  const supabaseCostTillNowInr = supabaseMonthlyInr * monthsActive;

  // Total Monthly Cost to EveBash (Active recurring only: B2 Storage + Supabase)
  const totalMonthlyCostInr = b2MonthlyInr + supabaseMonthlyInr;

  // Cumulative Cost to EveBash ENDURED TILL NOW (Historical compute + actual storage endured to date)
  const totalCostTillNowInr = modalTotalInr + qstashInr + b2CostTillNowInr + supabaseCostTillNowInr;
  const totalLifetimeCostInr = totalCostTillNowInr;

  return {
    b2MonthlyInr,
    b2YearlyInr,
    b2CostTillNowInr,
    b2MonthlyUsd,
    modalPhotoInr: effectivePhotoInr,
    modalBatchInr: totalBatchActualInr,
    modalVideoCpuInr: effectiveVideoCpuInr,
    modalVideoGpuInr: effectiveVideoGpuInr,
    modalVideoInr: effectiveVideoInr,
    modalSelfieInr: effectiveSelfieInr,
    modalTotalInr,
    modalTotalUsd: modalTotalInr / rate,
    qstashInr,
    supabaseMonthlyInr,
    supabaseYearlyInr,
    supabaseCostTillNowInr,
    totalMonthlyCostInr,
    totalLifetimeCostInr,
    totalLifetimeCostUsd: totalLifetimeCostInr / rate,
    totalCostTillNowInr,
    monthsActive,
  };
}

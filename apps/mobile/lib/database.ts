import { supabase } from "./supabase";
import { sendPushNotificationDirectly } from "./notifications";
import { DEFAULT_EVENT_COVER_IMAGE } from "./eventCovers";

const COVER_USAGE_TAG = "__cover_usage__";
const BUSINESS_PORTFOLIO_EVENTS_KEY = "__portfolio_events__";
const PLAN_EXPIRY_GRACE_DAYS = 7;
const FREE_PLAN_STORAGE_BYTES = 1024 * 1024 * 1024;
let photoInteractionChannelCounter = 0;

export function formatEventDate(dateStr?: string): string {
    if (!dateStr) return "";

    try {
        // If it's already a nicely formatted verbal date (e.g. contains month name and a year),
        // we can return it directly to preserve user's custom formatting.
        const isVerbal = /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(dateStr) && !dateStr.includes("T");
        if (isVerbal) {
            return dateStr;
        }

        let dateObj: Date;
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
            // Standard YYYY-MM-DD. Replace dashes with slashes to force local time parsing
            // to avoid timezone offset shifts.
            dateObj = new Date(dateStr.replace(/-/g, "/"));
        } else {
            dateObj = new Date(dateStr);
        }

        if (isNaN(dateObj.getTime())) {
            return dateStr;
        }

        return dateObj.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    } catch (e) {
        return dateStr;
    }
}

export const generateShortId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `WA-${result}`;
};

export interface Event {
    id: string;
    title: string;
    date: string;
    coverImage: string;
    description: string;
    createdBy?: string;
    type?: 'main' | 'sub';
    parentId?: string;
    legacyId?: string;
    joinId?: string;
    category?: string;
    templateId?: string;
    vendors?: string[];
    createdAt?: any;
    coverOffset?: number;
    coverOffsetX?: number;
    coverScale?: number;
    coverMode?: 'fit' | 'fill';
    order?: number;
    titleAlign?: 'left' | 'center' | 'right';
    hostName?: string;
    showWelcomeCard?: boolean;
}

export interface Photo {
    id: string;
    eventId: string;
    storageKey: string;
    url: string;
    mediaType?: 'photo' | 'video';
    resourceType?: 'image' | 'video' | string;
    uploadedAt: any;
    userId?: string;
    width?: number;
    height?: number;
    size?: number;
    format?: string;
    order?: number;
    thumbnailUrl?: string;
    tags?: string[];
}

export interface Business {
    id: string;
    name: string;
    ownerName: string;
    ownerEmail: string;
    ownerPhone: string;
    type: string;
    tags: string[];
    location: {
        latitude: number;
        longitude: number;
        address?: string;
    };
    rating: number;
    coverImage: string;
    coverImages?: string[];
    createdBy: string;
    admins?: string[];
    allowedUsers?: string[];
    description?: string;
    experience?: number;
    startedDate?: any;
    eventsHosted?: number;
    services?: string[];
    faqs?: { q: string; a: string }[];
    portfolioEvents?: BusinessPortfolioEvent[];
    status: 'created' | 'published';
    shortId?: string;
    vendorCode?: string;
    announcements?: string[];
    createdAt?: any;
    profileViews?: number;
    viewsByDate?: Record<string, number>;
    shortlistCount?: number;
}

export interface BusinessPortfolioEvent {
    id: string;
    name: string;
    type: string;
    date: string;
    coverImage?: string;
    coverOffset?: number;
    coverOffsetX?: number;
    coverScale?: number;
    coverMode?: 'fit' | 'fill';
    media?: BusinessPortfolioMedia[];
    templateId?: string;
    createdAt?: any;
}

export interface BusinessPortfolioMedia {
    id: string;
    url: string;
    type?: 'image' | 'video';
    createdAt?: any;
}

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role?: string;
    roleType?: 'primary' | 'event';
    delegatedBy?: string;
    assignedEvents?: string[];
    profileImage?: string;
    username?: string;
    isPrivate?: boolean;
    createdAt?: any;
    location?: string;
    gender?: string;
    relationshipStatus?: string;
    persona?: string | string[];
    discoverable?: boolean;
    notificationPreferences?: any;
    birthday?: string;
    anniversaryDate?: string;
    subscriptionDuration?: string;
    planStartDate?: string;
    planEndDate?: string;
    pushToken?: string;
}

const USER_PROFILE_COLUMN_MAP: Record<keyof Partial<UserProfile>, string> = {
    id: "id",
    name: "name",
    email: "email",
    phone: "phone",
    role: "role",
    roleType: "role_type",
    delegatedBy: "delegated_by",
    assignedEvents: "assigned_events",
    profileImage: "profile_image",
    username: "username",
    isPrivate: "is_private",
    createdAt: "created_at",
    location: "location",
    gender: "gender",
    relationshipStatus: "relationship_status",
    persona: "persona",
    discoverable: "discoverable",
    notificationPreferences: "notification_preferences",
    birthday: "birthday",
    anniversaryDate: "anniversary_date",
    subscriptionDuration: "subscription_duration",
    planStartDate: "plan_start_date",
    planEndDate: "plan_end_date",
    pushToken: "push_token",
};

function formatSupabaseError(error: unknown) {
    if (error && typeof error === "object") {
        const supabaseError = error as { message?: string; details?: string; hint?: string; code?: string };
        return {
            message: supabaseError.message,
            details: supabaseError.details,
            hint: supabaseError.hint,
            code: supabaseError.code,
        };
    }
    return error;
}

export interface GuestLog {
    id: string;
    name: string;
    phone: string;
    email?: string;
    eventId: string;
    parentEventId?: string;
    eventTitle?: string;
    parentEventOwnerId?: string;
    loginAt: any;
    status: 'pending' | 'approved' | 'rejected';
    canAdmin?: boolean;
    canUpload?: boolean;
    canComment?: boolean;
}

export interface Enquiry {
    id?: string;
    businessId: string;
    businessName: string;
    name: string;
    date: string;
    message: string;
    phone?: string;
    email?: string;
    userId?: string | null;
    vendorOwnerId: string;
    vendorOwnerEmail: string;
    preferredContact?: 'chat' | 'whatsapp' | 'call' | 'email';
    city?: string;
    createdAt?: any;
    status?: 'active' | 'ended';
    category?: string;
}

export interface ChatRoom {
  id?: string;
  clientUid: string;
  clientName: string;
  clientAvatar?: string;
  vendorUid: string;
  vendorName: string; // Business name
  businessId: string;
  lastMessage?: string;
  lastMessageAt?: any;
  createdAt: any;
  status?: 'active' | 'closed';
  enquiryId?: string;
  clientDeleted?: boolean;
  vendorDeleted?: boolean;
}

export interface ChatMessage {
  id?: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
}

// --- Helper mapping functions ---

function mapSqlToEvent(e: any): Event {
    return {
        id: e.id,
        title: e.title,
        date: formatEventDate(e.date),
        coverImage: e.cover_image,
        description: e.description,
        createdBy: e.created_by,
        type: e.type,
        parentId: e.parent_id,
        legacyId: e.legacy_id,
        category: e.category,
        templateId: e.template_id,
        joinId: e.join_id,
        order: e.order,
        showWelcomeCard: e.show_welcome_card,
        coverOffset: e.cover_offset,
        coverOffsetX: e.cover_offset_x,
        coverScale: e.cover_scale,
        coverMode: e.cover_mode,
        titleAlign: e.title_align,
        vendors: e.vendors || [],
        hostName: e.host_name
    };
}

function mapSqlToPhoto(p: any): Photo {
    return {
        id: p.id,
        eventId: p.event_id,
        storageKey: p.storage_key,
        url: p.url,
        mediaType: p.media_type,
        resourceType: p.resource_type,
        uploadedAt: p.uploaded_at,
        userId: p.user_id,
        width: p.width,
        height: p.height,
        size: p.size,
        format: p.format,
        order: p.order,
        thumbnailUrl: p.thumbnail_url,
        tags: p.tags || []
    };
}

function isCoverUsagePhoto(photo: Photo): boolean {
    return Boolean(photo.tags?.includes(COVER_USAGE_TAG));
}

function isPaidPlanRole(role?: string | null): boolean {
    const cleanRole = String(role || "free").toLowerCase();
    return cleanRole !== "admin" && cleanRole !== "free" && cleanRole !== "user" && cleanRole !== "freemium";
}

function isBeyondPlanGracePeriod(profile?: { role?: string | null; plan_end_date?: string | null } | null): boolean {
    if (!profile || !isPaidPlanRole(profile.role) || !profile.plan_end_date) return false;

    const endDate = new Date(`${profile.plan_end_date}T23:59:59.999Z`);
    if (Number.isNaN(endDate.getTime())) return false;

    const graceEndsAt = new Date(endDate);
    graceEndsAt.setUTCDate(graceEndsAt.getUTCDate() + PLAN_EXPIRY_GRACE_DAYS);
    return Date.now() > graceEndsAt.getTime();
}

function isPastPlanEndDate(profile?: { role?: string | null; plan_end_date?: string | null } | null): boolean {
    if (!profile || !isPaidPlanRole(profile.role) || !profile.plan_end_date) return false;

    const endDate = new Date(`${profile.plan_end_date}T23:59:59.999Z`);
    if (Number.isNaN(endDate.getTime())) return false;

    return Date.now() > endDate.getTime();
}

async function getEventOwnerExpiryProfile(eventIds: string[]) {
    const ids = eventIds.filter(Boolean);
    if (ids.length === 0) return null;

    const { data: eventRows, error: eventError } = await supabase
        .from("events")
        .select("created_by")
        .in("id", ids);

    if (eventError) throw eventError;

    const ownerIdentifier = String(eventRows?.find(row => row.created_by)?.created_by || "").trim();
    if (!ownerIdentifier) return null;

    let profileQuery = supabase
        .from("profiles")
        .select("id, email, role, plan_end_date")
        .limit(1);

    profileQuery = ownerIdentifier.includes("@")
        ? profileQuery.eq("email", ownerIdentifier)
        : profileQuery.eq("id", ownerIdentifier);

    const { data: profiles, error: profileError } = await profileQuery;
    if (profileError) throw profileError;

    return profiles?.[0] || null;
}

async function getVisiblePhotoIdsForExpiredOwner(ownerProfile: { id?: string; email?: string }) {
    const ownerIdentifiers = [ownerProfile.id, ownerProfile.email].filter(Boolean) as string[];
    if (ownerIdentifiers.length === 0) return new Set<string>();

    const { data: ownerEvents, error: eventsError } = await supabase
        .from("events")
        .select("id")
        .in("created_by", ownerIdentifiers);

    if (eventsError) throw eventsError;

    const ownerEventIds = (ownerEvents || []).map(event => event.id).filter(Boolean);
    if (ownerEventIds.length === 0) return new Set<string>();

    const { data: mediaRows, error: mediaError } = await supabase
        .from("photos")
        .select("id, size, uploaded_at, tags")
        .in("event_id", ownerEventIds);

    if (mediaError) throw mediaError;

    const visibleIds = new Set<string>();
    let visibleBytes = 0;

    (mediaRows || [])
        .filter(row => !Array.isArray(row.tags) || !row.tags.includes(COVER_USAGE_TAG))
        .sort((a, b) => {
            const aTime = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
            const bTime = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
            return aTime - bTime;
        })
        .forEach(row => {
            const size = Number(row.size) || 0;
            if (visibleBytes + size > FREE_PLAN_STORAGE_BYTES) return;
            visibleBytes += size;
            visibleIds.add(row.id);
        });

    return visibleIds;
}

export async function getRetainedMediaIdsForEventGrace(eventId: string, legacyId?: string): Promise<string[]> {
    if (!eventId) return [];

    const ids = legacyId && legacyId !== eventId ? [eventId, legacyId] : [eventId];

    try {
        const ownerProfile = await getEventOwnerExpiryProfile(ids);
        if (!isPastPlanEndDate(ownerProfile) || !ownerProfile) return [];

        const visibleIds = await getVisiblePhotoIdsForExpiredOwner(ownerProfile);
        return Array.from(visibleIds);
    } catch (error) {
        console.warn("[PlanExpiry] Could not load retained media ids:", error);
        return [];
    }
}

async function filterPhotosForPlanExpiry(photos: Photo[], eventIds: string[]): Promise<Photo[]> {
    if (photos.length === 0) return photos;

    let ownerProfile = null;
    try {
        ownerProfile = await getEventOwnerExpiryProfile(eventIds);
    } catch (error) {
        console.warn("[PlanExpiry] Skipping media visibility filter:", error);
        return photos;
    }

    if (!isBeyondPlanGracePeriod(ownerProfile)) return photos;
    if (!ownerProfile) return photos;

    try {
        const visibleIds = await getVisiblePhotoIdsForExpiredOwner(ownerProfile);
        return photos.filter(photo => visibleIds.has(photo.id));
    } catch (error) {
        console.warn("[PlanExpiry] Skipping expired-owner visibility filter:", error);
        return photos;
    }
}

function getCoverUsagePhotoId(eventId: string, storageKey: string, url: string): string {
    const source = storageKey || url;
    const safeSource = source.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-120);
    return `cover_${eventId}_${safeSource}`;
}

function mapSqlToProfile(u: any): UserProfile {
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        roleType: u.role_type,
        delegatedBy: u.delegated_by,
        profileImage: u.profile_image,
        createdAt: u.created_at,
        username: u.username,
        isPrivate: u.is_private || false,
        assignedEvents: [],
        location: u.location,
        gender: u.gender,
        relationshipStatus: u.relationship_status,
        persona: u.persona,
        birthday: u.birthday,
        anniversaryDate: u.anniversary_date,
        subscriptionDuration: u.subscription_duration,
        planStartDate: u.plan_start_date,
        planEndDate: u.plan_end_date,
        discoverable: u.discoverable ?? true,
        notificationPreferences: u.notification_preferences,
        pushToken: u.push_token
    };
}

function getGuestLogEmail(g: any): string | undefined {
    if (g.email) return g.email;
    if (typeof g.id !== "string") return undefined;

    const [possibleEmail] = g.id.split("_");
    return possibleEmail?.includes("@") ? possibleEmail : undefined;
}

function guestLogMatchesIdentifier(g: any, identifier: string): boolean {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    if (!normalizedIdentifier) return false;

    const derivedEmail = getGuestLogEmail(g);
    const idPrefix = typeof g.id === "string" ? g.id.split("_")[0] : undefined;
    const candidates = [g.phone, g.email, derivedEmail, idPrefix]
        .filter(Boolean)
        .map(value => String(value).trim().toLowerCase());

    return candidates.includes(normalizedIdentifier);
}

function mapSqlToGuestLog(g: any): GuestLog {
    return {
        id: g.id,
        name: g.name,
        phone: g.phone,
        email: getGuestLogEmail(g),
        eventId: g.event_id,
        parentEventId: g.parent_event_id,
        parentEventOwnerId: g.parent_event_owner_id,
        eventTitle: g.event_title,
        loginAt: g.login_at,
        status: g.status,
        canAdmin: g.can_admin,
        canUpload: g.can_upload,
        canComment: g.can_comment
    };
}

function mapSqlToBusiness(b: any): Business {
    const viewsByDate = sanitizeBusinessViewsByDate(b.views_by_date);

    return {
        id: b.id,
        name: b.name,
        ownerName: b.owner_name,
        ownerEmail: b.owner_email,
        ownerPhone: b.owner_phone,
        type: b.type,
        tags: b.tags || [],
        location: {
            latitude: b.latitude || 0,
            longitude: b.longitude || 0,
            address: b.address || undefined
        },
        rating: b.rating || 0,
        coverImage: b.cover_image,
        coverImages: b.cover_images || [],
        createdBy: b.created_by,
        admins: b.admins || [],
        allowedUsers: b.allowed_users || [],
        description: b.description,
        experience: b.experience,
        startedDate: b.started_date,
        eventsHosted: b.events_hosted || 0,
        services: b.services || [],
        faqs: b.faqs || [],
        portfolioEvents: b.portfolio_events || b.views_by_date?.[BUSINESS_PORTFOLIO_EVENTS_KEY] || [],
        status: b.status || 'created',
        shortId: b.short_id,
        vendorCode: b.vendor_code,
        announcements: b.announcements || [],
        createdAt: b.created_at,
        profileViews: b.profile_views || 0,
        viewsByDate,
        shortlistCount: b.shortlist_count || 0
    };
}

function sanitizeBusinessViewsByDate(value: any): Record<string, number> {
    if (!value || typeof value !== 'object') return {};

    return Object.entries(value).reduce<Record<string, number>>((acc, [key, count]) => {
        if (key === BUSINESS_PORTFOLIO_EVENTS_KEY) return acc;
        if (typeof count === 'number') acc[key] = count;
        return acc;
    }, {});
}

// --- Database Functions ---

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        const profile = mapSqlToProfile(data);
        const { data: assignments } = await supabase
            .from('profile_assigned_events')
            .select('event_id')
            .eq('profile_id', uid);
            
        profile.assignedEvents = (assignments || []).map(a => a.event_id);
        return profile;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}

export async function getUserById(uid: string): Promise<UserProfile | null> {
    return getUserProfile(uid);
}

export async function getUsers(): Promise<UserProfile[]> {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapSqlToProfile);
    } catch (error) {
        console.error("Error fetching users:", error);
        return [];
    }
}

export async function getDelegatedAdminsCount(ownerUid: string): Promise<number> {
    try {
        const { count, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('delegated_by', ownerUid);

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error("Error counting delegated admins:", error);
        return 0;
    }
}

export async function updateUserRole(
    uid: string,
    newRole: string | null,
    delegatedBy?: string,
    roleType?: 'primary' | 'event',
    assignedEvents?: string[]
) {
    if (!uid) return false;
    try {
        const updateData: any = {};
        if (newRole) updateData.role = newRole;

        if (delegatedBy) {
            updateData.delegated_by = delegatedBy;
            if (roleType) updateData.role_type = roleType;
        } else {
            updateData.delegated_by = null;
            updateData.role_type = null;
        }

        const { error } = await supabase
            .from('profiles')
            .update(updateData)
            .eq('id', uid);

        if (error) throw error;

        // Manage assignments
        if (delegatedBy && roleType === 'event' && assignedEvents) {
            await supabase.from('profile_assigned_events').delete().eq('profile_id', uid);
            const pairs = assignedEvents.map(eventId => ({ profile_id: uid, event_id: eventId }));
            if (pairs.length > 0) {
                await supabase.from('profile_assigned_events').insert(pairs);
            }
        } else {
            await supabase.from('profile_assigned_events').delete().eq('profile_id', uid);
        }

        return true;
    } catch (error) {
        console.error("Error updating user role:", error);
        return false;
    }
}

export async function getUserTotalStorage(identifiers: string[]): Promise<number> {
    try {
        const { data, error } = await supabase
            .from('photos')
            .select('size')
            .in('user_id', identifiers);

        if (error) throw error;
        return (data || []).reduce((acc, p) => acc + (p.size || 0), 0);
    } catch (error) {
        console.error("Error fetching storage stats:", error);
        return 0;
    }
}

export async function getUserEventCount(uid: string): Promise<number> {
    try {
        const { count, error } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('created_by', uid)
            .eq('type', 'main');

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error("Error counting user events:", error);
        return 0;
    }
}

export async function getUserEvents(userIds: string | string[], type?: 'main' | 'sub', parentId?: string, legacyParentId?: string): Promise<Event[]> {
    try {
        const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [userIds].filter(Boolean);
        if (ids.length === 0) return [];

        const { data, error } = await supabase
            .from('events')
            .select('*')
            .in('created_by', ids);

        if (error) throw error;

        const events = (data || []).map(mapSqlToEvent);
        let filteredEvents = [...events];

        if (type === 'sub') {
            filteredEvents = filteredEvents.filter(e => {
                const matchesParent = e.parentId === parentId || (!!legacyParentId && e.parentId === legacyParentId);
                const isNotSelf = e.id !== parentId && (!legacyParentId || e.id !== legacyParentId);
                const looksSub = e.type === 'sub' || !!e.parentId;
                return matchesParent && isNotSelf && looksSub;
            });
        } else {
            filteredEvents = filteredEvents.filter(e => {
                const isMain = e.type === 'main' || (!e.type && !e.parentId);
                if (isMain) return true;
                const parentExists = events.some(ev => ev.id === e.parentId);
                return !parentExists;
            });
        }

        return filteredEvents.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } catch (error) {
        console.error("Error fetching user events:", error);
        return [];
    }
}

export async function updateUserProfileImage(uid: string, imageUrl: string) {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ profile_image: imageUrl })
            .eq('id', uid);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating profile image:", error);
        return false;
    }
}

const USERNAME_PATTERN = /^(?!.*[._]{2})[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])$/;

export function isValidUsername(username: string): boolean {
    return USERNAME_PATTERN.test(username.trim().toLowerCase());
}

export async function isUsernameUnique(username: string, excludeUid?: string): Promise<boolean> {
    try {
        const normalizedUsername = username.trim().toLowerCase();
        if (!isValidUsername(normalizedUsername)) return false;

        let queryBuilder = supabase
            .from('profiles')
            .select('id')
            .eq('username', normalizedUsername);

        if (excludeUid) {
            queryBuilder = queryBuilder.neq('id', excludeUid);
        }

        const { data, error } = await queryBuilder;
        if (error) throw error;
        return (data || []).length === 0;
    } catch (error) {
        console.error("Error checking username uniqueness:", error);
        return false;
    }
}

export async function updateUserProfile(uid: string, updateData: Partial<UserProfile>) {
    try {
        const { data: existingProfile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", uid)
            .maybeSingle();

        if (profileError) throw profileError;

        const writableColumns = new Set(
            existingProfile ? Object.keys(existingProfile) : ["name", "username", "profile_image", "phone", "email", "push_token"]
        );
        const updateObj = Object.entries(updateData).reduce<Record<string, unknown>>((acc, [key, value]) => {
            if (value === undefined) return acc;
            const column = USER_PROFILE_COLUMN_MAP[key as keyof UserProfile];
            if (column && writableColumns.has(column)) {
                acc[column] = value;
            }
            return acc;
        }, {});

        if (Object.keys(updateObj).length === 0) {
            return true;
        }

        if (typeof updateObj.username === "string") {
            const username = updateObj.username.trim().toLowerCase();
            if (!isValidUsername(username)) {
                throw new Error("Invalid username format");
            }
            updateObj.username = username;
        }

        const { error } = await supabase
            .from('profiles')
            .update(updateObj)
            .eq('id', uid);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating user profile:", formatSupabaseError(error));
        return false;
    }
}

export async function submitFeedback(userId: string, userName: string, text: string, category: string) {
    try {
        console.log(`[Supabase] Feedback received: ${userName} (${userId}) - [${category}] ${text}`);
        return true;
    } catch (error) {
        console.error("Error submitting feedback:", error);
        return false;
    }
}

export async function getUserPhotosCount(uid: string): Promise<number> {
    if (!uid) return 0;
    try {
        const { count, error } = await supabase
            .from('photos')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', uid);

        if (error) throw error;
        return count || 0;
    } catch (error) {
        console.error("Error fetching user photos count:", error);
        return 0;
    }
}

export async function getEventById(eventId: string): Promise<Event | null> {
    try {
        const decodedId = decodeURIComponent(eventId);
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('id', decodedId)
            .maybeSingle();

        if (data) return mapSqlToEvent(data);

        // Fallbacks
        const { data: legacy } = await supabase.from('events').select('*').eq('legacy_id', decodedId).maybeSingle();
        if (legacy) return mapSqlToEvent(legacy);

        const { data: title } = await supabase.from('events').select('*').eq('title', decodedId).maybeSingle();
        if (title) return mapSqlToEvent(title);

        return null;
    } catch (error) {
        console.error("Error fetching event by ID:", error);
        return null;
    }
}

export async function getSubEvents(parentId: string, legacyParentId?: string): Promise<Event[]> {
    if (!parentId) return [];
    try {
        const ids = legacyParentId && legacyParentId !== parentId ? [parentId, legacyParentId] : [parentId];
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .in('parent_id', ids);

        if (error) throw error;
        const subEvents = (data || [])
            .map(mapSqlToEvent)
            .filter(e => e.id !== parentId && (!legacyParentId || e.id !== legacyParentId));

        return subEvents.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } catch (error) {
        console.error("Error fetching sub-events:", error);
        return [];
    }
}

export async function getEventPhotos(eventId: string, legacyId?: string): Promise<Photo[]> {
    if (!eventId) return [];
    try {
        const ids = legacyId && legacyId !== eventId ? [eventId, legacyId] : [eventId];
        const { data, error } = await supabase
            .from('photos')
            .select('*')
            .in('event_id', ids);

        if (error) throw error;
        const photos = (data || []).map(mapSqlToPhoto).filter(photo => !isCoverUsagePhoto(photo));
        const visiblePhotos = await filterPhotosForPlanExpiry(photos, ids);
        return visiblePhotos.sort((a, b) => (a.order ?? 999999) - (b.order ?? 999999));
    } catch (error) {
        console.error("Error fetching photos:", error);
        return [];
    }
}

export async function getEventPhotosPaginated(
    eventId: string,
    legacyId?: string,
    page: number = 0,
    limit: number = 20
): Promise<{ photos: Photo[], hasMore: boolean }> {
    if (!eventId) return { photos: [], hasMore: false };
    try {
        const ids = legacyId && legacyId !== eventId ? [eventId, legacyId] : [eventId];

        // Fetch limit + 1 to determine if hasMore is true
        const { data, error } = await supabase
            .from('photos')
            .select('*')
            .in('event_id', ids)
            .order('order', { ascending: true, nullsFirst: false })
            .order('uploaded_at', { ascending: false })
            .range(page * limit, (page + 1) * limit);

        if (error) throw error;

        const rawPhotos = (data || []).map(mapSqlToPhoto).filter(photo => !isCoverUsagePhoto(photo));
        const hasMore = rawPhotos.length > limit;
        const photosToReturn = hasMore ? rawPhotos.slice(0, limit) : rawPhotos;

        return {
            photos: photosToReturn,
            hasMore
        };
    } catch (error) {
        console.error("Error fetching paginated photos:", error);
        return { photos: [], hasMore: false };
    }
}

export async function updatePhotosOrder(orderedIds: string[]): Promise<boolean> {
    try {
        const promises = orderedIds.map((id, index) =>
            supabase.from('photos').update({ order: index }).eq('id', id)
        );
        await Promise.all(promises);
        return true;
    } catch (error) {
        console.error("Error updating photo order:", error);
        return false;
    }
}

export async function updateSubEventsOrder(orderedIds: string[]): Promise<boolean> {
    try {
        const promises = orderedIds.map((id, index) =>
            supabase.from('events').update({ order: index }).eq('id', id)
        );
        await Promise.all(promises);
        return true;
    } catch (error) {
        console.error("Error updating sub-events order:", error);
        return false;
    }
}

export function safeParseDateToISO(dateInput?: string | Date): string | null {
    if (!dateInput) return null;
    if (dateInput instanceof Date) {
        if (isNaN(dateInput.getTime())) return null;
        return dateInput.toISOString();
    }
    const dateStr = String(dateInput);
    try {
        const trimmed = dateStr.trim();
        if (!trimmed) return null;

        // 1. Try verbal month parsing (e.g. "Jun 2, 2026", "2 June 2026")
        const lowerStr = trimmed.toLowerCase();
        const MONTH_MAP: { [key: string]: number } = {
            jan: 0, january: 0,
            feb: 1, february: 1,
            mar: 2, march: 2,
            apr: 3, april: 3,
            may: 4,
            jun: 5, june: 5,
            jul: 6, july: 6,
            aug: 7, august: 7,
            sep: 8, september: 8,
            oct: 9, october: 9,
            nov: 10, november: 10,
            dec: 11, december: 11
        };

        const monthKeys = Object.keys(MONTH_MAP);
        let foundMonth: number | null = null;
        let foundMonthName = "";
        for (const key of monthKeys) {
            if (lowerStr.includes(key)) {
                if (key.length > foundMonthName.length) {
                    foundMonth = MONTH_MAP[key];
                    foundMonthName = key;
                }
            }
        }

        if (foundMonth !== null) {
            const numbers = lowerStr.match(/\d+/g);
            if (numbers && numbers.length > 0) {
                let year = new Date().getFullYear();
                let day = 1;
                
                const yearMatch = numbers.find(n => n.length === 4);
                if (yearMatch) {
                    year = parseInt(yearMatch, 10);
                }
                
                const dayMatch = numbers.find(n => n.length === 1 || n.length === 2);
                if (dayMatch) {
                    day = parseInt(dayMatch, 10);
                } else if (numbers.length > 1) {
                    const otherNum = numbers.find(n => n !== yearMatch);
                    if (otherNum) {
                        day = parseInt(otherNum, 10);
                    }
                }
                
                const dateObj = new Date(year, foundMonth, day);
                if (!isNaN(dateObj.getTime())) {
                    return dateObj.toISOString();
                }
            }
        }

        // 2. Try standard date parsing with replacements
        let dateObj: Date;
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            dateObj = new Date(trimmed.replace(/-/g, "/"));
        } else {
            dateObj = new Date(trimmed);
        }

        if (!isNaN(dateObj.getTime())) {
            return dateObj.toISOString();
        }

        // 3. Fallback to current date instead of crashing
        console.warn(`[SafeDate] Failed to parse date string: "${dateStr}". Falling back to current date.`);
        return new Date().toISOString();
    } catch (e) {
        console.error(`[SafeDate] Error parsing date string: "${dateStr}":`, e);
        try {
            return new Date().toISOString();
        } catch (inner) {
            return null;
        }
    }
}

export async function createEvent(event: Event) {
    try {
        const payload: Record<string, any> = {
            id: event.id,
            title: event.title,
            date: event.date ? safeParseDateToISO(event.date) : null,
            cover_image: event.coverImage || DEFAULT_EVENT_COVER_IMAGE,
            description: event.description || null,
            created_by: event.createdBy || null,
            type: event.type || null,
            parent_id: event.parentId || null,
            legacy_id: event.legacyId || null,
            category: event.category || null,
            template_id: event.templateId || 'hero',
            join_id: event.joinId || null
        };

        let { error } = await supabase.from('events').upsert(payload);

        if (error?.code === 'PGRST204') {
            const match = error.message.match(/Could not find the '([^']+)' column/i);
            const missingCol = match?.[1];
            if (missingCol && missingCol in payload) {
                console.warn(`[Supabase database] Column '${missingCol}' does not exist on 'events' table. Retrying event create without it...`);
                delete payload[missingCol];
                ({ error } = await supabase.from('events').upsert(payload));
            }
        }

        if (error) throw error;
        return true;
    } catch (error) {
        const details = error && typeof error === "object"
            ? {
                code: "code" in error ? error.code : undefined,
                message: "message" in error ? error.message : undefined,
                details: "details" in error ? error.details : undefined,
                hint: "hint" in error ? error.hint : undefined,
            }
            : error;
        console.error("Error creating event:", details);
        return false;
    }
}

export async function toggleLike(photoId: string, userId: string, userName: string) {
    try {
        const { data: existing, error } = await supabase
            .from('likes')
            .select('id')
            .eq('photo_id', photoId)
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;

        if (existing) {
            await supabase.from('likes').delete().eq('id', existing.id);
            return { liked: false };
        } else {
            await supabase.from('likes').insert({
                photo_id: photoId,
                user_id: userId
            });
            return { liked: true };
        }
    } catch (error) {
        console.error("Error toggling like:", error);
        throw error;
    }
}

export async function addComment(photoId: string, userId: string, userName: string, text: string, parentId?: string) {
    try {
        const { error } = await supabase.from('comments').insert({
            photo_id: photoId,
            user_id: userId,
            text,
            parent_id: parentId || null
        });
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error adding comment:", error);
        return false;
    }
}

export function onPhotoInteractions(photoId: string, callback: (data: { likes: any[], comments: any[] }) => void) {
    let currentLikes: any[] = [];
    let currentComments: any[] = [];

    const fetchAndTrigger = async () => {
        const [likesRes, commentsRes] = await Promise.all([
            supabase.from('likes').select('id, created_at, user_id, profiles(name)').eq('photo_id', photoId),
            supabase.from('comments').select('id, text, created_at, user_id, parent_id, profiles(name)').eq('photo_id', photoId)
        ]);

        if (!likesRes.error && likesRes.data) {
            currentLikes = likesRes.data.map((l: any) => ({
                id: l.id,
                photoId: photoId,
                userId: l.user_id,
                userName: l.profiles?.name || 'Guest User',
                createdAt: l.created_at
            }));
            currentLikes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        if (!commentsRes.error && commentsRes.data) {
            currentComments = commentsRes.data.map((c: any) => ({
                id: c.id,
                photoId: photoId,
                userId: c.user_id,
                userName: c.profiles?.name || 'Guest User',
                text: c.text,
                parentId: c.parent_id || null,
                createdAt: c.created_at
            }));
            currentComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        callback({ likes: currentLikes, comments: currentComments });
    };

    fetchAndTrigger();

    const channelName = `photo-interactions-${photoId}-${Date.now()}-${photoInteractionChannelCounter++}`;

    const interactionsChannel = supabase
        .channel(channelName)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'likes', filter: `photo_id=eq.${photoId}` }, () => fetchAndTrigger())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `photo_id=eq.${photoId}` }, () => fetchAndTrigger())
        .subscribe();

    return () => {
        supabase.removeChannel(interactionsChannel);
    };
}

export async function deletePhotoComment(commentId: string) {
    try {
        const { error } = await supabase.from('comments').delete().eq('id', commentId);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error deleting comment:", error);
        return false;
    }
}

export async function getUserVisits(identifier: string): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('guests')
            .select('*')
            .eq('status', 'approved')
            .order('login_at', { ascending: false });

        if (error) throw error;
        return (data || [])
            .filter(row => guestLogMatchesIdentifier(row, identifier))
            .map(mapSqlToGuestLog);
    } catch (error) {
        console.error("Error fetching user visits:", error);
        return [];
    }
}

export async function getSharedEvents(identifier: string): Promise<Event[]> {
    try {
        const visits = await getUserVisits(identifier);
        if (visits.length === 0) return [];

        const eventIds = [...new Set(visits.map(v => v.eventId).filter(id => !!id))];
        const eventPromises = eventIds.map(id => getEventById(id));
        const events = await Promise.all(eventPromises);

        return events.filter((e): e is Event => e !== null);
    } catch (error) {
        console.error("Error fetching shared events:", error);
        throw error;
    }
}

export async function getApprovedSharedEventsForUser(identifiers: string | string[], isAdminOnly: boolean = false): Promise<Event[]> {
    try {
        const ids = Array.isArray(identifiers) ? identifiers.filter(Boolean) : [identifiers].filter(Boolean);
        if (ids.length === 0) return [];

        const visitsByIdentifier = await Promise.all(ids.map((identifier) => getUserVisits(identifier)));
        const visits = visitsByIdentifier.flat();

        const eventVisits: { [eventId: string]: any[] } = {};
        visits.forEach(v => {
            const eid = v.eventId;
            if (eid) {
                if (!eventVisits[eid]) eventVisits[eid] = [];
                eventVisits[eid].push(v);
            }
        });

        const eventIds = Object.keys(eventVisits).filter(eid => {
            const vList = eventVisits[eid];
            return vList.some(v => v.status === "approved" && (!isAdminOnly || !!v.canAdmin));
        });

        const uniqueEventIds = [...new Set(eventIds)];
        const events = await Promise.all(uniqueEventIds.map((eventId) => getEventById(eventId)));

        return events
            .filter((event): event is Event => event !== null)
            .sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } catch (error) {
        console.error("Error fetching approved shared events:", error);
        return [];
    }
}

export async function logGuestLogin(
    name: string, 
    phone: string, 
    eventId?: string, 
    parentEventId?: string, 
    eventTitle?: string, 
    ownerId?: string, 
    status: 'pending' | 'approved' | 'rejected' = 'pending'
) {
    if (!phone) return false;
    try {
        const logId = eventId ? `${phone}_${eventId}` : phone;

        const { data: existing } = await supabase
            .from('guests')
            .select('status')
            .eq('id', logId)
            .maybeSingle();

        const { error } = await supabase.from('guests').upsert({
            id: logId,
            name,
            phone,
            event_id: eventId || null,
            parent_event_id: parentEventId || null,
            parent_event_owner_id: ownerId || null,
            event_title: eventTitle || null,
            login_at: new Date().toISOString(),
            status: existing?.status || status
        });

        if (error) throw error;

        // Notify event owner when a new guest joins their event
        if (ownerId && ownerId !== phone) {
            const isNew = !existing;
            if (isNew) {
                sendPushNotificationDirectly(
                    ownerId,
                    '🎉 New guest joined',
                    `${name} just joined "${eventTitle || 'your event'}"`,
                    { eventId: eventId || '' }
                ).catch(() => {});
            }
        }

        return true;
    } catch (error) {
        console.error("Error logging guest login:", error);
        return false;
    }
}

export async function checkGuestRequestStatus(userId: string, eventId: string): Promise<'pending' | 'approved' | 'rejected' | null> {
    try {
        const { data, error } = await supabase
            .from('guests')
            .select('status')
            .eq('id', `${userId}_${eventId}`)
            .maybeSingle();

        if (error) throw error;
        return data ? (data.status as any) : null;
    } catch (e) {
        console.error("Error checking guest request status:", e);
        return null;
    }
}

export function onGuestStatusChange(logId: string, callback: (status: string) => void) {
    const channel = supabase
        .channel(`guest-status-${logId}`)
        .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'guests', filter: `id=eq.${logId}` },
            (payload) => {
                if (payload.new && payload.new.status) {
                    callback(payload.new.status);
                }
            }
        )
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

export async function getGuestLogs(ownerIds?: string | string[]): Promise<GuestLog[]> {
    try {
        let queryBuilder = supabase.from('guests').select('*');

        if (ownerIds) {
            const ids = Array.isArray(ownerIds) ? ownerIds.filter(Boolean) : [ownerIds].filter(Boolean);
            if (ids.length > 0) {
                queryBuilder = queryBuilder.in('parent_event_owner_id', ids);
            }
        }

        const { data, error } = await queryBuilder.order('login_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapSqlToGuestLog);
    } catch (error) {
        console.error("Error fetching guest logs:", error);
        return [];
    }
}

export async function getEventLogs(eventId: string): Promise<GuestLog[]> {
    if (!eventId) return [];
    const logs = await getGuestLogs();
    return logs.filter(log => log.eventId === eventId || log.parentEventId === eventId);
}

export async function updateGuestStatus(logId: string, status: 'pending' | 'approved' | 'rejected') {
    try {
        const updateData: any = { status };
        if (status === 'approved') {
            updateData.can_upload = true;
            updateData.can_comment = true;
        }

        const { error } = await supabase
            .from('guests')
            .update(updateData)
            .eq('id', logId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating guest status:", error);
        return false;
    }
}

export async function updateGuestPermissions(logId: string, permissions: Partial<{ canAdmin: boolean, canUpload: boolean, canComment: boolean }>) {
    try {
        const updateData: any = {};
        if (permissions.canAdmin !== undefined) updateData.can_admin = permissions.canAdmin;
        if (permissions.canUpload !== undefined) updateData.can_upload = permissions.canUpload;
        if (permissions.canComment !== undefined) updateData.can_comment = permissions.canComment;

        const { error } = await supabase
            .from('guests')
            .update(updateData)
            .eq('id', logId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error updating guest permissions:", error);
        return false;
    }
}

// --- NEW MOBILE MARKETPLACE SPECIFIC FUNCTIONS ---

export async function removeGuestChatPermission(logId: string) {
    try {
        const { error } = await supabase.from('guests').update({ can_chat: false }).eq('id', logId);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error removing guest chat permission:", error);
        return false;
    }
}

function getDeleteEndpoints() {
    const explicitEndpoint = process.env.EXPO_PUBLIC_MEDIA_UPLOAD_URL?.trim();
    if (explicitEndpoint) {
        return [explicitEndpoint.replace(/\/upload$/, '/delete')];
    }

    const endpoints: string[] = [];
    const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
    if (apiBaseUrl) {
        endpoints.push(`${apiBaseUrl.replace(/\/+$/, '')}/api/media/delete`);
    }

    try {
        const Constants = require('expo-constants').default;
        const hostUri = Constants?.expoConfig?.hostUri || Constants?.manifest2?.extra?.expoGo?.developer?.hostUri;
        const devHost = typeof hostUri === 'string' ? hostUri.split(':')[0] : '';
        if (devHost) {
            endpoints.push(`http://${devHost}:3000/api/media/delete`);
        }
    } catch (e) {}

    try {
        const { Platform } = require('react-native');
        if (Platform.OS === 'android') {
            endpoints.push('http://10.0.2.2:3000/api/media/delete');
        }
    } catch (e) {}

    endpoints.push('http://localhost:3000/api/media/delete');

    return Array.from(new Set(endpoints));
}

export async function deletePhoto(photoId: string) {
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) {
            throw new Error('Please log in before deleting media.');
        }

        const endpoints = getDeleteEndpoints();
        let success = false;
        let lastError: any = null;

        for (const deleteUrl of endpoints) {
            try {
                console.log(`[Database] Trying delete: ${photoId} via ${deleteUrl}`);
                const response = await fetch(deleteUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({ photoId }),
                });

                if (response.ok) {
                    success = true;
                    break;
                } else {
                    const errRes = await response.json().catch(() => ({}));
                    lastError = new Error(errRes.error || `Failed with status: ${response.status}`);
                }
            } catch (err) {
                lastError = err;
                console.warn(`[Database] Delete endpoint failed: ${deleteUrl}`, err);
            }
        }

        if (!success) {
            throw lastError || new Error('Failed to reach any delete endpoint.');
        }

        return true;
    } catch (error) {
        console.error("Error deleting photo:", error);
        return false;
    }
}

export async function deleteEvent(eventId: string) {
    try {
        // Fetch and delete B2 assets for all photos associated with this event
        const { data: photos } = await supabase.from('photos').select('id').eq('event_id', eventId);
        if (photos && photos.length > 0) {
            console.log(`[deleteEvent] Cleaning up B2 files for ${photos.length} photos under event ${eventId}`);
            await Promise.all(photos.map(photo => deletePhoto(photo.id)));
        }

        const { error } = await supabase.from('events').delete().eq('id', eventId);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error deleting event:", error);
        return false;
    }
}

export async function updateEvent(eventId: string, data: Partial<Event>): Promise<boolean> {
    try {
        const updateObj: any = {};
        if (data.title !== undefined) updateObj.title = data.title;
        if (data.description !== undefined) updateObj.description = data.description;
        if (data.coverImage !== undefined) updateObj.cover_image = data.coverImage;
        if (data.date !== undefined) updateObj.date = data.date;
        if (data.category !== undefined) updateObj.category = data.category;
        if (data.templateId !== undefined) updateObj.template_id = data.templateId;
        if (data.coverOffset !== undefined) updateObj.cover_offset = data.coverOffset;
        if (data.coverOffsetX !== undefined) updateObj.cover_offset_x = data.coverOffsetX;
        if (data.coverScale !== undefined) updateObj.cover_scale = data.coverScale;
        if (data.coverMode !== undefined) updateObj.cover_mode = data.coverMode;
        if (data.order !== undefined) updateObj.order = data.order;
        if (data.joinId !== undefined) updateObj.join_id = data.joinId;
        if (data.vendors !== undefined) updateObj.vendors = data.vendors;

        const { error } = await supabase.from('events').update(updateObj).eq('id', eventId);
        if (error) {
            // Self-healing retry for missing table columns (PostgREST PGRST204)
            if (error.code === 'PGRST204') {
                const match = error.message.match(/Could not find the '([^']+)' column/i);
                if (match && match[1]) {
                    const missingCol = match[1];
                    console.warn(`[Supabase database] Column '${missingCol}' does not exist on 'events' table. Pruning and retrying...`);
                    
                    const dbToPropMap: Record<string, string> = {
                        title: 'title',
                        description: 'description',
                        cover_image: 'coverImage',
                        date: 'date',
                        category: 'category',
                        template_id: 'templateId',
                        show_welcome_card: 'showWelcomeCard',
                        cover_offset: 'coverOffset',
                        cover_offset_x: 'coverOffsetX',
                        cover_scale: 'coverScale',
                        cover_mode: 'coverMode',
                        order: 'order',
                        title_align: 'titleAlign',
                        join_id: 'joinId',
                        vendors: 'vendors',
                    };

                    const prop = dbToPropMap[missingCol];
                    if (prop && data[prop as keyof typeof data] !== undefined) {
                        const nextData = { ...data };
                        delete nextData[prop as keyof typeof data];
                        return updateEvent(eventId, nextData);
                    }
                }
            }
            throw error;
        }
        return true;
    } catch (error) {
        console.error("Error updating event:", error);
        return false;
    }
}

export async function getUserBusinesses(uid: string): Promise<Business[]> {
    if (!uid) return [];
    try {
        // Query businesses where creator is current user OR user is listed in admins OR allowed_users
        const { data, error } = await supabase
            .from('businesses')
            .select('*')
            .or(`created_by.eq.${uid},admins.cs.{${uid}},allowed_users.cs.{${uid}}`);

        if (error) throw error;
        return (data || []).map(mapSqlToBusiness).sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } catch (error) {
        console.error("Error fetching user businesses:", error);
        return [];
    }
}

export async function addPhoto(data: Omit<Photo, 'id'>) {
    try {
        // Derive a deterministic ID from storage_key — same approach as web savePhoto.
        // This prevents duplicate DB rows on retry (if the upload task is retried after a
        // partial failure where B2 got the file but the DB write failed).
        const derivedId = data.storageKey
            ? data.storageKey.replace(/\//g, '_')
            : Math.random().toString(36).substring(2, 15);

        const { error } = await supabase.from('photos').upsert({
            id: derivedId,
            event_id: data.eventId,
            storage_key: data.storageKey,
            url: data.url,
            user_id: data.userId || null,
            width: data.width || null,
            height: data.height || null,
            size: data.size || null,
            format: data.format || null,
            media_type: data.mediaType || 'photo',
            resource_type: data.resourceType || (data.mediaType === 'video' ? 'video' : 'image'),
            thumbnail_url: data.thumbnailUrl || null,
            tags: data.tags || [],
            uploaded_at: new Date().toISOString()
        });
        if (error) throw error;

        // Notify event owner when a guest uploads a photo
        if (data.eventId && data.userId) {
            void (async () => {
                const { data: event } = await supabase
                    .from('events')
                    .select('created_by, title')
                    .eq('id', data.eventId)
                    .maybeSingle();

                if (event?.created_by && event.created_by !== data.userId) {
                    const isVideo = data.mediaType === 'video';
                    await Promise.resolve(
                        sendPushNotificationDirectly(
                            event.created_by,
                            isVideo ? '🎥 New video uploaded' : '📸 New photo uploaded',
                            `Someone added a ${isVideo ? 'video' : 'photo'} to "${event.title}"`,
                            { eventId: data.eventId }
                        )
                    );
                }
            })().catch(() => {});
        }

        return derivedId;
    } catch (error) {
        console.error("Error adding photo:", error);
        return null;
    }
}

export async function saveCoverUsagePhoto(photo: Omit<Photo, "id" | "uploadedAt" | "tags"> & { uploadedAt?: any }) {
    const storageKey = photo.storageKey || photo.url;
    try {
        const { error } = await supabase.from('photos').upsert({
            id: getCoverUsagePhotoId(photo.eventId, storageKey, photo.url),
            event_id: photo.eventId,
            storage_key: storageKey,
            url: photo.url,
            user_id: photo.userId || null,
            width: photo.width || null,
            height: photo.height || null,
            size: photo.size || null,
            format: photo.format || null,
            media_type: photo.mediaType || 'photo',
            resource_type: photo.resourceType || 'image',
            thumbnail_url: photo.thumbnailUrl || null,
            tags: [COVER_USAGE_TAG],
            uploaded_at: photo.uploadedAt ? new Date(photo.uploadedAt).toISOString() : new Date().toISOString()
        });
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error saving cover usage photo:", error);
        return false;
    }
}

export async function deleteCoverUsagePhoto(eventId: string, coverUrl: string): Promise<boolean> {
    if (!eventId || !coverUrl) return true;

    try {
        const { error } = await supabase
            .from('photos')
            .delete()
            .eq('event_id', eventId)
            .eq('url', coverUrl)
            .contains('tags', [COVER_USAGE_TAG]);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error deleting cover usage photo:", error);
        return false;
    }
}

export async function createBusiness(businessData: Omit<Business, 'id' | 'createdAt'>) {
  try {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const vendorCode = businessData.vendorCode || `VEN-${randomCode}`;
    const generatedId = `biz_${Math.random().toString(36).substring(2, 15)}`;
    
    const { error } = await supabase.from('businesses').insert({
      id: generatedId,
      name: businessData.name,
      owner_name: businessData.ownerName,
      owner_email: businessData.ownerEmail || null,
      owner_phone: businessData.ownerPhone || null,
      type: businessData.type,
      tags: businessData.tags || [],
      latitude: businessData.location?.latitude || null,
      longitude: businessData.location?.longitude || null,
      address: businessData.location?.address || null,
      rating: businessData.rating || 0,
      cover_image: businessData.coverImage || null,
      cover_images: businessData.coverImages || [],
      created_by: businessData.createdBy || null,
      admins: businessData.admins || [],
      allowed_users: businessData.allowedUsers || [],
      description: businessData.description || null,
      experience: businessData.experience || null,
      started_date: businessData.startedDate ? safeParseDateToISO(businessData.startedDate) : null,
      events_hosted: businessData.eventsHosted || 0,
      services: businessData.services || [],
      faqs: businessData.faqs || [],
      status: businessData.status || 'created',
      short_id: businessData.shortId || null,
      vendor_code: vendorCode,
      announcements: businessData.announcements || [],
      views_by_date: businessData.portfolioEvents !== undefined
        ? { [BUSINESS_PORTFOLIO_EVENTS_KEY]: businessData.portfolioEvents }
        : {},
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
    return generatedId;
  } catch (e) {
    console.error("Error adding business: ", e);
    return null;
  }
}

export async function getBusinessById(id: string): Promise<Business | null> {
  try {
    const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', id)
        .maybeSingle();

    if (error) throw error;
    return data ? mapSqlToBusiness(data) : null;
  } catch (e) {
    console.error("Error fetching business by ID:", e);
    return null;
  }
}

export async function getEventsCountForVendor(vendorId: string): Promise<number> {
  try {
    const { data, error } = await supabase
        .from('businesses')
        .select('events_hosted')
        .eq('id', vendorId)
        .maybeSingle();

    if (error) throw error;
    return data?.events_hosted || 0;
  } catch (e) {
    console.error("Error fetching event count for vendor:", e);
    return 0;
  }
}

export async function getBusinessByVendorCode(code: string): Promise<Business | null> {
  try {
    const formattedCode = code.toUpperCase().trim();
    const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('vendor_code', formattedCode)
        .maybeSingle();

    if (error) throw error;
    if (data) return mapSqlToBusiness(data);

    // Fallback search by ID prefix
    if (formattedCode.startsWith('VEN-')) {
      const docIdPrefix = formattedCode.replace('VEN-', '').toLowerCase();
      const { data: direct } = await supabase.from('businesses').select('*').eq('id', docIdPrefix).maybeSingle();
      if (direct) return mapSqlToBusiness(direct);
    }
    return null;
  } catch (e) {
    console.error("Error fetching business by vendor code:", e);
    return null;
  }
}

export async function incrementBusinessViewCount(bizId: string): Promise<void> {
    try {
        const { data: biz } = await supabase.from('businesses').select('profile_views').eq('id', bizId).maybeSingle();
        const currentViews = biz?.profile_views || 0;
        await supabase.from('businesses').update({ profile_views: currentViews + 1 }).eq('id', bizId);
    } catch (e) {
        console.warn('Silent ignore: Failed to increment view count', e);
    }
}

export async function updateBusiness(bizId: string, data: Partial<Business>): Promise<boolean> {
  try {
    const updateObj: any = {};
    if (data.name !== undefined) updateObj.name = data.name;
    if (data.ownerName !== undefined) updateObj.owner_name = data.ownerName;
    if (data.ownerEmail !== undefined) updateObj.owner_email = data.ownerEmail;
    if (data.ownerPhone !== undefined) updateObj.owner_phone = data.ownerPhone;
    if (data.type !== undefined) updateObj.type = data.type;
    if (data.tags !== undefined) updateObj.tags = data.tags;
    
    if (data.location !== undefined) {
      if (data.location.latitude !== undefined) updateObj.latitude = data.location.latitude;
      if (data.location.longitude !== undefined) updateObj.longitude = data.location.longitude;
      if (data.location.address !== undefined) updateObj.address = data.location.address;
    }
    
    if (data.rating !== undefined) updateObj.rating = data.rating;
    if (data.coverImage !== undefined) updateObj.cover_image = data.coverImage;
    if (data.coverImages !== undefined) updateObj.cover_images = data.coverImages;
    if (data.admins !== undefined) updateObj.admins = data.admins;
    if (data.allowedUsers !== undefined) updateObj.allowed_users = data.allowedUsers;
    if (data.description !== undefined) updateObj.description = data.description;
    if (data.experience !== undefined) updateObj.experience = data.experience;
    
    if (data.startedDate !== undefined) {
      if (!data.startedDate) {
        updateObj.started_date = null;
      } else if (typeof data.startedDate === 'string') {
        updateObj.started_date = safeParseDateToISO(data.startedDate);
      } else if (data.startedDate instanceof Date) {
        updateObj.started_date = data.startedDate.toISOString();
      } else if (typeof data.startedDate.toDate === 'function') {
        updateObj.started_date = data.startedDate.toDate().toISOString();
      } else {
        updateObj.started_date = data.startedDate;
      }
    }
    
    if (data.eventsHosted !== undefined) updateObj.events_hosted = data.eventsHosted;
    if (data.services !== undefined) updateObj.services = data.services;
    if (data.faqs !== undefined) updateObj.faqs = data.faqs;
    if (data.portfolioEvents !== undefined) {
      const { data: existingBusiness } = await supabase
        .from('businesses')
        .select('views_by_date')
        .eq('id', bizId)
        .maybeSingle();

      updateObj.views_by_date = {
        ...(existingBusiness?.views_by_date || {}),
        [BUSINESS_PORTFOLIO_EVENTS_KEY]: data.portfolioEvents,
      };
    }
    if (data.status !== undefined) updateObj.status = data.status;
    if (data.shortId !== undefined) updateObj.short_id = data.shortId;
    if (data.vendorCode !== undefined) updateObj.vendor_code = data.vendorCode;
    if (data.announcements !== undefined) updateObj.announcements = data.announcements;
    if (data.profileViews !== undefined) updateObj.profile_views = data.profileViews;
    if (data.viewsByDate !== undefined) updateObj.views_by_date = data.viewsByDate;

    const { error } = await supabase.from('businesses').update(updateObj).eq('id', bizId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Error updating business: ", e);
    return false;
  }
}

export async function getUserRatingForBusiness(userId: string, bizId: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
        .from('business_ratings')
        .select('rating')
        .eq('id', `${userId}_${bizId}`)
        .maybeSingle();

    if (error) throw error;
    return data ? data.rating : null;
  } catch (e) {
    console.error("Error getting user rating for business: ", e);
    return null;
  }
}

export async function saveUserRating(
  userId: string, 
  bizId: string, 
  rating: number, 
  comment?: string, 
  userName?: string
): Promise<boolean> {
  try {
    const ratingId = `${userId}_${bizId}`;
    const { error } = await supabase.from('business_ratings').upsert({
      id: ratingId,
      user_id: userId,
      business_id: bizId,
      rating: rating,
      review: comment || '',
      created_at: new Date().toISOString()
    });
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("Error saving user rating: ", e);
    return false;
  }
}

export async function getReviewsForBusiness(bizId: string): Promise<any[]> {
  try {
    const { data, error } = await supabase
        .from('business_ratings')
        .select('*, profiles(name)')
        .eq('business_id', bizId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      businessId: r.business_id,
      rating: r.rating,
      comment: r.review,
      userName: r.profiles?.name || 'Anonymous User',
      createdAt: r.created_at
    }));
  } catch (e) {
    console.error("Error getting reviews for business: ", e);
    return [];
  }
}

export async function getTopRatedBusinesses(limitCount: number = 10): Promise<Business[]> {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('status', 'published')
        .order('rating', { ascending: false })
        .limit(limitCount);

      if (error) throw error;
      return (data || []).map(mapSqlToBusiness);
    } catch (e) {
      console.error("Error fetching top rated businesses:", e);
      return [];
    }
}

export function onTopRatedBusinesses(limitCount: number = 10, callback: (businesses: Business[]) => void) {
    const fetchAndTrigger = async () => {
        const list = await getTopRatedBusinesses(limitCount);
        callback(list);
    };
    
    fetchAndTrigger();
    const channel = supabase
        .channel('top-rated-businesses')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses', filter: `status=eq.published` }, () => fetchAndTrigger())
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
}

export async function getPublishedBusinesses(category?: string): Promise<Business[]> {
    try {
        let queryBuilder = supabase.from('businesses').select('*').eq('status', 'published');
        if (category) {
            queryBuilder = queryBuilder.eq('type', category);
        }
        const { data, error } = await queryBuilder;
        if (error) throw error;
        return (data || []).map(mapSqlToBusiness);
    } catch (e) {
        console.error("Error fetching published businesses:", e);
        return [];
    }
}

// --- SOCIAL NETWORK FUNCTIONS (STUBBED FOR STABILITY) ---

export async function updateUserPrivacy(uid: string, isPrivate: boolean) {
    try {
        await supabase.from('profiles').update({ is_private: isPrivate }).eq('id', uid);
        return true;
    } catch (error) {
        console.error("Error updating privacy:", error);
        return false;
    }
}

export async function followUser(followerId: string, followedId: string) {
    return { success: true, status: 'accepted' };
}

export async function getPendingFollowRequests(userId: string): Promise<any[]> {
    return [];
}

export async function approveFollowRequest(relationshipId: string) {
    return true;
}

export async function rejectFollowRequest(relationshipId: string) {
    return true;
}

export async function unfollowUser(followerId: string, followedId: string) {
    return true;
}

export async function getFollowing(userId: string): Promise<string[]> {
    return [];
}

export async function getFollowersCount(userId: string): Promise<number> {
    return 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
    return 0;
}

export async function getSocialFeed(followingIds: string[]): Promise<any[]> {
    try {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map(mapSqlToEvent).map(e => ({ ...e, type: 'event' }));
    } catch (error) {
        console.error("[SocialFeed] Error fetching feed:", error);
        return [];
    }
}

export async function toggleEventPostLike(eventId: string, userId: string) {
    return { liked: true };
}

export async function isEventPostLikedByUser(eventId: string, userId: string): Promise<boolean> {
    return false;
}

export async function getEventPostLikes(eventId: string) {
    return { count: 0 };
}

export async function addEventPostComment(eventId: string, userId: string, userName: string, text: string) {
    return true;
}

export async function getEventPostComments(eventId: string) {
    return [];
}

export async function toggleShortlistBusiness(userId: string, businessId: string) {
    return true;
}

export async function getBusinessShortlistStatus(userId: string, businessId: string): Promise<boolean> {
    return false;
}

export async function toggleBusinessShortlist(
    userId: string,
    businessId: string,
    currentlyShortlisted: boolean
): Promise<boolean> {
    return !currentlyShortlisted;
}

export async function addBusinessActivity(activity: any): Promise<boolean> {
    return true;
}

export async function getBusinessActivities(creatorIds: string[]): Promise<any[]> {
    return [];
}

export async function getNotifications(userId: string): Promise<any[]> {
    return [];
}

export async function getAnnouncementsForBusiness(bizId: string): Promise<any[]> {
    return [];
}

// --- ENQUIRY AND IN-APP CHAT FUNCTIONS ---

export async function addEnquiry(enquiry: Omit<Enquiry, 'id' | 'createdAt' | 'status'>) {
    try {
        const { data, error } = await supabase.from('enquiries').insert({
            user_id: enquiry.userId || null,
            vendor_owner_id: enquiry.vendorOwnerId,
            vendor_owner_email: enquiry.vendorOwnerEmail || null,
            text: enquiry.message || '',
            category: enquiry.category || null,
            created_at: new Date().toISOString()
        }).select('id').maybeSingle();

        if (error) throw error;
        const enquiryId = data ? data.id : `enq_${Math.random()}`;

        // Notify vendor of new enquiry
        if (enquiry.vendorOwnerId) {
            sendPushNotificationDirectly(
                enquiry.vendorOwnerId,
                '📩 New enquiry received',
                `You have a new enquiry${enquiry.category ? ` about ${enquiry.category}` : ''}`,
                { enquiryId }
            ).catch(() => {});
        }

        return enquiryId;
    } catch (error) {
        console.error("Error adding enquiry:", error);
        return null;
    }
}

export async function getEnquiriesForBusiness(businessId: string, userId: string): Promise<Enquiry[]> {
    try {
        const { data, error } = await supabase
            .from('enquiries')
            .select('*, profiles:profiles!enquiries_user_id_fkey(name)')
            .eq('vendor_owner_id', userId);

        if (error) throw error;
        return (data || []).map(e => ({
            id: e.id,
            businessId: businessId,
            businessName: 'Wedding Vendor',
            name: e.profiles?.name || 'Client',
            date: e.created_at,
            message: e.text,
            userId: e.user_id,
            vendorOwnerId: e.vendor_owner_id,
            vendorOwnerEmail: e.vendor_owner_email
        }));
    } catch (error) {
        console.error("Error fetching enquiries for business:", error);
        return [];
    }
}

export async function getOrCreateChatRoom(
  clientUid: string, 
  clientName: string, 
  vendorUid: string, 
  vendorName: string, 
  businessId: string,
  enquiryId?: string
): Promise<string> {
  try {
    const roomId = `${clientUid}_${vendorUid}_${businessId}`;
    const { error } = await supabase.from('chat_rooms').upsert({
        id: roomId,
        client_uid: clientUid,
        vendor_uid: vendorUid,
        status: 'active',
        created_at: new Date().toISOString(),
        last_read: {}
    });

    if (error) throw error;
    return roomId;
  } catch (error) {
    console.error("Error getOrCreateChatRoom:", error);
    throw error;
  }
}

export async function sendMessage(
  roomId: string, 
  senderId: string, 
  senderName: string, 
  text: string
): Promise<boolean> {
  try {
    const { error } = await supabase.from('messages').insert({
        room_id: roomId,
        sender_id: senderId,
        text: text,
        created_at: new Date().toISOString()
    });
    
    if (error) throw error;

    // Trigger push notification to the other chat member in background
    void (async () => {
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('client_uid, vendor_uid')
        .eq('id', roomId)
        .maybeSingle();

        if (room) {
          const recipientUid = senderId === room.client_uid ? room.vendor_uid : room.client_uid;
          if (recipientUid) {
            await Promise.resolve(
              sendPushNotificationDirectly(
                recipientUid,
                `New message from ${senderName}`,
                text.length > 60 ? `${text.substring(0, 60)}...` : text,
                { roomId, senderId },
                'likesAndComments'
              )
            );
          }
        }
    })().catch(err => console.warn('[sendMessage] Failed to query chat room for push:', err));

    return true;
  } catch (error) {
    console.error("Error sending message:", error);
    return false;
  }
}

export function onChatMessages(roomId: string, callback: (messages: ChatMessage[]) => void) {
  const fetchAndTrigger = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*, profiles(name)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (!error && data) {
          const list = data.map(m => ({
              id: m.id,
              senderId: m.sender_id,
              senderName: m.profiles?.name || 'User',
              text: m.text,
              createdAt: m.created_at
          }));
          callback(list);
      }
  };

  fetchAndTrigger();

  const channel = supabase
      .channel(`chat-room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, () => fetchAndTrigger())
      .subscribe();

  return () => {
      supabase.removeChannel(channel);
  };
}

export async function getUserChatRooms(userId: string, role: 'client' | 'vendor'): Promise<ChatRoom[]> {
  try {
    const field = role === 'client' ? 'client_uid' : 'vendor_uid';
    const { data, error } = await supabase
        .from('chat_rooms')
        .select('*, profiles(name)')
        .eq(field, userId);

    if (error) throw error;
    return (data || []).map(r => ({
        id: r.id,
        clientUid: r.client_uid,
        clientName: role === 'client' ? 'My Chat' : (r.profiles?.name || 'Client'),
        vendorUid: r.vendor_uid,
        vendorName: role === 'vendor' ? 'My Chat' : (r.profiles?.name || 'Vendor'),
        businessId: 'vendor-listing',
        createdAt: r.created_at,
        status: r.status,
        clientDeleted: r.client_deleted,
        vendorDeleted: r.vendor_deleted
    }));
  } catch (error) {
    console.error("Error fetching chat rooms:", error);
    return [];
  }
}

export async function closeChatRoom(roomId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('chat_rooms').update({ status: 'closed' }).eq('id', roomId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error closing chat room:", error);
    return false;
  }
}

export async function deleteChatRoom(roomId: string, role: 'client' | 'vendor'): Promise<boolean> {
  try {
    const field = role === 'client' ? 'client_deleted' : 'vendor_deleted';
    const { error } = await supabase.from('chat_rooms').update({ [field]: true }).eq('id', roomId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error deleting chat room:", error);
    return false;
  }
}

export function serializeDatabaseData<T>(data: T): T {
    return data;
}

export function generateEventJoinId(eventId: string): string {
    const cleanId = eventId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const parts = eventId.split('-');
    const suffix = parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
    const prefix = cleanId.slice(0, 4);

    if (suffix && suffix.length >= 3 && /^[A-Z0-9]+$/.test(suffix)) {
        return `${prefix}-${suffix}`;
    }

    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${randomSuffix}`;
}

export async function getEventByJoinId(joinId: string): Promise<Event | null> {
    try {
        const cleanJoinId = joinId.toUpperCase().trim();
        let { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('join_id', cleanJoinId);

        if (error) throw error;

        if (!data || data.length === 0) {
            const { data: allEvents, error: allErr } = await supabase
                .from('events')
                .select('*')
                .not('join_id', 'is', null);

            if (!allErr && allEvents) {
                const targetNormalized = cleanJoinId.replace(/[^A-Z0-9]/g, '');
                const matches = allEvents.filter(e => {
                    if (!e.join_id) return false;
                    const dbNormalized = e.join_id.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    return dbNormalized === targetNormalized;
                });
                if (matches.length > 0) {
                    data = matches;
                }
            }
        }

        if (!data || data.length === 0) return null;

        if (data.length > 1) {
            const mainEvent = data.find(e => e.type === 'main');
            if (mainEvent) return mapSqlToEvent(mainEvent);
        }
        return mapSqlToEvent(data[0]);
    } catch (error) {
        console.error("Error fetching event by joinId:", error);
        return null;
    }
}

export async function deleteGuest(logId: string) {
    try {
        const { error } = await supabase
            .from('guests')
            .delete()
            .eq('id', logId);
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error deleting guest:", error);
        return false;
    }
}

export const BUSINESS_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'Venue': { bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.3)', text: '#ec4899' }, // Pink
  'Photography': { bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)', text: '#38bdf8' }, // Sky Blue
  'Videography': { bg: 'rgba(129, 140, 248, 0.12)', border: 'rgba(129, 140, 248, 0.3)', text: '#818cf8' }, // Indigo
  'Catering': { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.3)', text: '#f97316' }, // Orange
  'Food Stalls': { bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.3)', text: '#eab308' }, // Yellow
  'Music & DJ': { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)', text: '#a855f7' }, // Purple
  'Lighting': { bg: 'rgba(253, 224, 71, 0.12)', border: 'rgba(253, 224, 71, 0.3)', text: '#fde047' }, // Gold/Yellow
  'Decor': { bg: 'rgba(20, 184, 166, 0.12)', border: 'rgba(20, 184, 166, 0.3)', text: '#20b8a6' }, // Teal
  'Event Planner': { bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.3)', text: '#f43f5e' }, // Rose
  'Security': { bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.3)', text: '#64748b' }, // Slate
  'Anchors': { bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)', text: '#06b6d4' }, // Cyan
  'Gifts': { bg: 'rgba(219, 39, 119, 0.12)', border: 'rgba(219, 39, 119, 0.3)', text: '#db2777' }, // Dark Pink
  'Travel': { bg: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.3)', text: '#0ea5e9' }, // Ocean Blue
  'Staff': { bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.3)', text: '#4ade80' }, // Green
  'Invitations': { bg: 'rgba(251, 146, 60, 0.12)', border: 'rgba(251, 146, 60, 0.3)', text: '#fb923c' }, // Light Orange
  'Makeup': { bg: 'rgba(244, 114, 182, 0.12)', border: 'rgba(244, 114, 182, 0.3)', text: '#f472b6' }, // Light Pink
  'Apparel': { bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.3)', text: '#a78bfa' }, // Violet
  'Trophies': { bg: 'rgba(250, 204, 21, 0.12)', border: 'rgba(250, 204, 21, 0.3)', text: '#facc15' }, // Bright Gold
};

export const getBusinessTypeColor = (type: string) => {
  const normalized = type ? type.trim() : '';
  const match = Object.keys(BUSINESS_TYPE_COLORS).find(
    key => key.toLowerCase() === normalized.toLowerCase()
  );
  if (match) {
    return BUSINESS_TYPE_COLORS[match];
  }
  return { bg: 'rgba(212, 175, 55, 0.12)', border: 'rgba(212, 175, 55, 0.25)', text: '#d4af37' };
};

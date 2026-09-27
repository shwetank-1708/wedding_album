"use client";

import React, { useEffect, useState, Suspense } from "react";
import { resolveEventCoverImage } from "@/lib/eventCovers";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";
import { getEvent } from "@/lib/events"; // Static Data
import { getEventPhotosPaginated, getEventById, getSubEvents, logGuestLogin, onGuestStatusChange, Event, Photo as DatabasePhoto, getFavouritePhotosForEvents, getEventFavouritePhotos } from "@/lib/database"; // Live Data
import { useAuth } from "@/context/AuthContext";
import { Loader2, Image as ImageIcon, ChevronLeft, ChevronDown, Share2, Check, Star, Layers3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import { getWebTemplateComponent } from "@/components/templateRegistry";
import { getWebLightboxTheme, getWebTemplateChrome } from "@/lib/webTemplateTheme";
import { supabase } from "@/lib/supabase";

function EventPageContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const slug = params.slug as string;
    const isShared = searchParams.get("shared") === "true";
    const { user, loading: authLoading, login, signup, authWithPhone } = useAuth();

    const [event, setEvent] = useState<Event | any | null>(null);
    const [subEvents, setSubEvents] = useState<Event[]>([]);
    const [photos, setPhotos] = useState<any[]>([]);
    const [mediaTotals, setMediaTotals] = useState({ photos: 0, videos: 0 });
    const [activeGallery, setActiveGallery] = useState<Event | null>(null);
    const [galleryMediaTab, setGalleryMediaTab] = useState<"photos" | "videos">("photos");
    const [showOnlyFavourites, setShowOnlyFavourites] = useState(false);
    const [favouriteMediaIds, setFavouriteMediaIds] = useState<Set<string>>(new Set());
    const [sourceGalleryFilter, setSourceGalleryFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Pagination State
    const [photoPage, setPhotoPage] = useState(0);
    const [hasMorePhotos, setHasMorePhotos] = useState(false);
    const [loadingMorePhotos, setLoadingMorePhotos] = useState(false);

    // Guest Tracking State
    const [showGuestModal, setShowGuestModal] = useState(false);
    const [guestStatus, setGuestStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected'>('idle');
    const [guestName, setGuestName] = useState("");
    const [guestPhone, setGuestPhone] = useState("");
    const [isLogging, setIsLogging] = useState(false);
    const [hasCheckedSession, setHasCheckedSession] = useState(false);
    const [stableIdentifier, setStableIdentifier] = useState<string | null>(null);
    const [entryMode, setEntryMode] = useState<'phone' | 'email'>('phone');
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [authError, setAuthError] = useState("");


    // Parallax logic
    const containerRef = useRef(null);

    useEffect(() => {
        if (!authLoading && slug) {
            loadEventData();
        }
    }, [authLoading, slug]);

    // Initial session check
    useEffect(() => {
        if (typeof window !== 'undefined' && !hasCheckedSession) {
            const saved = sessionStorage.getItem("wedding_guest_details");
            if (saved) {
                const details = JSON.parse(saved);
                setGuestName(details.name);
                setGuestPhone(details.phone);
                setStableIdentifier(details.phone);
            }
            setHasCheckedSession(true);
        }
    }, [hasCheckedSession]);

    // Real-time photo grid updates (syncing uploads and background resizing updates)
    useEffect(() => {
        if (!event?.id) return;

        const eventIds = Array.from(new Set([event.id, ...subEvents.map(s => s.id)].filter(Boolean)));
        const subscriptionSeed = Date.now();
        const channels = eventIds.map((id, index) => {
            return supabase
                .channel(`rt-photos-event-${id}-${subscriptionSeed}-${index}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'photos', filter: `event_id=eq.${id}` },
                    (payload) => {
                        console.log(`[Realtime] Received DB change on photos table for event ${id}:`, payload);
                        
                        if (payload.eventType === 'INSERT') {
                            loadGalleryPhotos(activeGallery || event, 0, false);
                        } else if (payload.eventType === 'UPDATE') {
                            setPhotos(prev => prev.map(p => {
                                if (p.id === payload.new.id) {
                                    return {
                                        ...p,
                                        thumbnailUrl: payload.new.thumbnail_url,
                                        width: payload.new.width || p.width,
                                        height: payload.new.height || p.height,
                                        src: payload.new.url || p.src,
                                    };
                                }
                                return p;
                            }));
                        } else if (payload.eventType === 'DELETE') {
                            setPhotos(prev => prev.filter(p => p.id !== payload.old.id));
                        }
                    }
                )
                .subscribe();
        });

        return () => {
            channels.forEach(ch => supabase.removeChannel(ch));
        };
    }, [event?.id, subEvents, activeGallery]);

    useEffect(() => {
        const ownerEventId = event?.parentId || event?.id;
        if (!ownerEventId) return;
        const channel = supabase.channel(`event-visibility-${ownerEventId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${ownerEventId}` }, payload => {
                const isPublic = payload.new.is_public === true;
                setEvent((previous: Event | null) => previous ? { ...previous, isPublic } : previous);
                if (!isPublic) setGuestStatus('idle');
            }).subscribe();
        return () => { void supabase.removeChannel(channel); };
    }, [event?.id, event?.parentId]);

    // Check for guest details or user approval if shared link
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        if (!event || loading) return;
        if (event.isPublic) {
            setGuestStatus('approved');
            setShowGuestModal(false);
            return;
        }
        if (isShared && !authLoading && hasCheckedSession) {
            // --- VIP BYPASS CHECK ---
            const isVIP = user && event && (
                user.role === 'admin' ||
                user.uid === event.createdBy ||
                (user.delegatedBy === event.createdBy && user.roleType === 'primary') ||
                user.assignedEvents?.includes(event.id) ||
                (event.parentId && user.assignedEvents?.includes(event.parentId))
            );

            if (isVIP) {
                console.log("[EventPage] VIP Access Granted. Bypassing guest logs.");
                setGuestStatus('approved');
                setShowGuestModal(false);
                return;
            }

            // Priority 1: Logged in user
            // Priority 2: Stable guest identifier (from session or submission)
            const ident = user ? (user.email || user.uid) : stableIdentifier;
            const dispName = user ? (user.name || "Logged User") : (guestName || "Guest");

            if (ident) {
                const logId = `${ident}_${slug}`;
                console.log(`[EventPage] Identification found: ${logId}. Starting listener...`);

                // 1. Listen for Current Event Status
                unsubscribe = onGuestStatusChange(logId, (status: any) => {
                    const currentStatus = status || 'pending';
                    console.log(`[EventPage] Listener update for ${logId}: ${currentStatus}`);

                    if (currentStatus === 'approved') {
                        setGuestStatus('approved');
                        setShowGuestModal(false);
                        return;
                    }

                    // 2. If not approved here, but we have a parent, check parent
                    if (event?.parentId) {
                        const parentLogId = `${ident}_${event.parentId}`;
                        onGuestStatusChange(parentLogId, (parentStatus: any) => {
                            if (parentStatus === 'approved') {
                                setGuestStatus('approved');
                                setShowGuestModal(false);
                            } else {
                                setGuestStatus(currentStatus);
                                setShowGuestModal(currentStatus !== 'approved');
                            }
                        });
                    } else {
                        setGuestStatus(currentStatus);
                        setShowGuestModal(currentStatus !== 'approved');
                    }
                });

                // Proactively log access for newly logged in users
                if (user && event && !loading && guestStatus === 'idle') {
                    logGuestAccess(dispName, ident);
                }
            } else if (guestStatus === 'idle') {
                // No ID found and not logged in - show the entry modal
                setShowGuestModal(true);
            }
        } else if (!isShared && !authLoading) {
            setGuestStatus('approved');
            setShowGuestModal(false);
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [isShared, user, authLoading, slug, event?.id, loading, hasCheckedSession, event?.parentId, event?.isPublic, stableIdentifier]);

    const logGuestAccess = async (name: string, identifier: string) => {
        if (!slug || !event) return;
        try {
            await logGuestLogin(
                name,
                identifier,
                slug,
                event.parentId || event.id, // Pass self as parent if main event
                event.title || "Shared Event",
                event.createdBy // Pass the owner ID
            );
        } catch (error) {
            console.error("Failed to log guest access:", error);
        }
    };

    const getPhoneLoginEmail = (phoneNumber: string) => `${phoneNumber.replace(/\D/g, "")}@phone-login.local`;

    const handleGuestAuthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError("");

        const isPhoneMode = entryMode === 'phone';
        const identifier = isPhoneMode ? guestPhone.trim() : email.trim();

        if (!identifier || !password.trim()) {
            setAuthError(isPhoneMode ? "Please enter phone number and password." : "Please enter email and password.");
            return;
        }

        if (password.length < 6) {
            setAuthError("Password should be at least 6 characters.");
            return;
        }

        if (isSignUp) {
            if (!guestName.trim()) {
                setAuthError("Please enter your name.");
                return;
            }

            if (password !== confirmPassword) {
                setAuthError("Passwords do not match.");
                return;
            }
        }

        setIsLogging(true);
        try {
            let success = false;
            let stableId = identifier;

            if (isSignUp) {
                if (isPhoneMode) {
                    const result = await authWithPhone(guestName, guestPhone, password);
                    success = result.success;
                    if (!success && result.error) setAuthError(result.error);
                } else {
                    const result = await signup(email, password, guestName);
                    if (result.needsEmailVerification) {
                        setAuthError(`A confirmation link has been sent to ${email.trim()}. Please confirm your email before signing in.`);
                        return;
                    }
                    success = result.success;
                    if (!success && result.error) setAuthError(result.error);
                }
            } else {
                const loginId = isPhoneMode ? getPhoneLoginEmail(guestPhone) : email;
                stableId = loginId;
                const result = await login(loginId, password);
                success = result.success;
                if (!success && result.error) setAuthError(result.error);
            }

            if (success) {
                const sessionDetails = {
                    name: guestName || email || guestPhone,
                    phone: stableId
                };

                sessionStorage.setItem("wedding_guest_details", JSON.stringify(sessionDetails));
                setStableIdentifier(stableId);
                setShowGuestModal(false);
            } else {
                setAuthError(isSignUp ? "Failed to create account. Please check your details." : "Invalid login details.");
            }
        } catch (err) {
            console.error("Guest auth failed:", err);
            setAuthError("Something went wrong. Please try again.");
        } finally {
            setIsLogging(false);
        }
    };

    const transformPhotos = (databasePhotos: DatabasePhoto[]) => databasePhotos.map(p => ({
        id: p.id,
        eventId: p.eventId,
        src: p.url || "",
        storageKey: p.storageKey || "",
        width: p.width || 800,
        height: p.height || 600,
        filename: p.storageKey ? p.storageKey.split('/').pop() : 'photo',
        thumbnailUrl: p.thumbnailUrl || p.url || "",
        mediaType: p.mediaType,
        resourceType: p.resourceType
    }));

    const loadGalleryPhotos = async (gallery: Event, page = 0, append = false, overrideSubEvents?: Event[]) => {
        if (!append) {
            const favouriteRows = await getEventFavouritePhotos(gallery.id);
            setFavouriteMediaIds(new Set(favouriteRows.map(row => row.photoId)));
        }
        const currentMainEvent = gallery.type === 'main' ? gallery : event;
        const subEventList = overrideSubEvents || subEvents;

        if (!gallery.parentId && (currentMainEvent || gallery.type === 'main')) {
            const rootId = gallery.type === 'main' ? gallery.id : currentMainEvent?.id;
            const eventIds = Array.from(new Set([
                rootId,
                gallery.legacyId,
                currentMainEvent?.legacyId,
                ...subEventList.flatMap(s => [s.id, s.legacyId]),
            ].filter(Boolean) as string[]));
            if (eventIds.length > 0) {
                const favPhotos = await getFavouritePhotosForEvents(eventIds);
                if (favPhotos.length > 0) {
                    const transformedFavs = transformPhotos(favPhotos as DatabasePhoto[]);
                    setFavouriteMediaIds(new Set(transformedFavs.map(photo => photo.id).filter(Boolean)));
                    setPhotos(prev => append ? [...prev, ...transformedFavs] : transformedFavs);
                    const photoCount = transformedFavs.filter(p => p.mediaType !== "video" && p.resourceType !== "video").length;
                    const videoCount = transformedFavs.filter(p => p.mediaType === "video" || p.resourceType === "video").length;
                    setMediaTotals({ photos: photoCount, videos: videoCount });
                    setHasMorePhotos(false);
                    return;
                }
            }
        }

        const { photos: databasePhotos, hasMore, totalPhotos, totalVideos } = await getEventPhotosPaginated(gallery.id, gallery.legacyId, page, 20);
        const transformedPhotos = transformPhotos(databasePhotos as DatabasePhoto[]);

        setPhotos(prev => append ? [...prev, ...transformedPhotos] : transformedPhotos);
        setMediaTotals({ photos: totalPhotos, videos: totalVideos });
        setPhotoPage(page);
        setHasMorePhotos(hasMore);
    };

    const loadEventData = async () => {
        setLoading(true);
        console.log(`[EventPage] Loading event for slug: ${slug}, isShared: ${isShared}`);

        try {
            // 1. Get Event Details
            let eventData: Event | null = null;
            try {
                eventData = await getEventById(slug, true);
            } catch (e: any) {
                console.error("[EventPage] Error fetching from Supabase database:", e);
                if (e.message?.includes("permissions")) {
                    setError("permissions");
                }
            }

            // Fallback to Static Data
            if (!eventData && !error) {
                console.log("[EventPage] Event not found in Supabase database, checking static data...");
                eventData = getEvent(slug);
            }

            if (!eventData) {
                setEvent(null);
                setLoading(false);
                return;
            }

            // Sub-gallery links inherit the parent event's current visibility.
            if (eventData.parentId) {
                const parentEvent = await getEventById(eventData.parentId, true);
                eventData.isPublic = !!parentEvent?.isPublic;
            }

            // Resolve event cover image to preview format
            eventData.coverImage = resolveEventCoverImage(eventData.coverImage, 'preview');

            setEvent(eventData);

            // 2. Branch logic based on Event Type
            if (eventData.type === 'main') {
                // Fetch Home gallery media and sub-galleries so web follows the same structure as mobile.
                console.log(`[EventPage] Main event detected. Fetching home gallery and sub-events for: ${eventData.id}`);
                const data = await getSubEvents(eventData.id, eventData.legacyId);
                const resolvedSubEvents = data.map(sub => ({
                    ...sub,
                    coverImage: resolveEventCoverImage(sub.coverImage, 'thumbnail')
                }));
                setSubEvents(resolvedSubEvents);
                setActiveGallery(null);
                setGalleryMediaTab("photos");
                await loadGalleryPhotos(eventData, 0, false, resolvedSubEvents);
            } else {
                // Fetch Photos (Sub-event or single gallery)
                console.log(`[EventPage] Sub-view detected. Fetching photos for: ${eventData.id}`);

                // NEW: Fetch Parent & Siblings for Navbar
                if (eventData.parentId) {
                    try {
                        const pEvent = await getEventById(eventData.parentId);
                        if (pEvent) {
                            pEvent.coverImage = resolveEventCoverImage(pEvent.coverImage, 'preview');
                            const siblings = await getSubEvents(pEvent.id, pEvent.legacyId);
                            const resolvedSiblings = siblings.map(sub => ({
                                ...sub,
                                coverImage: resolveEventCoverImage(sub.coverImage, 'thumbnail')
                            }));
                            setSubEvents(resolvedSiblings);
                        }
                    } catch (err) {
                        console.error("Error fetching parent event context:", err);
                    }
                }

                setActiveGallery(eventData);
                setGalleryMediaTab("photos");
                await loadGalleryPhotos(eventData, 0, false);
            }
        } catch (err: any) {
            console.error("[EventPage] Critical error:", err);
            setError(err.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    const loadMorePhotos = async () => {
        const currentGallery = activeGallery || event;
        if (!currentGallery || loadingMorePhotos || !hasMorePhotos) return;

        setLoadingMorePhotos(true);
        try {
            const nextPage = photoPage + 1;
            await loadGalleryPhotos(currentGallery, nextPage, true);
        } catch (error) {
            console.error("Error loading more photos:", error);
        } finally {
            setLoadingMorePhotos(false);
        }
    };

    const handleShare = () => {
        const shareUrl = `${window.location.origin}/events/${slug}?shared=true`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (authLoading || loading) {
        return <LoadingScreen message="Loading your gallery" />;
    }

    if (!event) {
        return (
            <main className="relative" ref={containerRef}>
                {notFound()}
            </main>
        );
    }

    if (error === "permissions" && !user && !isShared) {
        return (
            <main className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4 text-center relative" ref={containerRef}>
                <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
                <p className="text-stone-700 mb-8 max-w-md">
                    This gallery is private. Please log in to view your memories.
                </p>
                <button
                    onClick={() => window.location.href = "/login"}
                    className="px-8 py-3 bg-slate-900 text-white rounded-full font-bold shadow-lg hover:bg-slate-800 transition-all"
                >
                    Log In
                </button>
            </main>
        );
    }

    const photoItems = photos.filter(photo => photo.mediaType !== "video" && photo.resourceType !== "video" && !!(photo.thumbnailUrl || photo.src));
    const videoItems = photos.filter(photo => photo.mediaType === "video" || photo.resourceType === "video");
    const selectedMediaItems = galleryMediaTab === "videos" ? videoItems : photoItems;
    const isPrimaryGalleryView = !activeGallery;
    const sourceGalleryOptions = [event, ...subEvents]
        .filter((gallery): gallery is Event => !!gallery)
        .map(gallery => ({
            id: gallery.id,
            label: gallery.id === event.id ? "Main event" : gallery.title,
            legacyId: gallery.legacyId,
            count: selectedMediaItems.filter(photo => photo.eventId === gallery.id || (!!gallery.legacyId && photo.eventId === gallery.legacyId)).length,
        }))
        .filter(option => option.count > 0);
    const effectiveSourceGalleryFilter = sourceGalleryOptions.some(option => option.id === sourceGalleryFilter)
        ? sourceGalleryFilter
        : "all";
    const isFavouriteFilterActive = !isPrimaryGalleryView && showOnlyFavourites;
    const sourceFilteredMediaItems = isPrimaryGalleryView && effectiveSourceGalleryFilter !== "all"
        ? selectedMediaItems.filter(photo => {
            const source = sourceGalleryOptions.find(option => option.id === effectiveSourceGalleryFilter);
            return photo.eventId === source?.id || (!!source?.legacyId && photo.eventId === source.legacyId);
        })
        : selectedMediaItems;
    const activeGalleryItems = isFavouriteFilterActive
        ? sourceFilteredMediaItems.filter(photo => favouriteMediaIds.has(photo.id))
        : sourceFilteredMediaItems;
    const activeFavouriteCount = selectedMediaItems.filter(photo => favouriteMediaIds.has(photo.id)).length;
    const displayedPhotoCount = mediaTotals.photos || photoItems.length;
    const displayedVideoCount = mediaTotals.videos || videoItems.length;
    const activeGalleryTitle = activeGallery?.title || event.title || "Home";
    const displayEvent = activeGallery
        ? {
            ...event,
            title: activeGallery.title || event.title,
            date: activeGallery.date || event.date,
            description: activeGallery.description || "",
            coverImage: activeGallery.coverImage || event.coverImage,
            templateId: activeGallery.templateId || event.templateId,
        }
        : event;
    const activeGalleryMessage = activeGallery ? activeGallery.description : event.description;

    const renderContent = () => (
        <div className="contents">
            <div className="mb-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                    onClick={() => {
                        const backUrl = event?.parentId ? `/events/${event.parentId}` : "/gallery";
                        router.push(`${backUrl}${isShared ? "?shared=true" : ""}`);
                    }}
                    className="text-stone-700 hover:text-stone-900 transition-colors text-sm font-bold tracking-widest uppercase flex items-center group"
                >
                    <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
                    {event?.parentId ? "Back to Event" : "Back to Gallery"}
                </button>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleShare}
                        className="flex items-center space-x-2 px-6 py-3 bg-white border border-stone-200 text-stone-600 rounded-full text-sm font-bold hover:bg-stone-50 transition-all shadow-sm hover:shadow-md group active:scale-95"
                    >
                        <AnimatePresence mode="wait">
                            {copied ? (
                                <motion.div
                                    key="check"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    className="flex items-center space-x-2 text-green-600"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Link Copied!</span>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="share"
                                    initial={{ opacity: 0, scale: 0.5 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.5 }}
                                    className="flex items-center space-x-2 group-hover:text-stone-900"
                                >
                                    <Share2 className="w-4 h-4" />
                                    <span>Share Event</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </button>
                </div>
            </div>

            <div className="mt-12">
                <SectionHeader
                    title={activeGallery ? activeGalleryTitle : "Home Gallery"}
                    subtitle={`${displayedPhotoCount} Photos · ${displayedVideoCount} Videos`}
                />

                {activeGalleryMessage && (
                    <p className="mx-auto mt-5 max-w-3xl text-center font-sans text-sm font-semibold leading-7 text-stone-600 md:text-base">
                        {activeGalleryMessage}
                    </p>
                )}

                <div className="mt-10 inline-flex rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
                    {([
                        { id: "photos", label: `Photos (${displayedPhotoCount})` },
                        { id: "videos", label: `Videos (${displayedVideoCount})` },
                    ] as const).map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setGalleryMediaTab(item.id)}
                            className={cn(
                                "rounded-xl px-5 py-3 text-xs font-black uppercase tracking-widest transition-all",
                                galleryMediaTab === item.id
                                    ? "bg-slate-900 text-white shadow-sm"
                                    : "text-stone-500 hover:text-stone-900"
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <div className="mt-4">
                    {isPrimaryGalleryView ? (
                    <label className="flex w-full max-w-md items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-left shadow-sm">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-700">
                            <Layers3 className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold text-stone-800">Source gallery</span>
                            <span className="mt-0.5 block text-xs text-stone-500">Show media selected from</span>
                        </span>
                        <select
                            value={effectiveSourceGalleryFilter}
                            onChange={(event) => setSourceGalleryFilter(event.target.value)}
                            className="max-w-[13rem] rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-800 outline-none focus:border-slate-700"
                            aria-label="Filter by source gallery"
                        >
                            <option value="all">All galleries ({selectedMediaItems.length})</option>
                            {sourceGalleryOptions.map(option => (
                                <option key={option.id} value={option.id}>{option.label} ({option.count})</option>
                            ))}
                        </select>
                    </label>
                    ) : (
                    <button
                        type="button"
                        role="switch"
                        aria-checked={showOnlyFavourites}
                        onClick={() => setShowOnlyFavourites(current => !current)}
                        className={cn(
                            "flex w-full max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-left shadow-sm transition-colors",
                            showOnlyFavourites
                                ? "border-slate-900 bg-slate-900"
                                : "border-stone-200 bg-white hover:border-stone-400"
                        )}
                    >
                        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", showOnlyFavourites ? "bg-white text-slate-900" : "bg-stone-100 text-stone-600")}>
                            <Star className={cn("h-4 w-4", showOnlyFavourites && "fill-current")} />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className={cn("block text-sm font-bold", showOnlyFavourites ? "text-white" : "text-stone-800")}>Favourites only</span>
                            <span className={cn("mt-0.5 block text-xs", showOnlyFavourites ? "text-slate-300" : "text-stone-500")}>{activeFavouriteCount} in {galleryMediaTab === "videos" ? "Videos" : "Photos"}</span>
                        </span>
                        <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", showOnlyFavourites ? "bg-white/35" : "bg-stone-200")}>
                            <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform", showOnlyFavourites ? "translate-x-5" : "translate-x-0.5")} />
                        </span>
                    </button>
                    )}
                </div>

                {activeGalleryItems.length > 0 ? (
                    <div className="mt-8">
                        <MasonryGrid
                            photos={activeGalleryItems}
                            eventSlug={slug}
                            disableDownload={isShared && !user}
                            lightboxTheme={getWebLightboxTheme((activeGallery || event).templateId || event.templateId)}
                            templateId={(activeGallery || event).templateId || event.templateId}
                        />
                    </div>
                ) : (
                    <div className="text-center py-32 opacity-50">
                        <ImageIcon className="w-16 h-16 mx-auto mb-6 text-stone-600" />
                        {error === "permissions" ? (
                            <>
                                <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Moments restricted...</h2>
                                <p className="font-sans text-stone-600 text-sm">Owner: Check Supabase database rules to enable shared access.</p>
                            </>
                        ) : (
                            <>
                                <h2 className="text-2xl font-serif italic text-stone-600 mb-2">
                                    {isFavouriteFilterActive
                                        ? `No favourite ${galleryMediaTab === "videos" ? "videos" : "photos"} in this gallery yet.`
                                        : galleryMediaTab === "videos" ? "No videos yet." : "No photos yet."}
                                </h2>
                                <p className="font-sans text-stone-600 text-sm">Check back soon to see the captured memories.</p>
                            </>
                        )}
                    </div>
                )}

                {/* LOAD MORE BUTTON */}
                {hasMorePhotos && photos.length > 0 && (
                    <div className="flex justify-center mt-16 mb-8 w-full">
                        <button
                            onClick={loadMorePhotos}
                            disabled={loadingMorePhotos}
                            className="px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-bold shadow-xl flex items-center space-x-3 transition-all hover:scale-105 active:scale-95"
                        >
                            {loadingMorePhotos ? (
                                <Loader2 className="w-5 h-5 animate-spin text-white/70" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-white/70" />
                            )}
                            <span className="tracking-widest uppercase text-sm">
                                {loadingMorePhotos ? "Loading..." : "Load More Media"}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    const TemplateComponent = getWebTemplateComponent(displayEvent.templateId);
    const templateChrome = getWebTemplateChrome(displayEvent.templateId);

    return (
        <main
            className="event-template-shell min-h-screen relative"
            ref={containerRef}
            style={{
                "--event-template-primary": templateChrome.background,
                "--event-template-text": templateChrome.text,
                "--event-template-muted": templateChrome.muted,
                "--event-template-accent": templateChrome.accent,
                "--event-template-border": templateChrome.border,
            } as React.CSSProperties}
        >
            <TemplateComponent
                event={displayEvent}
                subEvents={[]}
                photos={[]}
                isShared={isShared}
                user={user}
                onBack={() => {
                    const backUrl = event?.parentId ? `/events/${event.parentId}` : "/gallery";
                    router.push(`${backUrl}${isShared ? "?shared=true" : ""}`);
                }}
                onShare={handleShare}
                canManage={false}
                hasParent={!!event?.parentId}
                copied={copied}
                error={error}
            >
                {renderContent()}
            </TemplateComponent>
            {/* Guest Entry Modal */}
            <AnimatePresence>
                {showGuestModal && !event?.isPublic && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/20"
                        >
                            <div className="p-10 text-center">
                                <div className="w-20 h-20 bg-royal-gold/10 rounded-full flex items-center justify-center mx-auto mb-6 text-royal-gold">
                                    {guestStatus === 'pending' ? <Loader2 className="w-10 h-10 animate-spin" /> : <ImageIcon size={40} />}
                                </div>

                                {guestStatus === 'pending' ? (
                                    <>
                                        <h2 className="text-3xl font-bold mb-3 font-serif text-slate-800">Hang Tight, {guestName.split(' ')[0]}! ✨</h2>
                                        <p className="text-slate-700 mb-8 font-sans leading-relaxed">
                                            We have sent your request to the event admin. You will be admitted as soon as they grant access.
                                        </p>
                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-center space-x-3">
                                            <div className="w-2 h-2 rounded-full bg-royal-gold animate-pulse" />
                                            <span className="text-xs font-bold uppercase tracking-widest text-stone-600">Waiting for approval</span>
                                        </div>
                                    </>
                                ) : guestStatus === 'rejected' ? (
                                    <>
                                        <h2 className="text-3xl font-bold mb-3 font-serif text-slate-800">Access Restricted</h2>
                                        <p className="text-slate-700 mb-8 font-sans leading-relaxed">
                                            The admin has declined this access request. Please contact the host for support.
                                        </p>
                                        <button
                                            onClick={() => setGuestStatus('idle')}
                                            className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest transition-all active:scale-95 shadow-xl"
                                        >
                                            Try Again
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex p-1 bg-stone-100 rounded-2xl mb-8">
                                            <button
                                                onClick={() => {
                                                    setEntryMode('phone');
                                                    setAuthError("");
                                                }}
                                                className={cn(
                                                    "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                                    entryMode === 'phone' ? "bg-white text-slate-800 shadow-sm" : "text-stone-600 hover:text-stone-600"
                                                )}
                                            >
                                                Phone Login
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEntryMode('email');
                                                    setAuthError("");
                                                }}
                                                className={cn(
                                                    "flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                                    entryMode === 'email' ? "bg-white text-slate-800 shadow-sm" : "text-stone-600 hover:text-stone-600"
                                                )}
                                            >
                                                Email Login
                                            </button>
                                        </div>

                                        <h2 className="text-3xl font-bold mb-3 font-serif text-slate-800">
                                            {isSignUp ? "Create Account" : "Welcome Back"}
                                        </h2>
                                        <p className="text-slate-700 mb-8 font-sans leading-relaxed text-sm">
                                            {isSignUp ? "Sign up to request access to this private event." : "Log in to request access to this private event."}
                                        </p>

                                        <form onSubmit={handleGuestAuthSubmit} className="space-y-6">
                                            <div className="space-y-4 text-left">
                                                {isSignUp && (
                                                    <div className="relative group">
                                                        <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1 mb-2 block">Name</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Your Name"
                                                            required
                                                            value={guestName}
                                                            onChange={(e) => setGuestName(e.target.value)}
                                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold transition-all font-sans"
                                                        />
                                                    </div>
                                                )}

                                                {entryMode === 'phone' ? (
                                                    <div className="relative group">
                                                        <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1 mb-2 block">Phone Number</label>
                                                        <input
                                                            type="tel"
                                                            placeholder="10-digit number"
                                                            required
                                                            value={guestPhone}
                                                            onChange={(e) => setGuestPhone(e.target.value)}
                                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold transition-all font-sans"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="relative group">
                                                        <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1 mb-2 block">Email Address</label>
                                                        <input
                                                            type="email"
                                                            placeholder="name@email.com"
                                                            required
                                                            value={email}
                                                            onChange={(e) => setEmail(e.target.value)}
                                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold transition-all font-sans"
                                                        />
                                                    </div>
                                                )}

                                                <div className="relative group">
                                                    <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1 mb-2 block">Password</label>
                                                    <input
                                                        type="password"
                                                        placeholder="••••••••"
                                                        required
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold transition-all font-sans"
                                                    />
                                                </div>

                                                {isSignUp && (
                                                    <div className="relative group">
                                                        <label className="text-[10px] font-bold text-stone-600 uppercase tracking-widest ml-1 mb-2 block">Confirm Password</label>
                                                        <input
                                                            type="password"
                                                            placeholder="••••••••"
                                                            required
                                                            value={confirmPassword}
                                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold transition-all font-sans"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            {authError && (
                                                <div className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-2xl border border-red-100">
                                                    {authError}
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={isLogging}
                                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-xl flex items-center justify-center space-x-3"
                                            >
                                                {isLogging ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>{isSignUp ? "Sign Up & Access" : "Login & Access"}</span>}
                                            </button>
                                        </form>

                                        <div className="mt-8 text-center pt-6 border-t border-stone-100">
                                            <p className="text-slate-700 text-sm">
                                                {isSignUp ? "Already have an account?" : "Do not have an account?"}
                                                <button
                                                    onClick={() => {
                                                        setIsSignUp(!isSignUp);
                                                        setAuthError("");
                                                    }}
                                                    className="ml-2 font-bold text-sky-600 hover:text-sky-800 transition-colors underline decoration-2 underline-offset-4"
                                                >
                                                    {isSignUp ? "Login here" : "Sign Up"}
                                                </button>
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </main>
    );
}

export default function EventPage() {
    return (
        <Suspense fallback={<LoadingScreen message="Loading your gallery" />}>
            <EventPageContent />
        </Suspense>
    );
}

"use client";

import React, { useEffect, useState, Suspense } from "react";
import { resolveEventCoverImage } from "@/lib/eventCovers";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";
import { getEvent } from "@/lib/events"; // Static Data
import { getEventPhotosPaginated, getEventById, getSubEvents, logGuestLogin, onGuestStatusChange, Event, Photo as DatabasePhoto, getFavouritePhotosForEvents } from "@/lib/database"; // Live Data
import { EventNavbar } from "@/components/EventNavbar";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Image as ImageIcon, ChevronLeft, ChevronDown, Share2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
import { getWebTemplateComponent } from "@/components/templateRegistry";
import { getWebLightboxTheme, getWebTemplateChrome } from "@/lib/webTemplateTheme";
import { FindYouSection } from "@/components/FindYouSection";
import { supabase } from "@/lib/supabase";
import { downloadGalleryAsZip } from "@/lib/zipDownload";

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
    const [activeVirtualGallery, setActiveVirtualGallery] = useState<"favourite" | null>(null);
    const [galleryMediaTab, setGalleryMediaTab] = useState<"photos" | "videos">("photos");
    const [activePage, setActivePage] = useState<"gallery" | "find-you">("gallery");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isZipping, setIsZipping] = useState(false);
    const [zipProgress, setZipProgress] = useState(0);

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
    const [hasHandledInitialHash, setHasHandledInitialHash] = useState(false);
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

    useEffect(() => {
        if (loading || !event || hasHandledInitialHash || typeof window === "undefined") return;
        if (window.location.hash === "#favourite") {
            setHasHandledInitialHash(true);
            void selectFavouriteGallery();
            return;
        }
        setHasHandledInitialHash(true);
    }, [loading, event?.id, hasHandledInitialHash]);

    const activeTemplateId = (activeGallery || event)?.templateId || event?.templateId;

    useEffect(() => {
        if (!activeTemplateId || typeof document === "undefined") return;

        const chrome = getWebTemplateChrome(activeTemplateId);
        const root = document.documentElement;

        root.dataset.eventTemplateChrome = "true";
        root.style.setProperty("--event-template-primary", chrome.background);
        root.style.setProperty("--event-template-text", chrome.text);
        root.style.setProperty("--event-template-muted", chrome.muted);
        root.style.setProperty("--event-template-accent", chrome.accent);
        root.style.setProperty("--event-template-border", chrome.border);

        return () => {
            delete root.dataset.eventTemplateChrome;
            root.style.removeProperty("--event-template-primary");
            root.style.removeProperty("--event-template-text");
            root.style.removeProperty("--event-template-muted");
            root.style.removeProperty("--event-template-accent");
            root.style.removeProperty("--event-template-border");
        };
    }, [activeTemplateId]);

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
                            if (activeVirtualGallery === 'favourite') {
                                loadFavouritePhotos();
                            } else {
                                loadGalleryPhotos(activeGallery || event, 0, false);
                            }
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
    }, [event?.id, subEvents, activeGallery, activeVirtualGallery]);

    // Check for guest details or user approval if shared link
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

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
    }, [isShared, user, authLoading, slug, event?.id, loading, hasCheckedSession, event?.parentId, stableIdentifier]);

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

    const [parentEvent, setParentEvent] = useState<Event | null>(null);

    // ... (keep existing state)

    const transformPhotos = (databasePhotos: DatabasePhoto[]) => databasePhotos.map(p => ({
        id: p.id,
        src: p.url || "",
        storageKey: p.storageKey || "",
        width: p.width || 800,
        height: p.height || 600,
        filename: p.storageKey ? p.storageKey.split('/').pop() : 'photo',
        thumbnailUrl: p.thumbnailUrl,
        mediaType: p.mediaType,
        resourceType: p.resourceType
    }));

    const loadGalleryPhotos = async (gallery: Event, page = 0, append = false) => {
        if (!gallery.parentId && event) {
            const eventIds = Array.from(new Set([event.id, ...subEvents.map(s => s.id)].filter(Boolean)));
            if (eventIds.length > 0) {
                const favPhotos = await getFavouritePhotosForEvents(eventIds);
                if (favPhotos.length > 0) {
                    const transformedFavs = transformPhotos(favPhotos as DatabasePhoto[]);
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

    const getFavouriteEventIds = () => {
        const ids = [
            parentEvent?.id,
            event?.parentId,
            event?.id,
            ...subEvents.map(sub => sub.id),
        ].filter(Boolean) as string[];

        return Array.from(new Set(ids));
    };

    const loadFavouritePhotos = async () => {
        const eventIds = getFavouriteEventIds();

        if (eventIds.length === 0) {
            setPhotos([]);
            setMediaTotals({ photos: 0, videos: 0 });
            setPhotoPage(0);
            setHasMorePhotos(false);
            return;
        }

        const databasePhotos = await getFavouritePhotosForEvents(eventIds);
        const transformedPhotos = transformPhotos(databasePhotos);
        const favouritePhotoCount = transformedPhotos.filter(photo => photo.mediaType !== "video" && photo.resourceType !== "video").length;
        const favouriteVideoCount = transformedPhotos.filter(photo => photo.mediaType === "video" || photo.resourceType === "video").length;
        setPhotos(transformedPhotos);
        setMediaTotals({ photos: favouritePhotoCount, videos: favouriteVideoCount });
        setPhotoPage(0);
        setHasMorePhotos(false);
    };

    const selectGallery = async (gallery: Event | null) => {
        const targetGallery = gallery || event;
        if (!targetGallery) return;

        setActiveVirtualGallery(null);
        setActiveGallery(gallery);
        setGalleryMediaTab("photos");
        setLoadingMorePhotos(false);

        try {
            await loadGalleryPhotos(targetGallery, 0, false);
        } catch (err) {
            console.error("Error loading gallery photos:", err);
            setPhotos([]);
            setMediaTotals({ photos: 0, videos: 0 });
            setHasMorePhotos(false);
        }
    };

    const selectFavouriteGallery = async () => {
        setActivePage("gallery");
        setActiveVirtualGallery("favourite");
        setActiveGallery(null);
        setGalleryMediaTab("photos");
        setLoadingMorePhotos(false);

        try {
            await loadFavouritePhotos();
        } catch (err) {
            console.error("Error loading favourite photos:", err);
            setPhotos([]);
            setMediaTotals({ photos: 0, videos: 0 });
            setHasMorePhotos(false);
        }
    };

    const loadEventData = async () => {
        setLoading(true);
        console.log(`[EventPage] Loading event for slug: ${slug}, isShared: ${isShared}`);

        try {
            // 1. Get Event Details
            let eventData: Event | null = null;
            try {
                eventData = await getEventById(slug);
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
                setParentEvent(null);
                setActiveGallery(null);
                setActiveVirtualGallery(null);
                setGalleryMediaTab("photos");
                await loadGalleryPhotos(eventData, 0, false);
            } else {
                // Fetch Photos (Sub-event or single gallery)
                console.log(`[EventPage] Sub-view detected. Fetching photos for: ${eventData.id}`);

                // NEW: Fetch Parent & Siblings for Navbar
                if (eventData.parentId) {
                    try {
                        const pEvent = await getEventById(eventData.parentId);
                        if (pEvent) {
                            pEvent.coverImage = resolveEventCoverImage(pEvent.coverImage, 'preview');
                            setParentEvent(pEvent);
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
                setActiveVirtualGallery(null);
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
        if (activeVirtualGallery) return;

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

    const photoItems = photos.filter(photo => photo.mediaType !== "video" && photo.resourceType !== "video" && !!photo.thumbnailUrl);
    const videoItems = photos.filter(photo => photo.mediaType === "video" || photo.resourceType === "video");
    const activeGalleryItems = galleryMediaTab === "videos" ? videoItems : photoItems;
    const displayedPhotoCount = mediaTotals.photos || photoItems.length;
    const displayedVideoCount = mediaTotals.videos || videoItems.length;
    const activeGalleryTitle = activeVirtualGallery === "favourite" ? "Favourite" : activeGallery?.title || event.title || "Home";
    const activeGalleryId = activeVirtualGallery === "favourite" ? "__favourite__" : activeGallery?.id || event.id;
    const displayEvent = activeVirtualGallery === "favourite"
        ? {
            ...event,
            title: "Favourite",
            description: `Your favourite photos from ${event.title || "this event"}.`,
        }
        : activeGallery
        ? {
            ...event,
            title: activeGallery.title || event.title,
            date: activeGallery.date || event.date,
            description: activeGallery.description || "",
            coverImage: activeGallery.coverImage || event.coverImage,
            templateId: activeGallery.templateId || event.templateId,
        }
        : event;
    const activeGalleryMessage = activeVirtualGallery === "favourite" ? displayEvent.description : activeGallery ? activeGallery.description : event.description;

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
                    title={activeVirtualGallery === "favourite" ? activeGalleryTitle : activeGallery ? activeGalleryTitle : "Home Gallery"}
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
                                    {activeVirtualGallery === "favourite"
                                        ? "No favourite photos yet."
                                        : galleryMediaTab === "videos"
                                            ? "No videos yet."
                                            : "No photos yet."}
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

    // Determine Navbar Props
    const navMainTitle = parentEvent ? parentEvent.title : event.title;
    const navMainId = event.parentId || event.id;

    // Build Find You event IDs (current event + parent if sub-event)
    const findYouEventIds = [event.id];
    if (event.parentId) findYouEventIds.push(event.parentId);

    const handleDownloadZip = async () => {
        if (!photos || photos.length === 0) {
            alert("No photos or videos to download in this gallery.");
            return;
        }
        setIsZipping(true);
        setZipProgress(0);
        try {
            const title = activeGallery?.title || event?.title || "Gallery";
            await downloadGalleryAsZip(
                title,
                photos.map(p => ({
                    id: p.id,
                    url: p.src || p.url,
                    filename: p.filename,
                    mediaType: p.mediaType,
                    resourceType: p.resourceType,
                })),
                (percent) => setZipProgress(percent)
            );
        } catch (err: any) {
            alert(err.message || "Failed to generate zip file.");
        } finally {
            setIsZipping(false);
            setZipProgress(0);
        }
    };

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
            <EventNavbar
                mainEventTitle={navMainTitle}
                mainEventId={navMainId}
                subEvents={subEvents}
                isShared={isShared}
                basePath={`/events/${navMainId}`}
                activeGalleryId={activeGalleryId}
                activePage={activePage}
                onSelectGallery={(gallery) => {
                    setActivePage("gallery");
                    selectGallery(gallery || parentEvent || null);
                }}
                onFindYou={() => router.push(`/events/${navMainId}/find-you${isShared ? "?shared=true" : ""}`)}
                onDownloadZip={handleDownloadZip}
                isZipping={isZipping}
                zipProgress={zipProgress}
                chromeBackgroundColor={templateChrome.background}
                chromeTextColor={templateChrome.text}
                chromeAccentColor={templateChrome.accent}
                chromeBorderColor={templateChrome.border}
            />
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
                {activePage === "find-you" ? (
                    <div className="py-12 px-4">
                        <div className="text-center mb-10">
                            <p className="text-xs font-black uppercase tracking-widest text-stone-500 mb-2">AI Photo Search</p>
                            <h2 className="text-3xl md:text-4xl font-serif italic text-stone-900 mb-3">Find You</h2>
                            <p className="text-stone-500 text-sm">Upload a selfie to find all your photos from this event</p>
                        </div>
                        <FindYouSection
                            eventId={event.id}
                            legacyId={event.legacyId}
                            parentId={event.parentId}
                            subEventIds={subEvents.map(s => s.id)}
                            eventSlug={slug}
                            lightboxTheme={getWebLightboxTheme(event.templateId)}
                        />
                    </div>
                ) : (
                    renderContent()
                )}
            </TemplateComponent>
            {/* Guest Entry Modal */}
            <AnimatePresence>
                {showGuestModal && (
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

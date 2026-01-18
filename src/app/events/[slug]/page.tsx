"use client";

import React, { useEffect, useState } from "react";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import { getEvent } from "@/lib/events"; // Static Data
import { getEventPhotos, getEventById, getSubEvents, logGuestLogin, Event, Photo as FirestorePhoto } from "@/lib/firestore"; // Live Data
import { syncCloudinaryToFirestore } from "@/app/actions/sync";
import Navbar from "@/components/Navbar";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Image as ImageIcon, ChevronLeft, Share2, Check, Phone, ArrowRight } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useRef } from "react";

export default function EventPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const slug = params.slug as string;
    const isShared = searchParams.get("shared") === "true";
    const { user, loading: authLoading, logout } = useAuth();

    const [event, setEvent] = useState<Event | any | null>(null);
    const [subEvents, setSubEvents] = useState<Event[]>([]);
    const [photos, setPhotos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    // Guest Tracking State
    const [showGuestModal, setShowGuestModal] = useState(false);
    const [guestStatus, setGuestStatus] = useState<'idle' | 'pending' | 'approved' | 'rejected'>('idle');
    const [guestName, setGuestName] = useState("");
    const [guestPhone, setGuestPhone] = useState("");
    const [isLogging, setIsLogging] = useState(false);

    // Parallax logic
    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end start"]
    });

    const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
    const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

    useEffect(() => {
        if (!authLoading && slug) {
            loadEventData();
        }
    }, [authLoading, slug]);

    // Check for guest details if shared link
    useEffect(() => {
        if (isShared && !user && !authLoading) {
            const savedDetails = localStorage.getItem("wedding_guest_details");
            if (savedDetails) {
                const { name, phone } = JSON.parse(savedDetails);
                setGuestName(name);
                setGuestPhone(phone);
                const logId = `${phone}_${slug}`;

                // Use the new listener for status
                const { onGuestStatusChange } = require("@/lib/firestore");
                const unsubscribe = onGuestStatusChange(logId, (status: any) => {
                    setGuestStatus(status || 'pending'); // Default to pending if record exists but status is missing
                    if (status === 'approved') {
                        setShowGuestModal(false);
                    } else if (status === 'pending' || !status) {
                        setShowGuestModal(true);
                    } else if (status === 'rejected') {
                        setShowGuestModal(true);
                    }
                });

                return () => unsubscribe();
            } else {
                setShowGuestModal(true);
                setGuestStatus('idle');
            }
        }
    }, [isShared, user, authLoading, slug]);

    const logGuestAccess = async (name: string, phone: string) => {
        if (!slug || !event) return;
        try {
            await logGuestLogin(
                name,
                phone,
                slug,
                event.parentId || event.id, // Pass self as parent if main event
                event.title || "Shared Event",
                event.createdBy // Pass the owner ID
            );
        } catch (error) {
            console.error("Failed to log guest access:", error);
        }
    };

    const handleGuestSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!guestName || !guestPhone) return;

        setIsLogging(true);
        try {
            localStorage.setItem("wedding_guest_details", JSON.stringify({
                name: guestName,
                phone: guestPhone
            }));
            await logGuestAccess(guestName, guestPhone);
            setGuestStatus('pending'); // Immediately set to pending after submission
        } catch (err) {
            console.error("Error logging guest:", err);
        } finally {
            setIsLogging(false);
        }
    };

    const loadEventData = async () => {
        setLoading(true);
        console.log(`[EventPage] Loading event for slug: ${slug}, isShared: ${isShared}`);

        try {
            // 1. Get Event Details
            // Try Firestore first (Dynamic events)
            let eventData: Event | null = null;
            try {
                eventData = await getEventById(slug);
            } catch (e: any) {
                console.error("[EventPage] Error fetching from Firestore:", e);
                if (e.message?.includes("permissions")) {
                    setError("permissions");
                }
            }

            // Fallback to Static Data
            if (!eventData && !error) {
                console.log("[EventPage] Event not found in Firestore, checking static data...");
                eventData = getEvent(slug);
            }

            if (!eventData) {
                setEvent(null);
                setLoading(false);
                return;
            }

            setEvent(eventData);

            // 2. Branch logic based on Event Type
            if (eventData.type === 'main') {
                // Fetch Sub-events (Categories)
                console.log(`[EventPage] Main event detected. Fetching sub-events for: ${eventData.id}`);
                const data = await getSubEvents(eventData.id, eventData.legacyId);
                setSubEvents(data);
            } else {
                // Fetch Photos (Sub-event or single gallery)
                console.log(`[EventPage] Sub-view detected. Fetching photos for: ${eventData.id}`);

                // 1. Fetch from Firestore CLIENT-SIDE (Authenticated / Rules-friendly)
                let firestorePhotos = await getEventPhotos(eventData.id, eventData.legacyId);

                // 2. If Empty, trigger server-side Sync fallback
                if (firestorePhotos.length === 0) {
                    console.log("[EventPage] No photos found. Triggering resilient sync...");
                    const syncResult = await syncCloudinaryToFirestore(eventData.id, eventData.createdBy, eventData.legacyId);
                    if (syncResult.success && (syncResult.count || 0) > 0) {
                        firestorePhotos = await getEventPhotos(eventData.id, eventData.legacyId);
                    }
                }

                const transformedPhotos = (firestorePhotos as FirestorePhoto[]).map(p => ({
                    id: p.id,
                    src: p.url || "",
                    cloudinaryPublicId: p.cloudinaryPublicId || "",
                    width: p.width || 800,
                    height: p.height || 600,
                    filename: p.cloudinaryPublicId ? p.cloudinaryPublicId.split('/').pop() : 'photo'
                }));
                setPhotos(transformedPhotos);
            }
        } catch (err: any) {
            console.error("[EventPage] Critical error:", err);
            setError(err.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    const handleShare = () => {
        const shareUrl = `${window.location.origin}/events/${slug}?shared=true`;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (authLoading || loading) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-stone-50 relative" ref={containerRef}>
                <Loader2 className="w-8 h-8 animate-spin text-royal-gold" />
            </main>
        );
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
                <p className="text-stone-500 mb-8 max-w-md">
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

    return (
        <main className="min-h-screen bg-stone-50 relative" ref={containerRef}>
            {/* Premium Parallax Hero */}
            <div className="relative h-[80vh] w-full overflow-hidden">
                <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0 h-[120%] -top-[10%]">
                    <Image
                        src={event.coverImage || "/placeholder-event.jpg"}
                        alt={event.title}
                        fill
                        className="object-cover"
                        priority
                    />
                </motion.div>
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

                <div className="absolute inset-0 flex flex-col justify-end items-center text-center px-4 pb-20">
                    <ScrollReveal direction="up" delay={0.3}>
                        <h1 className="text-4xl md:text-7xl font-serif text-white drop-shadow-xl mb-6 tracking-tight">
                            {event.title}
                        </h1>
                    </ScrollReveal>
                    <ScrollReveal direction="up" delay={0.5}>
                        <p className="text-white/90 text-lg md:text-xl max-w-2xl font-light drop-shadow-lg tracking-wide italic">
                            {event.description || "A celebration of love and new beginnings."}
                        </p>
                    </ScrollReveal>
                </div>

                {/* Floating Sign Out if user logged in */}
                {user && (
                    <nav className="absolute top-8 right-8 z-20">
                        <button
                            onClick={logout}
                            className="px-6 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full hover:bg-white/20 transition-all text-sm font-bold shadow-xl"
                        >
                            Sign Out
                        </button>
                    </nav>
                )}
            </div>

            <section className="relative z-10 -mt-12 bg-stone-50 rounded-t-[3rem] py-20 shadow-2xl shadow-black/10">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="mb-12 flex items-center justify-between">
                        <button
                            onClick={() => {
                                const backUrl = event?.parentId ? `/events/${event.parentId}` : "/gallery";
                                router.push(`${backUrl}${isShared ? "?shared=true" : ""}`);
                            }}
                            className="text-stone-500 hover:text-stone-900 transition-colors text-sm font-bold tracking-widest uppercase flex items-center group"
                        >
                            <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
                            {event?.parentId ? "Back to Event" : "Back to Gallery"}
                        </button>

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

                    {event.type === 'main' ? (
                        <div className="mt-12">
                            <SectionHeader title="Event Highlights" subtitle={`${subEvents.length} Unique Galleries`} />

                            {subEvents.length === 0 ? (
                                <div className="py-40 text-center opacity-40">
                                    <ImageIcon className="w-16 h-16 mx-auto mb-6 text-stone-300" />
                                    {error === "permissions" ? (
                                        <>
                                            <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Access restricted...</h2>
                                            <p className="font-sans text-stone-400">If you are the owner, please ensure your Firestore Security Rules allow public reads for events and photos.</p>
                                        </>
                                    ) : (
                                        <>
                                            <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Glimpses are being curated...</h2>
                                            <p className="font-sans text-stone-400">Galleries for this event will appear here soon.</p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
                                    {subEvents.map((sub, index) => (
                                        <ScrollReveal
                                            key={sub.id}
                                            delay={index * 0.1}
                                            className="w-full"
                                        >
                                            <div
                                                onClick={() => router.push(`/events/${sub.id}${isShared ? "?shared=true" : ""}`)}
                                                className="group relative block w-full aspect-[3/4] overflow-hidden rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer bg-stone-100"
                                            >
                                                <Image
                                                    src={sub.coverImage || '/placeholder-event.jpg'}
                                                    alt={sub.title}
                                                    fill
                                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                                                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                                                    priority={index < 3}
                                                />

                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>

                                                <div className="absolute bottom-0 left-0 p-8 w-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                                                    <p className="text-royal-gold text-[10px] font-bold uppercase tracking-[0.2em] mb-2">
                                                        {sub.date || "Gallery"}
                                                    </p>
                                                    <h3 className="text-3xl font-serif text-white mb-2 italic tracking-tight">{sub.title}</h3>
                                                    <div className="h-[1px] w-0 bg-white/50 group-hover:w-full transition-all duration-700 ease-in-out"></div>
                                                </div>
                                            </div>
                                        </ScrollReveal>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="contents">
                            <SectionHeader title="Gallery Collection" subtitle={`${photos.length} Precious Moments`} />

                            {photos.length > 0 ? (
                                <div className="mt-12">
                                    <MasonryGrid photos={photos} eventSlug={slug} disableDownload={isShared && !user} />
                                </div>
                            ) : (
                                <div className="text-center py-40 opacity-40">
                                    <ImageIcon className="w-16 h-16 mx-auto mb-6 text-stone-300" />
                                    {error === "permissions" ? (
                                        <>
                                            <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Moments restricted...</h2>
                                            <p className="font-sans text-stone-400 text-sm">Owner: Check Firestore rules to enable shared access.</p>
                                        </>
                                    ) : (
                                        <>
                                            <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Moments are being developed...</h2>
                                            <p className="font-sans text-stone-400 text-sm">Check back soon to see the captured memories.</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            <footer className="bg-stone-900 text-stone-400 py-12 text-center text-sm">
                <p>© 2026 Wedding Album.</p>
            </footer>
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
                                        <p className="text-slate-500 mb-8 font-sans leading-relaxed">
                                            We've sent your request to the event admin. You'll be admitted as soon as they grant access.
                                        </p>
                                        <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100 flex items-center justify-center space-x-3">
                                            <div className="w-2 h-2 rounded-full bg-royal-gold animate-pulse" />
                                            <span className="text-xs font-bold uppercase tracking-widest text-stone-400">Waiting for approval</span>
                                        </div>
                                    </>
                                ) : guestStatus === 'rejected' ? (
                                    <>
                                        <h2 className="text-3xl font-bold mb-3 font-serif text-slate-800">Access Restricted</h2>
                                        <p className="text-slate-500 mb-8 font-sans leading-relaxed">
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
                                        <h2 className="text-3xl font-bold mb-3 font-serif text-slate-800">Welcome Guest</h2>
                                        <p className="text-slate-500 mb-10 font-sans leading-relaxed">
                                            Please share your details to request access to this private event gallery.
                                        </p>

                                        <form onSubmit={handleGuestSubmit} className="space-y-6">
                                            <div className="space-y-4">
                                                <div className="relative group">
                                                    <input
                                                        type="text"
                                                        placeholder="Your Full Name"
                                                        required
                                                        value={guestName}
                                                        onChange={(e) => setGuestName(e.target.value)}
                                                        className="w-full px-6 py-5 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold group-hover:border-stone-200 transition-all font-sans"
                                                    />
                                                </div>
                                                <div className="relative group">
                                                    <div className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-400 flex items-center space-x-2">
                                                        <Phone size={16} />
                                                    </div>
                                                    <input
                                                        type="tel"
                                                        placeholder="Phone Number"
                                                        required
                                                        value={guestPhone}
                                                        onChange={(e) => setGuestPhone(e.target.value)}
                                                        className="w-full pl-14 pr-6 py-5 bg-stone-50 border border-stone-100 rounded-2xl text-slate-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-royal-gold/20 focus:border-royal-gold group-hover:border-stone-200 transition-all font-sans"
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={isLogging}
                                                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-bold uppercase tracking-widest transition-all hover:bg-slate-800 active:scale-95 disabled:opacity-50 shadow-xl flex items-center justify-center space-x-3"
                                            >
                                                {isLogging ? (
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                ) : (
                                                    <>
                                                        <span>Request Access</span>
                                                        <ArrowRight size={18} />
                                                    </>
                                                )}
                                            </button>
                                        </form>
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

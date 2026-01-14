"use client";

import React, { useEffect, useState } from "react";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { notFound, useParams, useRouter } from "next/navigation";
import { getEvent } from "@/lib/events"; // Static Data
import { getEventPhotos, getEventById, getUserEvents, Event, Photo as FirestorePhoto } from "@/lib/firestore"; // Live Data
import { syncCloudinaryToFirestore } from "@/app/actions/sync";
import Navbar from "@/components/Navbar";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { Loader2, Image as ImageIcon, ChevronLeft } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function EventPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params.slug as string;
    const { user, loading: authLoading, logout } = useAuth();

    const [event, setEvent] = useState<Event | any | null>(null);
    const [subEvents, setSubEvents] = useState<Event[]>([]);
    const [photos, setPhotos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

    const loadEventData = async () => {
        setLoading(true);
        console.log(`[EventPage] Loading event for slug: ${slug}`);

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
                const data = await getUserEvents(user?.email || "anonymous", "sub", eventData.id, eventData.legacyId);
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

    if (error === "permissions" && !user) {
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
                    <div className="mb-12">
                        <button
                            onClick={() => {
                                if (event?.parentId) {
                                    router.push(`/events/${event.parentId}`);
                                } else {
                                    router.push("/gallery");
                                }
                            }}
                            className="text-stone-500 hover:text-stone-900 transition-colors text-sm font-bold tracking-widest uppercase flex items-center group"
                        >
                            <ChevronLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
                            {event?.parentId ? "Back to Event" : "Back to Gallery"}
                        </button>
                    </div>

                    {event.type === 'main' ? (
                        <div className="mt-12">
                            <SectionHeader title="Event Highlights" subtitle={`${subEvents.length} Unique Galleries`} />

                            {subEvents.length === 0 ? (
                                <div className="py-40 text-center opacity-40">
                                    <ImageIcon className="w-16 h-16 mx-auto mb-6 text-stone-300" />
                                    <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Glimpses are being curated...</h2>
                                    <p className="font-sans text-stone-400">Galleries for this event will appear here soon.</p>
                                </div>
                            ) : (
                                <div className="flex flex-wrap gap-6 mt-12">
                                    {subEvents.map((sub, index) => (
                                        <ScrollReveal
                                            key={sub.id}
                                            delay={index * 0.1}
                                            className={`flex-1 min-w-[300px] ${subEvents.length > 4 ? 'lg:flex-none lg:w-[calc(25%-1.125rem)]' : ''}`}
                                        >
                                            <div
                                                onClick={() => router.push(`/events/${sub.id}`)}
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
                                    <MasonryGrid photos={photos} eventSlug={slug} />
                                </div>
                            ) : (
                                <div className="text-center py-40 opacity-40">
                                    <ImageIcon className="w-16 h-16 mx-auto mb-6 text-stone-300" />
                                    <h2 className="text-2xl font-serif italic text-stone-600 mb-2">Moments are being developed...</h2>
                                    <p className="font-sans text-stone-400 text-sm">Check back soon to see the captured memories.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            <footer className="bg-stone-900 text-stone-400 py-12 text-center text-sm">
                <p>© 2026 Wedding Album.</p>
            </footer>
        </main>
    );
}

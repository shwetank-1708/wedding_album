"use client";

import React, { useEffect, useState } from "react";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { notFound, useParams } from "next/navigation";
import { getEvent } from "@/lib/events"; // Static Data
import { getEventPhotos, getEventById, Event, Photo as FirestorePhoto } from "@/lib/firestore"; // Live Data
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function EventPage() {
    const params = useParams();
    const slug = params.slug as string;
    const { user, loading: authLoading } = useAuth();

    const [event, setEvent] = useState<Event | any | null>(null);
    const [photos, setPhotos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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

            // 2. Get LIVE Photos from Firestore (Database)
            const firestorePhotos = await getEventPhotos(slug);
            console.log(`[EventPage] Found ${firestorePhotos.length} photos in Firestore`);

            // 3. Transform for the Grid
            const transformedPhotos = firestorePhotos.map(p => ({
                id: p.id,
                src: p.url || "",
                cloudinaryPublicId: p.cloudinaryPublicId || "",
                width: p.width || 800,
                height: p.height || 600,
                filename: p.cloudinaryPublicId ? p.cloudinaryPublicId.split('/').pop() : 'photo'
            }));

            setPhotos(transformedPhotos);
        } catch (err: any) {
            console.error("[EventPage] Critical error:", err);
            setError(err.message || "An unexpected error occurred");
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-stone-50">
                <Loader2 className="w-8 h-8 animate-spin text-royal-gold" />
            </div>
        );
    }

    if (!event) {
        return notFound();
    }

    if (error === "permissions" && !user) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 px-4 text-center">
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
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-stone-50">
            <Navbar />

            {/* Event Hero */}
            <div className="relative h-[60vh] w-full overflow-hidden flex items-end justify-center pb-20">
                <div className="absolute inset-0">
                    <img
                        src={event.coverImage}
                        alt={event.title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40" />
                </div>

                <div className="relative z-10 text-center text-white">
                    <p className="text-gold-400 tracking-[0.3em] text-sm uppercase font-semibold mb-2">
                        {event.description}
                    </p>
                    <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight">
                        {event.title}
                    </h1>
                </div>
            </div>

            <section className="py-20">
                <SectionHeader title="Gallery" subtitle={`${photos.length} Photos`} />

                {photos.length > 0 ? (
                    <MasonryGrid photos={photos} eventSlug={slug} />
                ) : (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl mx-4 border border-dashed border-gray-300">
                        <p className="text-stone-500 mb-2">No photos found in database.</p>
                        <p className="text-sm text-stone-400">
                            Upload photos from your dashboard to see them here.
                        </p>
                    </div>
                )}
            </section>

            <footer className="bg-stone-900 text-stone-400 py-12 text-center text-sm">
                <p>© 2026 Wedding Album.</p>
            </footer>
        </main>
    );
}

"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { getUserEvents, Event } from "@/lib/firestore";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { Camera, ArrowRight, Loader2, Image as ImageIcon, ChevronLeft } from "lucide-react";
import { DashboardHeader } from "@/components/DashboardHeader";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { getEventById } from "@/lib/firestore";

export default function GalleryPage() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    const [events, setEvents] = useState<Event[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(true);

    // Parallax refs and state
    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end start"]
    });

    useEffect(() => {
        if (user) {
            fetchEvents();
        } else if (!loading) {
            setLoadingEvents(false);
        }
    }, [user, loading]);

    const fetchEvents = async () => {
        if (!user) return;
        setLoadingEvents(true);
        try {
            // Always fetch main events at the root level
            const userEvents = await getUserEvents(user.email || user.name, "main");
            setEvents(userEvents);
        } catch (error) {
            console.error("Error fetching events:", error);
        } finally {
            setLoadingEvents(false);
        }
    };

    if (loading || loadingEvents) {
        return (
            <main className="min-h-screen flex items-center justify-center bg-stone-50 relative" ref={containerRef}>
                <Loader2 className="w-8 h-8 animate-spin text-royal-gold" />
            </main>
        );
    }

    // Default Main Events View
    return (
        <main className="min-h-screen bg-stone-50 relative" ref={containerRef}>
            <DashboardHeader
                user={user}
                breadcrumbs={[
                    ...(user ? [{ label: "Dashboard", onClick: () => router.push("/dashboard") }] : []),
                    { label: "View Gallery" }
                ]}
                onBack={() => router.push("/dashboard")}
                showChevron={true}
                logout={logout}
                icon={ImageIcon}
            />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                <header className="mb-16 text-center">
                    <ScrollReveal direction="up">
                        <h1 className="text-4xl md:text-6xl font-serif font-bold text-slate-900 mb-6 uppercase tracking-wider">
                            Your Events
                        </h1>
                    </ScrollReveal>
                    <ScrollReveal direction="up" delay={0.2}>
                        <p className="text-slate-500 font-sans text-lg max-w-2xl mx-auto">
                            A private collection of your most cherished moments, captured forever.
                        </p>
                    </ScrollReveal>
                </header>

                {events.length === 0 ? (
                    <div className="bg-white rounded-[3rem] p-12 text-center border border-dashed border-stone-200 shadow-sm max-w-2xl mx-auto">
                        <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Camera className="w-10 h-10 text-stone-300" />
                        </div>
                        <h2 className="text-2xl font-bold mb-4 text-slate-900">No events yet</h2>
                        <p className="text-slate-500 mb-8 font-sans text-neutral-500">
                            Start by creating an event in your dashboard and uploading some photos.
                        </p>
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center space-x-2 px-8 py-4 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95"
                        >
                            Go to Dashboard
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                        {events.map((event, index) => (
                            <ScrollReveal key={event.id} delay={index * 0.1}>
                                <div
                                    onClick={() => {
                                        console.log(`[GalleryPage] Event clicked. Title: "${event.title}", ID: "${event.id}"`);
                                        router.push(`/events/${event.id}`);
                                    }}
                                    className="group block relative aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-stone-100 cursor-pointer"
                                >
                                    <Image
                                        src={event.coverImage || '/placeholder-event.jpg'}
                                        alt={event.title}
                                        fill
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                        priority={index < 3}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:via-black/40 transition-all" />

                                    <div className="absolute bottom-0 left-0 p-8 w-full text-left">
                                        <p className="text-royal-gold text-xs font-bold uppercase tracking-widest mb-3">
                                            {event.date}
                                        </p>
                                        <h3 className="text-2xl font-bold text-white mb-4 italic tracking-tight">
                                            {event.title}
                                        </h3>
                                        <div className="flex items-center text-white text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                                            View Galleries
                                            <ArrowRight className="w-4 h-4 ml-2" />
                                        </div>
                                    </div>
                                </div>
                            </ScrollReveal>
                        ))}
                    </div>
                )}
            </div>

            <footer className="py-20 text-center text-slate-400 font-sans text-sm">
                <p>© 2026 Lens & Frame. All Rights Reserved.</p>
            </footer>
        </main>
    );
}

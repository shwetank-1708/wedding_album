"use client";

import React, { useEffect, useMemo, useState } from "react";
import { resolveEventCoverImage } from "@/lib/eventCovers";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    Event,
    getApprovedSharedEventsForUser,
    getEventByJoinId,
    getUserEvents,
    logGuestLogin,
} from "@/lib/database";
import {
    ArrowLeft,
    ArrowRight,
    Calendar,
    MessageCircle,
    Play,
    Plus,
    QrCode,
    X,
    Send,
    Minus,
    Search,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const DEFAULT_EVENT_COVER_IMAGE = "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop";
const MEMORIES_CARD_IMAGE = "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2071&auto=format&fit=crop";

function getCreatedTime(event: Event) {
    const createdAt = event.createdAt as any;
    if (!createdAt) return 0;
    if (typeof createdAt === "string" || typeof createdAt === "number") {
        return new Date(createdAt).getTime() || 0;
    }
    if (createdAt.seconds) {
        return createdAt.seconds * 1000;
    }
    if (createdAt.toDate) {
        return createdAt.toDate().getTime();
    }
    return 0;
}

function getCoverImageStyle(event?: Event): React.CSSProperties {
    const coverMode = event?.coverMode || "fill";
    if (coverMode === "fit") {
        return { objectFit: "contain", backgroundColor: "#050505" };
    }

    const x = 50 + (event?.coverOffsetX || 0);
    const y = 50 + (event?.coverOffset || 0);
    return {
        objectFit: "cover",
        objectPosition: `${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`,
        transform: `scale(${event?.coverScale || 1})`,
    };
}

export default function DashboardHub() {
    const { user, loading } = useAuth();
    const router = useRouter();

    const [events, setEvents] = useState<Event[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(true);
    const [showAllEvents, setShowAllEvents] = useState(false);

    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinCode, setJoinCode] = useState("");
    const [isJoining, setIsJoining] = useState(false);
    const [joinMessage, setJoinMessage] = useState("");
    const [joinMessageType, setJoinMessageType] = useState<"success" | "error">("success");
    const [showChatBox, setShowChatBox] = useState(false);
    const [chatInput, setChatInput] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeChatId, setActiveChatId] = useState<string | null>(null);

    // Mock conversations resembling real wedding groups and direct messages
    const [conversations, setConversations] = useState([
        {
            id: "wedding",
            name: "Arjun & Priya's Wedding 💍",
            avatar: "AP",
            isGroup: true,
            lastMessage: "Priya: Can you upload the portrait photos?",
            time: "10:30 AM",
            unread: true,
        },
        {
            id: "siddharth",
            name: "Siddharth (Host) 🤵",
            avatar: "SH",
            isGroup: false,
            lastMessage: "Did you receive the join code?",
            time: "Yesterday",
            unread: false,
        },
        {
            id: "rohan",
            name: "Rohan (Photographer) 📸",
            avatar: "RP",
            isGroup: false,
            lastMessage: "Sent you the folder link.",
            time: "2 days ago",
            unread: false,
        },
        {
            id: "corporate",
            name: "Corporate Bash 2026 🏢",
            avatar: "CB",
            isGroup: true,
            lastMessage: "Nehal: Great event photos!",
            time: "1 week ago",
            unread: false,
        }
    ]);

    const [messagesByChat, setMessagesByChat] = useState<Record<string, Array<{ id: string; text: string; sender: "user" | "other"; senderName?: string; time: string }>>>({
        wedding: [
            { id: "w1", text: "Hey! Welcome to the group chat for Priya and Arjun's wedding!", sender: "other", senderName: "Priya", time: "10:15 AM" },
            { id: "w2", text: "We will share all the high-resolution event downloads here.", sender: "other", senderName: "Arjun", time: "10:20 AM" },
            { id: "w3", text: "Can you upload the portrait photos?", sender: "other", senderName: "Priya", time: "10:30 AM" }
        ],
        siddharth: [
            { id: "s1", text: "Hey! Let me know if you can see the wedding gallery dashboard.", sender: "other", time: "4:15 PM" },
            { id: "s2", text: "Yes, I can see it perfectly!", sender: "user", time: "4:20 PM" },
            { id: "s3", text: "Awesome! Did you receive the join code?", sender: "other", time: "Yesterday" }
        ],
        rohan: [
            { id: "r1", text: "Hi! I just finished exporting the edits.", sender: "other", time: "3 days ago" },
            { id: "r2", text: "Sent you the folder link.", sender: "other", time: "2 days ago" }
        ],
        corporate: [
            { id: "c1", text: "Awesome photos from the corporate meeting yesterday!", sender: "other", senderName: "Amit", time: "1 week ago" },
            { id: "c2", text: "Nehal: Great event photos!", sender: "other", senderName: "Nehal", time: "1 week ago" }
        ]
    });

    const [isTyping, setIsTyping] = useState(false);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        const text = chatInput.trim();
        if (!text || !activeChatId) return;

        const newMsg = {
            id: Date.now().toString(),
            text,
            sender: "user" as const,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessagesByChat((prev) => ({
            ...prev,
            [activeChatId]: [...(prev[activeChatId] || []), newMsg],
        }));

        setConversations((prev) =>
            prev.map((c) =>
                c.id === activeChatId
                    ? { ...c, lastMessage: `You: ${text}`, time: "Just now", unread: false }
                    : c
            )
        );

        setChatInput("");

        setIsTyping(true);
        setTimeout(() => {
            setIsTyping(false);
            
            let replyText = "Awesome! Thanks for the message.";
            let replySenderName = "";

            if (activeChatId === "wedding") {
                replyText = "Perfect! I will let Arjun know as well. Looking forward to the other files.";
                replySenderName = "Priya";
            } else if (activeChatId === "siddharth") {
                replyText = "Great! Let's sync tomorrow about the remaining uploads.";
            } else if (activeChatId === "rohan") {
                replyText = "Got it. Let me check the uploads and get back to you.";
            }

            const replyMsg = {
                id: (Date.now() + 1).toString(),
                text: replyText,
                sender: "other" as const,
                senderName: replySenderName || undefined,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };

            setMessagesByChat((prev) => ({
                ...prev,
                [activeChatId]: [...(prev[activeChatId] || []), replyMsg],
            }));

            setConversations((prev) =>
                prev.map((c) =>
                    c.id === activeChatId
                        ? { ...c, lastMessage: replySenderName ? `${replySenderName}: ${replyText}` : replyText, time: "Just now" }
                        : c
                )
            );
        }, 1500);
    };

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    const fetchData = async () => {
        if (!user) return;

        setIsLoadingEvents(true);
        try {
            const ownIdentifiers = [user.uid];
            if (user.email) ownIdentifiers.push(user.email);
            if (user.phone) ownIdentifiers.push(user.phone);

            const [hostedEvents, approvedSharedEvents] = await Promise.all([
                getUserEvents(ownIdentifiers, "main"),
                getApprovedSharedEventsForUser(ownIdentifiers),
            ]);

            const visibleEvents = Array.from(
                new Map([...hostedEvents, ...approvedSharedEvents].map((event) => [event.id, event])).values()
            ).sort((a, b) => getCreatedTime(b) - getCreatedTime(a));

            setEvents(visibleEvents);
        } catch (err) {
            console.error("Error fetching dashboard data:", err);
        } finally {
            setIsLoadingEvents(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user]);

    const handleJoinEvent = async (e?: React.FormEvent) => {
        e?.preventDefault();

        const finalCode = joinCode.trim().toUpperCase();
        if (!finalCode) return;

        if (!user) {
            setJoinMessageType("error");
            setJoinMessage("You must be logged in to join an event.");
            return;
        }

        setIsJoining(true);
        setJoinMessage("");

        try {
            const event = await getEventByJoinId(finalCode);

            if (!event) {
                setJoinMessageType("error");
                setJoinMessage("Invalid Join ID. Please check the code and try again.");
                return;
            }

            const guestName = user.name || "Anonymous Guest";
            const guestId = user.phone || user.email || user.uid;

            if (!guestId) {
                throw new Error("User identifier not found.");
            }

            const success = await logGuestLogin(
                guestName,
                guestId,
                event.id,
                event.parentId || undefined,
                event.title || "Untitled Event",
                event.createdBy || undefined,
                "pending"
            );

            if (success) {
                setJoinMessageType("success");
                setJoinMessage("Request sent. You will see the event in your collections once approved.");
                setTimeout(() => {
                    setShowJoinModal(false);
                    setJoinCode("");
                    setJoinMessage("");
                    fetchData();
                }, 2500);
            } else {
                setJoinMessageType("error");
                setJoinMessage("Request could not be submitted. Please try again.");
            }
        } catch (err) {
            console.error("[Join] Error:", err);
            setJoinMessageType("error");
            setJoinMessage("An error occurred while joining. Please try again later.");
        } finally {
            setIsJoining(false);
        }
    };

    const visibleEvents = useMemo(() => (
        showAllEvents ? events : events.slice(0, 3)
    ), [events, showAllEvents]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-slate-950 font-sans text-white">
            {/* Dashboard Sub-Navbar */}
            <div className="border-b border-slate-900 bg-slate-950 pt-24 pb-4">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                    {/* Left: Greeting / Workspace */}
                    <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-black tracking-wide text-white uppercase">Workspace</span>
                        <span className="text-slate-800">|</span>
                        <span className="text-xs font-bold text-slate-400">{user.name || user.email || "My Dashboard"}</span>
                    </div>

                </div>
            </div>

            <main className="relative z-20 mx-auto max-w-7xl space-y-8 px-4 pt-8 pb-24 sm:px-6 lg:px-8">
                <section className="rounded-[2rem] border border-slate-800 bg-slate-950 p-5 shadow-2xl shadow-black/20 sm:p-8">
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-300">Events</p>
                            <h2 className="mt-1 text-2xl font-black text-white">Memories curated for you</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowJoinModal(true)}
                            className="inline-flex w-fit items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-black text-slate-950 transition-transform active:scale-95"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Join Event</span>
                        </button>
                    </div>

                    {isLoadingEvents ? (
                        <div className="flex justify-center py-16">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-amber-400" />
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {visibleEvents.map((event) => {
                                const coverImage = resolveEventCoverImage(event.coverImage, 'thumbnail');
                                return (
                                    <button
                                        key={event.id}
                                        type="button"
                                        onClick={() => window.open(`/events/${event.id}?mode=visitor`, "_blank", "noopener,noreferrer")}
                                        className="group relative h-64 overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-900 text-left shadow-xl shadow-black/10 transition-transform hover:-translate-y-1"
                                    >
                                        <div className="absolute inset-0 overflow-hidden bg-slate-950">
                                            <img
                                                src={coverImage}
                                                alt=""
                                                className="absolute inset-0 h-full w-full object-cover opacity-35 blur-xl"
                                            />
                                            <img
                                                src={coverImage}
                                                alt={event.title}
                                                className="relative h-full w-full transition-transform duration-700 group-hover:scale-105"
                                                style={getCoverImageStyle(event)}
                                            />
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                                        {event.category && (
                                            <div className="absolute left-4 top-4 rounded-lg border border-amber-300/30 bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300 backdrop-blur-sm">
                                                {event.category}
                                            </div>
                                        )}
                                        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-800 bg-slate-950/70 p-5 text-white backdrop-blur-md">
                                            <h3 className="truncate text-lg font-black leading-tight text-white">{event.title}</h3>
                                            <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-400">
                                                <Calendar className="h-3.5 w-3.5 text-amber-300" />
                                                <span>{event.date}</span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}

                            <button
                                type="button"
                                onClick={() => setShowAllEvents(prev => !prev)}
                                className="group relative h-full min-h-64 overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-900 text-center shadow-xl shadow-black/10"
                            >
                                <img
                                    src={MEMORIES_CARD_IMAGE}
                                    alt=""
                                    className="absolute inset-0 h-full w-full object-cover opacity-45 transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/20" />
                                <div className="relative z-10 flex h-full min-h-64 flex-col items-center justify-center p-6">
                                    <h3 className="text-xl font-black text-white">Your memories</h3>
                                    <div className="mt-3 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black">
                                        {events.length} Collections
                                    </div>
                                    <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-950">
                                        <span>{showAllEvents ? "Show Less" : "Explore All"}</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </div>
                                </div>
                            </button>

                            {events.length === 0 && (
                                <div className="col-span-full rounded-[1.5rem] border border-dashed border-slate-800 p-10 text-center text-slate-400">
                                    <p className="text-lg font-black text-white">No events yet</p>
                                    <p className="mt-2 text-sm font-semibold">Join an event or create your first hosted collection.</p>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                <div className="grid gap-6 md:grid-cols-2">
                    <section
                        onClick={() => router.push("/host")}
                        className="group relative flex flex-col justify-between cursor-pointer overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-700 to-yellow-900 p-6 sm:p-8 shadow-xl shadow-amber-950/40 min-h-[220px]"
                    >
                        <div className="absolute right-0 top-0 h-48 w-48 -translate-y-1/2 translate-x-1/4 rounded-full bg-white/5 blur-2xl" />
                        <div className="relative z-10 flex flex-col gap-4">
                            <div className="w-fit rounded-lg border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200">
                                For Hosts
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white">Host an Event</h2>
                                <p className="mt-2 text-sm font-semibold text-amber-50/85">Create a private gallery for weddings, parties or corporate meets.</p>
                            </div>
                        </div>
                        <div className="relative z-10 mt-6 flex w-fit items-center rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-black text-white backdrop-blur-md transition-colors group-hover:bg-white/20">
                            <span>Create Now</span>
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </div>
                    </section>

                    <section
                        onClick={() => window.open("https://www.youtube.com/@EveBashApp", "_blank")}
                        className="group relative flex flex-col justify-between cursor-pointer overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-900 to-indigo-950 p-6 sm:p-8 shadow-xl shadow-indigo-950/20 min-h-[220px]"
                    >
                        <div className="absolute right-0 top-0 h-48 w-48 -translate-y-1/2 translate-x-1/4 rounded-full bg-indigo-500/20 blur-2xl" />
                        <div className="relative z-10 flex flex-col gap-4">
                            <div className="w-fit rounded-lg bg-indigo-500/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-200">
                                How To Host
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-white">Host Your Perfect Event</h2>
                                <p className="mt-2 text-sm font-semibold text-indigo-200">Watch our step-by-step tutorials and host your event like a pro.</p>
                            </div>
                        </div>
                        <div className="relative z-10 mt-6 flex w-fit items-center rounded-xl border border-indigo-300/30 bg-indigo-500/20 px-4 py-2.5 text-xs font-black text-white backdrop-blur-md transition-colors group-hover:bg-indigo-500/40">
                            <Play className="mr-2 h-4 w-4 fill-current" />
                            <span>Watch on YouTube</span>
                        </div>
                    </section>
                </div>
            </main>

            <AnimatePresence>
                {showJoinModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowJoinModal(false)}
                            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 shadow-2xl"
                        >
                            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 p-6">
                                <h3 className="text-xl font-black text-white">Join Event</h3>
                                <button
                                    type="button"
                                    onClick={() => setShowJoinModal(false)}
                                    className="rounded-full bg-slate-800 p-2 text-slate-400 transition-colors hover:text-white"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleJoinEvent} className="p-6 sm:p-8">
                                <div className="mb-6">
                                    <label className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-400">Enter Join ID</label>
                                    <input
                                        type="text"
                                        value={joinCode}
                                        onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                                        className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-4 text-center text-2xl font-black tracking-[0.2em] text-white outline-none transition-all placeholder:text-slate-600 focus:border-amber-400/60 focus:ring-2 focus:ring-amber-400/20"
                                        placeholder="A1B2C3"
                                        maxLength={6}
                                    />
                                </div>

                                {joinMessage && (
                                    <div className={`mb-6 rounded-xl border p-4 text-center text-sm font-bold ${
                                        joinMessageType === "error"
                                            ? "border-rose-500/30 bg-rose-950/40 text-rose-300"
                                            : "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                                    }`}>
                                        {joinMessage}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isJoining}
                                    className="flex w-full items-center justify-center rounded-xl bg-amber-400 py-4 text-[15px] font-black text-slate-950 transition-all disabled:opacity-70"
                                >
                                    {isJoining ? (
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                                    ) : (
                                        "Join with Code"
                                    )}
                                </button>

                                <div className="mt-6 flex items-center">
                                    <div className="flex-1 border-t border-slate-800" />
                                    <span className="px-4 text-xs font-black tracking-widest text-slate-500">OR</span>
                                    <div className="flex-1 border-t border-slate-800" />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setJoinMessageType("error");
                                        setJoinMessage("QR scanning is available on the mobile app. Please enter your Join ID here.");
                                    }}
                                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-4 text-[15px] font-black text-white transition-colors hover:bg-slate-700"
                                >
                                    <QrCode className="h-5 w-5 text-amber-300" />
                                    <span>Scan QR Code</span>
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Floating Chat Bubble & Box (FB Style) */}
            <div className="fixed bottom-6 right-6 z-50 font-sans">
                <AnimatePresence>
                    {showChatBox && (
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.9 }}
                            className="absolute bottom-18 right-0 w-80 sm:w-96 h-[480px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white"
                        >
                            {activeChatId === null ? (
                                /* Conversations Inbox List View */
                                <>
                                    {/* Inbox Header */}
                                    <div className="bg-slate-950 px-4 py-3.5 border-b border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <MessageCircle className="h-5 w-5 text-amber-300" />
                                            <h4 className="text-sm font-black text-white">EveBash Messages</h4>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowChatBox(false)}
                                            className="p-1 rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                                        >
                                            <Minus className="h-4.5 w-4.5" />
                                        </button>
                                    </div>

                                    {/* Inbox Search */}
                                    <div className="p-3 bg-slate-950/20 border-b border-slate-850">
                                        <div className="relative flex items-center">
                                            <Search className="absolute left-3.5 h-4 w-4 text-slate-500 pointer-events-none" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search chats..."
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-amber-400/50 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* Inbox Conversations List */}
                                    <div className="flex-1 overflow-y-auto bg-slate-950/10 divide-y divide-slate-850">
                                        {conversations
                                            .filter((convo) =>
                                                convo.name.toLowerCase().includes(searchQuery.toLowerCase())
                                            )
                                            .map((convo) => (
                                                <button
                                                    key={convo.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setActiveChatId(convo.id);
                                                        // Mark as read
                                                        setConversations((prev) =>
                                                            prev.map((c) =>
                                                                c.id === convo.id ? { ...c, unread: false } : c
                                                            )
                                                        );
                                                    }}
                                                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-800/40 transition-colors"
                                                >
                                                    <div className="relative h-10 w-10 rounded-full bg-slate-850 border border-slate-800 flex items-center justify-center font-black text-slate-200 text-xs flex-shrink-0">
                                                        {convo.avatar}
                                                        {convo.unread && (
                                                            <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-amber-400 border-2 border-slate-900" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-baseline justify-between mb-0.5">
                                                            <h5 className={`text-xs truncate ${convo.unread ? "font-black text-white" : "font-bold text-slate-200"}`}>
                                                                {convo.name}
                                                            </h5>
                                                            <span className="text-[10px] text-slate-500 font-semibold">{convo.time}</span>
                                                        </div>
                                                        <p className={`text-[11px] truncate ${convo.unread ? "font-bold text-amber-300" : "text-slate-400"}`}>
                                                            {convo.lastMessage}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))}
                                        {conversations.filter((c) => c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                            <div className="p-8 text-center text-xs text-slate-500 font-semibold">
                                                No conversations found
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                /* Chat Thread Messages View */
                                <>
                                    {/* Thread Header */}
                                    <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <button
                                                type="button"
                                                onClick={() => setActiveChatId(null)}
                                                className="p-1 rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                                                aria-label="Back to inbox"
                                            >
                                                <ArrowLeft className="h-4.5 w-4.5" />
                                            </button>
                                            <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-slate-200 text-xs flex-shrink-0">
                                                {conversations.find((c) => c.id === activeChatId)?.avatar}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-xs font-black text-white truncate">
                                                    {conversations.find((c) => c.id === activeChatId)?.name}
                                                </h4>
                                                <p className="text-[9px] text-emerald-400 font-bold">Active Chat</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowChatBox(false)}
                                            className="p-1 rounded-full text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                                        >
                                            <Minus className="h-4.5 w-4.5" />
                                        </button>
                                    </div>

                                    {/* Thread Messages List */}
                                    <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-950/40 flex flex-col">
                                        {messagesByChat[activeChatId]?.map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`max-w-[75%] flex flex-col ${
                                                    msg.sender === "user" ? "self-end" : "self-start"
                                                }`}
                                            >
                                                {msg.sender === "other" && msg.senderName && (
                                                    <span className="text-[9px] font-semibold text-slate-400 mb-1 ml-1.5">
                                                        {msg.senderName}
                                                    </span>
                                                )}
                                                <div
                                                    className={`rounded-2xl px-4 py-2.5 text-sm ${
                                                        msg.sender === "user"
                                                            ? "bg-amber-400 text-slate-950 rounded-br-none font-medium shadow-md shadow-amber-400/5"
                                                            : "bg-slate-800 text-slate-200 rounded-bl-none"
                                                    }`}
                                                >
                                                    <p className="leading-normal">{msg.text}</p>
                                                    <span className={`block text-[9px] mt-1 text-right ${
                                                        msg.sender === "user" ? "text-slate-800/70" : "text-slate-500"
                                                    }`}>
                                                        {msg.time}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {isTyping && (
                                            <div className="bg-slate-800 text-slate-200 self-start rounded-2xl rounded-bl-none px-4 py-2.5 max-w-[75%] flex items-center gap-1">
                                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Thread Message Input */}
                                    <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-800 bg-slate-900 flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            placeholder="Type a message..."
                                            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-400 transition-colors"
                                        />
                                        <button
                                            type="submit"
                                            className="h-9 w-9 flex items-center justify-center rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors disabled:opacity-50"
                                            disabled={!chatInput.trim()}
                                        >
                                            <Send className="h-4 w-4" />
                                        </button>
                                    </form>
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Floating Chat Bubble */}
                <button
                    type="button"
                    onClick={() => setShowChatBox((prev) => !prev)}
                    className="h-14 w-14 rounded-full bg-amber-400 text-slate-950 shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                    aria-label="Toggle chat"
                >
                    {showChatBox ? (
                        <Minus className="h-6 w-6" />
                    ) : (
                        <MessageCircle className="h-6 w-6 fill-slate-950" />
                    )}
                </button>
            </div>
        </div>
    );
}

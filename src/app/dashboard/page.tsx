"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
    LayoutDashboard,
    Eye,
    Settings,
    ShieldCheck,
    LogOut,
    ArrowRight,
    Camera,
    Plus,
    Upload,
    ChevronLeft,
    Image as ImageIcon,
    Loader2,
    MoreVertical,
    Pencil,
    Trash2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { createEvent, getUserEvents, savePhoto, Event, Photo, deleteEvent, updateEvent, getEventPhotos, deletePhoto } from "@/lib/firestore";
import { uploadEventImage } from "@/lib/storage";
import { v4 as uuidv4 } from "uuid";
import { Timestamp } from "firebase/firestore";

// Placeholder images for new events
const PLACEHOLDER_IMAGES = [
    "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2071&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1465495910483-34a170a7bb00?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1549413187-0521e7cebcba?q=80&w=2070&auto=format&fit=crop"
];

export default function UserDashboard() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const [view, setView] = useState<"main" | "manage">("main");
    const [manageMode, setManageMode] = useState<"list" | "add-event" | "add-image">("list");

    // Data State
    const [userEvents, setUserEvents] = useState<Event[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [currentEventPhotos, setCurrentEventPhotos] = useState<Photo[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);

    // Form State
    const [eventName, setEventName] = useState("");
    const [selectedEventId, setSelectedEventId] = useState("");
    const [selectedEventName, setSelectedEventName] = useState("");
    const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    // Event Management State
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [renamingEvent, setRenamingEvent] = useState<Event | null>(null);
    const [newTitle, setNewTitle] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

    useEffect(() => {
        if (user && view === "manage") {
            fetchUserEvents();
        }
    }, [user, view]);

    useEffect(() => {
        if (selectedEventId) {
            fetchEventPhotos();
        } else {
            setCurrentEventPhotos([]);
        }
    }, [selectedEventId]);

    const fetchUserEvents = async () => {
        if (!user) return;
        setLoadingEvents(true);
        // Using email as unique identifier for user-created content
        const events = await getUserEvents(user.email || user.name);
        setUserEvents(events);
        setLoadingEvents(false);
    };

    const fetchEventPhotos = async () => {
        if (!selectedEventId) return;
        setLoadingPhotos(true);
        try {
            const photos = await getEventPhotos(selectedEventId);
            setCurrentEventPhotos(photos);
        } catch (error) {
            console.error("Error fetching photos:", error);
        } finally {
            setLoadingPhotos(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-royal-cream text-slate-800">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-12 w-12 bg-royal-gold/20 rounded-full mb-4"></div>
                    <div className="h-4 w-32 bg-royal-gold/10 rounded"></div>
                </div>
            </div>
        );
    }

    if (!user) {
        router.push("/login");
        return null;
    }

    const handleCreateEventOnly = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventName.trim()) {
            setMessage("Please enter an event name.");
            return;
        }

        setStatus("uploading");
        setMessage("Creating event...");

        try {
            const eventId = eventName.toLowerCase().replace(/\s+/g, '-') + '-' + uuidv4().slice(0, 4);

            // Assign a random placeholder
            const randomPlaceholder = PLACEHOLDER_IMAGES[Math.floor(Math.random() * PLACEHOLDER_IMAGES.length)];

            const newEvent: Event = {
                id: eventId,
                title: eventName,
                date: new Date().toLocaleDateString(),
                coverImage: randomPlaceholder,
                description: `Gallery for ${eventName}`,
                createdBy: user.email || "anonymous"
            };

            await createEvent(newEvent);

            setStatus("success");
            setMessage("Event created! Click it to add images. ✨");
            setEventName("");
            fetchUserEvents();
            setTimeout(() => setManageMode("list"), 1500);
        } catch (err) {
            console.error(err);
            setStatus("error");
            setMessage("Failed to create event.");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0 || !selectedEventId) return;

        setStatus("uploading");
        setMessage(`Uploading ${selectedFiles.length} images...`);
        console.log(`[Dashboard] Starting auto-upload for ${selectedFiles.length} files to event ${selectedEventId}`);

        try {
            let firstUploadedUrl = "";
            const photoPromises = Array.from(selectedFiles).map(async (file, index) => {
                console.log(`[Dashboard] Uploading file ${index + 1}/${selectedFiles.length}: ${file.name}`);
                const uploadResult = await uploadEventImage(file, selectedEventId, user.email || "anonymous");

                if (index === 0) firstUploadedUrl = uploadResult.url;

                const photo: Photo = {
                    id: uuidv4(),
                    eventId: selectedEventId,
                    cloudinaryPublicId: uploadResult.publicId,
                    url: uploadResult.url,
                    uploadedAt: Timestamp.now(),
                    userId: user.email || "anonymous",
                    width: uploadResult.width,
                    height: uploadResult.height
                };
                await savePhoto(photo);
            });

            await Promise.all(photoPromises);

            // Auto-update cover if it's currently a placeholder or if it's the first upload
            const currentEvent = userEvents.find(ev => ev.id === selectedEventId);
            const isPlaceholder = !currentEvent?.coverImage || PLACEHOLDER_IMAGES.includes(currentEvent.coverImage);

            if (isPlaceholder && firstUploadedUrl) {
                console.log("[Dashboard] Replacing placeholder with first uploaded image as cover");
                await updateEvent(selectedEventId, { coverImage: firstUploadedUrl });
            }

            setStatus("success");
            setMessage("Gallery updated! ✨");
            fetchUserEvents();
            fetchEventPhotos();
            setTimeout(() => setStatus("idle"), 2000);
        } catch (err: any) {
            console.error("[Dashboard] Auto-upload error:", err);
            setStatus("error");
            setMessage(`Upload failed: ${err.message || 'Unknown error'}`);
        }
    };

    const handleSetAsCover = async (photoUrl: string) => {
        if (!selectedEventId) return;
        setStatus("uploading");
        setMessage("Setting as cover...");

        try {
            const success = await updateEvent(selectedEventId, { coverImage: photoUrl });
            if (success) {
                setStatus("success");
                setMessage("New thumbnail set! ✨");
                fetchUserEvents();
                setTimeout(() => setStatus("idle"), 2000);
            } else {
                setStatus("error");
                setMessage("Failed to update thumbnail.");
            }
        } catch (error) {
            console.error("Error setting cover:", error);
            setStatus("error");
            setMessage("Error updating thumbnail.");
        }
    };

    const openUploadForEvent = (eventId: string, title: string) => {
        setSelectedEventId(eventId);
        setSelectedEventName(title);
        setManageMode("add-image");
        setStatus("idle");
        setMessage("");
    };

    const handleRenameClick = (e: React.MouseEvent, evt: Event) => {
        e.stopPropagation();
        setRenamingEvent(evt);
        setNewTitle(evt.title);
        setActiveMenu(null);
    };

    const handleRenameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renamingEvent || !newTitle.trim()) return;

        setStatus("uploading");
        setMessage("Updating event...");

        try {
            const success = await updateEvent(renamingEvent.id, { title: newTitle });
            if (success) {
                setStatus("success");
                setMessage("Event renamed! ✨");
                setRenamingEvent(null);
                fetchUserEvents();
                setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);
            } else {
                setStatus("error");
                setMessage("Failed to rename event.");
            }
        } catch (err) {
            console.error(err);
            setStatus("error");
            setMessage("Error updating event.");
        }
    };

    const handleDeleteEvent = async (eventId: string) => {
        setStatus("uploading");
        setMessage("Deleting event...");

        try {
            const success = await deleteEvent(eventId);
            if (success) {
                setStatus("success");
                setMessage("Event deleted.");
                setShowDeleteConfirm(null);
                setActiveMenu(null);
                fetchUserEvents();
                setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);
            } else {
                setStatus("error");
                setMessage("Failed to delete event.");
            }
        } catch (err) {
            console.error(err);
            setStatus("error");
            setMessage("Error deleting event.");
        }
    };

    const handleDeletePhoto = async (photoId: string) => {
        try {
            const success = await deletePhoto(photoId);
            if (success) {
                setCurrentEventPhotos(prev => prev.filter(p => p.id !== photoId));
                setStatus("success");
                setMessage("Photo removed.");
                setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);
            } else {
                setStatus("error");
                setMessage("Failed to delete photo.");
            }
        } catch (error) {
            console.error("Error deleting photo:", error);
            setStatus("error");
            setMessage("Error removing photo.");
        }
    };

    return (
        <div className="min-h-screen bg-royal-cream font-serif text-slate-800">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                    <button
                        onClick={() => {
                            if (manageMode !== "list") setManageMode("list");
                            else if (view === "manage") setView("main");
                            else router.push("/");
                        }}
                        className="flex items-center space-x-3 group"
                    >
                        <div className="p-2 bg-slate-900 text-white rounded-lg group-hover:bg-slate-800 transition-colors">
                            {view === "manage" ? <ChevronLeft className="w-5 h-5" /> : <LayoutDashboard className="w-5 h-5" />}
                        </div>
                        <h1 className="text-xl font-bold tracking-tight">
                            {view === "manage" ? "Manage Gallery" : "Dashboard"}
                        </h1>
                    </button>

                    <div className="flex items-center space-x-4 text-slate-800">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold">{user.name}</p>
                            <p className="text-xs text-slate-500 font-sans">{user.email}</p>
                        </div>
                        <button
                            onClick={logout}
                            className="p-2 hover:bg-stone-100 rounded-full text-stone-500 transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <AnimatePresence mode="wait">
                    {view === "main" ? (
                        <motion.div
                            key="main-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="mb-12">
                                <h2 className="text-3xl font-bold mb-2">Welcome back, {user.name.split(' ')[0]}!</h2>
                                <p className="text-slate-500 font-sans">Everything you need to manage your personal memories.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-slate-800">
                                <OptionCard
                                    title="View Gallery"
                                    description="Browse through your captured memories and event albums."
                                    icon={Eye}
                                    onClick={() => router.push("/gallery")}
                                    color="bg-blue-50 text-blue-600"
                                    hoverBorder="hover:border-blue-200"
                                />
                                <OptionCard
                                    title="Manage Gallery"
                                    description="Create events and upload photos to your collections."
                                    icon={Settings}
                                    onClick={() => { setView("manage"); setManageMode("list"); }}
                                    color="bg-purple-50 text-purple-600"
                                    hoverBorder="hover:border-purple-200"
                                />
                                <OptionCard
                                    title="Permissions"
                                    description="Control who can access and view your private galleries."
                                    icon={ShieldCheck}
                                    onClick={() => { }}
                                    color="bg-emerald-50 text-emerald-600"
                                    hoverBorder="hover:border-emerald-200"
                                    badge="Coming Soon"
                                />
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="manage-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
                                <div>
                                    <h2 className="text-3xl font-bold mb-2 uppercase tracking-wide">Your Galleries</h2>
                                    <p className="text-slate-500 font-sans">Click on an event to add images.</p>
                                </div>
                                <div className="flex space-x-3">
                                    <button
                                        onClick={() => { setManageMode("add-event"); setStatus("idle"); setMessage(""); }}
                                        className="flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Create Event</span>
                                    </button>
                                </div>
                            </div>

                            {manageMode === "list" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                    {loadingEvents ? (
                                        Array.from({ length: 3 }).map((_, i) => (
                                            <div key={i} className="animate-pulse bg-white aspect-[4/5] rounded-3xl" />
                                        ))
                                    ) : userEvents.length === 0 ? (
                                        <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-stone-300 flex flex-col items-center justify-center text-center">
                                            <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mb-6">
                                                <Camera className="w-10 h-10 text-stone-300" />
                                            </div>
                                            <h3 className="text-xl font-bold mb-2">No galleries found</h3>
                                            <p className="text-stone-500 max-w-xs mx-auto mb-8 font-sans">Create your first event by clicking the button above.</p>
                                        </div>
                                    ) : (
                                        userEvents.map((evt) => (
                                            <motion.div
                                                key={evt.id}
                                                whileHover={{ y: -5 }}
                                                className="group relative bg-white aspect-[4/5] rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-stone-100 cursor-pointer"
                                                onClick={() => openUploadForEvent(evt.id, evt.title)}
                                            >
                                                <img
                                                    src={evt.coverImage}
                                                    alt={evt.title}
                                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />

                                                {/* Options Menu Button */}
                                                <div className="absolute top-4 right-4 z-20">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveMenu(activeMenu === evt.id ? null : evt.id);
                                                        }}
                                                        className="p-2 bg-white shadow-lg hover:bg-stone-50 rounded-full text-slate-900 transition-all active:scale-90 border border-stone-100"
                                                    >
                                                        <MoreVertical className="w-5 h-5" />
                                                    </button>

                                                    <AnimatePresence>
                                                        {activeMenu === evt.id && (
                                                            <motion.div
                                                                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                                                className="absolute right-0 mt-2 w-40 bg-white rounded-2xl shadow-xl border border-stone-100 py-2 z-30"
                                                            >
                                                                <button
                                                                    onClick={(e) => handleRenameClick(e, evt)}
                                                                    className="w-full px-4 py-2 text-left text-sm font-bold flex items-center space-x-2 hover:bg-stone-50 transition-colors"
                                                                >
                                                                    <Pencil className="w-4 h-4 text-blue-500" />
                                                                    <span>Rename</span>
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setShowDeleteConfirm(evt.id);
                                                                        setActiveMenu(null);
                                                                    }}
                                                                    className="w-full px-4 py-2 text-left text-sm font-bold flex items-center space-x-2 hover:bg-red-50 text-red-600 transition-colors"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                    <span>Delete</span>
                                                                </button>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>

                                                <div className="absolute bottom-0 left-0 p-8 text-white w-full">
                                                    <p className="text-xs font-sans font-bold uppercase tracking-widest text-royal-gold mb-2">{evt.date}</p>
                                                    <h3 className="text-2xl font-bold truncate">{evt.title}</h3>
                                                    <div className="mt-4 flex items-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 duration-300">
                                                        <Plus className="w-4 h-4 mr-2" />
                                                        Add Images
                                                    </div>
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            )}

                            {manageMode === "add-event" && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="max-w-lg mx-auto bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-stone-100"
                                >
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-2xl font-bold italic tracking-tight">New Event</h3>
                                        <button onClick={() => setManageMode("list")} className="text-stone-400 hover:text-stone-600 transition-colors">
                                            <ChevronLeft className="w-6 h-6" />
                                        </button>
                                    </div>

                                    <form onSubmit={handleCreateEventOnly} className="space-y-8">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-500 mb-4 ml-1">What's the occasion?</label>
                                            <input
                                                type="text"
                                                value={eventName}
                                                onChange={(e) => setEventName(e.target.value)}
                                                placeholder="e.g. Dream Wedding 2024"
                                                className="w-full px-6 py-5 bg-stone-50 border border-stone-200 rounded-3xl focus:ring-2 focus:ring-royal-gold focus:border-transparent transition-all outline-none text-xl font-medium"
                                                required
                                                autoFocus
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={status === "uploading"}
                                            className={cn(
                                                "w-full py-5 rounded-[1.5rem] font-bold text-lg shadow-lg transition-all flex items-center justify-center space-x-3 active:scale-95",
                                                status === "uploading" ? "bg-stone-300 text-stone-500 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800"
                                            )}
                                        >
                                            {status === "uploading" ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span>Creating...</span>
                                                </>
                                            ) : (
                                                <span>Create Event</span>
                                            )}
                                        </button>

                                        {message && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className={cn(
                                                    "p-4 rounded-2xl text-sm font-bold text-center",
                                                    status === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                                                )}
                                            >
                                                {message}
                                            </motion.div>
                                        )}
                                    </form>
                                </motion.div>
                            )}

                            {manageMode === "add-image" && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-stone-100"
                                >
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h3 className="text-3xl font-bold tracking-tight">Gallery Editor</h3>
                                            <p className="text-slate-500 font-sans mt-1">Managing memories for <span className="text-slate-900 font-bold underline decoration-royal-gold decoration-2 underline-offset-4">{selectedEventName}</span></p>
                                        </div>
                                        <button
                                            onClick={() => setManageMode("list")}
                                            className="p-3 bg-stone-50 hover:bg-stone-100 text-stone-400 hover:text-stone-600 rounded-2xl transition-all active:scale-95"
                                        >
                                            <ChevronLeft className="w-6 h-6" />
                                        </button>
                                    </div>

                                    {message && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                "mb-8 p-4 rounded-2xl text-sm font-bold text-center flex items-center justify-center space-x-2",
                                                status === "success" ? "bg-green-50 text-green-700" :
                                                    status === "error" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                                            )}
                                        >
                                            {status === "uploading" && <Loader2 className="w-4 h-4 animate-spin" />}
                                            <span>{message}</span>
                                        </motion.div>
                                    )}

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                                        {/* Existing Photos */}
                                        {currentEventPhotos.map((photo) => {
                                            const isCover = userEvents.find(ev => ev.id === selectedEventId)?.coverImage === photo.url;
                                            return (
                                                <motion.div
                                                    key={photo.id}
                                                    layout
                                                    className="group relative aspect-square rounded-[2rem] overflow-hidden bg-stone-100 shadow-sm border border-stone-100"
                                                >
                                                    <img
                                                        src={photo.url}
                                                        alt="Gallery item"
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                                    />
                                                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                                                    {/* Set as Cover Button */}
                                                    <button
                                                        onClick={() => handleSetAsCover(photo.url)}
                                                        className={cn(
                                                            "absolute top-3 left-3 p-2.5 backdrop-blur-md rounded-xl shadow-lg transition-all active:scale-90",
                                                            isCover
                                                                ? "bg-royal-gold text-white opacity-100"
                                                                : "bg-white/90 text-royal-gold opacity-0 group-hover:opacity-100 hover:bg-royal-gold/10"
                                                        )}
                                                        title={isCover ? "Current cover image" : "Set as cover image"}
                                                    >
                                                        <ImageIcon className="w-4 h-4" />
                                                    </button>

                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={() => handleDeletePhoto(photo.id)}
                                                        className="absolute top-3 right-3 p-2.5 bg-white/90 backdrop-blur-md rounded-xl text-red-500 shadow-lg opacity-0 group-hover:opacity-100 transition-all active:scale-90 hover:bg-red-50"
                                                        title="Delete photo"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </motion.div>
                                            );
                                        })}

                                        {/* Loading Skeletons for current fetching */}
                                        {loadingPhotos && currentEventPhotos.length === 0 && (
                                            Array.from({ length: 4 }).map((_, i) => (
                                                <div key={i} className="aspect-square bg-stone-50 rounded-[2rem] animate-pulse border border-stone-100" />
                                            ))
                                        )}

                                        {/* Add Image Button */}
                                        <motion.label
                                            layout
                                            className={cn(
                                                "relative aspect-square rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-stone-50 group",
                                                status === "uploading" ? "border-royal-gold/50 bg-royal-gold/5" : "border-stone-200"
                                            )}
                                        >
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*"
                                                onChange={handleFileUpload}
                                                className="hidden"
                                                disabled={status === "uploading"}
                                            />
                                            {status === "uploading" ? (
                                                <div className="flex flex-col items-center text-royal-gold">
                                                    <Loader2 className="w-10 h-10 animate-spin mb-3" />
                                                    <span className="text-xs font-bold uppercase tracking-widest">Adding...</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center text-stone-400 group-hover:text-slate-900 transition-colors">
                                                    <div className="p-4 bg-stone-50 rounded-2xl mb-3 group-hover:bg-white group-hover:shadow-md transition-all">
                                                        <Plus className="w-8 h-8" />
                                                    </div>
                                                    <span className="text-xs font-bold uppercase tracking-widest">Add Photos</span>
                                                </div>
                                            )}
                                        </motion.label>
                                    </div>

                                    {currentEventPhotos.length === 0 && !loadingPhotos && status !== "uploading" && (
                                        <div className="mt-12 p-12 bg-stone-50 rounded-[3rem] text-center border border-stone-100">
                                            <p className="text-stone-400 font-sans italic">Your gallery is currently empty.</p>
                                            <p className="text-stone-500 text-sm mt-2">Click the plus icon above to start adding memories.</p>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Rename Modal */}
                <AnimatePresence>
                    {renamingEvent && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-white rounded-[2.5rem] p-8 md:p-12 w-full max-w-md shadow-2xl"
                            >
                                <h3 className="text-2xl font-bold mb-6 italic tracking-tight">Rename Event</h3>
                                <form onSubmit={handleRenameSubmit} className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-500 mb-4 ml-1">New Name</label>
                                        <input
                                            type="text"
                                            value={newTitle}
                                            onChange={(e) => setNewTitle(e.target.value)}
                                            className="w-full px-6 py-4 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-royal-gold focus:border-transparent transition-all outline-none text-lg font-medium"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="flex space-x-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setRenamingEvent(null)}
                                            className="flex-1 py-4 px-6 border border-stone-200 rounded-2xl font-bold text-stone-600 hover:bg-stone-50 transition-all active:scale-95"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={status === "uploading"}
                                            className="flex-1 py-4 px-6 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:bg-stone-300"
                                        >
                                            {status === "uploading" ? "Saving..." : "Save Changes"}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Delete Confirmation Modal */}
                <AnimatePresence>
                    {showDeleteConfirm && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-white rounded-[2.5rem] p-8 md:p-12 w-full max-w-md shadow-2xl"
                            >
                                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
                                    <Trash2 className="w-8 h-8 text-red-500" />
                                </div>
                                <h3 className="text-2xl font-bold mb-4 tracking-tight text-slate-900">Delete Event?</h3>
                                <p className="text-slate-500 mb-8 font-sans leading-relaxed">
                                    Are you sure you want to delete this event? This will remove all photo records from the database. This action cannot be undone.
                                </p>
                                <div className="flex space-x-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(null)}
                                        className="flex-1 py-4 px-6 border border-stone-200 rounded-2xl font-bold text-stone-600 hover:bg-stone-50 transition-all active:scale-95"
                                    >
                                        Keep Event
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteEvent(showDeleteConfirm)}
                                        disabled={status === "uploading"}
                                        className="flex-1 py-4 px-6 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-lg active:scale-95 disabled:bg-red-300"
                                    >
                                        {status === "uploading" ? "Deleting..." : "Delete now"}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </main >
        </div >
    );
}

function OptionCard({ title, description, icon: Icon, onClick, color, hoverBorder, badge }: any) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onClick}
            className={cn(
                "group cursor-pointer bg-white p-10 rounded-[3rem] border border-stone-100 shadow-sm transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden",
                hoverBorder
            )}
        >
            {badge && (
                <div className="absolute top-8 right-8 px-3 py-1 bg-stone-100 text-[10px] font-bold uppercase tracking-widest text-stone-500 rounded-full">
                    {badge}
                </div>
            )}
            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110", color)}>
                <Icon className="w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold mb-4 group-hover:text-slate-900 transition-colors">
                {title}
            </h3>
            <p className="text-slate-500 font-sans leading-relaxed mb-10 text-sm">
                {description}
            </p>
            <div className="flex items-center text-xs font-bold uppercase tracking-widest text-slate-900 mt-auto">
                Explore
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </div>
        </motion.div>
    );
}

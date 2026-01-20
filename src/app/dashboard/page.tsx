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
    Trash2,
    X,
    Star,
    LayoutGrid,
    List,
    Users,
    Share2,
    Phone
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
    createEvent,
    getUserEvents,
    savePhoto,
    Event,
    Photo,
    deleteEvent,
    updateEvent,
    getEventPhotos,
    deletePhoto,
    getUsers,
    updateUserRole,
    deleteUser,
    getUserTotalStorage,
    getDelegatedAdminsCount,
    getGuestLogs,
    getEventLogs,
    getSubEvents,
    updateGuestStatus
} from "@/lib/firestore";
import { uploadEventImage } from "@/lib/storage";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Tooltip } from "@/components/Tooltip";
import { v4 as uuidv4 } from "uuid";
import { Timestamp } from "firebase/firestore";
import { syncCloudinaryToFirestore } from "@/app/actions/sync";

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
    const [view, setView] = useState<"main" | "manage" | "permissions">("main");
    const [manageMode, setManageMode] = useState<"list" | "add-event" | "add-image">("list");
    const [manageLevel, setManageLevel] = useState<"events" | "galleries" | "photos">("events");
    const [selectedMainEvent, setSelectedMainEvent] = useState<Event | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [galleryViewMode, setGalleryViewMode] = useState<"grid" | "list">("grid");

    // Data State
    const [userEvents, setUserEvents] = useState<Event[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [currentEventPhotos, setCurrentEventPhotos] = useState<Photo[]>([]);
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const [totalStorage, setTotalStorage] = useState<number>(0);

    // Permissions State
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [delegatedCount, setDelegatedCount] = useState(0);
    const [activePermissionTab, setActivePermissionTab] = useState<"admin_details" | "guest_user">("admin_details");
    const [trafficLogs, setTrafficLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [selectedLogEventId, setSelectedLogEventId] = useState<string>("all");
    const [selectedUserToAssign, setSelectedUserToAssign] = useState<string>("");
    const [assignedEventsForSelect, setAssignedEventsForSelect] = useState<string[]>([]);

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
        if (user && user.uid && view === "manage") {
            fetchUserEvents();
            fetchStorageStats();
        } else if (user && user.uid && view === "permissions") {
            fetchUserEvents();
            fetchUsersList();
            fetchDelegatedCount();
            fetchTrafficLogs();
        }
    }, [user, view, activePermissionTab, selectedLogEventId, manageLevel, selectedMainEvent]);

    useEffect(() => {
        if (selectedEventId && (manageMode === "add-image" || manageLevel === "photos")) {
            fetchEventPhotos();
        }
    }, [selectedEventId, manageMode, manageLevel]);

    const compressImage = async (file: File): Promise<File> => {
        // Only compress if larger than 5MB
        if (file.size < 5 * 1024 * 1024) return file;

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;

                // Max dimension 2500px for web display
                const MAX_DIM = 2500;
                if (width > height) {
                    if (width > MAX_DIM) {
                        height *= MAX_DIM / width;
                        width = MAX_DIM;
                    }
                } else {
                    if (height > MAX_DIM) {
                        width *= MAX_DIM / height;
                        height = MAX_DIM;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(new File([blob], file.name, { type: "image/jpeg" }));
                        } else {
                            resolve(file);
                        }
                    },
                    "image/jpeg",
                    0.85 // High quality but significantly smaller filesize
                );
                URL.revokeObjectURL(img.src);
            };
            img.onerror = (err) => reject(err);
        });
    };

    const fetchUserEvents = async () => {
        if (!user || !user.uid) return;
        setLoadingEvents(true);
        const type = (view === "permissions" || manageLevel === "events") ? "main" : "sub";
        const parentId = (view === "manage" && (manageLevel === "galleries" || manageLevel === "photos")) ? selectedMainEvent?.id : undefined;

        // Identity Pool for authorship checks
        const identifiers = [user.uid];
        if (user.email) identifiers.push(user.email);
        if (user.delegatedBy) identifiers.push(user.delegatedBy);

        if (type === "sub" && parentId) {
            // ... existing complex sub-event logic ...
            const byRelationship = await getSubEvents(parentId, selectedMainEvent?.legacyId);
            const byIdentity = await getUserEvents(identifiers, type, parentId, selectedMainEvent?.legacyId);
            const combined = [...byRelationship];
            byIdentity.forEach(evt => {
                if (!combined.some(e => e.id === evt.id)) {
                    combined.push(evt);
                }
            });

            const sorted = combined.sort((a, b) => (a.title || "").localeCompare(b.title || ""));

            // Filter by assignedEvents if the current user is an Event Admin
            if (user.role === 'admin' && user.roleType === 'event' && user.assignedEvents) {
                setUserEvents(sorted.filter(e => user.assignedEvents?.includes(e.id) || e.parentId === parentId));
            } else {
                setUserEvents(sorted);
            }
        } else {
            // Root level: Fetch by identity pool
            const events = await getUserEvents(identifiers, type, parentId, selectedMainEvent?.legacyId);

            // Filter by assignedEvents if the current user is an Event Admin
            if (user.role === 'admin' && user.roleType === 'event' && user.assignedEvents) {
                setUserEvents(events.filter(e => user.assignedEvents?.includes(e.id)));
            } else {
                setUserEvents(events);
            }
        }
        setLoadingEvents(false);
    };

    const fetchEventPhotos = async () => {
        if (!selectedEventId) return;
        const currentEvent = userEvents.find(e => e.id === selectedEventId);

        setLoadingPhotos(true);
        try {
            // 1. Fetch from Firestore CLIENT-SIDE (Respects permissions)
            let photos = await getEventPhotos(selectedEventId, currentEvent?.legacyId);

            // 2. If Empty, trigger SERVER-SIDE Sync
            if (photos.length === 0) {
                setStatus("uploading");
                setMessage("Syncing from Cloudinary...");

                const syncResult = await syncCloudinaryToFirestore(
                    selectedEventId,
                    currentEvent?.createdBy,
                    currentEvent?.legacyId
                );

                if (syncResult.success && (syncResult.count || 0) > 0) {
                    // Re-fetch on client after successful sync
                    photos = await getEventPhotos(selectedEventId, currentEvent?.legacyId);
                    setMessage(`Sync success! ${syncResult.count || 0} photos restored. ✨`);
                    setStatus("success");
                    setTimeout(() => { setStatus("idle"); setMessage(""); }, 3000);
                } else if (!syncResult.success) {
                    setStatus("idle");
                    setMessage("");
                } else {
                    setStatus("idle");
                    setMessage("");
                }
            }

            setCurrentEventPhotos(photos as Photo[]);
        } catch (error) {
            console.error("[Dashboard] fetchEventPhotos Error:", error);
            setStatus("error");
            setMessage("Failed to load photos.");
        } finally {
            setLoadingPhotos(false);
        }
    };

    const fetchStorageStats = async () => {
        if (!user) return;
        const total = await getUserTotalStorage(user.email || "anonymous");
        setTotalStorage(total);
    };

    const fetchUsersList = async () => {
        setLoadingUsers(true);
        try {
            const users = await getUsers();
            // Sort all users alphabetically by name
            const sortedUsers = users.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            setAllUsers(sortedUsers);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchDelegatedCount = async () => {
        if (!user) return;
        const count = await getDelegatedAdminsCount(user.uid);
        setDelegatedCount(count);
    };

    const fetchTrafficLogs = async () => {
        if (!user) return;
        setLoadingLogs(true);
        try {
            // Enforce strict identity scoping for everyone (Primary, Event, and Web Admins)
            // This ensures guest activity is only visible on the relevant dashboard.
            const identifiers = [user.uid];
            if (user.email) identifiers.push(user.email);
            if (user.delegatedBy) identifiers.push(user.delegatedBy);

            const logs = await (selectedLogEventId === "all"
                ? getGuestLogs(identifiers)
                : getEventLogs(selectedLogEventId));

            // Filter by assignedEvents if the current user is an Event Admin
            if (user.role === 'admin' && user.roleType === 'event' && user.assignedEvents) {
                setTrafficLogs(logs.filter(log => user.assignedEvents?.includes(log.parentEventId) || user.assignedEvents?.includes(log.eventId)));
            } else {
                setTrafficLogs(logs);
            }
        } catch (error) {
            console.error("Error fetching logs:", error);
        } finally {
            setLoadingLogs(false);
        }
    };

    const handleUpdateUserRole = async (targetUid: string, currentRole: string, roleType: 'primary' | 'event' = 'primary', assignedEvents: string[] = []) => {
        if (!user) return;

        const isPromoting = currentRole !== "admin";

        if (isPromoting && delegatedCount >= 2) {
            setMessage("You can only have a maximum of 2 delegated admins.");
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
            return;
        }

        const newRole = isPromoting ? "admin" : "user";
        const success = await updateUserRole(targetUid, newRole, user.uid, roleType, assignedEvents);

        if (success) {
            setMessage(`User successfully ${isPromoting ? "promoted to Admin" : "demoted to User"}.`);
            setStatus("success");
            fetchUsersList();
            fetchDelegatedCount();
        } else {
            setMessage("Failed to update user role.");
            setStatus("error");
        }
        setTimeout(() => setStatus("idle"), 3000);
    };

    const handleDeleteUserAccount = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

        const success = await deleteUser(id);
        if (success) {
            setMessage("User deleted successfully!");
            setStatus("success");
            fetchUsersList();
        } else {
            setMessage("Failed to delete user.");
            setStatus("error");
        }
        setTimeout(() => setStatus("idle"), 3000);
    };

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

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

            const isSubEvent = manageLevel === "galleries" && selectedMainEvent;

            const newEvent: Event = {
                id: eventId,
                title: eventName,
                date: new Date().toLocaleDateString(),
                coverImage: randomPlaceholder,
                description: isSubEvent ? `Gallery of ${selectedMainEvent.title}` : `Main Event: ${eventName}`,
                createdBy: user.uid, // Using secure UID for new events
                type: isSubEvent ? "sub" : "main",
                ...(isSubEvent && { parentId: selectedMainEvent.id })
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
                console.log(`[Dashboard] Processing file ${index + 1}/${selectedFiles.length}: ${file.name}`);

                // Compress if needed before sending to storage layer
                const optimizedFile = await compressImage(file);
                if (optimizedFile.size !== file.size) {
                    console.log(`[Dashboard] Optimized ${file.name}: ${Math.round(file.size / 1024 / 1024 * 10) / 10}MB -> ${Math.round(optimizedFile.size / 1024 / 1024 * 10) / 10}MB`);
                }

                const uploadResult = await uploadEventImage(optimizedFile, selectedEventId, user.email || "anonymous");

                if (index === 0) firstUploadedUrl = uploadResult.url;

                const photo: Photo = {
                    id: uuidv4(),
                    eventId: selectedEventId,
                    cloudinaryPublicId: uploadResult.publicId,
                    url: uploadResult.url,
                    uploadedAt: Timestamp.now(),
                    userId: user.email || "anonymous",
                    width: uploadResult.width,
                    height: uploadResult.height,
                    size: (uploadResult as any).bytes,
                    format: (uploadResult as any).format
                };
                await savePhoto(photo);
            });

            await Promise.all(photoPromises);
            await fetchStorageStats();

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

    const handleSetAsCover = async (photoUrl: string, targetEventId?: string, isMainEvent: boolean = false) => {
        const idToUpdate = targetEventId || selectedEventId;
        if (!idToUpdate) return;

        setStatus("uploading");
        setMessage(`Setting as ${isMainEvent ? 'event' : 'gallery'} cover...`);

        try {
            const success = await updateEvent(idToUpdate, { coverImage: photoUrl });
            if (success) {
                setStatus("success");
                setMessage(`${isMainEvent ? 'Event' : 'Gallery'} thumbnail updated! ✨`);
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
            await fetchStorageStats();
        } catch (error) {
            console.error("Error deleting photo:", error);
            setStatus("error");
            setMessage("Error removing photo.");
        }
    };

    return (
        <div className="min-h-screen bg-royal-cream font-serif text-slate-800">
            <DashboardHeader
                user={user}
                breadcrumbs={[
                    { label: "Dashboard", onClick: view !== "main" ? () => setView("main") : undefined },
                    ...(view === "manage" ? [
                        {
                            label: "Manage Gallery",
                            onClick: manageLevel !== "events" || manageMode !== "list"
                                ? () => { setView("manage"); setManageLevel("events"); setManageMode("list"); }
                                : undefined
                        },
                        ...(manageLevel === "galleries" || (manageLevel === "photos" && selectedMainEvent) ? [
                            {
                                label: selectedMainEvent?.title || "Event",
                                onClick: manageLevel === "photos"
                                    ? () => { setManageLevel("galleries"); setSelectedEventId(""); setManageMode("list"); }
                                    : undefined
                            }
                        ] : []),
                        ...(manageLevel === "photos" ? [
                            { label: selectedEventName || "Gallery" }
                        ] : []),
                        ...(manageMode === "add-event" ? [
                            { label: manageLevel === "events" ? "New Event" : "New Gallery" }
                        ] : [])
                    ] : []),
                    ...(view === "permissions" ? [
                        { label: "Permissions" }
                    ] : [])
                ]}
                onBack={() => {
                    if (manageMode !== "list") {
                        setManageMode("list");
                    } else if (view === "manage") {
                        if (manageLevel === "photos") {
                            setManageLevel("galleries");
                            setSelectedEventId("");
                        } else if (manageLevel === "galleries") {
                            setManageLevel("events");
                            setSelectedMainEvent(null);
                        } else {
                            setView("main");
                        }
                    } else if (view === "permissions") {
                        setView("main");
                    } else {
                        router.push("/");
                    }
                }}
                onShare={(manageLevel === "photos" && selectedEventId) ? () => {
                    const url = `${window.location.origin}/events/${selectedEventId}?shared=true`;
                    navigator.clipboard.writeText(url);
                    setMessage("Share link copied! 🔗");
                    setStatus("success");
                    setTimeout(() => setStatus("idle"), 2000);
                } : undefined}
                logout={logout}
                showChevron={view !== "main"}
            />

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
                                    actionTitle="Open your public gallery"
                                />
                                <OptionCard
                                    title="Manage Gallery"
                                    description="Create events and upload photos to your galleries."
                                    icon={Settings}
                                    onClick={() => { setView("manage"); setManageMode("list"); }}
                                    color="bg-purple-50 text-purple-600"
                                    hoverBorder="hover:border-purple-200"
                                    actionTitle="Manage your events and photos"
                                />
                                <OptionCard
                                    title="Permissions"
                                    description="Control who can access and view your private galleries."
                                    icon={ShieldCheck}
                                    onClick={() => setView("permissions")}
                                    color="bg-emerald-50 text-emerald-600"
                                    hoverBorder="hover:border-emerald-200"
                                    actionTitle="Manage user access and roles"
                                />
                            </div>
                        </motion.div>
                    ) : view === "manage" ? (
                        <motion.div
                            key="manage-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
                                <div>
                                    <h2 className="text-3xl font-bold mb-2 uppercase tracking-wide">
                                        {manageLevel === "events" ? "Your Events" : "Galleries"}
                                    </h2>
                                    <p className="text-slate-500 font-sans">
                                        {manageLevel === "events"
                                            ? "Organize your wedding into high-level events."
                                            : `Galleries within ${selectedMainEvent?.title}`
                                        }
                                    </p>
                                </div>

                                {/* Storage Stat */}
                                <div className="hidden md:flex bg-white/50 backdrop-blur-sm px-6 py-4 rounded-[2rem] border border-stone-100 shadow-sm items-center space-x-4">
                                    <div className="w-10 h-10 bg-royal-gold/10 rounded-xl flex items-center justify-center">
                                        <ImageIcon className="w-5 h-5 text-royal-gold" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 leading-none mb-1">Total Storage</p>
                                        <p className="text-lg font-bold text-slate-900 leading-none">
                                            {(() => {
                                                const k = 1024;
                                                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                                                if (totalStorage === 0) return '0 MB';
                                                const i = Math.floor(Math.log(totalStorage) / Math.log(k));
                                                return parseFloat((totalStorage / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                                            })()}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex space-x-3">
                                    <Tooltip text={`Create new ${manageLevel === "events" ? "event" : "gallery"}`}>
                                        <button
                                            onClick={() => { setManageMode("add-event"); setStatus("idle"); setMessage(""); }}
                                            className="flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Create {manageLevel === "events" ? "Event" : "Gallery"}</span>
                                        </button>
                                    </Tooltip>
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
                                                onClick={() => {
                                                    if (manageLevel === "events") {
                                                        // For root level, we always start by showing chapters
                                                        // or letting them jump to photos if they want.
                                                        setSelectedMainEvent(evt);
                                                        setManageLevel("galleries");
                                                    } else {
                                                        openUploadForEvent(evt.id, evt.title);
                                                        setManageLevel("photos");
                                                    }
                                                }}
                                                className="group relative bg-white aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-stone-100 cursor-pointer"
                                            >
                                                <img
                                                    src={evt.coverImage || '/placeholder-event.jpg'}
                                                    alt={evt.title}
                                                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:via-black/40 transition-all" />

                                                {/* Options Menu Button */}
                                                <div className="absolute top-6 right-6 z-20">
                                                    <Tooltip text="Options">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveMenu(activeMenu === evt.id ? null : evt.id);
                                                            }}
                                                            className="p-2.5 bg-white/90 backdrop-blur-md shadow-lg hover:bg-white rounded-2xl text-slate-900 transition-all active:scale-95 border border-white/50"
                                                        >
                                                            <MoreVertical className="w-5 h-5" />
                                                        </button>
                                                    </Tooltip>

                                                    <AnimatePresence>
                                                        {activeMenu === evt.id && (
                                                            <motion.div
                                                                initial={{ opacity: 0, scale: 0.9, y: -10 }}
                                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                exit={{ opacity: 0, scale: 0.9, y: -10 }}
                                                                className="absolute right-0 mt-3 w-44 bg-white rounded-2xl shadow-2xl border border-stone-100 py-2 z-30 overflow-hidden"
                                                            >
                                                                <button
                                                                    onClick={(e) => handleRenameClick(e, evt)}
                                                                    className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-stone-50 transition-colors"
                                                                    title="Rename this event"
                                                                >
                                                                    <Pencil className="w-4 h-4 text-blue-500" />
                                                                    <span>Rename</span>
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openUploadForEvent(evt.id, evt.title);
                                                                        setManageLevel("photos");
                                                                        setActiveMenu(null);
                                                                    }}
                                                                    className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-stone-50 transition-colors border-t border-stone-50"
                                                                    title="Manage photos for this event"
                                                                >
                                                                    <Camera className="w-4 h-4 text-purple-500" />
                                                                    <span>Edit Photos</span>
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const url = `${window.location.origin}/events/${evt.id}?shared=true`;
                                                                        navigator.clipboard.writeText(url);
                                                                        setMessage("Share link copied! 🔗");
                                                                        setStatus("success");
                                                                        setTimeout(() => setStatus("idle"), 2000);
                                                                        setActiveMenu(null);
                                                                    }}
                                                                    className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-stone-50 transition-colors border-t border-stone-50"
                                                                    title="Copy shareable magic link"
                                                                >
                                                                    <Share2 className="w-4 h-4 text-emerald-500" />
                                                                    <span>Share Link</span>
                                                                </button>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setShowDeleteConfirm(evt.id);
                                                                        setActiveMenu(null);
                                                                    }}
                                                                    className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-red-50 text-red-600 transition-colors border-t border-stone-50"
                                                                    title="Permanently delete this event"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                    <span>Delete</span>
                                                                </button>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>

                                                <div className="absolute bottom-0 left-0 p-8 text-white w-full text-left">
                                                    <p className="text-xs font-sans font-bold uppercase tracking-[0.2em] text-royal-gold mb-3">{evt.date}</p>
                                                    <h3 className="text-2xl font-bold italic tracking-tight mb-4">{evt.title}</h3>
                                                    <div className="flex items-center text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-y-3 group-hover:translate-y-0 duration-300">
                                                        {manageLevel === "events" ? (
                                                            <>
                                                                <Settings className="w-4 h-4 mr-2" />
                                                                Manage Event
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ImageIcon className="w-4 h-4 mr-2" />
                                                                Manage Photos
                                                            </>
                                                        )}
                                                        <ArrowRight className="w-4 h-4 ml-2" />
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
                                        <Tooltip text="Back to list">
                                            <button
                                                onClick={() => setManageMode("list")}
                                                className="text-stone-400 hover:text-stone-600 transition-colors"
                                            >
                                                <ChevronLeft className="w-6 h-6" />
                                            </button>
                                        </Tooltip>
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
                                                <span>Create {manageLevel === "events" ? "Event" : "Gallery"}</span>
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
                                    className="max-w-7xl mx-auto bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-stone-100"
                                >
                                    <div className="flex items-center justify-between mb-8">
                                        <div>
                                            <h3 className="text-3xl font-bold tracking-tight">Gallery Editor</h3>
                                            <p className="text-slate-500 font-sans mt-1">Managing memories for <span className="text-slate-900 font-bold underline decoration-royal-gold decoration-2 underline-offset-4">{selectedEventName}</span></p>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            {/* View Toggle */}
                                            <div className="flex bg-stone-100 p-1.5 rounded-2xl mr-4 shadow-inner border border-stone-200">
                                                <Tooltip text="View as Thumbnails">
                                                    <button
                                                        onClick={() => setGalleryViewMode("grid")}
                                                        className={cn(
                                                            "p-2 rounded-xl transition-all active:scale-95",
                                                            galleryViewMode === "grid"
                                                                ? "bg-white text-slate-900 shadow-md border border-stone-100"
                                                                : "text-stone-400 hover:text-stone-600"
                                                        )}
                                                    >
                                                        <LayoutGrid className="w-5 h-5" />
                                                    </button>
                                                </Tooltip>
                                                <Tooltip text="View as List">
                                                    <button
                                                        onClick={() => setGalleryViewMode("list")}
                                                        className={cn(
                                                            "p-2 rounded-xl transition-all active:scale-95",
                                                            galleryViewMode === "list"
                                                                ? "bg-white text-slate-900 shadow-md border border-stone-100"
                                                                : "text-stone-400 hover:text-stone-600"
                                                        )}
                                                    >
                                                        <List className="w-5 h-5" />
                                                    </button>
                                                </Tooltip>
                                            </div>

                                            <Tooltip text="Back to galleries">
                                                <button
                                                    onClick={() => setManageMode("list")}
                                                    className="p-3 bg-stone-50 hover:bg-stone-100 text-stone-400 hover:text-stone-600 rounded-2xl transition-all active:scale-95"
                                                >
                                                    <ChevronLeft className="w-6 h-6" />
                                                </button>
                                            </Tooltip>
                                        </div>
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

                                    {galleryViewMode === "grid" ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                            {/* Existing Photos Grid */}
                                            {currentEventPhotos.map((photo) => {
                                                const isCover = userEvents.find(ev => ev.id === selectedEventId)?.coverImage === photo.url;
                                                return (
                                                    <motion.div
                                                        key={photo.id}
                                                        layout
                                                        className="group relative aspect-square overflow-hidden bg-stone-100 shadow-sm border border-stone-100 cursor-zoom-in"
                                                        onClick={() => setPreviewImage(photo.url)}
                                                    >
                                                        <img
                                                            src={photo.url}
                                                            alt="Gallery item"
                                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                        />
                                                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                                                        {/* Set as Gallery Cover Button */}
                                                        <div className="absolute top-3 left-3 z-10">
                                                            <Tooltip text={isCover ? "Current Gallery Thumbnail" : "Make it Gallery thumbnail"}>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleSetAsCover(photo.url); }}
                                                                    className={cn(
                                                                        "p-2.5 backdrop-blur-md rounded-xl shadow-lg transition-all active:scale-90",
                                                                        isCover
                                                                            ? "bg-royal-gold text-white opacity-100"
                                                                            : "bg-white/90 text-royal-gold opacity-0 group-hover:opacity-100 hover:bg-royal-gold/10"
                                                                    )}
                                                                >
                                                                    <ImageIcon className="w-4 h-4" />
                                                                </button>
                                                            </Tooltip>
                                                        </div>

                                                        {/* Set as Main Event Cover Button */}
                                                        {selectedMainEvent && (
                                                            <div className="absolute top-3 left-14 z-10">
                                                                <Tooltip text={selectedMainEvent.coverImage === photo.url ? "Current Main Event Thumbnail" : "Make it Main Event thumbnail"}>
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleSetAsCover(photo.url, selectedMainEvent.id, true); }}
                                                                        className={cn(
                                                                            "p-2.5 backdrop-blur-md rounded-xl shadow-lg transition-all active:scale-90",
                                                                            selectedMainEvent.coverImage === photo.url
                                                                                ? "bg-royal-gold text-white opacity-100"
                                                                                : "bg-white/90 text-royal-gold opacity-0 group-hover:opacity-100 hover:bg-royal-gold/10"
                                                                        )}
                                                                    >
                                                                        <Star className="w-4 h-4" />
                                                                    </button>
                                                                </Tooltip>
                                                            </div>
                                                        )}

                                                        {/* Delete Button */}
                                                        <div className="absolute top-3 right-3 z-10">
                                                            <Tooltip text="Delete Image">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id); }}
                                                                    className="p-2.5 bg-white/90 backdrop-blur-md rounded-xl text-red-500 shadow-lg opacity-0 group-hover:opacity-100 transition-all active:scale-95 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </Tooltip>
                                                        </div>
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
                                                title="Click to select photos to upload"
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
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Add Image Option as List Item */}
                                            <motion.label
                                                className={cn(
                                                    "flex items-center p-6 border-2 border-dashed rounded-3xl cursor-pointer transition-all hover:bg-stone-50 group",
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
                                                <div className="w-16 h-16 bg-stone-50 rounded-2xl flex items-center justify-center mr-6 group-hover:bg-white transition-all">
                                                    {status === "uploading" ? (
                                                        <Loader2 className="w-6 h-6 text-royal-gold animate-spin" />
                                                    ) : (
                                                        <Plus className="w-6 h-6 text-stone-400 group-hover:text-slate-900" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-800">Add New Photos</p>
                                                    <p className="text-sm text-stone-400">Click to upload memories to this gallery</p>
                                                </div>
                                            </motion.label>

                                            <div className="bg-white rounded-[2.5rem] border border-stone-100 overflow-hidden shadow-sm">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-stone-50/50 border-b border-stone-100">
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-stone-400">Preview</th>
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-stone-400">Technical Details</th>
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-stone-400">Metadata</th>
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-stone-400 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-stone-50">
                                                            {currentEventPhotos.map((photo) => {
                                                                const isCover = userEvents.find(ev => ev.id === selectedEventId)?.coverImage === photo.url;
                                                                const dateAdded = (
                                                                    photo.uploadedAt && typeof photo.uploadedAt === 'number'
                                                                        ? new Date(photo.uploadedAt)
                                                                        : photo.uploadedAt?.toDate?.() || new Date()
                                                                ).toLocaleDateString('en-GB', {
                                                                    day: 'numeric',
                                                                    month: 'short',
                                                                    year: 'numeric'
                                                                });

                                                                // Fallback for format if missing (for legacy photos)
                                                                let displayFormat = photo.format;
                                                                if (!displayFormat && photo.url) {
                                                                    const ext = photo.url.split('.').pop()?.split('?')[0].toLowerCase();
                                                                    if (ext && ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
                                                                        displayFormat = ext === 'jpeg' ? 'jpg' : ext;
                                                                    }
                                                                }

                                                                const formatSize = (bytes?: number) => {
                                                                    if (!bytes) return 'Legacy Photo';
                                                                    const k = 1024;
                                                                    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                                                                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                                                                    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
                                                                };

                                                                return (
                                                                    <tr key={photo.id} className="hover:bg-stone-50/50 transition-colors group">
                                                                        <td className="px-8 py-6">
                                                                            <div
                                                                                className="w-32 h-32 rounded-[1.5rem] overflow-hidden cursor-zoom-in shadow-md border border-stone-100 group-hover:scale-105 transition-transform"
                                                                                onClick={() => setPreviewImage(photo.url)}
                                                                            >
                                                                                <img src={photo.url} alt="" className="w-full h-full object-cover" />
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-8 py-6">
                                                                            <div className="space-y-1.5">
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-stone-400 w-20">Resolution:</span>
                                                                                    <span className="font-bold text-slate-700">{photo.width && photo.height ? `${photo.width} × ${photo.height}` : 'N/A'}</span>
                                                                                </div>
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-stone-400 w-20">File Size:</span>
                                                                                    <span className={cn("font-bold text-slate-700", !photo.size && "text-stone-300 font-normal italic")}>
                                                                                        {formatSize(photo.size)}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-stone-400 w-20">Format:</span>
                                                                                    <span className="font-bold text-slate-700 uppercase">{displayFormat || 'N/A'}</span>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-8 py-6">
                                                                            <div className="space-y-1.5">
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-stone-400 w-20">Added On:</span>
                                                                                    <span className="font-bold text-slate-700">{dateAdded}</span>
                                                                                </div>
                                                                                <div className="flex items-center space-x-2 pt-1">
                                                                                    {isCover && (
                                                                                        <span className="px-2 py-0.5 bg-royal-gold/10 text-royal-gold text-[9px] font-bold uppercase rounded-md border border-royal-gold/20">
                                                                                            Gallery Thumb
                                                                                        </span>
                                                                                    )}
                                                                                    {selectedMainEvent?.coverImage === photo.url && (
                                                                                        <span className="px-2 py-0.5 bg-slate-900/10 text-slate-900 text-[9px] font-bold uppercase rounded-md border border-slate-900/20">
                                                                                            Event Thumb
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-8 py-6 text-right">
                                                                            <div className="flex items-center justify-end space-x-2">
                                                                                <Tooltip text={isCover ? "Current Gallery Thumbnail" : "Make it Gallery thumbnail"}>
                                                                                    <button
                                                                                        onClick={() => handleSetAsCover(photo.url)}
                                                                                        className={cn(
                                                                                            "p-2.5 rounded-xl transition-all active:scale-95",
                                                                                            isCover ? "bg-royal-gold text-white shadow-lg" : "bg-white text-stone-400 hover:text-royal-gold hover:bg-royal-gold/5 border border-stone-200"
                                                                                        )}
                                                                                    >
                                                                                        <ImageIcon className="w-4 h-4" />
                                                                                    </button>
                                                                                </Tooltip>
                                                                                {selectedMainEvent && (
                                                                                    <Tooltip text={selectedMainEvent.coverImage === photo.url ? "Current Main Event Thumbnail" : "Make it Main Event thumbnail"}>
                                                                                        <button
                                                                                            onClick={() => handleSetAsCover(photo.url, selectedMainEvent.id, true)}
                                                                                            className={cn(
                                                                                                "p-2.5 rounded-xl transition-all active:scale-95",
                                                                                                selectedMainEvent.coverImage === photo.url ? "bg-royal-gold text-white shadow-lg" : "bg-white text-stone-400 hover:text-royal-gold hover:bg-royal-gold/5 border border-stone-200"
                                                                                            )}
                                                                                        >
                                                                                            <Star className="w-4 h-4" />
                                                                                        </button>
                                                                                    </Tooltip>
                                                                                )}
                                                                                <Tooltip text="Delete Image">
                                                                                    <button
                                                                                        onClick={() => handleDeletePhoto(photo.id)}
                                                                                        className="p-2.5 bg-white text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-95 border border-stone-200"
                                                                                    >
                                                                                        <Trash2 className="w-4 h-4" />
                                                                                    </button>
                                                                                </Tooltip>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                                {currentEventPhotos.length === 0 && !loadingPhotos && (
                                                    <div className="p-12 text-center">
                                                        <p className="text-stone-400 italic">No photos in this gallery yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                </motion.div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="permissions-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            {view === "permissions" && (
                                <div className="space-y-12">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-12 h-12 bg-slate-900 rounded-[1.2rem] flex items-center justify-center text-white shadow-xl shadow-slate-200">
                                                <ShieldCheck size={24} />
                                            </div>
                                            <div>
                                                <h2 className="text-3xl font-bold mb-1 font-serif text-slate-800">Permissions & Traffic</h2>
                                                <p className="text-slate-500 font-sans text-sm">Manage your team and monitor guest access.</p>
                                            </div>
                                        </div>

                                        <div className="flex bg-stone-100 p-1.5 rounded-2xl overflow-x-auto scroller-hidden">
                                            <button
                                                onClick={() => setActivePermissionTab("admin_details")}
                                                className={cn(
                                                    "px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                                                    activePermissionTab === "admin_details" ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
                                                )}
                                            >
                                                Admin Details
                                            </button>
                                            <button
                                                onClick={() => setActivePermissionTab("guest_user")}
                                                className={cn(
                                                    "px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                                                    activePermissionTab === "guest_user" ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
                                                )}
                                            >
                                                Guest User
                                            </button>
                                        </div>
                                    </div>

                                    {activePermissionTab === "admin_details" ? (
                                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100">
                                                <div className="flex items-center justify-between mb-8">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-slate-800 font-serif">Primary Administrators</h3>
                                                        <p className="text-stone-400 text-xs font-sans uppercase tracking-widest mt-1">Full account management access</p>
                                                    </div>
                                                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
                                                        <ShieldCheck size={20} />
                                                    </div>
                                                </div>

                                                <div className="space-y-6">
                                                    {allUsers.filter(u => u.role === 'admin' && (u.delegatedBy === user?.uid || u.id === user?.uid) && (u.roleType === 'primary' || !u.roleType)).length > 0 ? (
                                                        allUsers.filter(u => u.role === 'admin' && (u.delegatedBy === user?.uid || u.id === user?.uid) && (u.roleType === 'primary' || !u.roleType)).map((u) => (
                                                            <div key={u.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100 group hover:bg-white hover:shadow-md transition-all duration-300">
                                                                <div className="flex items-center space-x-4">
                                                                    <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm">
                                                                        {u.name.charAt(0)}
                                                                    </div>
                                                                    <div>
                                                                        <p className="text-slate-800 font-bold text-sm">{u.name} {u.id === user?.uid && "(You)"}</p>
                                                                        <p className="text-stone-400 text-[10px] font-sans">{u.email}</p>
                                                                    </div>
                                                                </div>
                                                                {u.id !== user?.uid && (
                                                                    <button
                                                                        onClick={() => handleUpdateUserRole(u.id, "admin")}
                                                                        className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                                                                    >
                                                                        Revoke
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="py-10 text-center border-2 border-dashed border-stone-100 rounded-3xl">
                                                            <p className="text-stone-400 text-sm font-sans italic">No primary admins assigned.</p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-8 pt-8 border-t border-stone-100">
                                                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-4">Promote to Primary</p>
                                                    <div className="flex gap-4">
                                                        <select
                                                            className="flex-1 px-4 py-3 bg-stone-100 border-none rounded-2xl text-xs font-bold font-sans outline-none focus:ring-2 focus:ring-slate-200 transition-all"
                                                            onChange={(e) => {
                                                                if (e.target.value) handleUpdateUserRole(e.target.value, "user", "primary");
                                                            }}
                                                            value=""
                                                        >
                                                            <option value="">Select a user...</option>
                                                            {allUsers.filter(u => u.id !== user?.uid && (u.role !== 'admin' || (u.role === 'admin' && u.delegatedBy !== user?.uid))).map(u => (
                                                                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-stone-100">
                                                <div className="flex items-center justify-between mb-8">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-slate-800 font-serif">Event Administrators</h3>
                                                        <p className="text-stone-400 text-xs font-sans uppercase tracking-widest mt-1">Management per event</p>
                                                    </div>
                                                </div>

                                                <div className="space-y-6">
                                                    {loadingEvents ? (
                                                        <div className="flex items-center justify-center py-12">
                                                            <Loader2 className="w-8 h-8 animate-spin text-royal-gold" />
                                                        </div>
                                                    ) : userEvents.filter(e => e.type === 'main' || (!e.type && !e.parentId)).length > 0 ? (
                                                        userEvents.filter(e => e.type === 'main' || (!e.type && !e.parentId)).map(event => {
                                                            const admins = allUsers.filter(u =>
                                                                u.role === 'admin' &&
                                                                u.delegatedBy === user?.uid &&
                                                                u.roleType === 'event' &&
                                                                u.assignedEvents?.includes(event.id)
                                                            );
                                                            return (
                                                                <div key={event.id} className="p-6 bg-stone-50 rounded-[2rem] border border-stone-100 space-y-4">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center space-x-3">
                                                                            <div className="w-2 h-2 rounded-full bg-royal-gold"></div>
                                                                            <span className="text-sm font-bold text-slate-700">{event.title}</span>
                                                                        </div>
                                                                        <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">
                                                                            {admins.length} {admins.length === 1 ? 'Admin' : 'Admins'}
                                                                        </span>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        {admins.map(admin => (
                                                                            <div key={admin.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-stone-100">
                                                                                <div className="flex items-center space-x-3">
                                                                                    <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
                                                                                        {admin.name.charAt(0)}
                                                                                    </div>
                                                                                    <div>
                                                                                        <p className="text-slate-800 font-bold text-[11px]">{admin.name}</p>
                                                                                        <p className="text-stone-400 text-[9px] font-sans">{admin.email}</p>
                                                                                    </div>
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => handleUpdateUserRole(admin.id, "admin")}
                                                                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                                                                >
                                                                                    <Trash2 size={14} />
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                        {admins.length === 0 && (
                                                                            <p className="text-[10px] text-stone-300 font-sans italic pl-5">No specific admins assigned to this event.</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <div className="py-6 text-center border-2 border-dashed border-stone-100 rounded-2xl">
                                                            <p className="text-stone-400 text-xs font-sans italic">No events created yet.</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Promotion UI relocated here for Admin Details context */}
                                                <div className="mt-10 pt-10 border-t border-stone-100">
                                                    <h4 className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-6">Promote to Event Admin</h4>
                                                    <div className="space-y-6 bg-stone-50 p-6 rounded-[2rem] border border-stone-100">
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest ml-1">1. Select User</label>
                                                            <select
                                                                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-2xl text-xs font-bold font-sans outline-none focus:ring-2 focus:ring-royal-gold/20 transition-all font-sans"
                                                                onChange={(e) => setSelectedUserToAssign(e.target.value)}
                                                                value={selectedUserToAssign}
                                                            >
                                                                <option value="">Select a user...</option>
                                                                {allUsers.filter(u => u.id !== user?.uid && (u.role !== 'admin' || (u.role === 'admin' && u.delegatedBy !== user?.uid))).map(u => (
                                                                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-bold text-slate-700 uppercase tracking-widest ml-1">2. Assign Galleries</label>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-2 scroller-hidden">
                                                                {userEvents.filter(e => e.type === 'main' || (!e.type && !e.parentId)).map(e => (
                                                                    <label key={e.id} className="flex items-center p-3 bg-white rounded-xl border border-stone-100 cursor-pointer hover:border-royal-gold/20 transition-all">
                                                                        <input
                                                                            type="checkbox"
                                                                            className="accent-royal-gold w-4 h-4 rounded"
                                                                            checked={assignedEventsForSelect.includes(e.id)}
                                                                            onChange={(ev) => {
                                                                                if (ev.target.checked) {
                                                                                    setAssignedEventsForSelect([...assignedEventsForSelect, e.id]);
                                                                                } else {
                                                                                    setAssignedEventsForSelect(assignedEventsForSelect.filter(id => id !== e.id));
                                                                                }
                                                                            }}
                                                                        />
                                                                        <span className="ml-3 text-[11px] font-medium text-slate-700 truncate">{e.title}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        <button
                                                            onClick={async () => {
                                                                if (!selectedUserToAssign) return;
                                                                await handleUpdateUserRole(selectedUserToAssign, "user", "event", assignedEventsForSelect);
                                                                setSelectedUserToAssign("");
                                                                setAssignedEventsForSelect([]);
                                                            }}
                                                            disabled={!selectedUserToAssign}
                                                            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl active:scale-95 disabled:bg-stone-300"
                                                        >
                                                            Create Event Admin
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8">
                                            {/* Grouping Guest Logs by Event */}
                                            {userEvents.filter(e => e.type === 'main' || (!e.type && !e.parentId)).map(event => {
                                                const eventLogs = trafficLogs.filter(log => log.parentEventId === event.id || log.eventId === event.id);
                                                const pendingCount = eventLogs.filter(l => l.status === 'pending').length;

                                                return (
                                                    <div key={event.id} className="bg-white rounded-[2.5rem] border border-stone-100 overflow-hidden shadow-sm">
                                                        <div className="p-8 border-b border-stone-50 bg-stone-50/30 flex items-center justify-between">
                                                            <div className="flex items-center space-x-4">
                                                                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-stone-100 flex items-center justify-center text-royal-gold">
                                                                    <Users size={20} />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-lg font-bold text-slate-800 font-serif">{event.title}</h4>
                                                                    <div className="flex items-center space-x-2 mt-0.5">
                                                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{eventLogs.length} Total Visits</span>
                                                                        {pendingCount > 0 && (
                                                                            <span className="flex items-center space-x-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-[9px] font-bold uppercase border border-amber-100">
                                                                                <div className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                                                                                <span>{pendingCount} Pending</span>
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex bg-white rounded-xl p-1 border border-stone-100">
                                                                <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-stone-400 tracking-tighter">Event ID: {event.id.slice(0, 8)}...</div>
                                                            </div>
                                                        </div>

                                                        <div className="divide-y divide-stone-50">
                                                            {eventLogs.length > 0 ? [...eventLogs].sort((a, b) => b.loginAt?.seconds - a.loginAt?.seconds).map(log => {
                                                                const loginDate = log.loginAt ? new Date(log.loginAt.seconds * 1000).toLocaleString('en-IN', {
                                                                    day: '2-digit',
                                                                    month: 'short',
                                                                    hour: '2-digit',
                                                                    minute: '2-digit'
                                                                }) : 'Unknown';

                                                                return (
                                                                    <div key={log.id} className="p-6 hover:bg-stone-50/30 transition-colors flex items-center justify-between group">
                                                                        <div className="flex items-center space-x-4">
                                                                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                                                                                {(log.name || 'G').charAt(0)}
                                                                            </div>
                                                                            <div>
                                                                                <p className="font-bold text-slate-800 text-sm">{log.name || 'Anonymous'}</p>
                                                                                <div className="flex items-center space-x-3 text-[10px] text-stone-400 font-sans mt-0.5">
                                                                                    <span className="flex items-center space-x-1">
                                                                                        <Phone size={10} />
                                                                                        <span>{log.phone || 'N/A'}</span>
                                                                                    </span>
                                                                                    <span>•</span>
                                                                                    <span>{loginDate}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center space-x-2">
                                                                            {log.status === 'pending' ? (
                                                                                <>
                                                                                    <button
                                                                                        onClick={async () => {
                                                                                            await updateGuestStatus(log.id, 'approved');
                                                                                            fetchTrafficLogs(); // Refresh
                                                                                        }}
                                                                                        className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-200 active:scale-95 transition-all"
                                                                                    >
                                                                                        Approve
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={async () => {
                                                                                            await updateGuestStatus(log.id, 'rejected');
                                                                                            fetchTrafficLogs(); // Refresh
                                                                                        }}
                                                                                        className="px-4 py-2 bg-white text-stone-400 border border-stone-200 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all"
                                                                                    >
                                                                                        Deny
                                                                                    </button>
                                                                                </>
                                                                            ) : (
                                                                                <span className={cn(
                                                                                    "px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest border",
                                                                                    log.status === 'approved' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-rose-50 text-rose-600 border-rose-100"
                                                                                )}>
                                                                                    {log.status || 'Approved'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }) : (
                                                                <div className="p-12 text-center">
                                                                    <p className="text-stone-300 font-sans italic text-sm">No guests have visited this event yet.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {userEvents.filter(e => e.type === 'main' || (!e.type && !e.parentId)).length === 0 && (
                                                <div className="p-20 bg-white rounded-[3rem] border-2 border-dashed border-stone-100 flex flex-col items-center justify-center text-center">
                                                    <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center text-stone-300 mb-6">
                                                        <Users size={32} />
                                                    </div>
                                                    <h3 className="text-xl font-bold text-slate-800 font-serif mb-2">No Events Found</h3>
                                                    <p className="text-stone-400 font-sans text-sm max-w-xs">
                                                        Create an event in the "Manage Gallery" section to start tracking guests.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
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
                                            title="Discard changes"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={status === "uploading"}
                                            className="flex-1 py-4 px-6 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:bg-stone-300"
                                            title="Save new name"
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
                {/* Image Preview Lightbox */}
                <AnimatePresence>
                    {previewImage && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setPreviewImage(null)}
                            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12 bg-slate-950/90 backdrop-blur-xl cursor-zoom-out"
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="relative max-w-full max-h-full rounded-3xl overflow-hidden shadow-2xl border border-white/10"
                            >
                                <img
                                    src={previewImage}
                                    alt="Enlarged preview"
                                    className="max-w-full max-h-[85vh] object-contain shadow-2xl"
                                />
                                <div className="absolute top-6 right-6">
                                    <Tooltip text="Close preview">
                                        <button
                                            onClick={() => setPreviewImage(null)}
                                            className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all active:scale-95 border border-white/20"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>
                                    </Tooltip>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main >
        </div >
    );
}

function OptionCard({ title, description, icon: Icon, onClick, color, hoverBorder, badge, actionTitle }: any) {
    return (
        <Tooltip text={actionTitle}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={onClick}
                className={cn(
                    "group cursor-pointer bg-white p-10 rounded-[3rem] border border-stone-100 shadow-sm transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden h-full flex flex-col",
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
                <p className="text-slate-500 font-sans leading-relaxed mb-6 text-sm">
                    {description}
                </p>
                <div className="flex items-center text-xs font-bold uppercase tracking-widest text-slate-900 mt-auto">
                    Explore
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </div>
            </motion.div>
        </Tooltip>
    );
}

"use client";

import React, { useState, useEffect, Suspense, useTransition, useRef, useCallback } from "react";
import LoadingScreen from "@/components/LoadingScreen";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
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
    MoreHorizontal,
    Pencil,
    Check,
    Trash2,
    X,
    Star,
    LayoutGrid,
    List,
    Users,
    Share2,
    Phone,
    Globe,
    Crown,
    Calendar,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    UserCog,
    UserMinus,
    Info,
    MessageCircle,
    Sparkles,
    UserPlus,
    Play,
    Video,
    Home,
    ChevronUp,
    Heart,
    Gift,
    Briefcase,
    GraduationCap
} from "lucide-react";
import { cn, formatEventDate } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
    createEvent,
    createUserProfile,
    getUserEvents,
    Event,
    Photo,
    deleteEvent,
    updateEvent,
    getEventPhotos,
    getEventPhotosPaginated,
    deletePhoto,
    rotatePhoto,
    getUsers,
    updateUserRole,
    deleteUser,
    getUserTotalStorage,
    getUserEventCount,
    getDelegatedAdminsCount,
    getGuestLogs,
    getEventLogs,
    getSubEvents,
    getEventById,
    getUserById,
    getApprovedSharedEventsForUser,
    saveCoverUsagePhoto,
    deleteCoverUsagePhoto,
    updatePhotosOrder,
    updateSubEventsOrder,
	    getEventFavouritePhotos,
	    toggleEventFavouritePhoto,
	    getFavouritePhotosForEvents,
	    generateEventJoinId,
	    setEventSampleGalleryStatus,
	} from "@/lib/database";
import { uploadEventImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { getApiUrl } from "@/lib/apiBase";
import { Tooltip } from "@/components/Tooltip";
import { navigateWithModifierClick } from "@/lib/navigation";
import { formatStorageSize, getPlanDetails, getUsagePercent } from "@/lib/planLimits";
import { getSubscriptionStatus } from "@/lib/subscriptionStatus";
import { getWebLightboxTheme } from "@/lib/webTemplateTheme";
import { v4 as uuidv4 } from "uuid";
import { deleteGuestAction, updateGuestPermissionsAction, updateGuestStatusAction } from "@/app/actions/permissions";


import { Lightbox } from "@/components/ui/Lightbox";
const GridMediaCell = ({
    photo,
    gridSrc,
    isVideo,
    shouldBlurMediaForPlan,
    onThumbnailLoaded
}: {
    photo: Photo;
    gridSrc: string;
    isVideo: boolean;
    shouldBlurMediaForPlan: boolean;
    onThumbnailLoaded?: (photoId: string, storageKey: string) => void;
}) => {
    const [loaded, setLoaded] = useState(!!photo.thumbnailUrl);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        if (photo.thumbnailUrl) {
            setLoaded(true);
            if (onThumbnailLoaded) {
                onThumbnailLoaded(photo.id, photo.storageKey || "");
            }
        }
    }, [photo.thumbnailUrl, onThumbnailLoaded]);

    if (isVideo) {
        return (
            <div className="relative h-full w-full bg-slate-950">
                <video
                    src={photo.url}
                    className={cn(
                        "h-full w-full object-cover transition-all duration-300",
                        shouldBlurMediaForPlan && "blur-[1.5px] scale-[1.02]"
                    )}
                    muted
                    playsInline
                    preload="metadata"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-300/70 bg-slate-950/80 text-amber-300 shadow-xl">
                        <Play className="h-5 w-5 fill-current" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full relative">
            {!loaded && (
                <div className="absolute inset-0 z-10 h-full w-full animate-pulse bg-slate-800/80 flex flex-col items-center justify-center space-y-1">
                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    <span className="text-[8px] uppercase font-bold tracking-widest text-slate-500">Processing</span>
                </div>
            )}
            <img
                src={loaded ? gridSrc : `${photo.url}-thumbnail.webp?retry=${retryCount}`}
                alt="Gallery item"
                className={cn(
                    "w-full h-full object-cover transition-all duration-500 group-hover:scale-105",
                    shouldBlurMediaForPlan && "blur-[1.5px] scale-[1.02]",
                    !loaded && "invisible"
                )}
                onLoad={() => {
                    setLoaded(true);
                    if (onThumbnailLoaded) {
                        onThumbnailLoaded(photo.id, photo.storageKey || "");
                    }
                }}
                onError={() => {
                    if (!photo.thumbnailUrl) {
                        setTimeout(() => {
                            setRetryCount(prev => prev + 1);
                        }, 2500);
                    }
                }}
            />
        </div>
    );
};

import { resolveEventCoverImage } from "@/lib/eventCovers";


const PLACEHOLDER_IMAGES = [
    "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=2071&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1465495910483-34a170a7bb00?q=80&w=2070&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1549413187-0521e7cebcba?q=80&w=2070&auto=format&fit=crop"
];
const DEFAULT_EVENT_COVER_IMAGE = PLACEHOLDER_IMAGES[0];
const FREE_PLAN_VIDEO_LIMIT_BYTES = 200 * 1024 * 1024;
const EVENT_TYPE_OPTIONS = [
    { name: "Wedding", icon: Heart },
    { name: "Birthday", icon: Gift },
    { name: "Anniversary", icon: Sparkles },
    { name: "Corporate", icon: Briefcase },
    { name: "Sports", icon: Play },
    { name: "College", icon: GraduationCap },
    { name: "Other", icon: MoreHorizontal },
];

export const TEMPLATE_THEMES = [
    {
        "id": "royal",
        "category": "Wedding",
        "label": "Royal Emerald",
        "desc": "Deep imperial emerald & palace gold",
        "background": {
            "light": "#033026",
            "dark": "#02231c"
        },
        "accent": "#cca43b"
    },
    {
        "id": "classic",
        "category": "Wedding",
        "label": "Classic White",
        "desc": "Timeless and elegant design",
        "background": {
            "light": "#FAF9F6",
            "dark": "#FAF9F6"
        },
        "accent": "#cca43b"
    },
    {
        "id": "hero",
        "category": "Wedding",
        "label": "Midnight Hero",
        "desc": "Big impact cinematic dark aesthetic",
        "background": {
            "light": "#000000",
            "dark": "#000000"
        },
        "accent": "#cca43b"
    },
    {
        "id": "ethereal",
        "category": "Wedding",
        "label": "Ethereal Mist",
        "desc": "Vintage fine-art album & steel blue",
        "background": {
            "light": "#F8FAFC",
            "dark": "#F8FAFC"
        },
        "accent": "#4A6984"
    },
    {
        "id": "scrapbook",
        "category": "Birthday",
        "label": "Playful Scrapbook",
        "desc": "Soft modern keepsake aesthetic",
        "background": {
            "light": "#f8f5f0",
            "dark": "#151c1b"
        },
        "accent": "#d9826b"
    },
    {
        "id": "neon",
        "category": "Birthday",
        "label": "Neon Party",
        "desc": "Premium neon birthday album",
        "background": {
            "light": "#070611",
            "dark": "#070611"
        },
        "accent": "#ff3df2"
    },
    {
        "id": "pastel",
        "category": "Birthday",
        "label": "Pastel Dream",
        "desc": "Dreamy pastel memory journal",
        "background": {
            "light": "#fff7f4",
            "dark": "#fff7f4"
        },
        "accent": "#c9768b"
    },
    {
        "id": "pop",
        "category": "Birthday",
        "label": "Pop Art",
        "desc": "Comic poster birthday album",
        "background": {
            "light": "#ffe84a",
            "dark": "#ffe84a"
        },
        "accent": "#ef2b3a"
    },
    {
        "id": "golden_years",
        "category": "Anniversary",
        "label": "Golden Years",
        "desc": "Champagne legacy celebration",
        "background": {
            "light": "#fbf4e6",
            "dark": "#1f1710"
        },
        "accent": "#c99a2e"
    },
    {
        "id": "vintage",
        "category": "Anniversary",
        "label": "Vintage Noir",
        "desc": "Dark archival anniversary journal",
        "background": {
            "light": "#0F0E0B",
            "dark": "#0F0E0B"
        },
        "accent": "#B89145"
    },
    {
        "id": "rose",
        "category": "Anniversary",
        "label": "Rose Garden",
        "desc": "Romantic floral memory journal",
        "background": {
            "light": "#fff9f5",
            "dark": "#30151d"
        },
        "accent": "#b76578"
    },
    {
        "id": "minimal_love",
        "category": "Anniversary",
        "label": "Minimal Love",
        "desc": "Minimal romantic editorial journal",
        "background": {
            "light": "#f7efe4",
            "dark": "#17120d"
        },
        "accent": "#6d4b34"
    },
    {
        "id": "bohemian",
        "category": "Other",
        "label": "Bohemian Rhapsody",
        "desc": "Sunset acoustic & festival theme",
        "background": {
            "light": "#fff7ed",
            "dark": "#2f241d"
        },
        "accent": "#fb923c"
    },
    {
        "id": "diamond",
        "category": "Other",
        "label": "Diamond Shine",
        "desc": "Cool blues and sparkle",
        "background": {
            "light": "#f0f9ff",
            "dark": "#082f49"
        },
        "accent": "#0284c7"
    },
    {
        "id": "blush",
        "category": "Other",
        "label": "Blush & Bashful",
        "desc": "Soft pink champagne",
        "background": {
            "light": "#fff7ed",
            "dark": "#431407"
        },
        "accent": "#ea580c"
    },
    {
        "id": "garden",
        "category": "Other",
        "label": "Garden Path",
        "desc": "Natural greens and ivory",
        "background": {
            "light": "#E5ECE9",
            "dark": "#112217"
        },
        "accent": "#2E6F40"
    },
    {
        "id": "midnight_glam",
        "category": "Other",
        "label": "Midnight Glam",
        "desc": "Dark blue and silver",
        "background": {
            "light": "#eff6ff",
            "dark": "#050505"
        },
        "accent": "#3b82f6"
    },
    {
        "id": "cinematic",
        "category": "Other",
        "label": "Cinematic Noir",
        "desc": "Dramatic and immersive",
        "background": {
            "light": "#f5f5f5",
            "dark": "#000000"
        },
        "accent": "#ef4444"
    },
    {
        "id": "modern_lounge",
        "category": "Other",
        "label": "Modern Lounge",
        "desc": "Sleek and contemporary",
        "background": {
            "light": "#f8fafc",
            "dark": "#101010"
        },
        "accent": "#818cf8"
    },
    {
        "id": "elegant_night",
        "category": "Other",
        "label": "Elegant Night",
        "desc": "Sophisticated design",
        "background": {
            "light": "#fafafa",
            "dark": "#111111"
        },
        "accent": "#171717"
    },
    {
        "id": "museum",
        "category": "Corporate",
        "label": "Museum Gallery",
        "desc": "Luxury corporate exhibition",
        "background": {
            "light": "#f3f0ea",
            "dark": "#0b1118"
        },
        "accent": "#9b7a44"
    },
    {
        "id": "brutalist",
        "category": "Corporate",
        "label": "Brutalist Grid",
        "desc": "Modern architectural editorial grid",
        "background": {
            "light": "#efede7",
            "dark": "#111113"
        },
        "accent": "#1a1a1c"
    },
    {
        "id": "tech_sleek",
        "category": "Corporate",
        "label": "Tech Sleek",
        "desc": "Futuristic and clean",
        "background": {
            "light": "#050b17",
            "dark": "#050b17"
        },
        "accent": "#22d3ee"
    },
    {
        "id": "executive",
        "category": "Corporate",
        "label": "Executive Suite",
        "desc": "Professional theme",
        "background": {
            "light": "#08111f",
            "dark": "#08111f"
        },
        "accent": "#d4b474"
    },
    {
        "id": "polaroid",
        "category": "Other",
        "label": "Vintage Polaroid",
        "desc": "Classic photo frames",
        "background": {
            "light": "#f8f3e7",
            "dark": "#1c1917"
        },
        "accent": "#b45309"
    },
    {
        "id": "editorial",
        "category": "Other",
        "label": "Editorial Mag",
        "desc": "Magazine layout style",
        "background": {
            "light": "#fafaf9",
            "dark": "#171717"
        },
        "accent": "#111827"
    },
    {
        "id": "vibrant",
        "category": "Other",
        "label": "Vibrant Energy",
        "desc": "Colorful and dynamic",
        "background": {
            "light": "#f5f3ff",
            "dark": "#4c1d95"
        },
        "accent": "#8b5cf6"
    },
    {
        "id": "zen",
        "category": "Other",
        "label": "Zen Garden",
        "desc": "Calm and peaceful",
        "background": {
            "light": "#f5f5f4",
            "dark": "#1c1917"
        },
        "accent": "#57534e"
    },
    {
        "id": "cyber_tech",
        "category": "College",
        "label": "Cyber Tech",
        "desc": "Neon cyber hackathon & coding terminal",
        "background": {
            "light": "#090d16",
            "dark": "#05070c"
        },
        "accent": "#00f0ff"
    },
    {
        "id": "retro_arcade",
        "category": "College",
        "label": "Retro Arcade",
        "desc": "Bold pop art & funky festival vibe",
        "background": {
            "light": "#ffde4a",
            "dark": "#ffe663"
        },
        "accent": "#ff3562"
    },
    {
        "id": "academic_editorial",
        "category": "College",
        "label": "Academic Editorial",
        "desc": "Clean minimalist journal & campus registry style",
        "background": {
            "light": "#FCFAF7",
            "dark": "#0B0E14"
        },
        "accent": "#800020"
    },
    {
        "id": "neon_carnival",
        "category": "College",
        "label": "Neon Carnival",
        "desc": "Glowing festival lights & concert stage",
        "background": {
            "light": "#0c0714",
            "dark": "#06030a"
        },
        "accent": "#d946ef"
    }
];


export const getTemplateCategoryForEventCategory = (category?: string) => {
    if (category === 'Sports') return 'Other';
    return category || 'Wedding';
};

export const getTemplatesForEventCategory = (category?: string) => {
    const templateCategory = getTemplateCategoryForEventCategory(category);
    return TEMPLATE_THEMES.filter((theme) => theme.category === templateCategory);
};

type EventDetailLog = {
    id: string;
    name?: string;
    phone?: string;
    email?: string;
    status?: string;
    loginAt?: { seconds?: number };
    canAdmin?: boolean;
    canUpload?: boolean;
    canComment?: boolean;
};

const DATE_PICKER_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DATE_PICKER_ITEM_HEIGHT = 56;

function formatCreateEventDate(date: Date) {
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function createEventSlug(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
}

function DatePickerColumn({
    options,
    selectedValue,
    onSelect,
}: {
    options: Array<{ label: string; value: number }>;
    selectedValue: number;
    onSelect: (value: number) => void;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const settleTimerRef = useRef<number | null>(null);
    const initialSelectedIndexRef = useRef(Math.max(0, options.findIndex(option => option.value === selectedValue)));

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            scrollRef.current?.scrollTo({
                top: initialSelectedIndexRef.current * DATE_PICKER_ITEM_HEIGHT,
                behavior: "auto",
            });
        }, 0);

        return () => window.clearTimeout(timeout);
    }, []);

    useEffect(() => () => {
        if (settleTimerRef.current) {
            window.clearTimeout(settleTimerRef.current);
        }
    }, []);

    return (
        <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute left-0 right-0 top-1/2 z-10 h-14 -translate-y-1/2 border-y border-slate-400" />
            <div
                ref={scrollRef}
                className="max-h-56 touch-pan-y snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth px-1 py-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onScroll={(event) => {
                    if (settleTimerRef.current) {
                        window.clearTimeout(settleTimerRef.current);
                    }

                    const scrollTop = event.currentTarget.scrollTop;
                    settleTimerRef.current = window.setTimeout(() => {
                        const index = Math.max(0, Math.min(options.length - 1, Math.round(scrollTop / DATE_PICKER_ITEM_HEIGHT)));
                        const option = options[index];
                        if (option && option.value !== selectedValue) {
                            onSelect(option.value);
                        }
                    }, 90);
                }}
            >
                {options.map((option) => {
                    const isSelected = option.value === selectedValue;

                    return (
                        <button
                            key={`${option.label}-${option.value}`}
                            type="button"
                            onClick={(event) => {
                                onSelect(option.value);
                                event.currentTarget.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
                            }}
                            className={cn(
                                "flex h-14 w-full snap-center items-center justify-center rounded-xl text-center text-xl font-medium transition-colors",
                                isSelected
                                    ? "text-slate-950"
                                    : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            )}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function DashboardContent() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [view, setView] = useState<"main" | "manage" | "permissions">("main");
    const [manageMode, setManageMode] = useState<"list" | "add-event" | "add-image">("list");
    const [manageLevel, setManageLevel] = useState<"events" | "galleries" | "photos" | "event-details">("events");
    const [selectedMainEvent, setSelectedMainEvent] = useState<Event | null>(null);
    const [viewingPhoto, setViewingPhoto] = useState<any | null>(null);
    const [photoActionItem, setPhotoActionItem] = useState<Photo | null>(null);
    const [galleryViewMode, setGalleryViewMode] = useState<"grid" | "list">("grid");
    const [galleryMediaTab, setGalleryMediaTab] = useState<"photos" | "videos">("photos");
    const [isDraggingPhotos, setIsDraggingPhotos] = useState(false);
    const [galleryMessageText, setGalleryMessageText] = useState("");
    const [isNavigating, setIsNavigating] = useState(false);
    const [, startTransition] = useTransition();

    // Upload Manager State (Google Drive style bottom-right widget)
    interface UploadQueueItem {
        id: string;
        fileName: string;
        status: "pending" | "uploading" | "processing" | "success" | "error";
        progress: number; // 0 to 100
        error?: string;
        mediaType?: "photo" | "video";
        storageKey?: string;
        photoId?: string;
    }
    const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
    const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(false);
    const [isUploadPanelMinimized, setIsUploadPanelMinimized] = useState(false);
    const [indexingStatus, setIndexingStatus] = useState<{
        total: number;
        indexed: number;
        photosWithFaces?: number;
        photosWithoutFaces?: number;
        pending: number;
        percentComplete: number;
        status: string;
    } | null>(null);

    // Helper: show loading screen briefly, then navigate
    const navigateTo = (url: string, message?: string) => {
        setIsNavigating(true);
        setTimeout(() => {
            startTransition(() => {
                router.push(url);
            });
            // Hide loading after navigation settles
            setTimeout(() => setIsNavigating(false), 600);
        }, 400);
    };

    const goBackOr = (fallbackUrl: string) => {
        if (typeof window !== "undefined" && window.history.length > 1) {
            router.back();
            return;
        }

        router.push(fallbackUrl);
    };

    // Data State
    const [userEvents, setUserEvents] = useState<Event[]>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [sampleGalleryUpdating, setSampleGalleryUpdating] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'hosted' | 'shared' | 'request'>('hosted');
    const [sharedEvents, setSharedEvents] = useState<Event[]>([]);
    const [currentEventPhotos, setCurrentEventPhotos] = useState<Photo[]>([]);
    const [currentEventMediaCounts, setCurrentEventMediaCounts] = useState({ photos: 0, videos: 0 });
    const [currentEventRetainedMediaIds, setCurrentEventRetainedMediaIds] = useState<Set<string>>(new Set());
    const [eventFavouritePhotoIds, setEventFavouritePhotoIds] = useState<Set<string>>(new Set());
    const [eventFavouritePreview, setEventFavouritePreview] = useState<Photo | null>(null);
    const [eventFavouriteCount, setEventFavouriteCount] = useState(0);
    const [loadingPhotos, setLoadingPhotos] = useState(false);
    const [photoPage, setPhotoPage] = useState(0);
    const [hasMorePhotos, setHasMorePhotos] = useState(false);

    // Refs to keep track of currentEventPhotos and uploadQueue to avoid stale closure bugs in Supabase Realtime callbacks
    const currentEventPhotosRef = useRef<Photo[]>([]);
    const uploadQueueRef = useRef<UploadQueueItem[]>([]);
    
    useEffect(() => {
        currentEventPhotosRef.current = currentEventPhotos;
    }, [currentEventPhotos]);

    useEffect(() => {
        uploadQueueRef.current = uploadQueue;
    }, [uploadQueue]);

    const handleThumbnailLoaded = useCallback((photoId: string, storageKey: string) => {
        setUploadQueue(prev => prev.map(qItem => 
            (qItem.photoId === photoId || qItem.storageKey === storageKey) && qItem.status !== "success"
                ? { ...qItem, status: "success", progress: 100 } 
                : qItem
        ));
    }, []);
    const [totalStorage, setTotalStorage] = useState<number>(0);
    const [totalMainEvents, setTotalMainEvents] = useState<number>(0);
    const [workspaceOwner, setWorkspaceOwner] = useState<any | null>(null);
    const [eventOwners, setEventOwners] = useState<Record<string, { email?: string; name?: string; username?: string }>>({});
    const [activeEventDetailTab, setActiveEventDetailTab] = useState<"galleries" | "permissions" | "design" | "partners">("galleries");
    const [eventDetailGalleries, setEventDetailGalleries] = useState<Event[]>([]);
    const [eventDetailLogs, setEventDetailLogs] = useState<EventDetailLog[]>([]);
    const [loadingEventDetail, setLoadingEventDetail] = useState(false);
    const [selectedGuestLog, setSelectedGuestLog] = useState<EventDetailLog | null>(null);
    const [selectedGuestProfile, setSelectedGuestProfile] = useState<any | null>(null);
    const [loadingGuestProfile, setLoadingGuestProfile] = useState(false);

    // Permissions State
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [delegatedCount, setDelegatedCount] = useState(0);
    const [activePermissionTab, setActivePermissionTab] = useState<"admin_details" | "guest_user">("admin_details");
    const [expandedMainEvents, setExpandedMainEvents] = useState<Set<string>>(new Set());
    const [expandedEventAdmins, setExpandedEventAdmins] = useState<Set<string>>(new Set());
    const [expandedEventGuests, setExpandedEventGuests] = useState<Set<string>>(new Set());
    const [trafficLogs, setTrafficLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [selectedLogEventId, setSelectedLogEventId] = useState<string>("all");
    const [selectedUserToAssign, setSelectedUserToAssign] = useState<string>("");
    const [assignedEventsForSelect, setAssignedEventsForSelect] = useState<string[]>([]);

    // Form State
    const [eventName, setEventName] = useState("");
    const [eventDate, setEventDate] = useState(() => formatCreateEventDate(new Date()));
    const [selectedEventId, setSelectedEventId] = useState("");
    const [selectedEventName, setSelectedEventName] = useState("");
    const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");
    const isCoverUpdating = status === "uploading" && message.toLowerCase().includes("cover");
    const [showDatePickerModal, setShowDatePickerModal] = useState(false);
    const [datePickerTarget, setDatePickerTarget] = useState<"rename" | "create">("rename");
    const [datePickerValue, setDatePickerValue] = useState(() => {
        const today = new Date();
        return { month: today.getMonth(), day: today.getDate(), year: today.getFullYear() };
    });

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCreateSubGalleryModalOpen, setIsCreateSubGalleryModalOpen] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showCreateSuccessModal, setShowCreateSuccessModal] = useState(false);
    const [eventType, setEventType] = useState("Wedding");
    const [coverPositionEvent, setCoverPositionEvent] = useState<Event | null>(null);
    const [coverDraft, setCoverDraft] = useState({ coverOffset: 0, coverOffsetX: 0, coverScale: 1 });
    const coverPreviewRef = useRef<HTMLDivElement | null>(null);
    const coverDragStartRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        coverOffset: number;
        coverOffsetX: number;
    } | null>(null);

    const toggleMainEvent = (eventId: string) => {
        setExpandedMainEvents(prev => {
            const next = new Set(prev);
            if (next.has(eventId)) next.delete(eventId);
            else next.add(eventId);
            return next;
        });
    };

    const toggleEventAdmins = (eventId: string) => {
        setExpandedEventAdmins(prev => {
            const next = new Set(prev);
            if (next.has(eventId)) next.delete(eventId);
            else next.add(eventId);
            return next;
        });
    };

    const toggleEventGuests = (eventId: string) => {
        setExpandedEventGuests(prev => {
            const next = new Set(prev);
            if (next.has(eventId)) next.delete(eventId);
            else next.add(eventId);
            return next;
        });
    };

    // Event Management State
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [renamingEvent, setRenamingEvent] = useState<Event | null>(null);
    const [editDetailsMode, setEditDetailsMode] = useState<"title" | "date">("title");
    const [shareModalEvent, setShareModalEvent] = useState<Event | null>(null);
    const [showPlanDetailsModal, setShowPlanDetailsModal] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newDate, setNewDate] = useState("");
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
    const [showDeleteSuccessType, setShowDeleteSuccessType] = useState<"event" | "gallery" | null>(null);
    const selectedMainEventId = selectedMainEvent?.id;
    const selectedMainEventLegacyId = selectedMainEvent?.legacyId;

    // Template Selection State
    const [showTemplateModal, setShowTemplateModal] = useState(false);
    const [templateTargetEvent, setTemplateTargetEvent] = useState<Event | null>(null);
    const [selectedTemplate, setSelectedTemplate] = useState("hero");

    useEffect(() => {
        // Allow all logged in users to access the dashboard
        // Plan roles: free (default), basic, standard, premium, elite, admin
        const isAuthorized = !!user;
        
        if (!loading && user && !isAuthorized) {
            router.push("/profile");
        }
    }, [user, loading, router]);

    // Warn user before closing/refreshing tab during active uploads
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const hasActiveUploads = uploadQueue.some(
                item => item.status === "uploading" || item.status === "pending" || item.status === "processing"
            );
            if (hasActiveUploads) {
                e.preventDefault();
                e.returnValue = "You have active uploads in progress. If you leave or reload now, these uploads will be cancelled.";
                return e.returnValue;
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, [uploadQueue]);

    // Poll face indexing status when items are in queue
    useEffect(() => {
        if (!selectedEventId || uploadQueue.length === 0) {
            setIndexingStatus(null);
            return;
        }

        let pollInterval: NodeJS.Timeout;

        const checkStatus = async () => {
            try {
                const res = await fetch(getApiUrl(`/api/media/indexing-status?eventId=${selectedEventId}`));
                if (res.ok) {
                    const data = await res.json();
                    setIndexingStatus(data);

                    // Check if there are any items still actively uploading or pending in the queue
                    const hasActiveUploads = uploadQueueRef.current.some(item => item.status === "pending" || item.status === "uploading");

                    // Only stop polling when indexing is fully complete AND all file uploads have finished
                    if (data.status === "complete" && !hasActiveUploads) {
                        clearInterval(pollInterval);
                        // Mark all processing/pending items in the queue as success
                        setUploadQueue(prev => prev.map(item => 
                            (item.status === "processing" || item.status === "pending" || item.status === "uploading")
                                ? { ...item, status: "success", progress: 100 } 
                                : item
                        ));
                    }
                }
            } catch (err) {
                console.error("[Dashboard] Error polling indexing status:", err);
            }
        };

        // Run immediately
        checkStatus();

        // Poll every 5 seconds
        pollInterval = setInterval(checkStatus, 5000);

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [selectedEventId, uploadQueue.length]);

    // URL State Synchronization
    useEffect(() => {
        const viewParam = searchParams.get("view");
        const levelParam = searchParams.get("level");
        const modeParam = searchParams.get("mode");
        const eventIdParam = searchParams.get("eventId");
        const galleryIdParam = searchParams.get("galleryId");

        // 1. View State
        if (viewParam === "manage" || viewParam === "permissions") {
            setView(viewParam as any);
        } else {
            setView("main");
        }

        // 2. Manage Level
        if (levelParam === "galleries" || levelParam === "photos" || levelParam === "event-details") {
            setManageLevel(levelParam as any);
        } else {
            setManageLevel("events");
        }

        // 3. Manage Mode
        if (modeParam === "add-event" || modeParam === "add-image") {
            setManageMode(modeParam as any);
        } else {
            setManageMode("list");
        }

        // 4. Selected Event (for generic ID lookups)
        if (eventIdParam && userEvents.length > 0) {
            // Find in loaded events (may need to be robust if events aren't loaded yet)
            // We'll trust fetchUserEvents to handle data loading, this just sets the ID.
            const targetEvent = userEvents.find(e => e.id === eventIdParam);
            if (targetEvent) {
                if (levelParam === "event-details" && modeParam === "add-image" && galleryIdParam) {
                    const targetGallery = userEvents.find(e => e.id === galleryIdParam) || eventDetailGalleries.find(e => e.id === galleryIdParam);
                    setSelectedEventId(galleryIdParam);
                    setSelectedEventName(targetGallery?.title || (galleryIdParam === targetEvent.id ? targetEvent.title : "Gallery"));
                    setGalleryMessageText(targetGallery?.description || "");
                    setSelectedMainEvent(targetEvent);
                    return;
                }

                // Always set the selected event ID if we're in add-image mode or specifically on photos level
                if (levelParam === "photos" || modeParam === "add-image") {
                    setSelectedEventId(targetEvent.id);
                    setSelectedEventName(targetEvent.title);
                }

                if (levelParam === "galleries" || levelParam === "event-details") {
                    setSelectedMainEvent(targetEvent);
                } else if (levelParam === "photos") {
                    // If it's a sub-event, we also need to set the Main Event parent
                    if (targetEvent.parentId) {
                        const parent = userEvents.find(e => e.id === targetEvent.parentId);
                        if (parent) setSelectedMainEvent(parent);
                    }
                }
            } else {
                // If event events aren't loaded yet, we might need to rely on the ID alone 
                // and let the fetch logic handle it, but for now we set the generic IDs
                if (levelParam === "galleries") {
                    // We need the object for some UI, but ID is enough for fetching
                    // We'll optimistically set what we can
                }
                setSelectedEventId(eventIdParam);
            }
        } else if (!eventIdParam) {
            setSelectedEventId("");
            setSelectedMainEvent(null);
        }
    }, [searchParams, userEvents, eventDetailGalleries]);

    useEffect(() => {
        const levelParam = searchParams.get("level");
        const eventIdParam = searchParams.get("eventId");
        const shouldRestoreMainEvent = eventIdParam && (levelParam === "event-details" || levelParam === "galleries");

        if (!user?.uid || !shouldRestoreMainEvent || selectedMainEvent?.id === eventIdParam) return;

        const cachedEvent = userEvents.find(event => event.id === eventIdParam);
        if (cachedEvent) {
            setSelectedMainEvent(cachedEvent);
            return;
        }

        let isMounted = true;

        const restoreSelectedMainEvent = async () => {
            setLoadingEventDetail(true);
            try {
                const event = await getEventById(eventIdParam);
                if (isMounted && event) {
                    setSelectedMainEvent(event);
                }
            } catch (error) {
                console.error("Error restoring selected event from URL:", error);
            } finally {
                if (isMounted) setLoadingEventDetail(false);
            }
        };

        restoreSelectedMainEvent();

        return () => {
            isMounted = false;
        };
    }, [searchParams, selectedMainEvent?.id, user?.uid, userEvents]);


    // 1. Fetch main/sub events and storage stats when in "manage" view and relevant navigation items change
    // 1. Fetch main/sub events and storage stats when in "main" or "manage" view
    useEffect(() => {
        if (user && user.uid && (view === "main" || view === "manage")) {
            fetchUserEvents();
            fetchStorageStats();
        }
    }, [user?.uid, view, manageLevel, selectedMainEvent?.id]);

    // 2. Fetch main events and delegated count once when in "permissions" view
    useEffect(() => {
        if (user && user.uid && view === "permissions") {
            fetchUserEvents();
            fetchDelegatedCount();
        }
    }, [user?.uid, view]);

    // 3. Fetch full users list ONLY when in "permissions" view under "admin_details" tab
    useEffect(() => {
        if (user && user.uid && view === "permissions" && activePermissionTab === "admin_details") {
            fetchUsersList();
        }
    }, [user?.uid, view, activePermissionTab]);

    // 4. Fetch guest traffic logs ONLY when in "permissions" view under "guest_user" tab, filtered by selected log event
    useEffect(() => {
        if (user && user.uid && view === "permissions" && activePermissionTab === "guest_user") {
            fetchTrafficLogs();
        }
    }, [user?.uid, view, activePermissionTab, selectedLogEventId]);

    useEffect(() => {
        if (selectedEventId && (manageMode === "add-image" || manageLevel === "photos" || (manageLevel === "event-details" && activeEventDetailTab === "galleries"))) {
            fetchEventPhotos();
        }
    }, [selectedEventId, manageMode, manageLevel, activeEventDetailTab]);

    useEffect(() => {
        if (selectedMainEventId) {
            void refreshEventFavourites(selectedMainEventId);
        } else {
            setEventFavouritePhotoIds(new Set());
            setEventFavouritePreview(null);
            setEventFavouriteCount(0);
        }
    }, [selectedMainEventId]);

    useEffect(() => {
        if (!selectedMainEventId || manageLevel !== "event-details") return;

        let isMounted = true;

        const fetchEventDetailSections = async () => {
            setLoadingEventDetail(true);
            try {
                const [galleries, logs] = await Promise.all([
                    getSubEvents(selectedMainEventId, selectedMainEventLegacyId),
                    getEventLogs(selectedMainEventId),
                ]);

                if (!isMounted) return;

                setEventDetailGalleries(galleries.sort((a, b) => (a.title || "").localeCompare(b.title || "")));
                setEventDetailLogs(logs);
            } catch (error) {
                console.error("Error loading event detail sections:", error);
                if (isMounted) {
                    setEventDetailGalleries([]);
                    setEventDetailLogs([]);
                }
            } finally {
                if (isMounted) setLoadingEventDetail(false);
            }
        };

        setActiveEventDetailTab("galleries");
        fetchEventDetailSections();

        return () => {
            isMounted = false;
        };
    }, [selectedMainEventId, selectedMainEventLegacyId, manageLevel]);

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
        const type = (view === "main" || view === "permissions" || manageLevel === "events" || manageLevel === "event-details") ? "main" : "sub";
        const parentId = (view === "manage" && (manageLevel === "galleries" || manageLevel === "photos")) ? selectedMainEvent?.id : undefined;

        // Own events are always visible. Delegated owner events are scoped by roleType below.
        const ownIdentifiers = [user.uid];
        if (user.email) ownIdentifiers.push(user.email);

        const ownerIdentifiers: string[] = [];
        if (user.delegatedBy) ownerIdentifiers.push(user.delegatedBy);
        if (workspaceOwner?.email) ownerIdentifiers.push(workspaceOwner.email);

        const identifiers = user.delegatedBy
            ? [...ownIdentifiers, ...ownerIdentifiers]
            : ownIdentifiers;

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

            // Event managers only see events explicitly assigned to them.
            if (user.roleType === 'event') {
                const assignedEvents = user.assignedEvents || [];
                setUserEvents(sorted.filter(e =>
                    (e.createdBy && ownIdentifiers.includes(e.createdBy)) ||
                    assignedEvents.includes(e.id) ||
                    e.parentId === parentId
                ));
            } else {
                setUserEvents(sorted);
            }
        } else {
            // Root level: Fetch by identity pool
            const events = await getUserEvents(identifiers, type, parentId, selectedMainEvent?.legacyId);
            if (view === "main") {
                const [approvedSharedEvents, logs] = await Promise.all([
                    getApprovedSharedEventsForUser(ownIdentifiers, true),
                    getGuestLogs(identifiers),
                ]);
                setSharedEvents(approvedSharedEvents.sort((a, b) => (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0)));
                setTrafficLogs(logs);
            }
            const combinedEvents = [...events];

            if (user.roleType === 'event') {
                const assignedEvents = user.assignedEvents || [];
                const assignedEventDocs = await Promise.all(
                    assignedEvents.map(eventId => getEventById(eventId))
                );

                assignedEventDocs.forEach(eventDoc => {
                    if (eventDoc && !combinedEvents.some(existing => existing.id === eventDoc.id)) {
                        combinedEvents.push(eventDoc);
                    }
                });
            }

            // Event managers only see events explicitly assigned to them.
            if (user.roleType === 'event') {
                const assignedEvents = user.assignedEvents || [];
                setUserEvents(combinedEvents.filter(e =>
                    (e.createdBy && ownIdentifiers.includes(e.createdBy)) ||
                    assignedEvents.includes(e.id)
                ));
            } else {
                setUserEvents(combinedEvents);
            }
        }
        setLoadingEvents(false);
    };

    const fetchEventPhotos = async () => {
        if (!selectedEventId) return;
        
        let currentEvent = userEvents.find(e => e.id === selectedEventId);
        
        // Robust fetch: Ensure we have the full event object (especially legacyId and createdBy)
        // If we don't have it or it's missing the legacyId (common for migrated events in the list pool)
        // we fetch it deeply from Supabase database.
        if (!currentEvent || (!currentEvent.legacyId && selectedEventId.includes("-"))) {
            try {
                const fetched = await getEventById(selectedEventId);
                if (fetched) currentEvent = fetched;
            } catch (err) {
                console.error("[Dashboard] Error fetching event details for photos:", err);
            }
        }

        setLoadingPhotos(true);
        try {
            // 1. Fetch from Supabase database CLIENT-SIDE (Respects permissions)
            // Use legacyId if available, fallback to selectedEventId
            const legacyId = currentEvent?.legacyId;
            const { photos, hasMore, totalPhotos, totalVideos, retainedMediaIds } = await getEventPhotosPaginated(selectedEventId, legacyId, 0, 20);

            setCurrentEventPhotos(photos as Photo[]);
            setCurrentEventMediaCounts({ photos: totalPhotos, videos: totalVideos });
            setCurrentEventRetainedMediaIds(new Set(retainedMediaIds));
            setPhotoPage(0);
            setHasMorePhotos(hasMore);
        } catch (error) {
            console.error("[Dashboard] fetchEventPhotos Error:", error);
            setStatus("error");
            setMessage("Failed to load photos.");
        } finally {
            setLoadingPhotos(false);
        }
    };

    const refreshEventFavourites = async (eventId = selectedMainEventId) => {
        if (!eventId) {
            setEventFavouritePhotoIds(new Set());
            setEventFavouritePreview(null);
            setEventFavouriteCount(0);
            return;
        }

        try {
            const favouriteRows = await getEventFavouritePhotos(eventId);
            setEventFavouritePhotoIds(new Set(favouriteRows.map(row => row.photoId)));
            setEventFavouriteCount(favouriteRows.length);

            if (favouriteRows.length > 0) {
                const favouritePhotos = await getFavouritePhotosForEvents([eventId]);
                setEventFavouritePreview(favouritePhotos[0] || null);
            } else {
                setEventFavouritePreview(null);
            }
        } catch (error) {
            console.error("Error refreshing event favourites:", error);
            setEventFavouritePhotoIds(new Set());
            setEventFavouritePreview(null);
            setEventFavouriteCount(0);
        }
    };

    const loadMorePhotos = async () => {
        if (!selectedEventId || loadingPhotos || !hasMorePhotos) return;
        setLoadingPhotos(true);
        try {
            let currentEvent = userEvents.find(e => e.id === selectedEventId);
            if (!currentEvent || (!currentEvent.legacyId && selectedEventId.includes("-"))) {
                try {
                    const fetched = await getEventById(selectedEventId);
                    if (fetched) currentEvent = fetched;
                } catch (err) {}
            }
            const legacyId = currentEvent?.legacyId;
            const nextPage = photoPage + 1;
            const { photos, hasMore, totalPhotos, totalVideos, retainedMediaIds } = await getEventPhotosPaginated(selectedEventId, legacyId, nextPage, 20);
            setCurrentEventPhotos(prev => [...prev, ...photos as Photo[]]);
            setCurrentEventMediaCounts({ photos: totalPhotos, videos: totalVideos });
            setCurrentEventRetainedMediaIds(new Set(retainedMediaIds));
            setPhotoPage(nextPage);
            setHasMorePhotos(hasMore);
        } catch (error) {
            console.error("[Dashboard] loadMorePhotos Error:", error);
        } finally {
            setLoadingPhotos(false);
        }
    };

    const fetchStorageStats = React.useCallback(async () => {
        if (!user) return;

        // Identity Pool for storage calculation (accounts for both UID and Email tags)
        const identifiers = [user.uid];
        if (user.email) identifiers.push(user.email);
        if (user.phone) identifiers.push(user.phone);

        const [total, eventCount] = await Promise.all([
            getUserTotalStorage(identifiers),
            getUserEventCount(user.uid),
        ]);
        setTotalStorage(total);
        setTotalMainEvents(eventCount);
    }, [user]);

    useEffect(() => {
        if (!user?.uid) return;

        const identifiers = [user.uid, user.email, user.phone].filter(Boolean) as string[];
        const channels = identifiers.map((identifier) =>
            supabase
                .channel(`host-storage-${identifier}-${Math.random().toString(36).slice(2, 8)}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'photos', filter: `user_id=eq.${identifier}` },
                    () => fetchStorageStats()
                )
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'events', filter: `created_by=eq.${identifier}` },
                    () => fetchStorageStats()
                )
                .subscribe()
        );

        return () => {
            channels.forEach((channel) => supabase.removeChannel(channel));
        };
    }, [user?.uid, user?.email, user?.phone, fetchStorageStats]);

    // Real-time photo grid updates for host dashboard (syncs thumbnail resolving in real time)
    useEffect(() => {
        if (!selectedEventId) return;

        console.log(`[Dashboard Realtime] Subscribing to photos for event: ${selectedEventId}`);
        const channel = supabase
            .channel(`host-photos-event-${selectedEventId}-${Math.random().toString(36).slice(2, 8)}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'photos' },
                (payload) => {
                    console.log(`[Dashboard Realtime] Received DB change:`, payload);
                    
                    if (payload.eventType === 'INSERT') {
                        // For INSERT events, event_id is always present in the payload
                        if (payload.new.event_id === selectedEventId) {
                            const newPhoto: Photo = {
                                id: payload.new.id,
                                eventId: payload.new.event_id,
                                storageKey: payload.new.storage_key,
                                url: payload.new.url,
                                thumbnailUrl: payload.new.thumbnail_url,
                                width: payload.new.width,
                                height: payload.new.height,
                                uploadedAt: payload.new.uploaded_at,
                                userId: payload.new.user_id,
                                size: payload.new.size,
                                format: payload.new.format,
                                mediaType: payload.new.media_type,
                                resourceType: payload.new.resource_type
                            };

                            // Add to grid state directly in real-time so it shows immediately!
                            setCurrentEventPhotos(prev => {
                                if (prev.some(p => p.id === newPhoto.id)) return prev;
                                return [newPhoto, ...prev];
                            });
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        // Use currentEventPhotosRef and uploadQueueRef to avoid stale closure state snapshots
                        const isOurPhoto = currentEventPhotosRef.current.some(p => p.id === payload.new.id) ||
                                           uploadQueueRef.current.some(qItem => qItem.photoId === payload.new.id);
                        
                        if (!isOurPhoto) return;

                        setCurrentEventPhotos(prev => {
                            const exists = prev.some(p => p.id === payload.new.id);
                            
                            // 1. If it doesn't exist yet (UPDATE arrived before INSERT state re-rendered),
                            // we build the Photo record and insert it directly in its completed state.
                            if (!exists) {
                                const queueItem = uploadQueueRef.current.find(q => q.photoId === payload.new.id);
                                if (queueItem) {
                                    const mediaDomain = process.env.NEXT_PUBLIC_MEDIA_DOMAIN || 'media.evebash.com';
                                    const resolvedStorageKey = payload.new.storage_key || queueItem.storageKey || "";
                                    const completedPhoto: Photo = {
                                        id: payload.new.id,
                                        eventId: selectedEventId,
                                        storageKey: resolvedStorageKey,
                                        url: payload.new.url || `https://${mediaDomain}/${resolvedStorageKey}`,
                                        thumbnailUrl: payload.new.thumbnail_url ?? `https://${mediaDomain}/${resolvedStorageKey}-thumbnail.webp`,
                                        width: payload.new.width,
                                        height: payload.new.height,
                                        uploadedAt: payload.new.uploaded_at || new Date().toISOString(),
                                        mediaType: payload.new.media_type || "photo",
                                        resourceType: payload.new.resource_type || "image"
                                    };
                                    return [completedPhoto, ...prev];
                                }
                                return prev;
                            }

                            // 2. If it already exists in the grid, update its thumbnail and sizes
                            return prev.map(p => {
                                if (p.id === payload.new.id) {
                                    return {
                                        ...p,
                                        thumbnailUrl: payload.new.thumbnail_url ?? p.thumbnailUrl,
                                        width: payload.new.width || p.width,
                                        height: payload.new.height || p.height,
                                        url: payload.new.url || p.url,
                                    };
                                }
                                return p;
                            });
                        });

                        if (payload.new.thumbnail_url) {
                            setUploadQueue(prev => prev.map(qItem => 
                                (qItem.photoId === payload.new.id || qItem.storageKey === payload.new.storage_key)
                                    ? { ...qItem, status: "success", progress: 100 } 
                                    : qItem
                            ));
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setCurrentEventPhotos(prev => prev.filter(p => p.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedEventId]);

    useEffect(() => {
        if (!selectedGuestLog) {
            setSelectedGuestProfile(null);
            return;
        }

        let isMounted = true;

        const loadSelectedGuestProfile = async () => {
            const possibleIdentifiers = [
                selectedGuestLog.email,
                selectedGuestLog.phone,
            ].filter(Boolean) as string[];

            setLoadingGuestProfile(true);
            try {
                const filters = possibleIdentifiers.flatMap((identifier) => [
                    `id.eq.${identifier}`,
                    `email.eq.${identifier}`,
                    `phone.eq.${identifier}`,
                ]);
                const { data } = filters.length > 0
                    ? await supabase.from("profiles").select("*").or(filters.join(",")).limit(1).maybeSingle()
                    : { data: null };

                const matchedProfile = data ? {
                    id: data.id,
                    name: data.name,
                    username: data.username,
                    email: data.email,
                    phone: data.phone,
                    profileImage: data.profile_image,
                } : null;

                if (isMounted) setSelectedGuestProfile(matchedProfile);
            } catch (error) {
                console.error("Error loading guest profile:", error);
                if (isMounted) setSelectedGuestProfile(null);
            } finally {
                if (isMounted) setLoadingGuestProfile(false);
            }
        };

        loadSelectedGuestProfile();

        return () => {
            isMounted = false;
        };
    }, [selectedGuestLog]);

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

            // Event managers only see traffic for events explicitly assigned to them.
            if (user.roleType === 'event') {
                const assignedEvents = user.assignedEvents || [];
                setTrafficLogs(logs.filter(log => (log.parentEventId && assignedEvents.includes(log.parentEventId)) || (log.eventId && assignedEvents.includes(log.eventId))));
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

        const targetUser = allUsers.find(u => u.id === targetUid);
        const isRevoking = currentRole === "revoke";
        const isNewDelegation = targetUser?.delegatedBy !== user.uid;
        const isPromoting = !isRevoking;

        if (isPromoting && isNewDelegation && delegatedCount >= 2) {
            setMessage("You can only have a maximum of 2 delegated managers.");
            setStatus("error");
            setTimeout(() => setStatus("idle"), 3000);
            return;
        }

        // When promoting: Set delegation fields, but DO NOT flip global role to 'admin'
        // When revoking: Remove delegation fields. Signature: (uid, newRole, delegatedBy, roleType, assignedEvents)
        const success = await updateUserRole(
            targetUid,
            null, // Do not change global role
            isPromoting ? user.uid : undefined,
            isPromoting ? roleType : undefined,
            isPromoting ? assignedEvents : undefined
        );

        if (success) {
            setMessage(`User successfully ${isPromoting ? "authorized as Manager" : "access revoked"}.`);
            setStatus("success");
            fetchUsersList();
            fetchDelegatedCount();
            fetchUserEvents();
            fetchTrafficLogs();
        } else {
            setMessage("Failed to update user authorizations.");
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

    const handleGuestStatusUpdate = async (logId: string, nextStatus: "approved" | "rejected") => {
        const result = await updateGuestStatusAction(logId, nextStatus, {
            uid: user?.uid,
            email: user?.email,
        });

        if (result.success) {
            setMessage(`Guest ${nextStatus === "approved" ? "approved" : "rejected"} successfully.`);
            setStatus("success");
            const updateLog = (item: EventDetailLog) => item.id === logId
                ? {
                    ...item,
                    status: nextStatus,
                    ...(nextStatus === "approved" ? { canUpload: true, canComment: true } : {}),
                }
                : item;
            setEventDetailLogs(prev => prev.map(updateLog));
            setTrafficLogs(prev => prev.map(updateLog as any));
            setSelectedGuestLog(prev => prev?.id === logId ? updateLog(prev) : prev);
            fetchTrafficLogs();
        } else {
            setMessage(result.error || "Failed to update guest.");
            setStatus("error");
        }
        setTimeout(() => setStatus("idle"), 3000);
    };

    const handleGuestDelete = async (logId: string) => {
        if (!window.confirm("Are you sure you want to remove this user from the guest list?")) return;

        const result = await deleteGuestAction(logId, {
            uid: user?.uid,
            email: user?.email,
        });

        if (result.success) {
            setMessage("Guest removed successfully.");
            setStatus("success");
            fetchTrafficLogs();
        } else {
            setMessage(result.error || "Failed to remove guest.");
            setStatus("error");
        }
        setTimeout(() => setStatus("idle"), 3000);
    };

    const handleGuestViewAccessToggle = async (log: EventDetailLog) => {
        await handleGuestStatusUpdate(log.id, log.status === "approved" ? "rejected" : "approved");
    };

    const handleGuestPermissionToggle = async (
        log: EventDetailLog,
        key: "canAdmin" | "canUpload" | "canComment"
    ) => {
        const nextValue = !log[key];
        const nextPermissions = key === "canAdmin" && nextValue
            ? { canAdmin: true, canUpload: true, canComment: true }
            : { [key]: nextValue };
        const shouldApproveViewAccess = key === "canAdmin" && nextValue && log.status !== "approved";

        if (shouldApproveViewAccess) {
            const statusResult = await updateGuestStatusAction(log.id, "approved", {
                uid: user?.uid,
                email: user?.email,
            });

            if (!statusResult.success) {
                setMessage(statusResult.error || "Failed to update guest.");
                setStatus("error");
                setTimeout(() => setStatus("idle"), 3000);
                return;
            }
        }

        const result = await updateGuestPermissionsAction(log.id, nextPermissions, {
            uid: user?.uid,
            email: user?.email,
        });

        if (result.success) {
            const updateLog = (item: EventDetailLog) => item.id === log.id
                ? { ...item, ...(shouldApproveViewAccess ? { status: "approved" } : {}), ...nextPermissions }
                : item;
            setEventDetailLogs(prev => prev.map(updateLog));
            setTrafficLogs(prev => prev.map(updateLog as any));
            setSelectedGuestLog(prev => prev?.id === log.id
                ? { ...prev, ...(shouldApproveViewAccess ? { status: "approved" } : {}), ...nextPermissions }
                : prev);
            setMessage("Guest permissions updated.");
            setStatus("success");
        } else {
            setMessage(result.error || "Failed to update permissions.");
            setStatus("error");
        }
        setTimeout(() => setStatus("idle"), 3000);
    };

    // Fetch workspace owner if current user is delegated
    useEffect(() => {
        const fetchWorkspaceOwner = async () => {
            if (user?.delegatedBy) {
                try {
                    const ownerData = await getUserById(user.delegatedBy);
                    if (ownerData) {
                        setWorkspaceOwner(ownerData);
                    }
                } catch (error) {
                    console.error("Error fetching workspace owner:", error);
                }
            } else {
                setWorkspaceOwner(null);
            }
        };

        if (user) {
            fetchWorkspaceOwner();
        }
    }, [user?.delegatedBy, user?.uid]);

    // Re-fetch events once workspace owner email is available
    useEffect(() => {
        if (workspaceOwner?.email) {
            console.log("[Dashboard] Workspace owner loaded, re-fetching events for attribution...");
            fetchUserEvents();
        }
    }, [workspaceOwner?.email]);

    useEffect(() => {
        const fetchEventOwners = async () => {
            const ownerIds = Array.from(new Set(
                [...userEvents, ...sharedEvents]
                    .map(evt => evt.createdBy)
                    .filter((ownerId): ownerId is string => !!ownerId && !ownerId.includes("@"))
            ));

            if (ownerIds.length === 0) {
                setEventOwners({});
                return;
            }

            const ownerEntries = await Promise.all(
                ownerIds.map(async (ownerId) => {
                    const owner = await getUserById(ownerId);
                    return [ownerId, { email: owner?.email, name: owner?.name, username: owner?.username }] as const;
                })
            );

            setEventOwners(Object.fromEntries(ownerEntries));
        };

        fetchEventOwners();
    }, [userEvents, sharedEvents]);

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    if (loading) {
        return <LoadingScreen message="Loading your dashboard" />;
    }

    if (isNavigating) {
        return <LoadingScreen message="Opening event" />;
    }

    if (!user) {
        return null;
    }

    const handleCreateEventOnly = async (e: React.FormEvent, skipSuccessModal: boolean = false): Promise<boolean> => {
        e.preventDefault();
        if (!eventName.trim()) {
            setStatus("error");
            setMessage("Please enter an event name.");
            setTimeout(() => setStatus("idle"), 5000);
            return false;
        }

        const { data: authData, error: authError } = await supabase.auth.getUser();
        const authUser = authData?.user;
        if (authError || !authUser?.id) {
            setStatus("error");
            setMessage("Please sign in again before creating an event.");
            setTimeout(() => setStatus("idle"), 5000);
            return false;
        }

        const creatorUid = authUser.id;
        const creatorEmail = authUser.email || user.email || "";
        const creatorName = user.name || authUser.user_metadata?.name || creatorEmail.split("@")[0] || "User";

        // --- ROLE-BASED LIMITS ---
        const isCreatingMainEvent = manageLevel !== "galleries" && !isCreateSubGalleryModalOpen;
        if (isCreatingMainEvent && user.role !== "admin" && !user.delegatedBy) {
            const eventCount = await getUserEventCount(creatorUid);
            const currentPlan = getPlanDetails(user.role);
            const maxEvents = currentPlan.eventLimit;
            
            if (eventCount >= maxEvents) {
                setMessage(`You've reached your ${currentPlan.eventLabel}-event limit for the ${currentPlan.name}. Upgrade your plan to create more events.`);
                setStatus("error");
                setTimeout(() => setStatus("idle"), 5000);
                return false;
            }
        }

        setStatus("uploading");
        setMessage("Creating event...");

        try {
            const profileReady = await createUserProfile(
                creatorUid,
                creatorName,
                creatorEmail,
                user.phone && user.phone !== "No Phone" ? user.phone : "",
                user.role || "user"
            );

            if (!profileReady) {
                setStatus("error");
                setMessage("Your profile is still being prepared. Please try again in a moment.");
                return false;
            }

            const eventId = `${createEventSlug(eventName) || "event"}-${uuidv4().slice(0, 4)}`;

            const isSubEvent = (manageLevel === "galleries" || isCreateSubGalleryModalOpen) && selectedMainEvent;

            // Assign the primary placeholder for main events, or inherit parent's cover for sub-galleries
            const defaultPlaceholder = PLACEHOLDER_IMAGES[0];
            const initialCoverImage = isSubEvent ? (selectedMainEvent.coverImage || defaultPlaceholder) : defaultPlaceholder;

            const newEvent: Event = {
                id: eventId,
                title: eventName,
                date: eventDate.trim() || new Date().toLocaleDateString(),
                coverImage: initialCoverImage,
                description: isSubEvent ? `Welcome to the ${eventName} gallery! Share your beautiful moments and thoughts here.` : `Main Event: ${eventName}`,
                createdBy: creatorUid,
                type: isSubEvent ? "sub" : "main",
                category: isSubEvent ? (selectedMainEvent.category || eventType) : eventType,
                joinId: generateEventJoinId(eventId),
                ...(isSubEvent && { parentId: selectedMainEvent.id }),
                templateId: isSubEvent ? (selectedMainEvent.templateId || "hero") : selectedTemplate
            };

            const created = await createEvent(newEvent);
            if (!created.success) {
                setStatus("error");
                setMessage(created.error || "Failed to create event. Please check the event details and try again.");
                return false;
            }

            setStatus("success");
            setIsCreateModalOpen(false);
            if (!skipSuccessModal) {
                setShowCreateSuccessModal(true);
            }
            setMessage("Your event has been created! ✨");
            if (isSubEvent) {
                setEventDetailGalleries(prev => [...prev, newEvent].sort((a, b) => (a.title || "").localeCompare(b.title || "")));
            }
            setEventName("");
            setEventDate(formatCreateEventDate(new Date()));
            setEventType("Wedding");
            setSelectedTemplate("hero"); // Reset to default
            fetchUserEvents();
            return true;
        } catch (err) {
            console.error(err);
            setStatus("error");
            setMessage(err instanceof Error ? err.message : "Failed to create event.");
            return false;
        }
    };    const uploadFiles = async (files: FileList | File[]) => {
        const expectedPrefix = galleryMediaTab === "videos" ? "video/" : "image/";
        const selectedFiles = Array.from(files).filter(file => file.type.startsWith(expectedPrefix));
        if (selectedFiles.length === 0 || !selectedEventId) return;

        const isFreeUploadUser = !user.delegatedBy && (!user.role || user.role === "user" || user.role === "free" || user.role === "freemium");
        if (galleryMediaTab === "videos" && isFreeUploadUser) {
            const oversizedVideo = selectedFiles.find(file => file.size > FREE_PLAN_VIDEO_LIMIT_BYTES);
            if (oversizedVideo) {
                setMessage("Free plan videos can be up to 200 MB. Upgrade to upload larger videos.");
                setStatus("error");
                setTimeout(() => setStatus("idle"), 5000);
                return;
            }
        }

        // --- ROLE-BASED LIMITS: Storage Cap ---
        if (user.role !== "admin" && !user.delegatedBy) {
            const currentPlan = getPlanDetails(user.role);
            const identifiers = [user.uid];
            if (user.email) identifiers.push(user.email);
            if (user.phone) identifiers.push(user.phone);
            const currentUsage = await getUserTotalStorage(identifiers);
            const selectedUploadSize = selectedFiles.reduce((total, file) => total + file.size, 0);
            
            if (currentUsage >= currentPlan.storageBytes) {
                setMessage(`You've reached your ${currentPlan.storageLabel} storage limit. Upgrade your plan for more storage.`);
                setStatus("error");
                setTimeout(() => setStatus("idle"), 5000);
                return;
            }

            if (currentUsage + selectedUploadSize > currentPlan.storageBytes) {
                const remainingStorage = Math.max(currentPlan.storageBytes - currentUsage, 0);
                setMessage(
                    `Upload exceeds your ${currentPlan.storageLabel} storage limit. You have ${formatStorageSize(remainingStorage)} remaining, but selected files are ${formatStorageSize(selectedUploadSize)}.`
                );
                setStatus("error");
                setTimeout(() => setStatus("idle"), 7000);
                return;
            }
        }

        // Initialize queue items in state
        const newQueueItems = selectedFiles.map((file, idx) => {
            const isVideo = file.type.startsWith("video/");
            return {
                id: `${Date.now()}-${idx}-${Math.random()}`,
                fileName: file.name,
                status: "uploading" as const,
                progress: 0,
                mediaType: isVideo ? ("video" as const) : ("photo" as const),
            };
        });
        setUploadQueue(prev => [...prev, ...newQueueItems]);
        setIsUploadPanelOpen(true);
        setIsUploadPanelMinimized(false);

        setStatus("uploading");
        setMessage(`Uploading ${selectedFiles.length} ${galleryMediaTab === "videos" ? "videos" : "images"}...`);
        console.log(`[Dashboard] Starting auto-upload for ${selectedFiles.length} files to event ${selectedEventId}`);

        try {
            let firstUploadedUrl = "";
            const uploadResults: { file: File, photo: Photo }[] = [];

            const concurrencyLimit = 3;
            let activeCount = 0;
            let currentIndex = 0;
            let chunkBuffer: { photo: Photo; queueItemId: string; transcodeTriggered?: boolean }[] = [];
            let completedCount = 0;

            const flushChunkBuffer = async () => {
                if (chunkBuffer.length === 0) return;
                const itemsToFlush = [...chunkBuffer];
                chunkBuffer = [];
                console.log(`[Dashboard] Flushing chunk of ${itemsToFlush.length} photos to batch API...`);
                try {
                    const session = await supabase.auth.getSession();
                    const headers: Record<string, string> = { "Content-Type": "application/json" };
                    if (session.data.session?.access_token) {
                        headers["Authorization"] = `Bearer ${session.data.session.access_token}`;
                    }
                    let res = await fetch(getApiUrl("/api/media/save-photo-batch"), {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            photos: itemsToFlush.map(item => ({
                                storageKey: item.photo.storageKey,
                                eventId: item.photo.eventId,
                                fileName: item.photo.storageKey.split('/').pop() || 'image.jpg',
                                fileSize: item.photo.size,
                                resourceType: item.photo.resourceType,
                                skipTranscode: item.transcodeTriggered ?? false
                            }))
                        })
                    });

                    if (!res.ok && (res.status === 401 || res.status === 500)) {
                        console.warn("[Dashboard] save-photo-batch failed, refreshing auth session and retrying...");
                        const { data: refreshed } = await supabase.auth.refreshSession();
                        if (refreshed.session?.access_token) {
                            headers["Authorization"] = `Bearer ${refreshed.session.access_token}`;
                            res = await fetch(getApiUrl("/api/media/save-photo-batch"), {
                                method: "POST",
                                headers,
                                body: JSON.stringify({
                                    photos: itemsToFlush.map(item => ({
                                        storageKey: item.photo.storageKey,
                                        eventId: item.photo.eventId,
                                        fileName: item.photo.storageKey.split('/').pop() || 'image.jpg',
                                        fileSize: item.photo.size,
                                        resourceType: item.photo.resourceType,
                                        skipTranscode: item.transcodeTriggered ?? false
                                    }))
                                })
                            });
                        }
                    }

                    if (res.ok) {
                        // Immediately prepend new photos to grid state so they render instantly
                        setCurrentEventPhotos(prev => {
                            const newPhotos = itemsToFlush
                                .map(item => item.photo)
                                .filter(p => !prev.some(existing => existing.id === p.id));
                            return [...newPhotos, ...prev];
                        });

                        const itemIds = new Set(itemsToFlush.map(item => item.queueItemId));
                        setUploadQueue(prev => prev.map(qItem => {
                            if (itemIds.has(qItem.id)) {
                                const isVideo = qItem.mediaType === "video";
                                return { 
                                    ...qItem, 
                                    status: isVideo ? "success" : "processing", 
                                    progress: isVideo ? 100 : 90 
                                };
                            }
                            return qItem;
                        }));
                    } else {
                        const itemIds = new Set(itemsToFlush.map(item => item.queueItemId));
                        setUploadQueue(prev => prev.map(qItem => 
                            itemIds.has(qItem.id) ? { ...qItem, status: "error", progress: 100, error: "Failed to save photo metadata" } : qItem
                        ));
                    }
                } catch (e: any) {
                    console.error("[Dashboard] Batch flush error:", e);
                    const itemIds = new Set(itemsToFlush.map(item => item.queueItemId));
                    setUploadQueue(prev => prev.map(qItem => 
                        itemIds.has(qItem.id) ? { ...qItem, status: "error", progress: 100, error: e.message || "Failed to save photo metadata" } : qItem
                    ));
                }
            };

            const runNext = async (workerId: number): Promise<void> => {
                if (currentIndex >= selectedFiles.length) return;

                const index = currentIndex++;
                const file = selectedFiles[index];
                const queueItemId = newQueueItems[index].id;

                activeCount++;
                // Update status to uploading in UI when task actually starts
                setUploadQueue(prev => prev.map(item => item.id === queueItemId ? { ...item, status: "uploading" } : item));

                try {
                    console.log(`[Dashboard] Uploading file ${index + 1}/${selectedFiles.length}: ${file.name} (lane: ${workerId})`);
                    // Upload the original file — skip single-save so we can chunk it
                    const uploadResult = await uploadEventImage(
                        file,
                        selectedEventId,
                        user.uid || "anonymous",
                        workerId,
                        true,
                        (percent) => {
                            setUploadQueue(prev => prev.map(item =>
                                item.id === queueItemId && item.status === "uploading"
                                    ? { ...item, progress: Math.min(99, Math.round(percent)) }
                                    : item
                            ));
                        }
                    );

	                    if (index === 0) firstUploadedUrl = uploadResult.url;

	                    const uniqueId = uploadResult.publicId.replace(/\//g, '_');
	                    const isVideoFile = file.type.startsWith("video/") || !!file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i);
	                    const photo: Photo = {
                        id: uniqueId,
                        eventId: selectedEventId,
                        storageKey: uploadResult.publicId,
                        url: uploadResult.url,
                        uploadedAt: new Date().toISOString(),
                        userId: user.uid || "anonymous",
                        width: uploadResult.width,
                        height: uploadResult.height,
                        size: uploadResult.bytes || file.size,
                        format: uploadResult.format || file.name.split('.').pop()?.toLowerCase() || (isVideoFile ? "mp4" : "jpg"),
                        mediaType: isVideoFile ? "video" : "photo",
                        resourceType: isVideoFile ? "video" : "image"
                    };

                    // Store storageKey and photoId in the queue item so Realtime updates can map to it
                    setUploadQueue(prev => prev.map(item => 
                        item.id === queueItemId 
                            ? { ...item, storageKey: uploadResult.publicId, photoId: uniqueId } 
                            : item
                    ));

                    // If this was a chunked upload (>100MB) AND a video, upload/chunk/complete
                    // already triggered the transcode — skip it in save-photo-batch
                    const transcodeTriggered = isVideoFile && file.size > 100 * 1024 * 1024;
                    chunkBuffer.push({ photo, queueItemId, transcodeTriggered });
                    // Flush immediately after each upload so resizing starts right away (non-blocking)
                    flushChunkBuffer();

                    // Store for background indexing
                    uploadResults.push({ file, photo });
                } catch (fileErr: any) {
                    console.error(`[Dashboard] File upload error for ${file.name}:`, fileErr);
                    setUploadQueue(prev => prev.map(item => item.id === queueItemId ? { ...item, status: "error", progress: 100, error: fileErr.message || "Failed" } : item));
                } finally {
                    activeCount--;
                    completedCount++;
                    
                    // If this is the absolute last photo of the entire batch to complete (success or fail), flush any remaining items
                    if (completedCount === selectedFiles.length) {
                        flushChunkBuffer();
                    }
                    
                    // Process next file in the queue
                    await runNext(workerId);
                }
            };

            // Launch initial set of workers
            const workers: Promise<void>[] = [];
            for (let i = 0; i < Math.min(concurrencyLimit, selectedFiles.length); i++) {
                workers.push(runNext(i));
            }

            // Wait for all workers to finish execution
            await Promise.allSettled(workers);



            await fetchStorageStats();

            // Trigger immediate face recognition on the backend if any photo uploads succeeded
            const photoUploads = uploadResults.filter(item => item.photo.mediaType === "photo" && item.photo.resourceType === "image");
            if (photoUploads.length > 0) {
                console.log(`[Dashboard] Drained upload queue. Triggering immediate face indexing...`);
                fetch(getApiUrl('/api/media/trigger-modal-batch?immediate=true'), { method: 'POST' }).catch(err => {
                    console.warn("[Dashboard] Immediate face indexing trigger failed:", err);
                });
            }

            // Auto-update cover if it's currently a placeholder or if it's the first upload
            const currentEvent = userEvents.find(ev => ev.id === selectedEventId);
            const isPlaceholder = !currentEvent?.coverImage || PLACEHOLDER_IMAGES.includes(currentEvent.coverImage);

            if (galleryMediaTab === "photos" && isPlaceholder && firstUploadedUrl) {
                console.log("[Dashboard] Replacing placeholder with first uploaded image as cover");
                await updateEvent(selectedEventId, { coverImage: firstUploadedUrl });
                syncCoverImageForEvent(selectedEventId, firstUploadedUrl);
            }

            setStatus("success");
            setMessage(galleryMediaTab === "videos" ? "Videos added! ✨" : "Gallery updated! ✨");
            fetchUserEvents();
            fetchEventPhotos();
            setTimeout(() => setStatus("idle"), 2000);
        } catch (err: any) {
            console.error("[Dashboard] Auto-upload error:", err);
            setStatus("error");
            setMessage(`Upload failed: ${err.message || 'Unknown error'}`);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;
        await uploadFiles(selectedFiles);
        e.target.value = "";
    };

    const handleGalleryDrag = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (status !== "uploading") {
            setIsDraggingPhotos(e.type === "dragenter" || e.type === "dragover");
        }
    };

    const handleGalleryDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingPhotos(false);

        if (status === "uploading") return;

        const expectedPrefix = galleryMediaTab === "videos" ? "video/" : "image/";
        const droppedFiles = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith(expectedPrefix));
        if (droppedFiles.length === 0) {
            setStatus("error");
            setMessage(galleryMediaTab === "videos" ? "Drop video files to upload." : "Drop image files to upload.");
            setTimeout(() => setStatus("idle"), 2500);
            return;
        }

        await uploadFiles(droppedFiles);
    };

    const handleSetAsCover = async (photoUrl: string, targetEventId?: string, isMainEvent: boolean = false) => {
        const idToUpdate = targetEventId || selectedEventId;
        if (!idToUpdate) return;

        setStatus("uploading");
        setMessage(`Setting as ${isMainEvent ? 'event' : 'gallery'} cover...`);

        try {
            const success = await updateEvent(idToUpdate, { coverImage: photoUrl });
            if (success) {
                syncCoverImageForEvent(idToUpdate, photoUrl);
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

    const syncCoverImageForEvent = (eventId: string, coverImage: string) => {
        setUserEvents(prev => prev.map(evt => evt.id === eventId ? { ...evt, coverImage } : evt));
        setEventDetailGalleries(prev => prev.map(evt => evt.id === eventId ? { ...evt, coverImage } : evt));
        setSelectedMainEvent(prev => prev?.id === eventId ? { ...prev, coverImage } : prev);
    };

    const syncEventFields = (eventId: string, fields: Partial<Event>) => {
        setUserEvents(prev => prev.map(evt => evt.id === eventId ? { ...evt, ...fields } : evt));
        setEventDetailGalleries(prev => prev.map(evt => evt.id === eventId ? { ...evt, ...fields } : evt));
        setSelectedMainEvent(prev => prev?.id === eventId ? { ...prev, ...fields } : prev);
        setCoverPositionEvent(prev => prev?.id === eventId ? { ...prev, ...fields } : prev);
    };

    const getCoverImageStyle = (evt?: Event | null): React.CSSProperties => {
        if (!evt) return { objectFit: "cover" };
        const coverMode = evt.coverMode || "fill";
        if (coverMode === "fit") {
            return {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                backgroundColor: "#050505",
            };
        }

        const isDraftTarget = coverPositionEvent?.id === evt.id;
        const x = isDraftTarget ? coverDraft.coverOffsetX : (evt.coverOffsetX || 0);
        const y = isDraftTarget ? coverDraft.coverOffset : (evt.coverOffset || 0);
        const scale = isDraftTarget ? coverDraft.coverScale : (evt.coverScale || 1);
        return {
            position: "absolute",
            left: 0,
            right: 0,
            top: -50,
            width: "100%",
            height: "calc(100% + 100px)",
            objectFit: "cover",
            transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
            transformOrigin: "center",
        };
    };

    const handleToggleCoverMode = async (targetEvent: Event) => {
        const nextMode = (targetEvent.coverMode || "fill") === "fill" ? "fit" : "fill";
        const updatedFields: Partial<Event> = {
            coverMode: nextMode,
            coverOffset: 0,
            coverOffsetX: 0,
            coverScale: 1,
        };
        syncEventFields(targetEvent.id, updatedFields);
        setStatus("uploading");
        setMessage(nextMode === "fit" ? "Setting cover to fit..." : "Setting cover to fill...");

        const success = await updateEvent(targetEvent.id, updatedFields);
        setStatus(success ? "success" : "error");
        setMessage(success ? (nextMode === "fit" ? "Cover set to Fit." : "Cover set to Fill.") : "Failed to update cover mode.");
        setTimeout(() => {
            setStatus("idle");
            setMessage("");
        }, 2000);
    };

    const openCoverPosition = (targetEvent: Event) => {
        setCoverPositionEvent(targetEvent);
        setCoverDraft({
            coverOffset: targetEvent.coverOffset || 0,
            coverOffsetX: targetEvent.coverOffsetX || 0,
            coverScale: targetEvent.coverScale || 1,
        });
    };

    const getCoverDragLimits = (scale = coverDraft.coverScale) => {
        const rect = coverPreviewRef.current?.getBoundingClientRect();
        const width = rect?.width || 1;
        const height = rect?.height || 1;
        return {
            x: Math.max(0, (width * scale - width) / 2),
            y: 50 + Math.max(0, (height * scale - height) / 2),
        };
    };

    const clampCoverDraft = (draft: typeof coverDraft) => {
        const limits = getCoverDragLimits(draft.coverScale);
        return {
            coverScale: draft.coverScale,
            coverOffsetX: Math.min(Math.max(draft.coverOffsetX, -limits.x), limits.x),
            coverOffset: Math.min(Math.max(draft.coverOffset, -limits.y), limits.y),
        };
    };

    const handleCoverPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (!coverPositionEvent) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        coverDragStartRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            coverOffset: coverDraft.coverOffset,
            coverOffsetX: coverDraft.coverOffsetX,
        };
    };

    const handleCoverPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const start = coverDragStartRef.current;
        if (!start || start.pointerId !== event.pointerId) return;
        const nextDraft = {
            ...coverDraft,
            coverOffsetX: start.coverOffsetX + event.clientX - start.startX,
            coverOffset: start.coverOffset + event.clientY - start.startY,
        };
        setCoverDraft(clampCoverDraft(nextDraft));
    };

    const handleCoverPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
        if (coverDragStartRef.current?.pointerId === event.pointerId) {
            coverDragStartRef.current = null;
        }
    };

    const adjustCoverZoom = (delta: number) => {
        setCoverDraft(prev => {
            const nextScale = Math.min(Math.max(Number((prev.coverScale + delta).toFixed(2)), 1), 2.5);
            return clampCoverDraft({ ...prev, coverScale: nextScale });
        });
    };

    const handleSaveCoverPosition = async () => {
        if (!coverPositionEvent) return;
        const updatedFields: Partial<Event> = {
            coverOffset: coverDraft.coverOffset,
            coverOffsetX: coverDraft.coverOffsetX,
            coverScale: coverDraft.coverScale,
            coverMode: "fill",
        };
        syncEventFields(coverPositionEvent.id, updatedFields);
        setStatus("uploading");
        setMessage("Saving cover position...");
        const success = await updateEvent(coverPositionEvent.id, updatedFields);
        setStatus(success ? "success" : "error");
        setMessage(success ? "Cover position saved." : "Failed to save cover position.");
        if (success) setCoverPositionEvent(null);
        setTimeout(() => {
            setStatus("idle");
            setMessage("");
        }, 2000);
    };

    const handleUpdateEventCategory = async (targetEvent: Event, category: string) => {
        syncEventFields(targetEvent.id, { category });
        setStatus("uploading");
        setMessage("Updating event type...");
        const success = await updateEvent(targetEvent.id, { category });
        setStatus(success ? "success" : "error");
        setMessage(success ? "Event type updated." : "Failed to update event type.");
        setTimeout(() => {
            setStatus("idle");
            setMessage("");
        }, 2000);
    };

    const handleRemoveCoverForEvent = async (targetEvent: Event) => {
        if (!targetEvent.coverImage) {
            setStatus("success");
            setMessage("This event is already using the default cover.");
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 2000);
            return;
        }

        setStatus("uploading");
        setMessage("Removing cover picture...");

        try {
            const coverUrlToRemove = targetEvent.coverImage;
            const success = await updateEvent(targetEvent.id, { coverImage: "" });
            if (!success) {
                throw new Error("Failed to remove cover picture.");
            }

            const usageDeleted = await deleteCoverUsagePhoto(targetEvent.id, coverUrlToRemove);
            if (!usageDeleted) {
                console.warn("[Dashboard] Cover removed, but storage usage could not be synced.");
            }

            syncCoverImageForEvent(targetEvent.id, "");
            setStatus("success");
            setMessage("Cover picture removed. Default cover restored.");
            await fetchUserEvents();
            await fetchStorageStats();

            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 2000);
        } catch (error: unknown) {
            console.error("Error removing cover:", error);
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Failed to remove cover picture.");
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 4000);
        }
    };

    const uploadCoverForEvent = async (file: File, targetEvent: Event) => {
        setStatus("uploading");
        setMessage("Optimizing and uploading cover picture...");

        const optimizedFile = await compressImage(file);
        if (optimizedFile.size !== file.size) {
            console.log(`[Dashboard] Optimized cover: ${Math.round(file.size / 1024 / 1024 * 10) / 10}MB -> ${Math.round(optimizedFile.size / 1024 / 1024 * 10) / 10}MB`);
        }

        const uploadResult = await uploadEventImage(optimizedFile, targetEvent.id, user?.uid || "anonymous");
        const success = await updateEvent(targetEvent.id, { coverImage: uploadResult.url });

        if (!success) {
            throw new Error("Cover upload completed, but saving the event cover failed.");
        }

        const usageSaved = await saveCoverUsagePhoto({
            eventId: targetEvent.id,
            storageKey: uploadResult.publicId || uploadResult.url,
            url: uploadResult.url,
            userId: user?.uid || "anonymous",
            width: uploadResult.width,
            height: uploadResult.height,
            size: uploadResult.bytes || optimizedFile.size,
            format: uploadResult.format,
        });

        if (!usageSaved) {
            console.warn("[Dashboard] Cover updated, but storage usage could not be synced.");
        }

        syncCoverImageForEvent(targetEvent.id, uploadResult.url);
        setStatus("success");
        setMessage("Cover picture updated! ✨");
        await fetchUserEvents();
        await fetchStorageStats();
    };

    const handleMainEventCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        const targetEvent = activeEventDetailEvent || selectedMainEvent;
        if (!file || !targetEvent || !user) return;

        try {
            await uploadCoverForEvent(file, targetEvent);
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 2000);
        } catch (error: unknown) {
            console.error("Error uploading event cover:", error);
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Failed to update cover picture.");
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 4000);
        }
    };

    const handleSubEventCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || !selectedEventId || !user) return;

        const targetEvent = userEvents.find(evt => evt.id === selectedEventId) || activeSubEvent;
        if (!targetEvent) {
            setStatus("error");
            setMessage("Could not find this event. Please reopen it and try again.");
            return;
        }

        try {
            await uploadCoverForEvent(file, targetEvent);
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 2000);
        } catch (error: unknown) {
            console.error("Error uploading sub-event cover:", error);
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Failed to update cover picture.");
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 4000);
        }
    };

    const getEventShareUrl = (eventId: string) => `${window.location.origin}/events/${eventId}`;

    const ensureEventJoinId = async (eventToShare: Event) => {
        if (eventToShare.joinId) return eventToShare;

        const joinId = generateEventJoinId(eventToShare.id);
        const eventWithJoinId = { ...eventToShare, joinId };
        await updateEvent(eventToShare.id, { joinId });
        setUserEvents(prev => prev.map(evt => evt.id === eventToShare.id ? { ...evt, joinId } : evt));
        setSharedEvents(prev => prev.map(evt => evt.id === eventToShare.id ? { ...evt, joinId } : evt));
        setEventDetailGalleries(prev => prev.map(evt => evt.id === eventToShare.id ? { ...evt, joinId } : evt));
        setSelectedMainEvent(prev => prev?.id === eventToShare.id ? { ...prev, joinId } : prev);
        return eventWithJoinId;
    };

    const handleShareEventLink = async (eventToShare: Event) => {
        try {
            const eventWithJoinId = await ensureEventJoinId(eventToShare);
            setShareModalEvent(eventWithJoinId);
        } catch (error) {
            console.error("Failed to prepare share modal:", error);
            setMessage("Unable to prepare share invitation.");
            setStatus("error");
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 3000);
        }
    };

    const handleShareInvitation = async () => {
        if (!shareModalEvent) return;

        const url = getEventShareUrl(shareModalEvent.id);
        const text = `Join our event "${shareModalEvent.title}" on EveBash!\nJoin ID: ${shareModalEvent.joinId || generateEventJoinId(shareModalEvent.id)}\nLink: ${url}`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: `Join ${shareModalEvent.title}`,
                    text,
                    url,
                });
            } else {
                await navigator.clipboard.writeText(text);
                setMessage("Invitation copied!");
                setStatus("success");
                setTimeout(() => {
                    setStatus("idle");
                    setMessage("");
                }, 2000);
            }
        } catch (error) {
            console.error("Sharing failed:", error);
        }
    };

    const toDateInputValue = (value?: string) => {
        if (!value) return "";
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) return "";

        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, "0");
        const day = String(parsed.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    };

    const getDaysInMonth = (month: number, year: number) => new Date(year, month + 1, 0).getDate();

    const clampDatePickerValue = (value: { month: number; day: number; year: number }) => ({
        ...value,
        day: Math.min(value.day, getDaysInMonth(value.month, value.year)),
    });

    const getDatePartsFromInputValue = (value?: string) => {
        const normalized = toDateInputValue(value);
        if (!normalized) {
            const today = new Date();
            return { month: today.getMonth(), day: today.getDate(), year: today.getFullYear() };
        }

        const [year, month, day] = normalized.split("-").map(Number);
        return { month: month - 1, day, year };
    };

    const formatDatePickerValue = (value: { month: number; day: number; year: number }) => (
        `${value.year}-${String(value.month + 1).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`
    );

    const formatFriendlyDatePickerValue = (value: { month: number; day: number; year: number }) => (
        formatCreateEventDate(new Date(value.year, value.month, value.day))
    );

    const openDatePicker = (target: "rename" | "create" = "rename") => {
        setDatePickerTarget(target);
        setDatePickerValue(getDatePartsFromInputValue(target === "create" ? eventDate : newDate));
        setShowDatePickerModal(true);
    };

    const openUploadForEvent = (eventId: string, title: string) => {
        if (manageLevel === "event-details") {
            setSelectedEventId(eventId);
            setSelectedEventName(title);
            const targetEvent = userEvents.find(evt => evt.id === eventId)
                || eventDetailGalleries.find(evt => evt.id === eventId)
                || (selectedMainEvent?.id === eventId ? selectedMainEvent : undefined);
            setGalleryMessageText(targetEvent?.description || "");
            setManageMode("add-image");
            setStatus("idle");
            setMessage("");
            const params = new URLSearchParams(searchParams);
            params.set("view", "manage");
            params.set("level", "event-details");
            params.set("mode", "add-image");
            params.set("eventId", selectedMainEvent?.id || eventId);
            params.set("galleryId", eventId);
            router.push(`/host?${params.toString()}`);
            return;
        }

        const params = new URLSearchParams(searchParams);
        params.set("view", "manage");
        // Maintain current level if valid, otherwise assume photos for this specific action context? 
        // Actually, adding images usually implies looking at photos.
        params.set("level", "photos");
        params.set("mode", "add-image");
        params.set("eventId", eventId);

        router.push(`/host?${params.toString()}`);

        // Reset UI transients
        setStatus("idle");
        setMessage("");
    };

    const handleRenameClick = (e: React.MouseEvent, evt: Event, mode: "title" | "date" = "title") => {
        e.stopPropagation();
        setEditDetailsMode(mode);
        setRenamingEvent(evt);
        setNewTitle(evt.title);
        setNewDate(toDateInputValue(evt.date));
        setActiveMenu(null);
    };

    const handleRenameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!renamingEvent || !newTitle.trim()) return;

        // Optimistic Update
        const updatedEvents = userEvents.map(evt =>
            evt.id === renamingEvent.id ? { ...evt, title: newTitle, date: newDate } : evt
        );
        setUserEvents(updatedEvents);

        const currentRenamingEvent = renamingEvent;
        setRenamingEvent(null);
        setEditDetailsMode("title");
        setNewTitle("");
        setNewDate("");
        setMessage(currentRenamingEvent.type === "sub" ? "Gallery updated!" : "Event updated!");
        setStatus("success");
        setTimeout(() => setStatus("idle"), 2000);

        try {
            await updateEvent(currentRenamingEvent.id, { title: newTitle, date: newDate });
            if (currentRenamingEvent.id === selectedEventId) {
                setSelectedEventName(newTitle);
            }
            setEventDetailGalleries(prev => prev.map(evt =>
                evt.id === currentRenamingEvent.id ? { ...evt, title: newTitle, date: newDate } : evt
            ));
            if (selectedMainEvent && currentRenamingEvent.id === selectedMainEvent.id) {
                setSelectedMainEvent(prev => prev ? { ...prev, title: newTitle, date: newDate } : null);
            }
        } catch (error) {
            console.error("Failed to rename event:", error);
            setMessage("Failed to save changes.");
            setStatus("error");
            // Revert
            setUserEvents(userEvents);
        }
    };

    const handleSaveGalleryMessage = async () => {
        if (!activeEventDetailEvent) return;

        const nextDescription = galleryMessageText.trim();
        setStatus("uploading");
        setMessage("Saving gallery message...");

        try {
            await updateEvent(activeEventDetailEvent.id, { description: nextDescription });
            setUserEvents(prev => prev.map(evt => evt.id === activeEventDetailEvent.id ? { ...evt, description: nextDescription } : evt));
            setEventDetailGalleries(prev => prev.map(evt => evt.id === activeEventDetailEvent.id ? { ...evt, description: nextDescription } : evt));
            setSelectedMainEvent(prev => prev?.id === activeEventDetailEvent.id ? { ...prev, description: nextDescription } : prev);
            setGalleryMessageText(nextDescription);
            setStatus("success");
            setMessage("Gallery message updated.");
            setTimeout(() => {
                setStatus("idle");
                setMessage("");
            }, 2000);
        } catch (error) {
            console.error("Failed to update gallery message:", error);
            setStatus("error");
            setMessage("Failed to update gallery message.");
        }
    };

    const moveSubGallery = async (galleryId: string, direction: -1 | 1) => {
        const currentIndex = eventDetailGalleries.findIndex(gallery => gallery.id === galleryId);
        const nextIndex = currentIndex + direction;
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= eventDetailGalleries.length) return;

        const nextGalleries = [...eventDetailGalleries];
        [nextGalleries[currentIndex], nextGalleries[nextIndex]] = [nextGalleries[nextIndex], nextGalleries[currentIndex]];
        setEventDetailGalleries(nextGalleries);
        await updateSubEventsOrder(nextGalleries.map(gallery => gallery.id));
        fetchUserEvents();
    };

    const moveGalleryMedia = async (photoId: string, direction: -1 | 1) => {
        const currentItems = galleryMediaTab === "videos" ? videoItems : photoItems;
        const currentIndex = currentItems.findIndex(item => item.id === photoId);
        const nextIndex = currentIndex + direction;
        if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentItems.length) return;

        const reorderedItems = [...currentItems];
        [reorderedItems[currentIndex], reorderedItems[nextIndex]] = [reorderedItems[nextIndex], reorderedItems[currentIndex]];
        const reorderedIds = reorderedItems.map(item => item.id);
        setCurrentEventPhotos(prev => {
            const reorderedSet = new Set(reorderedIds);
            const otherItems = prev.filter(item => !reorderedSet.has(item.id));
            return galleryMediaTab === "videos"
                ? [...otherItems.filter(item => item.mediaType !== "video" && item.resourceType !== "video"), ...reorderedItems]
                : [...reorderedItems, ...otherItems.filter(item => item.mediaType === "video" || item.resourceType === "video")];
        });
        await updatePhotosOrder(reorderedIds);
    };

    const handleUpdateTemplate = async (templateId: string) => {
        if (!templateTargetEvent) return;

        setStatus("uploading");
        setMessage("Applying new theme...");

        // Optimistic Update for current list
        const updatedEvents = userEvents.map(evt =>
            evt.id === templateTargetEvent.id ? { ...evt, templateId } : evt
        );
        setUserEvents(updatedEvents);

        try {
            // Update main event
            await updateEvent(templateTargetEvent.id, { templateId });

            // If it's a main event, cascade the update to all its sub-events
            if (templateTargetEvent.type === 'main') {
                setMessage("Updating all galleries matching new theme...");
                const subEvents = await getSubEvents(templateTargetEvent.id);

                // Update all sub-events concurrently
                const updatePromises = subEvents.map(subEvent =>
                    updateEvent(subEvent.id, { templateId })
                );

                await Promise.all(updatePromises);
                console.log(`[Dashboard] Cascaded template change '${templateId}' to ${subEvents.length} sub-events.`);
            }

            setShowTemplateModal(false);
            setTemplateTargetEvent(null);
            setMessage("Theme updated successfully! ✨");
            setStatus("success");
            setTimeout(() => setStatus("idle"), 2000);

            // Refresh to ensure everything is synced
            fetchUserEvents();
        } catch (error) {
            console.error("Failed to update template:", error);
            setMessage("Failed to save changes.");
            setStatus("error");
            // Revert
            fetchUserEvents(); // Re-fetch from server to guarantee correct state
        }
    };



    const handleDeleteEvent = async (eventId: string) => {
        setStatus("uploading");
        setMessage("Deleting event...");
        const isDeletingCurrentEvent =
            eventId === selectedEventId ||
            eventId === selectedMainEvent?.id ||
            searchParams.get("eventId") === eventId;

        try {
            const eventToDelete = userEvents.find(e => e.id === eventId) || eventDetailGalleries.find(e => e.id === eventId);
            const isGallery = eventToDelete?.type === "sub";
            
            const success = await deleteEvent(eventId);
            if (success) {
                setStatus("success");
                setMessage("");
                setShowDeleteConfirm(null);
                setShowDeleteSuccessType(isGallery ? "gallery" : "event");
                setActiveMenu(null);
                if (eventId === selectedEventId) {
                    setSelectedEventId("");
                    setSelectedEventName("");
                    setManageMode("list");
                }
                if (eventId === selectedMainEvent?.id) {
                    setSelectedMainEvent(null);
                    navigateTo("/host");
                }
                setEventDetailGalleries(prev => prev.filter(gallery => gallery.id !== eventId));
                fetchUserEvents();
                if (isDeletingCurrentEvent) {
                    navigateTo("/host");
                }
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

    const handleToggleSampleGallery = async (event: Event) => {
        if (sampleGalleryUpdating) return;

        const nextStatus = !event.isSampleGallery;
        setSampleGalleryUpdating(event.id);
        setStatus("uploading");
        setMessage(nextStatus ? "Adding event to Sample Galleries..." : "Removing event from Sample Galleries...");

        const success = await setEventSampleGalleryStatus(event.id, nextStatus);

        if (success) {
            setUserEvents(prev => prev.map(item => item.id === event.id ? { ...item, isSampleGallery: nextStatus } : item));
            setSharedEvents(prev => prev.map(item => item.id === event.id ? { ...item, isSampleGallery: nextStatus } : item));
            setMessage(nextStatus ? "Event added to Sample Galleries." : "Event removed from Sample Galleries.");
            setStatus("success");
            fetchUserEvents();
        } else {
            setMessage("Could not update Sample Gallery status.");
            setStatus("error");
        }

        setSampleGalleryUpdating(null);
        setTimeout(() => {
            setStatus("idle");
            setMessage("");
        }, 2200);
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
            await refreshEventFavourites(selectedMainEventId);
        } catch (error) {
            console.error("Error deleting photo:", error);
            setStatus("error");
            setMessage("Error removing photo.");
        }
    };

    const handleToggleEventFavourite = async (photoId: string) => {
        if (!selectedMainEventId || !user?.uid) return;

        try {
            const result = await toggleEventFavouritePhoto(selectedMainEventId, photoId, user.uid);
            if (result.error) {
                setStatus("error");
                setMessage(result.error);
                return;
            }

            setEventFavouritePhotoIds(prev => {
                const next = new Set(prev);
                if (result.favourited) next.add(photoId);
                else next.delete(photoId);
                return next;
            });
            setStatus("success");
            setMessage(result.favourited ? "Added to Favourite gallery." : "Removed from Favourite gallery.");
            await refreshEventFavourites(selectedMainEventId);
            setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);
        } catch (error) {
            console.warn("Error updating favourite photo:", error);
            setStatus("error");
            setMessage("Failed to update Favourite gallery.");
        }
    };

    const handleRotatePhoto = async (photoId: string, direction: "left" | "right") => {
        try {
            setStatus("uploading");
            setMessage(direction === "left" ? "Rotating photo left..." : "Rotating photo right...");

            const result = await rotatePhoto(photoId, direction);
            if (!result.success || !result.url || !result.thumbnailUrl) {
                throw new Error(result.error || "Failed to rotate photo.");
            }

            const cacheBuster = result.cacheBuster || Date.now();
            const displayUrl = `${result.url}?v=${cacheBuster}`;
            const displayThumbnailUrl = `${result.thumbnailUrl}?v=${cacheBuster}`;

            setCurrentEventPhotos(prev => prev.map(photo => (
                photo.id === photoId
                    ? {
                        ...photo,
                        url: displayUrl,
                        thumbnailUrl: displayThumbnailUrl,
                        width: result.width ?? photo.width,
                        height: result.height ?? photo.height,
                        size: result.size ?? photo.size,
                    }
                    : photo
            )));

            setViewingPhoto((prev: any | null) => prev?.id === photoId ? {
                ...prev,
                src: displayUrl,
                width: result.width ?? prev.width,
                height: result.height ?? prev.height,
            } : prev);

            setStatus("success");
            setMessage("Photo rotation saved.");
            setTimeout(() => { setStatus("idle"); setMessage(""); }, 2000);
        } catch (error) {
            console.error("Error rotating photo:", error);
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "Error rotating photo.");
        }
    };

    const ownEventIdentifiers = new Set([user.uid, user.email].filter(Boolean) as string[]);
    const activeSubEvent = userEvents.find(e => e.id === selectedEventId)
        || eventDetailGalleries.find(e => e.id === selectedEventId)
        || (selectedMainEvent?.id === selectedEventId ? selectedMainEvent : undefined);
    const coverUrl = resolveEventCoverImage(activeSubEvent?.coverImage, 'preview');
    const isInlineEventDetailGalleryEditor = manageLevel === "event-details" && activeEventDetailTab === "galleries" && manageMode === "add-image";
    const activeEventDetailEvent = isInlineEventDetailGalleryEditor ? (activeSubEvent || selectedMainEvent) : selectedMainEvent;
    const activeGalleryOriginalMessage = activeEventDetailEvent?.description || "";
    const hasGalleryMessageChanges = galleryMessageText !== activeGalleryOriginalMessage;
    const photoItems = currentEventPhotos.filter(photo => photo.mediaType !== "video" && photo.resourceType !== "video");
    const videoItems = currentEventPhotos.filter(photo => photo.mediaType === "video" || photo.resourceType === "video");
    const activeGalleryItems = galleryMediaTab === "videos" ? videoItems : photoItems;
    const stripUrlQuery = (value?: string | null) => (value || "").split("?")[0];
    const createdEvents = userEvents.filter(evt => evt.createdBy && ownEventIdentifiers.has(evt.createdBy));
    const legacySharedEvents = userEvents.filter(evt => !evt.createdBy || !ownEventIdentifiers.has(evt.createdBy));
    const permissionMainEvents = userEvents.filter(e => e.type === 'main' || (!e.type && !e.parentId));
    const permissionCreatedEvents = permissionMainEvents.filter(evt => evt.createdBy && ownEventIdentifiers.has(evt.createdBy));
    const permissionOtherEvents = permissionMainEvents.filter(evt => !evt.createdBy || !ownEventIdentifiers.has(evt.createdBy));

    const pendingGuestRequests = trafficLogs.filter(log => log.status === "pending");
    const pendingRequestsByEvent = Object.entries(
        pendingGuestRequests.reduce<Record<string, any[]>>((groups, log) => {
            const eventTitle = log.eventTitle || "Untitled Event";
            groups[eventTitle] = groups[eventTitle] || [];
            groups[eventTitle].push(log);
            return groups;
        }, {})
    );
    const eventDetailPendingLogs = eventDetailLogs.filter(log => log.status === "pending");
    const eventDetailAdminLogs = eventDetailLogs.filter(log => log.status === "approved" && !!log.canAdmin);
    const eventDetailMemberLogs = eventDetailLogs.filter(log => log.status === "approved" && !log.canAdmin);
    const eventDetailVisibleLogsCount = eventDetailPendingLogs.length + eventDetailAdminLogs.length + eventDetailMemberLogs.length;
    const planDetails = getPlanDetails(user.role);
    const subscriptionStatus = getSubscriptionStatus({
        role: user.role,
        planStartDate: user.planStartDate,
        planEndDate: user.planEndDate,
    });
    const shouldWarnExpiredPlanMedia = subscriptionStatus.status === "grace";
    const storagePercent = getUsagePercent(totalStorage, planDetails.storageBytes);
    const eventPercent = getUsagePercent(totalMainEvents, planDetails.eventLimit);
    const isImmersiveHostEventView = view === "manage" && manageLevel === "event-details";
    const mediaTabs = [
        { id: "photos", label: `Photos (${currentEventMediaCounts.photos})`, icon: ImageIcon },
        { id: "videos", label: `Videos (${currentEventMediaCounts.videos})`, icon: Video },
    ] as const;

    const getEventOwnerEmail = (evt: Event) => {
        if (!evt.createdBy) return "Unknown owner";
        if (evt.createdBy.includes("@")) return evt.createdBy;
        return eventOwners[evt.createdBy]?.email || workspaceOwner?.email || evt.createdBy;
    };

    const getEventOwnerDetails = (evt: Event) => {
        const ownerId = evt.createdBy;
        if (!ownerId) {
            return { name: "Unknown owner", email: "Unknown", username: "Not set" };
        }

        if (ownerId.includes("@")) {
            return { name: "Unknown owner", email: ownerId, username: "Not set" };
        }

        const owner = eventOwners[ownerId];
        return {
            name: owner?.name || "Unknown owner",
            email: owner?.email || ownerId,
            username: owner?.username || "Not set",
        };
    };

    const getSharedAccessLabel = (evt: Event) => {
        const ownerId = evt.createdBy;
        const isFullManager = !!ownerId && user.roleType === "primary" && (
            user.delegatedBy === ownerId ||
            user.delegatedBy === eventOwners[ownerId]?.email ||
            user.delegatedBy === workspaceOwner?.id
        );

        return isFullManager ? "Full Manager" : "Event Manager";
    };

    const renderEventDetailPermissionCard = (log: EventDetailLog) => {
        const loginDate = log.loginAt?.seconds
            ? new Date(log.loginAt.seconds * 1000).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
            : "Unknown";
        const contact = log.email || log.phone || "No contact";
        const hasAdminAccess = Boolean(log.canAdmin);
        const hasUploadAccess = hasAdminAccess || Boolean(log.canUpload);
        const hasCommentAccess = hasAdminAccess || Boolean(log.canComment);
        const permissionBadges = log.status === "pending"
            ? [{ label: "Pending", icon: RefreshCw, className: "border-sky-400/30 bg-sky-400/10 text-sky-300" }]
            : log.status === "rejected"
                ? [{ label: "Denied", icon: X, className: "border-rose-400/30 bg-rose-400/10 text-rose-300" }]
                : [
                    { label: "View", icon: Eye, className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" },
                    ...(hasAdminAccess ? [{ label: "Admin", icon: ShieldCheck, className: "border-amber-400/30 bg-amber-400/10 text-amber-300" }] : []),
                    ...(hasUploadAccess ? [{ label: "Upload", icon: Camera, className: "border-purple-400/30 bg-purple-400/10 text-purple-300" }] : []),
                    ...(hasCommentAccess ? [{ label: "Comment", icon: MessageCircle, className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" }] : []),
                ];

        return (
            <div
                key={log.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedGuestLog(log)}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setSelectedGuestLog(log);
                }}
                className="flex cursor-pointer flex-col gap-3 rounded-[1.5rem] border border-slate-700 bg-slate-900/50 p-4 transition-colors hover:border-amber-400/50 hover:bg-slate-900 lg:flex-row lg:items-center"
            >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400/10 text-sm font-black text-amber-300">
                        {(log.name || "G").charAt(0)}
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h5 className="truncate text-base font-black text-white">{log.name || "Guest"}</h5>
                        </div>
                        <p className="truncate text-xs font-bold text-slate-400">{contact} • {loginDate}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {permissionBadges.map(({ label, icon: Icon, className }) => (
                                <span
                                    key={label}
                                    className={cn(
                                        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest",
                                        className
                                    )}
                                >
                                    <Icon className="h-3 w-3" />
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {log.status === "pending" && (
                        <>
                            <button
                                onClick={async (event) => {
                                    event.stopPropagation();
                                    await handleGuestStatusUpdate(log.id, "approved");
                                    setEventDetailLogs(prev => prev.map(item => item.id === log.id ? { ...item, status: "approved", canUpload: true, canComment: true } : item));
                                }}
                                className="rounded-full bg-emerald-500/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-300"
                            >
                                Approve
                            </button>
                            <button
                                onClick={async (event) => {
                                    event.stopPropagation();
                                    await handleGuestStatusUpdate(log.id, "rejected");
                                    setEventDetailLogs(prev => prev.filter(item => item.id !== log.id));
                                }}
                                className="rounded-full bg-rose-500/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-rose-300"
                            >
                                Deny
                            </button>
                        </>
                    )}
                    <button
                        onClick={async (event) => {
                            event.stopPropagation();
                            await handleGuestDelete(log.id);
                            setEventDetailLogs(prev => prev.filter(item => item.id !== log.id));
                        }}
                        className="rounded-full border border-slate-700 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-300"
                    >
                        Delete
                    </button>
                </div>
            </div>
        );
    };

    const renderEventCard = (evt: Event) => {
        const isSharedEvent = !evt.createdBy || !ownEventIdentifiers.has(evt.createdBy);

        return (
        <motion.div
            key={evt.id}
            whileHover={{ y: -5 }}
            onClick={(e) => {
                if (manageLevel === "events") {
                    navigateWithModifierClick(e, `/host?view=manage&level=event-details&eventId=${evt.id}`, router.push);
                } else {
                    navigateWithModifierClick(e, `/host?view=manage&level=photos&mode=add-image&eventId=${evt.id}`, router.push);
                }
            }}
            className="group relative bg-slate-800 aspect-[4/5] rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 border border-slate-700 cursor-pointer"
        >
            <div className="absolute inset-0 overflow-hidden rounded-[2.5rem]">
                <img
                    src={resolveEventCoverImage(evt.coverImage, 'thumbnail')}
                    alt={evt.title}
                    className="absolute inset-0 w-full h-full transition-transform duration-700 group-hover:scale-110"
                    style={getCoverImageStyle(evt)}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent transition-all" />
                {evt.category && (
                    <div className="absolute left-5 top-5 z-10 rounded-lg border border-amber-300/30 bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300 backdrop-blur-sm">
                        {evt.category}
                    </div>
                )}
            </div>

            <div className="absolute top-6 right-6 z-20">
                <Tooltip text="Options">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenu(activeMenu === evt.id ? null : evt.id);
                        }}
                        className="p-2.5 bg-slate-800/90 backdrop-blur-md shadow-lg hover:bg-slate-800 rounded-2xl text-white transition-all active:scale-95 border border-white/50"
                    >
                        <MoreHorizontal className="w-5 h-5" />
                    </button>
                </Tooltip>

                <AnimatePresence>
                    {activeMenu === evt.id && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -10 }}
                            className="absolute right-0 mt-3 w-44 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 py-2 z-30 overflow-hidden"
                        >
                            <button
                                onClick={(e) => handleRenameClick(e, evt)}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-slate-900/50 transition-colors"
                                title="Rename this event"
                            >
                                <Pencil className="w-4 h-4 text-blue-500" />
                                <span>Rename</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openUploadForEvent(evt.id, evt.title);
                                    setActiveMenu(null);
                                }}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-slate-900/50 transition-colors border-t border-slate-700"
                                title="Manage photos for this event"
                            >
                                <Camera className="w-4 h-4 text-purple-500" />
                                <span>Edit Photos</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setTemplateTargetEvent(evt);
                                    setShowTemplateModal(true);
                                    setActiveMenu(null);
                                }}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-slate-900/50 transition-colors border-t border-slate-700 text-sky-400"
                                title="Change design template"
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                <span>Change Template</span>
                            </button>
                            {manageLevel === "events" && (
                                <a
                                    href={`/events/${evt.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenu(null);
                                    }}
                                    className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-slate-900/50 transition-colors border-t border-slate-700 text-blue-600"
                                    title="Visit public website"
                                >
                                    <Globe className="w-4 h-4" />
                                    <span>Visit Website</span>
                                </a>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleShareEventLink(evt);
                                    setActiveMenu(null);
                                }}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-slate-900/50 transition-colors border-t border-slate-700"
                                title="Share event invitation"
                            >
                                <Share2 className="w-4 h-4 text-emerald-500" />
                                <span>Share Event</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowDeleteConfirm(evt.id);
                                    setActiveMenu(null);
                                }}
                                className="w-full px-5 py-3 text-left text-sm font-bold flex items-center space-x-3 hover:bg-red-50 text-red-600 transition-colors border-t border-slate-700"
                                title="Permanently delete this event"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="absolute bottom-0 left-0 w-full bg-black p-6 text-left text-white sm:p-8">
                {isSharedEvent && (
                    <div className="mb-3 space-y-1">
                        <div className="inline-flex max-w-full items-center px-2 py-1 bg-slate-800/20 backdrop-blur-md rounded text-[9px] font-bold uppercase tracking-widest border border-white/20">
                            <span className="truncate">Owner: {getEventOwnerEmail(evt)}</span>
                        </div>
                        <div className="w-fit px-2 py-1 bg-black/30 backdrop-blur-md rounded text-[9px] font-bold uppercase tracking-widest border border-white/10 text-white/90">
                            {getSharedAccessLabel(evt)}
                        </div>
                    </div>
                )}
                {user?.delegatedBy && workspaceOwner && (
                    <div className="mb-2 inline-flex items-center px-2 py-0.5 bg-slate-800/20 backdrop-blur-md rounded text-[9px] font-bold uppercase tracking-widest border border-white/20">
                        Managed for: {workspaceOwner.email}
                    </div>
                )}
                <h3 className="text-2xl font-bold italic tracking-tight mb-4">{evt.title}</h3>
                <div className="mb-3 flex items-center text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    <Calendar className="mr-2 h-3.5 w-3.5 text-amber-300" />
                    <span>{formatEventDate(evt.date)}</span>
                </div>
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
        );
    };

    const renderManagedWorkspaceBanner = () => {
        if (!user?.delegatedBy || !workspaceOwner) return null;

        return (
            <div className="bg-amber-900/30 rounded-3xl p-6 border border-amber-500/30 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-amber-900/50 rounded-2xl flex items-center justify-center text-amber-400">
                        <Users size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-slate-200 font-serif">Managed Workspace</h3>
                        <p className="text-sm text-stone-700 font-sans">
                            You are managing the account for <span className="text-amber-400 font-bold">{workspaceOwner.email}</span>
                        </p>
                    </div>
                </div>
                <div className="hidden sm:block">
                    <span className="px-4 py-1.5 bg-slate-800 text-amber-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-500/50 shadow-sm">
                        {user.roleType === 'primary' ? 'Full Manager' : 'Event Admin'}
                    </span>
                </div>
            </div>
        );
    };

    const renderEventSection = (title: string, items: Event[], showWorkspaceBanner = false) => {
        if (items.length === 0) return null;

        return (
            <section className="space-y-5">
                <div>
                    <h3 className="text-xl font-bold text-slate-200 font-serif">{title}</h3>
                    <p className="text-sm text-slate-400 font-sans">{items.length} {items.length === 1 ? "item" : "items"}</p>
                </div>
                {showWorkspaceBanner && renderManagedWorkspaceBanner()}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {items.map(renderEventCard)}
                </div>
            </section>
        );
    };



    const totalItems = uploadQueue.length;
    const completedItems = uploadQueue.filter(item => item.status === "success" || item.status === "error").length;
    const processingItems = uploadQueue.filter(item => item.status === "processing").length;
    const uploadingItems = uploadQueue.filter(item => item.status === "uploading").length;

    let overallStatusText = "";
    if (uploadingItems > 0) {
        overallStatusText = `Uploading ${uploadingItems} of ${totalItems} ${uploadingItems === 1 ? 'file' : 'files'}...`;
    } else if (processingItems > 0) {
        overallStatusText = `Resizing ${processingItems} ${processingItems === 1 ? 'file' : 'files'}...`;
    } else if (indexingStatus && indexingStatus.status === "processing") {
        overallStatusText = `AI Indexing: ${indexingStatus.indexed}/${indexingStatus.total} (${indexingStatus.percentComplete}%)`;
    } else if (completedItems === totalItems || (indexingStatus && indexingStatus.status === "complete")) {
        const withoutFaces = indexingStatus?.photosWithoutFaces || 0;
        const withFaces = indexingStatus?.photosWithFaces || 0;
        overallStatusText = withoutFaces > 0
            ? `✓ AI Indexing complete! ${indexingStatus?.total || totalItems} photos (${withFaces} with faces, ${withoutFaces} without faces)`
            : `✓ AI Indexing complete! ${totalItems} photos searchable`;
    } else {
        overallStatusText = "Upload status";
    }

    const shareModalUrl = shareModalEvent ? getEventShareUrl(shareModalEvent.id) : "";
    const shareModalJoinId = shareModalEvent?.joinId || (shareModalEvent ? generateEventJoinId(shareModalEvent.id) : "");

    return (
        <div className={cn(
            "min-h-screen font-serif text-slate-200 transition-colors duration-300",
            isImmersiveHostEventView ? "bg-black" : "bg-[#050505]"
        )}>
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <AnimatePresence mode="wait">
                    {view === "main" ? (
                        <motion.div
                            key="main-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-8"
                        >
                            <div className="bg-slate-800/80 rounded-[2rem] p-5 sm:p-8 shadow-xl border border-slate-700/50 backdrop-blur-sm">
                                <div className="flex flex-col gap-5 mb-6 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="flex items-center gap-4">
                                        <Tooltip text="Plan Details">
                                            <button
                                                onClick={() => {
                                                    fetchStorageStats();
                                                    setShowPlanDetailsModal(true);
                                                }}
                                                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-300 transition-colors hover:bg-amber-400/20"
                                                aria-label="Plan Details"
                                            >
                                                <svg
                                                    width="22"
                                                    height="22"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    aria-hidden="true"
                                                >
                                                    <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                                                    <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                                                    <line x1="6" x2="6.01" y1="6" y2="6" />
                                                    <line x1="6" x2="6.01" y1="18" y2="18" />
                                                </svg>
                                            </button>
                                        </Tooltip>
                                        <div>
                                            <h2 className="text-3xl font-bold text-white">Host Event</h2>
                                            <p className="text-slate-400 text-sm font-sans">Manage events and guests</p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => setIsCreateModalOpen(true)}
                                            className="flex items-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-sm font-black text-slate-950 transition-colors hover:bg-amber-300"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Create Event
                                        </button>
                                    </div>
                                </div>

                                <div className="flex w-full gap-2 overflow-x-auto rounded-2xl bg-slate-900/50 p-1 sm:w-fit">
                                    <button 
                                        onClick={() => setActiveTab('hosted')} 
                                        className={`flex min-w-28 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${activeTab === 'hosted' ? 'bg-slate-700 text-amber-300 shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                    >
                                        <Camera className="h-4 w-4" />
                                        Host
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('shared')} 
                                        className={`flex min-w-28 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${activeTab === 'shared' ? 'bg-slate-700 text-amber-300 shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                    >
                                        <Users className="h-4 w-4" />
                                        Shared
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('request')} 
                                        className={`relative flex min-w-28 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${activeTab === 'request' ? 'bg-slate-700 text-amber-300 shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                    >
                                        <UserPlus className="h-4 w-4" />
                                        Requests
                                        {pendingGuestRequests.length > 0 && (
                                            <span className="ml-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950">
                                                {pendingGuestRequests.length}
                                            </span>
                                        )}
                                    </button>
                                </div>

                                {loadingEvents ? (
                                    <div className="flex justify-center py-12">
                                        <div className="w-8 h-8 border-4 border-slate-600 border-t-sky-400 rounded-full animate-spin" />
                                    </div>
                                ) : activeTab === "request" ? (
                                    <div className="mt-6">
                                        {pendingGuestRequests.length === 0 ? (
                                            <div className="flex min-h-64 flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-slate-700 text-center text-slate-400">
                                                <Check className="mb-4 h-10 w-10 text-emerald-400/40" />
                                                <p className="mb-2 text-lg font-bold text-slate-200">All caught up!</p>
                                                <p className="text-sm">New access requests will appear here.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-5">
                                                {pendingRequestsByEvent.map(([eventTitle, logs]) => (
                                                    <section key={eventTitle} className="rounded-[1.5rem] border border-slate-700 bg-slate-900/60 p-4 sm:p-5">
                                                        <div className="mb-4 flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Event</p>
                                                                <h3 className="truncate text-lg font-black text-white">{eventTitle}</h3>
                                                            </div>
                                                            <span className="shrink-0 rounded-full bg-amber-400 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-950">
                                                                {logs.length} {logs.length === 1 ? "Request" : "Requests"}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                                                            {logs.map((log) => (
                                                                <div key={log.id} className="flex flex-col gap-4 rounded-[1.2rem] border border-white/10 bg-black p-4 sm:flex-row sm:items-center">
                                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-lg font-black text-slate-950">
                                                                        {(log.name || "G").charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="truncate text-base font-bold text-white">{log.name || "Anonymous Guest"}</p>
                                                                        <p className="mt-1 truncate text-sm text-slate-400">{log.email || log.phone || "No contact provided"}</p>
                                                                    </div>
                                                                    <div className="flex gap-2 sm:ml-auto">
                                                                        <button
                                                                            onClick={() => handleGuestStatusUpdate(log.id, "rejected")}
                                                                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500 text-white transition-colors hover:bg-rose-400"
                                                                            aria-label="Reject request"
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleGuestStatusUpdate(log.id, "approved")}
                                                                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white transition-colors hover:bg-emerald-400"
                                                                            aria-label="Approve request"
                                                                        >
                                                                            <Check className="h-4 w-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                                        {(activeTab === 'hosted' ? userEvents : sharedEvents).map((event) => {
                                            const ownerDetails = getEventOwnerDetails(event);
                                            return (
                                                <div 
                                                    key={event.id}
                                                    onClick={() => {
                                                        router.push(`/host?view=manage&level=event-details&eventId=${event.id}`);
                                                    }}
                                                    className={cn(
                                                        "group relative cursor-pointer overflow-hidden rounded-[1.5rem] bg-black",
                                                        activeTab === "shared" ? "h-80" : "h-64"
                                                    )}
                                                >
                                                    <div className={cn("relative overflow-hidden", activeTab === "shared" ? "h-64" : "h-full")}>
                                                        <img 
                                                            src={resolveEventCoverImage(event.coverImage, 'thumbnail')}
                                                            alt={event.title}
                                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent"></div>
                                                        {event.category && (
                                                            <div className="absolute left-4 top-4 rounded-lg border border-amber-300/30 bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300 backdrop-blur-sm">
                                                                {event.category}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="absolute bottom-0 left-0 right-0 bg-black p-5">
                                                        <h3 className="text-white font-bold text-lg leading-tight mb-1 truncate">{event.title}</h3>
                                                        <div className="mt-2 flex items-center text-xs font-bold text-slate-400">
                                                            <Calendar className="w-3 h-3 mr-1.5 text-amber-300" />
                                                            <span>{event.date}</span>
                                                        </div>
                                                        {activeTab === "shared" && (
                                                            <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                                                                <p className="break-words leading-relaxed">Owner username: <span className="normal-case text-white">{ownerDetails.username.toLowerCase()}</span></p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {(activeTab === 'hosted' ? userEvents : sharedEvents).length === 0 && (
                                            <div className="col-span-full h-64 rounded-[1.5rem] border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-400">
                                                <p className="font-medium text-lg mb-2">{activeTab === 'hosted' ? 'No events yet' : 'Nothing shared'}</p>
                                                <p className="text-sm text-center">{activeTab === 'hosted' ? 'Create your first album to see it here.' : 'Events shared with you will appear here.'}</p>
                                                {activeTab === 'hosted' && (
                                                    <button 
                                                        onClick={() => setIsCreateModalOpen(true)}
                                                        className="mt-4 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-full text-sm font-bold transition-colors"
                                                    >
                                                        Create one now
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

{/* HOST GUIDE SECTION */}
                            <div className="mt-16 bg-slate-800/80 rounded-[2rem] p-6 sm:p-8 shadow-xl border border-slate-700/50 backdrop-blur-sm">
                                <div className="mb-8">
                                    <h2 className="text-3xl font-bold text-white">Host Your Perfect Event</h2>
                                    <p className="text-slate-400 mt-2">Everything you need to capture memories flawlessly.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                                    {/* Benefit 1 */}
                                    <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
                                        <div className="w-12 h-12 bg-sky-500/20 rounded-xl flex items-center justify-center mb-4">
                                            <ImageIcon className="w-6 h-6 text-sky-400" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Stunning Galleries</h3>
                                        <p className="text-slate-400 text-sm">Create unlimited, high-resolution albums to preserve every beautiful memory.</p>
                                    </div>
                                    
                                    {/* Benefit 2 */}
                                    <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
                                        <div className="w-12 h-12 bg-sky-500/20 rounded-xl flex items-center justify-center mb-4">
                                            <Users className="w-6 h-6 text-sky-400" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Guest Sharing</h3>
                                        <p className="text-slate-400 text-sm">Easily invite guests via QR codes and securely share photos directly with them.</p>
                                    </div>

                                    {/* Benefit 3 */}
                                    <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-700/50">
                                        <div className="w-12 h-12 bg-sky-500/20 rounded-xl flex items-center justify-center mb-4">
                                            <Video className="w-6 h-6 text-sky-400" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Live Streaming</h3>
                                        <p className="text-slate-400 text-sm">Broadcast your special moments live to loved ones who could not attend in person.</p>
                                    </div>
                                </div>

                                {/* SECTION 4: HOW TO HOST (YouTube Card) */}
                                <div 
                                    onClick={() => window.open('https://www.youtube.com/@EveBashApp', '_blank')}
                                    className="relative overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-indigo-900 to-indigo-950 p-6 cursor-pointer shadow-lg shadow-indigo-900/20 group border border-indigo-500/20"
                                >
                                    <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
                                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between">
                                        <div className="mb-6 md:mb-0 max-w-md">
                                            <div className="inline-block px-3 py-1 bg-indigo-500/20 backdrop-blur-sm rounded-lg text-indigo-300 text-[10px] font-bold tracking-widest mb-3">
                                                HOW TO HOST
                                            </div>
                                            <h3 className="text-2xl font-bold text-white mb-1">Watch & Learn</h3>
                                            <p className="text-indigo-200 text-sm font-medium">Watch our step-by-step tutorials and host your event like a pro.</p>
                                        </div>
                                        <div className="flex items-center bg-indigo-500/20 backdrop-blur-md px-5 py-3 rounded-xl text-white font-bold w-fit group-hover:bg-indigo-500/40 transition-colors border border-indigo-400/30">
                                            <Play className="w-4 h-4 mr-2" fill="currentColor" /> Watch on YouTube
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ) : view === "manage" ? (
                        <motion.div
                            key="manage-view"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            {manageLevel !== "event-details" && (
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-4">
                                <div>
                                    <h2 className="text-3xl font-bold mb-2 uppercase tracking-wide">
                                        {manageLevel === "events" ? "Your Events" : "Galleries"}
                                    </h2>
                                    <p className="text-slate-700 font-sans">
                                        {manageLevel === "events"
                                            ? "Organize your wedding into high-level events."
                                            : `Galleries within ${selectedMainEvent?.title}`
                                        }
                                    </p>
                                </div>

                                <div className="flex space-x-3">
                                    <Tooltip text={`Create new ${manageLevel === "events" ? "event" : "gallery"}`}>
                                        <button
                                            onClick={() => {
                                                // Preserve existing params but add mode=add-event
                                                const params = new URLSearchParams(searchParams);
                                                params.set("mode", "add-event");
                                                router.push(`/host?${params.toString()}`);

                                                // Reset generic UI state
                                                setStatus("idle");
                                                setMessage("");
                                                setSelectedTemplate("hero");
                                            }}
                                            className="flex items-center space-x-2 px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl active:scale-95"
                                        >
                                            <Plus className="w-4 h-4" />
                                            <span>Create {manageLevel === "events" ? "Event" : "Gallery"}</span>
                                        </button>
                                    </Tooltip>
                                </div>
                            </div>
                            )}

                            {manageLevel === "event-details" && !selectedMainEvent && (
                                <div className="flex min-h-80 items-center justify-center rounded-[2rem] border border-slate-700 bg-slate-900/60 p-8 text-center">
                                    <div className="space-y-4">
                                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-sky-300" />
                                        <div>
                                            <h3 className="text-xl font-bold text-white">Loading Event Details</h3>
                                            <p className="mt-2 text-sm font-semibold text-slate-400">Restoring this event after refresh.</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {manageLevel === "event-details" && selectedMainEvent && (
                                <div className="space-y-8">
                                    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 shadow-xl">
                                        <div
                                            ref={(node) => {
                                                if (activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id) {
                                                    coverPreviewRef.current = node;
                                                }
                                            }}
                                            className={cn(
                                                "relative h-[26rem] sm:h-[30rem]",
                                                activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id && "cursor-grab active:cursor-grabbing"
                                            )}
                                            onPointerDown={activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id ? handleCoverPointerDown : undefined}
                                            onPointerMove={activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id ? handleCoverPointerMove : undefined}
                                            onPointerUp={activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id ? handleCoverPointerEnd : undefined}
                                            onPointerCancel={activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id ? handleCoverPointerEnd : undefined}
                                            style={activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id ? { touchAction: "none" } : undefined}
                                        >
                                            <img
                                                src={resolveEventCoverImage(activeEventDetailEvent?.coverImage, 'preview')}
                                                alt={activeEventDetailEvent?.title || selectedMainEvent.title}
                                                draggable={false}
                                                className="h-full w-full select-none"
                                                style={getCoverImageStyle(activeEventDetailEvent)}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                                            {activeEventDetailEvent && coverPositionEvent?.id === activeEventDetailEvent.id && (
                                                <div className="pointer-events-none absolute inset-x-6 top-6 z-20 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.2em] text-white/90 backdrop-blur-md">
                                                    Drag image
                                                </div>
                                            )}
                                            {isCoverUpdating && (
                                                <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm">
                                                    <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-slate-950/80 px-5 py-4 text-sm font-bold text-white shadow-2xl">
                                                        <Loader2 className="h-5 w-5 animate-spin text-royal-gold" />
                                                        <span>{message || "Updating your cover image..."}</span>
                                                    </div>
                                                </div>
                                            )}
                                            {!coverPositionEvent && (
                                            <div className="absolute right-6 top-6 z-10 flex flex-wrap justify-end gap-2">
                                                {activeEventDetailEvent && (
                                                    <>
                                                        <button
                                                            onClick={() => handleToggleCoverMode(activeEventDetailEvent)}
                                                            disabled={status === "uploading"}
                                                            className="flex items-center gap-2 rounded-full border border-white/30 bg-slate-950/40 px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg backdrop-blur-md transition-colors hover:bg-slate-950/60 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            <RefreshCw className="h-4 w-4" />
                                                            <span>{(activeEventDetailEvent.coverMode || "fill") === "fill" ? "Fit" : "Fill"}</span>
                                                        </button>
                                                        {(activeEventDetailEvent.coverMode || "fill") === "fill" && (
                                                            <button
                                                                onClick={() => openCoverPosition(activeEventDetailEvent)}
                                                                disabled={status === "uploading"}
                                                                className="flex items-center gap-2 rounded-full border border-white/30 bg-slate-950/40 px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg backdrop-blur-md transition-colors hover:bg-slate-950/60 disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                <Settings className="h-4 w-4" />
                                                                <span>Position</span>
                                                            </button>
                                                        )}
                                                    </>
                                                )}
                                                <label className="flex cursor-pointer items-center gap-2 rounded-full border border-white/30 bg-slate-950/40 px-4 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg backdrop-blur-md transition-colors hover:bg-slate-950/60">
                                                    <Camera className="h-4 w-4" />
                                                    <span>Change Cover</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleMainEventCoverUpload}
                                                        className="hidden"
                                                        disabled={status === "uploading"}
                                                    />
                                                </label>
                                                <button
                                                    onClick={() => activeEventDetailEvent && handleRemoveCoverForEvent(activeEventDetailEvent)}
                                                    disabled={status === "uploading"}
                                                    className="rounded-full border border-rose-300/40 bg-rose-500/20 px-4 py-2 text-xs font-black uppercase tracking-widest text-rose-100 shadow-lg backdrop-blur-md transition-colors hover:bg-rose-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    Remove Cover
                                                </button>
                                            </div>
                                            )}
                                            <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                                                <h3 className="text-3xl font-bold text-white sm:text-4xl">{activeEventDetailEvent?.title || selectedMainEvent.title}</h3>
                                                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-300">
                                                        <Calendar className="h-4 w-4 text-amber-300" />
                                                        <span>{formatEventDate(activeEventDetailEvent?.date || selectedMainEvent.date)}</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            onClick={(e) => activeEventDetailEvent && handleRenameClick(e, activeEventDetailEvent, "title")}
                                                            className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white backdrop-blur-md transition-colors hover:bg-white/20"
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                            <span>Edit Title</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => activeEventDetailEvent && handleRenameClick(e, activeEventDetailEvent, "date")}
                                                            className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white backdrop-blur-md transition-colors hover:bg-white/20"
                                                        >
                                                            <Calendar className="h-4 w-4" />
                                                            <span>Edit Date</span>
                                                        </button>
                                                        <button
                                                            onClick={() => activeEventDetailEvent && handleShareEventLink(activeEventDetailEvent)}
                                                            className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-white backdrop-blur-md transition-colors hover:bg-white/20"
                                                        >
                                                            <Share2 className="h-4 w-4" />
                                                            <span>Share</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 rounded-[1.75rem] border border-white/10 bg-neutral-950/90 p-2 sm:grid-cols-4">
                                        <button
                                            onClick={() => setActiveEventDetailTab("galleries")}
                                            className="group flex min-h-28 flex-col items-start justify-between rounded-[1.35rem] border border-white/10 bg-neutral-900 p-4 text-left transition-colors hover:bg-neutral-800"
                                        >
                                            <span className={cn(
                                                "flex h-10 w-10 items-center justify-center rounded-2xl",
                                                activeEventDetailTab === "galleries" ? "bg-amber-400 text-slate-950" : "bg-amber-400/10 text-amber-300"
                                            )}>
                                                <Camera className="h-5 w-5" />
                                            </span>
                                            <span>
                                                <span className="block text-base font-black text-white">Galleries</span>
                                                <span className="mt-1 block text-xs font-bold text-slate-400">Photos and albums</span>
                                            </span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                setActiveEventDetailTab("permissions");
                                                setManageMode("list");
                                            }}
                                            className="group relative flex min-h-28 flex-col items-start justify-between rounded-[1.35rem] border border-white/10 bg-neutral-900 p-4 text-left transition-colors hover:bg-neutral-800"
                                        >
                                            <span className={cn(
                                                "flex h-10 w-10 items-center justify-center rounded-2xl",
                                                activeEventDetailTab === "permissions" ? "bg-amber-400 text-slate-950" : "bg-amber-400/10 text-amber-300"
                                            )}>
                                                <ShieldCheck className="h-5 w-5" />
                                            </span>
                                            <span>
                                                <span className="block text-base font-black text-white">Permissions</span>
                                                <span className="mt-1 block text-xs font-bold text-slate-400">Guest access</span>
                                            </span>
                                            {eventDetailLogs.filter(log => log.status === "pending").length > 0 && (
                                                <span className="absolute right-4 top-4 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-950">
                                                    {eventDetailLogs.filter(log => log.status === "pending").length}
                                                </span>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => {
                                                setActiveEventDetailTab("design");
                                                setManageMode("list");
                                            }}
                                            className="group flex min-h-28 flex-col items-start justify-between rounded-[1.35rem] border border-white/10 bg-neutral-900 p-4 text-left transition-colors hover:bg-neutral-800"
                                        >
                                            <span className={cn(
                                                "flex h-10 w-10 items-center justify-center rounded-2xl",
                                                activeEventDetailTab === "design" ? "bg-amber-400 text-slate-950" : "bg-amber-400/10 text-amber-300"
                                            )}>
                                                <LayoutDashboard className="h-5 w-5" />
                                            </span>
                                            <span>
                                                <span className="block text-base font-black text-white">Design</span>
                                                <span className="mt-1 block text-xs font-bold text-slate-400">Theme and style</span>
                                            </span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                setActiveEventDetailTab("partners");
                                                setManageMode("list");
                                            }}
                                            className="group flex min-h-28 flex-col items-start justify-between rounded-[1.35rem] border border-white/10 bg-neutral-900 p-4 text-left transition-colors hover:bg-neutral-800"
                                        >
                                            <span className={cn(
                                                "flex h-10 w-10 items-center justify-center rounded-2xl",
                                                activeEventDetailTab === "partners" ? "bg-amber-400 text-slate-950" : "bg-amber-400/10 text-amber-300"
                                            )}>
                                                <Users className="h-5 w-5" />
                                            </span>
                                            <span>
                                                <span className="block text-base font-black text-white">Partners</span>
                                                <span className="mt-1 block text-xs font-bold text-slate-400">Linked vendors</span>
                                            </span>
                                        </button>
                                    </div>

                                    <div className={cn(
                                        "rounded-[2rem] border border-white/10 bg-neutral-950 p-5 sm:p-6",
                                        isInlineEventDetailGalleryEditor && "hidden"
                                    )}>
                                        {activeEventDetailTab === "galleries" && (
                                            <div className="space-y-5">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <h4 className="text-xl font-black text-white">Galleries</h4>
                                                        <p className="text-sm font-bold text-slate-400">Primary gallery and sub-galleries for this event.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setIsCreateSubGalleryModalOpen(true)}
                                                        className="flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-950 transition-transform hover:-translate-y-0.5"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                        <span>Add Sub-Gallery</span>
                                                    </button>
                                                </div>

                                                <div className="space-y-6">
                                                    <section className="space-y-3">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Primary Gallery</p>
                                                        <div className="flex flex-wrap gap-4">
                                                            <div 
                                                                className={cn(
                                                                    "group relative overflow-hidden rounded-[1.5rem] border shadow-lg transition-all cursor-pointer hover:border-amber-400/50 w-full sm:w-[280px] aspect-square flex-shrink-0",
                                                                    selectedEventId === selectedMainEvent.id && manageMode === "add-image"
                                                                        ? "border-amber-400/70 shadow-amber-950/10"
                                                                        : "border-slate-700 shadow-slate-950/10"
                                                                )}
                                                                onClick={() => openUploadForEvent(selectedMainEvent.id, selectedMainEvent.title)}
                                                            >
                                                                <img
                                                                    src={resolveEventCoverImage(selectedMainEvent.coverImage, 'thumbnail')}
                                                                    alt={selectedMainEvent.title}
                                                                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                                />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />
                                                                
                                                                <div className="absolute inset-0 p-3 flex flex-col justify-between">
                                                                    <div className="flex">
                                                                        <div className="flex items-center gap-1 rounded-lg bg-black/65 border border-white/20 px-2 py-1">
                                                                            <Home className="h-2.5 w-2.5 text-white/90" />
                                                                            <span className="text-[9px] font-bold tracking-wider text-white/90">PRIMARY</span>
                                                                        </div>
                                                                    </div>
                                                                    
                                                                    <div className="flex items-end justify-between gap-2">
                                                                        <div className="min-w-0 flex-1">
                                                                            <h5 className="text-[13px] font-bold text-white drop-shadow-md line-clamp-2 leading-tight">{selectedMainEvent.title || 'Home'}</h5>
                                                                        </div>
                                                                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 border border-white/30 backdrop-blur-sm transition-colors group-hover:bg-white/30">
                                                                            <ChevronRight className="h-3 w-3 text-white" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {eventFavouriteCount > 0 && (
                                                                <div
                                                                    className="group relative overflow-hidden rounded-[1.5rem] border border-amber-400/60 shadow-lg shadow-amber-950/20 transition-all cursor-pointer hover:border-amber-300 w-full sm:w-[280px] aspect-square flex-shrink-0"
                                                                    onClick={() => window.open(`/events/${selectedMainEvent.id}#favourite`, "_blank")}
                                                                >
                                                                    <img
                                                                        src={eventFavouritePreview?.thumbnailUrl || eventFavouritePreview?.url || selectedMainEvent.coverImage || DEFAULT_EVENT_COVER_IMAGE}
                                                                        alt="Favourite photos"
                                                                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                                    />
                                                                    <div className="absolute inset-0 bg-gradient-to-t from-amber-950/95 via-black/40 to-transparent pointer-events-none" />

                                                                    <div className="absolute inset-0 p-3 flex flex-col justify-between">
                                                                        <div className="flex">
                                                                            <div className="flex items-center gap-1 rounded-lg bg-amber-400 text-slate-950 border border-amber-200 px-2 py-1">
                                                                                <Star className="h-2.5 w-2.5 fill-current" />
                                                                                <span className="text-[9px] font-black tracking-wider">FAVOURITE</span>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-end justify-between gap-2">
                                                                            <div className="min-w-0 flex-1">
                                                                                <h5 className="text-[13px] font-bold text-white drop-shadow-md line-clamp-2 leading-tight">Favourite</h5>
                                                                                <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-100">{eventFavouriteCount} photos selected</p>
                                                                            </div>
                                                                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 border border-white/30 backdrop-blur-sm transition-colors group-hover:bg-white/30">
                                                                                <ChevronRight className="h-3 w-3 text-white" />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </section>

                                                    <section className="space-y-3">
                                                        <div className="flex items-center justify-between gap-3">
                                                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Sub-Galleries</p>
                                                        </div>

                                                        {loadingEventDetail ? (
                                                            <div className="flex items-center justify-center rounded-[1.5rem] border border-slate-700 p-8 text-slate-400">
                                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                                <span className="text-sm font-bold">Loading sub-galleries...</span>
                                                            </div>
                                                        ) : eventDetailGalleries.length > 0 ? (
                                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                                                {eventDetailGalleries.map((gallery) => (
                                                                    <div
                                                                        key={gallery.id}
                                                                        className={cn(
                                                                            "group relative aspect-square overflow-hidden rounded-[1.5rem] border shadow-lg transition-all cursor-pointer hover:border-amber-400/50",
                                                                            selectedEventId === gallery.id && manageMode === "add-image"
                                                                                ? "border-amber-400/70 shadow-amber-950/10"
                                                                                : "border-slate-700 shadow-slate-950/10"
                                                                        )}
                                                                        onClick={() => openUploadForEvent(gallery.id, gallery.title)}
                                                                    >
                                                                        <img
                                                                            src={resolveEventCoverImage(gallery.coverImage || selectedMainEvent.coverImage, 'thumbnail')}
                                                                            alt={gallery.title}
                                                                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                                        />
                                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent pointer-events-none" />
                                                                        
                                                                        <div className="absolute inset-0 p-3 flex flex-col justify-between">
                                                                            <div className="flex justify-between items-start">
                                                                                <div className="flex items-center gap-1 rounded-lg bg-black/65 border border-white/20 px-2 py-1">
                                                                                    <ImageIcon className="h-2.5 w-2.5 text-white/90" />
                                                                                    <span className="text-[9px] font-bold tracking-wider text-white/90">SUB-GALLERY</span>
                                                                                </div>
                                                                                <div className="flex gap-2 relative z-20">
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(gallery.id); }}
                                                                                        className="flex h-6 w-6 items-center justify-center rounded-full bg-black/65 border border-white/15 backdrop-blur-sm transition-colors shadow-sm hover:bg-black"
                                                                                    >
                                                                                        <Trash2 className="h-3 w-3 text-red-500" />
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                            
                                                                            <div className="flex items-end justify-between gap-2">
                                                                                <div className="min-w-0 flex-1">
                                                                                    <h5 className="text-[13px] font-bold text-white drop-shadow-md line-clamp-2 leading-tight">{gallery.title}</h5>
                                                                                </div>
                                                                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 border border-white/30 backdrop-blur-sm transition-colors group-hover:bg-white/30">
                                                                                    <ChevronRight className="h-3 w-3 text-white" />
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="rounded-[1.5rem] border border-dashed border-slate-700 bg-slate-900/30 p-8 text-center">
                                                                <ImageIcon className="mx-auto mb-3 h-8 w-8 text-slate-500" />
                                                                <p className="text-sm font-bold text-slate-400">No sub-galleries created yet.</p>
                                                            </div>
                                                        )}
                                                    </section>

                                                    <div className="pt-6 flex justify-center">
                                                        <button
                                                            onClick={() => setShowDeleteConfirm(selectedMainEvent.id)}
                                                            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-8 py-3 text-sm font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/20 transition-colors"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                            <span>Delete Event</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {activeEventDetailTab === "permissions" && (
                                            <div className="space-y-5">
                                                <div>
                                                    <h4 className="text-xl font-black text-white">Permissions</h4>
                                                    <p className="text-sm font-bold text-slate-400">Approve, deny, or remove guest access requests for this event.</p>
                                                </div>

                                                {loadingEventDetail ? (
                                                    <div className="flex items-center justify-center rounded-[1.5rem] border border-slate-700 p-8 text-slate-400">
                                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                        <span className="text-sm font-bold">Loading permissions...</span>
                                                    </div>
                                                ) : eventDetailVisibleLogsCount > 0 ? (
                                                    <div className="space-y-6">
                                                        {eventDetailPendingLogs.length > 0 && (
                                                            <section className="space-y-3">
                                                                <h5 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                                                                    Pending Requests ({eventDetailPendingLogs.length})
                                                                </h5>
                                                                {eventDetailPendingLogs.map(renderEventDetailPermissionCard)}
                                                            </section>
                                                        )}

                                                        {eventDetailAdminLogs.length > 0 && (
                                                            <section className="space-y-3">
                                                                <h5 className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">
                                                                    Admins ({eventDetailAdminLogs.length})
                                                                </h5>
                                                                {eventDetailAdminLogs.map(renderEventDetailPermissionCard)}
                                                            </section>
                                                        )}

                                                        {eventDetailMemberLogs.length > 0 && (
                                                            <section className="space-y-3">
                                                                <h5 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                                                                    Members ({eventDetailMemberLogs.length})
                                                                </h5>
                                                                {eventDetailMemberLogs.map(renderEventDetailPermissionCard)}
                                                            </section>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="rounded-[1.5rem] border border-dashed border-slate-700 p-8 text-center">
                                                        <p className="text-sm font-bold text-slate-400">No guest requests for this event yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {activeEventDetailTab === "design" && (
                                            <div className="space-y-4">
                                                <h4 className="text-xl font-black text-white mb-2">Event Design</h4>

                                                <div 
                                                    onClick={() => setShowCategoryModal(true)}
                                                    className="flex items-center justify-between rounded-[1.2rem] border border-slate-700 bg-slate-900/50 p-4 cursor-pointer hover:border-amber-400/50 transition-colors"
                                                >
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Event Type</p>
                                                        <p className="text-base font-bold text-white">{selectedMainEvent.category || 'Select Type'}</p>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-amber-400" />
                                                </div>

                                                <div 
                                                    onClick={() => {
                                                        setTemplateTargetEvent(selectedMainEvent);
                                                        setShowTemplateModal(true);
                                                    }}
                                                    className="flex items-center justify-between rounded-[1.2rem] border border-slate-700 bg-slate-900/50 p-4 cursor-pointer hover:border-amber-400/50 transition-colors"
                                                >
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Change Template</p>
                                                        <p className="text-base font-bold text-white">
                                                            {selectedMainEvent.templateId ? TEMPLATE_THEMES.find(t => t.id === selectedMainEvent.templateId)?.label : 'Hero (Default)'}
                                                        </p>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-amber-400" />
                                                </div>

                                                <div 
                                                    onClick={() => window.open(`/event/${selectedMainEvent.id}`, '_blank')}
                                                    className="flex items-center justify-between rounded-[1.2rem] border border-amber-500/30 bg-amber-500/10 p-4 cursor-pointer hover:bg-amber-500/20 transition-colors mt-2"
                                                >
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Preview Guest Theme</p>
                                                        <p className="text-xs font-medium text-slate-300 mt-1">
                                                            See how guests view your {selectedMainEvent.templateId ? TEMPLATE_THEMES.find(t => t.id === selectedMainEvent.templateId)?.label : 'Hero'} theme
                                                        </p>
                                                    </div>
                                                    <Eye className="h-4 w-4 text-amber-500" />
                                                </div>
                                            </div>
                                        )}

                                        {activeEventDetailTab === "partners" && (
                                            <div className="space-y-5">
                                                <div>
                                                    <h4 className="text-xl font-black text-white">Partners</h4>
                                                    <p className="text-sm font-bold text-slate-400">Linked vendors and event partners for this event.</p>
                                                </div>

                                                {(selectedMainEvent.vendors?.length || 0) > 0 ? (
                                                    <div className="grid gap-3 sm:grid-cols-2">
                                                        {selectedMainEvent.vendors?.map((vendorId) => (
                                                            <div key={vendorId} className="rounded-[1.5rem] border border-slate-700 bg-slate-900/50 p-4">
                                                                <p className="text-sm font-black text-white">Vendor</p>
                                                                <p className="mt-1 break-all text-xs font-bold text-slate-400">{vendorId}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="rounded-[1.5rem] border border-dashed border-slate-700 p-8 text-center">
                                                        <Users className="mx-auto mb-3 h-8 w-8 text-slate-500" />
                                                        <p className="text-sm font-bold text-slate-400">No partners linked to this event yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {message && (
                                        <div className={cn(
                                            "rounded-2xl p-4 text-center text-sm font-bold",
                                            status === "success" ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
                                        )}>
                                            {message}
                                        </div>
                                    )}
                                </div>
                            )}

                            {manageMode === "list" && manageLevel !== "event-details" && (
                                <div className="space-y-8">
                                    {loadingEvents ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                            {Array.from({ length: 3 }).map((_, i) => (
                                                <div key={i} className="animate-pulse bg-slate-800 aspect-[4/5] rounded-3xl" />
                                            ))}
                                        </div>
                                    ) : userEvents.length === 0 ? (
                                        <div className="py-20 bg-slate-800 rounded-3xl border border-dashed border-slate-600 flex flex-col items-center justify-center text-center">
                                            <div className="w-20 h-20 bg-slate-900/50 rounded-full flex items-center justify-center mb-6">
                                                <Camera className="w-10 h-10 text-slate-400" />
                                            </div>
                                            <h3 className="text-xl font-bold mb-2">No galleries found</h3>
                                            <p className="text-stone-700 max-w-xs mx-auto mb-8 font-sans">Create your first event by clicking the button above.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-12">
                                            {renderEventSection(manageLevel === "events" ? "Your Created Events" : "Your Created Galleries", createdEvents)}
                                            {renderEventSection(manageLevel === "events" ? "Shared Events" : "Shared Galleries", legacySharedEvents, true)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {manageMode === "add-event" && manageLevel === "events" && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="max-w-lg mx-auto bg-slate-800 p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-slate-700"
                                >
                                    <div className="flex items-center justify-between mb-8">
                                        <h3 className="text-2xl font-bold italic tracking-tight">New Event</h3>
                                        <Tooltip text="Back to list">
                                            <button
                                                onClick={() => {
                                                    const params = new URLSearchParams(searchParams);
                                                    params.set("mode", "list");
                                                    params.delete("galleryId");
                                                    goBackOr(`/host?${params.toString()}`);
                                                }}
                                                className="text-slate-400 hover:text-slate-400 transition-colors"
                                            >
                                                <ChevronLeft className="w-6 h-6" />
                                            </button>
                                        </Tooltip>
                                    </div>

                                    <form onSubmit={handleCreateEventOnly} className="space-y-8">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-700 mb-4 ml-1">
                                                What is the occasion?
                                            </label>
                                            <input
                                                type="text"
                                                value={eventName}
                                                onChange={(e) => setEventName(e.target.value)}
                                                placeholder="e.g. Dream Wedding 2024"
                                                className="w-full px-6 py-5 bg-slate-900/50 border border-slate-700 rounded-3xl focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all outline-none text-xl font-medium"
                                                required
                                                autoFocus
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-700 mb-4 ml-1">
                                                Date
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => openDatePicker("create")}
                                                className="flex w-full items-center justify-between px-6 py-5 bg-slate-900/50 border border-slate-700 rounded-3xl focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all outline-none text-xl font-medium text-left"
                                            >
                                                <span className={eventDate ? "text-white" : "text-slate-500"}>
                                                    {eventDate || "Select event date"}
                                                </span>
                                                <ChevronDown className="h-5 w-5 text-slate-400" />
                                            </button>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-700 mb-4 ml-1">Event Type</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {EVENT_TYPE_OPTIONS.map(({ name, icon: Icon }) => {
                                                    const isSelected = eventType === name;
                                                    return (
                                                        <button
                                                            key={name}
                                                            type="button"
                                                            onClick={() => {
                                                                setEventType(name);
                                                                const newTemplates = getTemplatesForEventCategory(name);
                                                                if (newTemplates.length > 0) setSelectedTemplate(newTemplates[0].id);
                                                            }}
                                                            className={cn(
                                                                "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-black transition-colors",
                                                                isSelected
                                                                    ? "border-amber-400 bg-amber-400 text-slate-950"
                                                                    : "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-amber-400/60"
                                                            )}
                                                        >
                                                            <Icon className="h-4 w-4" />
                                                            <span>{name}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-700 mb-4 ml-1">Choose Style</label>
                                            <div className="flex flex-col gap-3 max-h-[40vh] overflow-y-auto pr-2">
                                                {getTemplatesForEventCategory(eventType).map((template) => {
                                                    const isActive = selectedTemplate === template.id;
                                                    return (
                                                        <div
                                                            key={template.id}
                                                            onClick={() => setSelectedTemplate(template.id)}
                                                            className={cn(
                                                                "flex items-center justify-between p-3 rounded-2xl border-2 transition-colors cursor-pointer",
                                                                isActive ? "bg-slate-900 border-sky-500 shadow-md" : "bg-slate-900/50 border-slate-700 hover:border-slate-500"
                                                            )}
                                                            style={{ borderColor: isActive ? template.accent : undefined }}
                                                        >
                                                            <div className="flex items-center gap-3 flex-1">
                                                                <div 
                                                                    className="w-10 h-10 rounded-full flex items-center justify-center border border-slate-700 shadow-sm"
                                                                    style={{ backgroundColor: template.background?.light || '#fff' }}
                                                                >
                                                                    <div 
                                                                        className="w-3.5 h-3.5 rounded-full shadow-sm"
                                                                        style={{ backgroundColor: template.accent || '#000' }}
                                                                    />
                                                                </div>
                                                                
                                                                <div className="flex-1 mr-2">
                                                                    <div 
                                                                        className="text-sm font-bold font-outfit"
                                                                        style={{ color: isActive ? template.accent : '#334155' }}
                                                                    >
                                                                        {template.label}
                                                                    </div>
                                                                    <div className="text-[11px] text-slate-500 font-inter mt-0.5 truncate">
                                                                        {template.desc}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {isActive && (
                                                                <div 
                                                                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                                                                    style={{ backgroundColor: template.accent }}
                                                                >
                                                                    <Check className="w-3 h-3 text-white" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={status === "uploading"}
                                            className={cn(
                                                "w-full py-5 rounded-[1.5rem] font-bold text-lg shadow-lg transition-all flex items-center justify-center space-x-3 active:scale-95",
                                                status === "uploading" ? "bg-stone-300 text-stone-700 cursor-not-allowed" : "bg-slate-900 text-white hover:bg-slate-800"
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

                            <AnimatePresence>
                                {isCreateSubGalleryModalOpen && (
                                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                            className="w-full max-w-md bg-[#1a1a1a] p-8 rounded-[2rem] shadow-2xl border border-white/5 my-8 relative"
                                        >
                                            <div className="flex items-center justify-between mb-8">
                                                <h3 className="text-2xl font-bold text-white tracking-tight">New Sub-Gallery</h3>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsCreateSubGalleryModalOpen(false)}
                                                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0"
                                                >
                                                    <X className="w-4 h-4 text-white" />
                                                </button>
                                            </div>

                                            <form 
                                                onSubmit={async (e) => {
                                                    // Pass true to skip the success modal
                                                    const success = await handleCreateEventOnly(e, true);
                                                    if (success) {
                                                        setIsCreateSubGalleryModalOpen(false);
                                                    }
                                                }} 
                                                className="space-y-6"
                                            >
                                                <div>
                                                    <input
                                                        type="text"
                                                        value={eventName}
                                                        onChange={(e) => setEventName(e.target.value)}
                                                        placeholder="Sub-gallery name"
                                                        className="w-full px-5 py-4 bg-[#262626] border border-white/5 rounded-2xl focus:ring-1 focus:ring-amber-500 transition-all outline-none text-base text-white placeholder-slate-400"
                                                        required
                                                        autoFocus
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-300 mb-3 ml-1">
                                                        SUB-GALLERY DATE
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => openDatePicker("create")}
                                                        className="flex w-full items-center justify-between px-5 py-4 bg-[#262626] border border-white/5 rounded-2xl focus:ring-1 focus:ring-amber-500 transition-all outline-none text-base text-left"
                                                    >
                                                        <div className="flex items-center">
                                                            <Calendar className="w-5 h-5 text-amber-500 mr-3" />
                                                            <span className={eventDate ? "text-white" : "text-slate-400"}>
                                                                {eventDate || "Select event date"}
                                                            </span>
                                                        </div>
                                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                                    </button>
                                                </div>

                                                <button
                                                    type="submit"
                                                    disabled={status === "uploading"}
                                                    className={cn(
                                                        "w-full py-4 mt-2 rounded-2xl font-bold text-[15px] transition-all flex items-center justify-center space-x-3 active:scale-95",
                                                        status === "uploading" 
                                                            ? "bg-[#806316]/50 text-black/50 cursor-not-allowed" 
                                                            : "bg-[#806316] text-[#2c2203] hover:bg-[#96741b]"
                                                    )}
                                                >
                                                    {status === "uploading" ? (
                                                        <>
                                                            <Loader2 className="w-5 h-5 animate-spin" />
                                                            <span>Creating...</span>
                                                        </>
                                                    ) : (
                                                        <span>Create Sub-Gallery</span>
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
                                    </div>
                                )}
                            </AnimatePresence>

                            {manageMode === "add-image" && (manageLevel !== "event-details" || activeEventDetailTab === "galleries") && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    onDragEnter={handleGalleryDrag}
                                    onDragOver={handleGalleryDrag}
                                    onDragLeave={handleGalleryDrag}
                                    onDrop={handleGalleryDrop}
                                    className={cn(
                                        "relative max-w-7xl mx-auto bg-slate-800 p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-slate-700 transition-colors",
                                        isDraggingPhotos && "border-amber-400 bg-slate-800/95",
                                        isInlineEventDetailGalleryEditor && "mt-8"
                                    )}
                                >
                                    {isDraggingPhotos && (
                                        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-[2.5rem] border-2 border-dashed border-amber-400 bg-slate-950/70 backdrop-blur-sm">
                                            <div className="flex flex-col items-center text-center">
                                                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-lg">
                                                    <Upload className="h-8 w-8" />
                                                </div>
                                                <p className="text-lg font-black text-white">
                                                    {galleryMediaTab === "videos" ? "Drop videos to upload" : "Drop images to upload"}
                                                </p>
                                                <p className="mt-1 text-sm font-bold text-slate-300">They will be added to {selectedEventName}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sub-event Cover Banner */}
                                    {!isInlineEventDetailGalleryEditor && (
                                    <div
                                        ref={(node) => {
                                            if (activeSubEvent && coverPositionEvent?.id === activeSubEvent.id) {
                                                coverPreviewRef.current = node;
                                            }
                                        }}
                                        className={cn(
                                            "relative w-full h-64 md:h-80 rounded-[2rem] overflow-hidden mb-8 group/cover shadow-md border border-slate-700",
                                            activeSubEvent && coverPositionEvent?.id === activeSubEvent.id && "cursor-grab active:cursor-grabbing"
                                        )}
                                        onPointerDown={activeSubEvent && coverPositionEvent?.id === activeSubEvent.id ? handleCoverPointerDown : undefined}
                                        onPointerMove={activeSubEvent && coverPositionEvent?.id === activeSubEvent.id ? handleCoverPointerMove : undefined}
                                        onPointerUp={activeSubEvent && coverPositionEvent?.id === activeSubEvent.id ? handleCoverPointerEnd : undefined}
                                        onPointerCancel={activeSubEvent && coverPositionEvent?.id === activeSubEvent.id ? handleCoverPointerEnd : undefined}
                                        style={activeSubEvent && coverPositionEvent?.id === activeSubEvent.id ? { touchAction: "none" } : undefined}
                                    >
                                        <img
                                            src={coverUrl}
                                            alt={`${selectedEventName} Cover`}
                                            draggable={false}
                                            className="w-full h-full select-none transition-transform duration-700 group-hover/cover:scale-105"
                                            style={getCoverImageStyle(activeSubEvent)}
                                        />
                                        {/* Elegant dark overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/40 transition-opacity duration-300" />
                                        {activeSubEvent && coverPositionEvent?.id === activeSubEvent.id && (
                                            <div className="pointer-events-none absolute inset-x-6 top-6 z-20 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.2em] text-white/90 backdrop-blur-md">
                                                Drag image
                                            </div>
                                        )}
                                        {isCoverUpdating && (
                                            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm">
                                                <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-slate-950/80 px-5 py-4 text-sm font-bold text-white shadow-2xl">
                                                    <Loader2 className="h-5 w-5 animate-spin text-sky-300" />
                                                    <span>{message || "Updating your cover image..."}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Floating Glassmorphic "Change Cover" Button */}
                                        {!coverPositionEvent && (
                                        <div className="absolute top-6 right-6 z-10">
                                            <label className="flex items-center space-x-2 px-5 py-3 bg-slate-800/20 hover:bg-slate-800/30 active:bg-slate-800/40 backdrop-blur-md text-white rounded-full text-sm font-bold cursor-pointer transition-all border border-white/30 shadow-lg active:scale-95">
                                                <Camera className="w-4 h-4" />
                                                <span>Change Cover</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleSubEventCoverUpload}
                                                    className="hidden"
                                                    disabled={status === "uploading"}
                                                />
                                            </label>
                                        </div>
                                        )}

                                        {/* Information overlay */}
                                        <div className="absolute bottom-6 left-8 right-8 flex items-end justify-between">
                                            <div className="text-white">
                                                <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-sky-400">Sub-Event Cover</span>
                                                <div className="flex items-center space-x-3 mt-1">
                                                    <h4 className="text-2xl md:text-3xl font-bold font-serif tracking-tight">{selectedEventName}</h4>
                                                    <button
                                                        onClick={(e) => {
                                                            if (activeSubEvent) {
                                                                handleRenameClick(e, activeSubEvent);
                                                            }
                                                        }}
                                                        className="p-1.5 bg-slate-800/20 hover:bg-slate-800/30 backdrop-blur-md rounded-lg text-white transition-all active:scale-95 border border-white/20"
                                                        title="Rename sub-event"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                {activeSubEvent?.date && (
                                                    <p className="text-xs text-stone-200 mt-1.5 font-sans flex items-center gap-1.5">
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-royal-gold" />
                                                        {activeSubEvent.date}
                                                     </p>
                                                 )}
                                            </div>
                                        </div>
                                    </div>
                                    )}

                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
                                        <div>
                                            <h3 className="text-3xl font-bold tracking-tight">Gallery Editor</h3>
                                            <p className="text-slate-700 font-sans mt-1">Managing memories for <span className="text-white font-bold underline decoration-royal-gold decoration-2 underline-offset-4">{selectedEventName}</span></p>
                                        </div>
                                        <div className="flex items-center space-x-3">
                                            {/* View Toggle */}
                                            <div className="bg-slate-900/50 p-1 rounded-2xl flex items-center">
                                                <Tooltip text="Grid View">
                                                    <button
                                                        onClick={() => setGalleryViewMode("grid")}
                                                        className={cn(
                                                            "p-2 rounded-xl transition-all",
                                                            galleryViewMode === "grid" ? "bg-slate-800 shadow-sm text-white" : "text-slate-400 hover:text-slate-400"
                                                        )}
                                                    >
                                                        <LayoutGrid className="w-5 h-5" />
                                                    </button>
                                                </Tooltip>
                                                <Tooltip text="List View">
                                                    <button
                                                        onClick={() => setGalleryViewMode("list")}
                                                        className={cn(
                                                            "p-2 rounded-xl transition-all",
                                                            galleryViewMode === "list" ? "bg-slate-800 shadow-sm text-white" : "text-slate-400 hover:text-slate-400"
                                                        )}
                                                    >
                                                        <List className="w-5 h-5" />
                                                    </button>
                                                </Tooltip>
                                            </div>

                                            <Tooltip text="Back to galleries">
                                                <button
                                                    onClick={() => {
                                                        const fallbackParams = new URLSearchParams(searchParams);
                                                        fallbackParams.set("mode", "list");
                                                        fallbackParams.delete("galleryId");

                                                        if (isInlineEventDetailGalleryEditor) {
                                                            goBackOr(`/host?${fallbackParams.toString()}`);
                                                            setMessage("");
                                                            setStatus("idle");
                                                            return;
                                                        }

                                                        goBackOr(`/host?${fallbackParams.toString()}`);
                                                    }}
                                                    className="p-3 bg-slate-900/50 hover:bg-slate-600 text-slate-400 hover:text-slate-400 rounded-2xl transition-all active:scale-95"
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

                                    {isInlineEventDetailGalleryEditor && activeEventDetailEvent && (
                                        <div className="mb-8 rounded-3xl border border-amber-400/25 bg-white/[0.04] p-5">
                                            <div className="mb-3 flex items-end justify-between gap-4">
                                                <div>
                                                    <p className="text-sm font-black tracking-wide text-white">Welcome Message</p>
                                                    <p className="mt-1 text-xs font-bold text-slate-400">
                                                        For: {activeEventDetailEvent.id === selectedMainEvent?.id ? "Primary Gallery" : activeEventDetailEvent.title}
                                                    </p>
                                                </div>
                                                <span className={cn(
                                                    "text-xs font-bold",
                                                    galleryMessageText.length >= 200 ? "text-rose-300" : "text-slate-400"
                                                )}>
                                                    {galleryMessageText.length}/200
                                                </span>
                                            </div>
                                            <textarea
                                                value={galleryMessageText}
                                                onChange={(event) => setGalleryMessageText(event.target.value.slice(0, 200))}
                                                placeholder="Write a brief, elegant welcome note..."
                                                maxLength={200}
                                                className="min-h-24 w-full resize-none rounded-2xl border border-amber-400/20 bg-slate-950/50 p-4 text-sm font-semibold leading-6 text-white outline-none transition-colors placeholder:text-slate-500 focus:border-amber-400/60"
                                            />
                                            <div className="mt-3 flex justify-end">
                                                <button
                                                    onClick={handleSaveGalleryMessage}
                                                    disabled={!hasGalleryMessageChanges || status === "uploading"}
                                                    className={cn(
                                                        "flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest transition-all active:scale-95",
                                                        hasGalleryMessageChanges && status !== "uploading"
                                                            ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
                                                            : "bg-slate-800 text-slate-500"
                                                    )}
                                                >
                                                    {status === "uploading" && message.toLowerCase().includes("gallery message") ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <Check className="h-4 w-4" />
                                                    )}
                                                    <span>{hasGalleryMessageChanges ? "Save" : "Saved"}</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-6 rounded-2xl border border-slate-700 bg-slate-900/60 p-1">
                                        {mediaTabs.map(({ id, label, icon: Icon }) => {
                                            const active = galleryMediaTab === id;
                                            return (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    onClick={() => setGalleryMediaTab(id)}
                                                    className={cn(
                                                        "inline-flex w-1/2 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition-colors",
                                                        active ? "bg-amber-400 text-slate-950" : "text-slate-300 hover:bg-slate-800"
                                                    )}
                                                >
                                                    <Icon className="h-4 w-4" />
                                                    <span>{label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {isInlineEventDetailGalleryEditor && activeEventDetailEvent && activeEventDetailEvent.id !== selectedMainEvent?.id && (
                                        <div className="mb-6 flex justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setShowDeleteConfirm(activeEventDetailEvent.id)}
                                                className="flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-xs font-black uppercase tracking-widest text-rose-300"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                <span>Delete Gallery</span>
                                            </button>
                                        </div>
                                    )}

                                    {galleryViewMode === "grid" ? (
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                            {/* Existing Photos Grid */}
                                            {activeGalleryItems.map((photo, index) => {
                                                const isCover = stripUrlQuery(userEvents.find(ev => ev.id === selectedEventId)?.coverImage) === stripUrlQuery(photo.url);
                                                const isVideo = photo.mediaType === "video" || photo.resourceType === "video";
                                                const gridSrc = !isVideo ? (photo.thumbnailUrl || `${photo.url}-thumbnail.webp`) : photo.url;
                                                const shouldBlurMediaForPlan = shouldWarnExpiredPlanMedia && !currentEventRetainedMediaIds.has(photo.id);
                                                const isFavourite = eventFavouritePhotoIds.has(photo.id);
                                                return (
                                                    <motion.div
                                                        key={photo.id}
                                                        layout
                                                        className="group relative aspect-square bg-stone-100 shadow-sm border border-slate-700 cursor-zoom-in"
                                                        onClick={() => {
                                                            setViewingPhoto({
                                                                id: photo.id,
                                                                src: photo.url,
                                                                storageKey: photo.storageKey,
                                                                width: photo.width,
                                                                height: photo.height,
                                                                filename: photo.storageKey?.split('/').pop() || (isVideo ? "video" : "photo"),
                                                                thumbnailUrl: photo.thumbnailUrl,
                                                                mediaType: isVideo ? "video" : "photo",
                                                                resourceType: isVideo ? "video" : "image"
                                                            });
                                                        }}
                                                    >
                                                        {/* Inner Clipping Container for Photo */}
                                                        <div className="absolute inset-0 overflow-hidden">
                                                            <GridMediaCell 
                                                                photo={photo}
                                                                gridSrc={gridSrc}
                                                                isVideo={isVideo}
                                                                shouldBlurMediaForPlan={shouldBlurMediaForPlan} onThumbnailLoaded={handleThumbnailLoaded}
                                                            />
                                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            {shouldBlurMediaForPlan && (
                                                                <div className="pointer-events-none absolute left-1/2 top-14 z-20 w-[calc(100%-1.5rem)] -translate-x-1/2 rounded-2xl border border-amber-300/50 bg-slate-950/95 px-3 py-2 text-center text-[10px] font-black uppercase leading-4 tracking-[0.08em] text-amber-100 shadow-2xl shadow-black/50 backdrop-blur-md">
                                                                    Plan expired<br />
                                                                    <span className="text-[9px] text-amber-200/90">May be deleted after grace period</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {!isVideo && (
                                                        <div className="absolute top-3 left-3 z-10">
                                                            <Tooltip text="Photo actions">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setPhotoActionItem(photo);
                                                                    }}
                                                                    className="p-2.5 bg-slate-800/90 backdrop-blur-md rounded-xl text-white shadow-lg opacity-0 transition-all active:scale-90 group-hover:opacity-100 hover:bg-slate-700"
                                                                >
                                                                    <MoreHorizontal className="w-4 h-4" />
                                                                </button>
                                                            </Tooltip>
                                                        </div>
                                                        )}
                                                        {!isVideo && (
                                                            <div className="absolute top-3 right-14 z-10">
                                                                <Tooltip text={isFavourite ? "Remove from Favourite" : "Add to Favourite"}>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleToggleEventFavourite(photo.id);
                                                                        }}
                                                                        className={cn(
                                                                            "p-2.5 backdrop-blur-md rounded-xl shadow-lg transition-all active:scale-95",
                                                                            isFavourite
                                                                                ? "bg-amber-400 text-slate-950 opacity-100"
                                                                                : "bg-slate-800/90 text-white opacity-0 group-hover:opacity-100 hover:bg-amber-400 hover:text-slate-950"
                                                                        )}
                                                                    >
                                                                        <Star className={cn("w-4 h-4", isFavourite && "fill-current")} />
                                                                    </button>
                                                                </Tooltip>
                                                            </div>
                                                        )}
                                                        <div className="absolute top-3 right-3 z-10">
                                                            <Tooltip text={isVideo ? "Delete Video" : "Delete Image"}>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleDeletePhoto(photo.id);
                                                                    }}
                                                                    className="p-2.5 bg-slate-800/90 backdrop-blur-md rounded-xl text-red-500 shadow-lg opacity-0 group-hover:opacity-100 transition-all active:scale-95 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </Tooltip>
                                                        </div>
                                                        {activeGalleryItems.length > 1 && (
                                                            <div className="absolute bottom-3 left-3 z-10 flex overflow-hidden rounded-full border border-slate-700 bg-slate-950/80 text-white shadow-lg backdrop-blur-md">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        moveGalleryMedia(photo.id, -1);
                                                                    }}
                                                                    disabled={index === 0}
                                                                    className="px-3 py-2 text-xs font-black disabled:opacity-30"
                                                                    aria-label="Move media backward"
                                                                >
                                                                    ↑
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        moveGalleryMedia(photo.id, 1);
                                                                    }}
                                                                    disabled={index === activeGalleryItems.length - 1}
                                                                    className="border-l border-slate-700 px-3 py-2 text-xs font-black disabled:opacity-30"
                                                                    aria-label="Move media forward"
                                                                >
                                                                    ↓
                                                                </button>
                                                            </div>
                                                        )}

                                                    </motion.div>
                                                );
                                            })}

                                            {/* Loading Skeletons for current fetching */}
                                            {loadingPhotos && activeGalleryItems.length === 0 && (
                                                Array.from({ length: 4 }).map((_, i) => (
                                                    <div key={i} className="aspect-square bg-slate-900/50 rounded-[2rem] animate-pulse border border-slate-700" />
                                                ))
                                            )}

                                            {/* Add Image Button */}
                                            <motion.label
                                                layout
                                                className={cn(
                                                    "relative aspect-square rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-slate-900/50 group",
                                                    status === "uploading" ? "border-sky-500/50 bg-sky-500/5" : "border-slate-700"
                                                )}
                                                title="Click to select photos to upload"
                                            >
                                                    <input
                                                        type="file"
                                                        multiple
                                                        accept={galleryMediaTab === "videos" ? "video/*" : "image/*"}
                                                        onChange={handleFileUpload}
                                                    className="hidden"
                                                    disabled={status === "uploading"}
                                                />
                                                {status === "uploading" ? (
                                                    <div className="flex flex-col items-center text-sky-400">
                                                        <Loader2 className="w-10 h-10 animate-spin mb-3" />
                                                        <span className="text-xs font-bold uppercase tracking-widest">Adding...</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center text-slate-400 group-hover:text-white transition-colors">
                                                        <div className="p-4 bg-slate-900/50 rounded-2xl mb-3 group-hover:bg-slate-800 group-hover:shadow-md transition-all">
                                                            <Plus className="w-8 h-8" />
                                                        </div>
                                                        <span className="text-xs font-bold uppercase tracking-widest">
                                                            {galleryMediaTab === "videos" ? "Add or Drop Videos" : "Add or Drop Photos"}
                                                        </span>
                                                    </div>
                                                )}
                                            </motion.label>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Add Image Option as List Item */}
                                            <motion.label
                                                className={cn(
                                                    "flex items-center p-6 border-2 border-dashed rounded-3xl cursor-pointer transition-all hover:bg-slate-900/50 group",
                                                    status === "uploading" ? "border-sky-500/50 bg-sky-500/5" : "border-slate-700"
                                                )}
                                            >
                                                <input
                                                    type="file"
                                                    multiple
                                                    accept={galleryMediaTab === "videos" ? "video/*" : "image/*"}
                                                    onChange={handleFileUpload}
                                                    className="hidden"
                                                    disabled={status === "uploading"}
                                                />
                                                <div className="w-16 h-16 bg-slate-900/50 rounded-2xl flex items-center justify-center mr-6 group-hover:bg-slate-800 transition-all">
                                                    {status === "uploading" ? (
                                                        <Loader2 className="w-6 h-6 text-sky-400 animate-spin" />
                                                    ) : (
                                                        <Plus className="w-6 h-6 text-slate-400 group-hover:text-white" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-200">
                                                        {galleryMediaTab === "videos" ? "Add New Videos" : "Add New Photos"}
                                                    </p>
                                                    <p className="text-sm text-slate-400">
                                                        {galleryMediaTab === "videos" ? "Click to upload videos, or drag them here" : "Click to upload memories, or drag images here"}
                                                    </p>
                                                </div>
                                            </motion.label>

                                            <div className="bg-slate-800 rounded-[2.5rem] border border-slate-700 overflow-hidden shadow-sm">
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-slate-900/50/50 border-b border-slate-700">
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">Preview</th>
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">Technical Details</th>
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-slate-400">Metadata</th>
                                                                <th className="px-8 py-6 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-stone-50">
                                                            {activeGalleryItems.map((photo, index) => {
                                                                const isVideo = photo.mediaType === "video" || photo.resourceType === "video";
                                                                const isCover = stripUrlQuery(userEvents.find(ev => ev.id === selectedEventId)?.coverImage) === stripUrlQuery(photo.url);
                                                                const gridSrc = !isVideo ? (photo.thumbnailUrl || `${photo.url}-thumbnail.webp`) : photo.url;
                                                                const shouldBlurMediaForPlan = shouldWarnExpiredPlanMedia && !currentEventRetainedMediaIds.has(photo.id);
                                                                const isFavourite = eventFavouritePhotoIds.has(photo.id);
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
                                                                    <tr key={photo.id} className="hover:bg-slate-900/50/50 transition-colors group">
                                                                        <td className="px-8 py-6">
                                                                            <div
                                                                                className="w-32 h-32 rounded-[1.5rem] overflow-hidden cursor-zoom-in shadow-md border border-slate-700 group-hover:scale-105 transition-transform"
                                                                                onClick={() => {
                                                                                    setViewingPhoto({
                                                                                        id: photo.id,
                                                                                        src: photo.url,
                                                                                        storageKey: photo.storageKey,
                                                                                        width: photo.width,
                                                                                        height: photo.height,
                                                                                        filename: photo.storageKey?.split('/').pop() || (isVideo ? "video" : "photo"),
                                                                                        thumbnailUrl: photo.thumbnailUrl,
                                                                                        mediaType: isVideo ? "video" : "photo",
                                                                                        resourceType: isVideo ? "video" : "image"
                                                                                    });
                                                                                }}
                                                                            >
                                                                                <GridMediaCell 
                                                                                    photo={photo}
                                                                                    gridSrc={gridSrc}
                                                                                    isVideo={isVideo}
                                                                                    shouldBlurMediaForPlan={shouldBlurMediaForPlan}
                                                                                    onThumbnailLoaded={handleThumbnailLoaded}
                                                                                />
                                                                                {shouldBlurMediaForPlan && (
                                                                                    <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-amber-300/50 bg-slate-950/95 px-2 py-2 text-center text-[9px] font-black uppercase leading-4 tracking-[0.08em] text-amber-100 shadow-2xl shadow-black/50 backdrop-blur-md">
                                                                                        Plan expired<br />
                                                                                        <span className="text-[8px] text-amber-200/90">May be deleted after grace period</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-8 py-6">
                                                                            <div className="space-y-1.5">
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-slate-400 w-20">Resolution:</span>
                                                                                    <span className="font-bold text-slate-700">{photo.width && photo.height ? `${photo.width} × ${photo.height}` : 'N/A'}</span>
                                                                                </div>
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-slate-400 w-20">File Size:</span>
                                                                                    <span className={cn("font-bold text-slate-700", !photo.size && "text-slate-400 font-normal italic")}>
                                                                                        {formatSize(photo.size)}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-slate-400 w-20">Format:</span>
                                                                                    <span className="font-bold text-slate-700 uppercase">{displayFormat || 'N/A'}</span>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-8 py-6">
                                                                            <div className="space-y-1.5">
                                                                                <div className="flex items-center text-xs">
                                                                                    <span className="text-slate-400 w-20">Added On:</span>
                                                                                    <span className="font-bold text-slate-700">{dateAdded}</span>
                                                                                </div>
                                                                                <div className="flex items-center space-x-2 pt-1">
                                                                                    {!isVideo && isCover && (
                                                                                        <span className="px-2 py-0.5 bg-sky-500/10 text-sky-400 text-[9px] font-bold uppercase rounded-md border border-sky-500/20">
                                                                                            Gallery Thumb
                                                                                        </span>
                                                                                    )}
                                                                                    {!isVideo && stripUrlQuery(selectedMainEvent?.coverImage) === stripUrlQuery(photo.url) && (
                                                                                        <span className="px-2 py-0.5 bg-slate-900/10 text-white text-[9px] font-bold uppercase rounded-md border border-slate-900/20">
                                                                                            Event Thumb
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-8 py-6 text-right">
                                                                            <div className="flex items-center justify-end space-x-2">
                                                                                {activeGalleryItems.length > 1 && (
                                                                                    <div className="flex overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => moveGalleryMedia(photo.id, -1)}
                                                                                            disabled={index === 0}
                                                                                            className="px-3 py-2 text-xs font-black text-slate-300 disabled:opacity-30"
                                                                                            aria-label="Move media backward"
                                                                                        >
                                                                                            ↑
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => moveGalleryMedia(photo.id, 1)}
                                                                                            disabled={index === activeGalleryItems.length - 1}
                                                                                            className="border-l border-slate-700 px-3 py-2 text-xs font-black text-slate-300 disabled:opacity-30"
                                                                                            aria-label="Move media forward"
                                                                                        >
                                                                                            ↓
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                                {!isVideo && (
                                                                                <Tooltip text="Photo actions">
                                                                                    <button
                                                                                        onClick={() => setPhotoActionItem(photo)}
                                                                                        className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 transition-all active:scale-95 hover:bg-slate-700 hover:text-white"
                                                                                    >
                                                                                        <MoreHorizontal className="w-4 h-4" />
                                                                                    </button>
                                                                                </Tooltip>
                                                                                )}
                                                                                {!isVideo && (
                                                                                    <Tooltip text={isFavourite ? "Remove from Favourite" : "Add to Favourite"}>
                                                                                        <button
                                                                                            onClick={() => handleToggleEventFavourite(photo.id)}
                                                                                            className={cn(
                                                                                                "p-2.5 rounded-xl border transition-all active:scale-95",
                                                                                                isFavourite
                                                                                                    ? "border-amber-400 bg-amber-400 text-slate-950"
                                                                                                    : "border-slate-700 bg-slate-800 text-slate-300 hover:bg-amber-400 hover:text-slate-950"
                                                                                            )}
                                                                                        >
                                                                                            <Star className={cn("w-4 h-4", isFavourite && "fill-current")} />
                                                                                        </button>
                                                                                    </Tooltip>
                                                                                )}
                                                                                <Tooltip text="Delete Image">
                                                                                    <button
                                                                                        onClick={() => handleDeletePhoto(photo.id)}
                                                                                        className="p-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-400 transition-all active:scale-95 hover:bg-red-50 hover:text-red-500"
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
                                                {activeGalleryItems.length === 0 && !loadingPhotos && (
                                                    <div className="p-12 text-center">
                                                        <p className="text-slate-400 italic">
                                                            {galleryMediaTab === "videos" ? "No videos in this gallery yet." : "No photos in this gallery yet."}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {hasMorePhotos && (
                                        <div className="flex justify-center mt-12 mb-8">
                                            <button 
                                                onClick={loadMorePhotos} 
                                                disabled={loadingPhotos}
                                                className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-full font-bold shadow-lg flex items-center space-x-2 transition-all border border-slate-700"
                                            >
                                                {loadingPhotos ? <Loader2 className="w-5 h-5 animate-spin text-sky-400" /> : <ChevronDown className="w-5 h-5 text-sky-400" />}
                                                <span>{loadingPhotos ? "Loading..." : "Load More Photos"}</span>
                                            </button>
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
                                                <h2 className="text-3xl font-bold mb-1 font-serif text-slate-200">Permissions & Traffic</h2>
                                                <p className="text-slate-700 font-sans text-sm">Manage your team and monitor guest access.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        {/* Primary Admins Section */}
                                        <div className="bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-700">
                                            <div className="flex items-center justify-between mb-8">
                                                <div>
                                                    <h3 className="text-2xl font-bold text-slate-200 font-serif">Premium Users (Primary)</h3>
                                                    <p className="text-slate-400 text-sm font-sans uppercase tracking-widest mt-1">Full account management access</p>
                                                </div>
                                                <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-slate-300">
                                                    <Crown size={24} />
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                {allUsers.filter(u => (u.delegatedBy === user?.uid || u.id === user?.uid) && (u.roleType === 'primary' || u.id === user?.uid)).length > 0 ? (
                                                    allUsers.filter(u => (u.delegatedBy === user?.uid || u.id === user?.uid) && (u.roleType === 'primary' || u.id === user?.uid)).map((u) => (
                                                        <div key={u.id} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-700 group hover:bg-slate-800 hover:shadow-md transition-all duration-300">
                                                            <div className="flex items-center space-x-4">
                                                                <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-base">
                                                                    {u.name.charAt(0)}
                                                                </div>
                                                                <div>
                                                                    <p className="text-slate-200 font-bold text-base">{u.name} {u.id === user?.uid && "(You)"}</p>
                                                                    <p className="text-slate-400 text-xs font-sans">{u.email}</p>
                                                                </div>
                                                            </div>
                                                            {u.id !== user?.uid && (
                                                                <button
                                                                    onClick={() => handleUpdateUserRole(u.id, "revoke")}
                                                                    className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                                                                >
                                                                    Revoke
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-10 text-center border-2 border-dashed border-slate-700 rounded-3xl">
                                                        <p className="text-slate-400 text-base font-sans italic">No premium users assigned yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Events Hierarchy Section */}
                                        <div className="bg-slate-800 p-8 rounded-[2.5rem] shadow-sm border border-slate-700">
                                            <div className="flex items-center justify-between mb-8">
                                                <div>
                                                    <h3 className="text-2xl font-bold text-slate-200 font-serif">Event Administrators & Guests</h3>
                                                    <p className="text-slate-400 text-sm font-sans uppercase tracking-widest mt-1">Management per event</p>
                                                </div>
                                                <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center text-slate-300">
                                                    <Calendar size={24} />
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {loadingEvents ? (
                                                    <div className="flex items-center justify-center py-12">
                                                        <RefreshCw className="w-8 h-8 animate-spin text-stone-300" />
                                                    </div>
                                                ) : permissionMainEvents.length > 0 ? (
                                                    [
                                                        { title: "Events Created by You", events: permissionCreatedEvents, groupByOwner: false },
                                                        { title: "Events Created by Others", events: permissionOtherEvents, groupByOwner: true }
                                                    ].filter(section => section.events.length > 0).map(section => (
                                                        <div key={section.title} className="space-y-3">
                                                            <div className="px-1">
                                                                <h4 className="text-lg font-bold text-slate-200 font-serif">{section.title}</h4>
                                                                <p className="text-xs text-slate-400 font-sans uppercase tracking-widest mt-1">
                                                                    {section.events.length} {section.events.length === 1 ? "event" : "events"}
                                                                </p>
                                                            </div>
                                                            {(section.groupByOwner
                                                                ? Object.entries(section.events.reduce<Record<string, Event[]>>((groups, event) => {
                                                                    const ownerEmail = getEventOwnerEmail(event);
                                                                    if (!groups[ownerEmail]) groups[ownerEmail] = [];
                                                                    groups[ownerEmail].push(event);
                                                                    return groups;
                                                                }, {}))
                                                                : [["", section.events] as [string, Event[]]]
                                                            ).map(([ownerEmail, events]) => (
                                                                <div key={ownerEmail || section.title} className="space-y-3">
                                                                    {section.groupByOwner && (
                                                                        <div className="px-1 pt-2">
                                                                            <h5 className="text-sm font-bold text-slate-200 font-sans">{ownerEmail}</h5>
                                                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                                                                {events.length} shared {events.length === 1 ? "event" : "events"}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    {events.map(event => {
                                                        const isMainExpanded = expandedMainEvents.has(event.id);
                                                        const isOtherUserEvent = !event.createdBy || !ownEventIdentifiers.has(event.createdBy);
                                                        const eventAdmins = allUsers.filter(u =>
                                                            u.delegatedBy === user?.uid &&
                                                            u.roleType === 'event' &&
                                                            u.assignedEvents?.includes(event.id)
                                                        );
                                                        const eventLogs = trafficLogs.filter(log => (log.parentEventId === event.id || log.eventId === event.id));
                                                        const pendingCount = eventLogs.filter(l => l.status === 'pending').length;

                                                        return (
                                                            <div key={event.id} className="relative">
                                                                {isMainExpanded && (eventAdmins.length > 0 || eventLogs.length > 0) && (
                                                                    <div className="absolute left-7 top-14 bottom-6 w-px bg-stone-100"></div>
                                                                )}
                                                                
                                                                <div className="flex items-center justify-between gap-4 p-4 sm:p-5 bg-slate-900/50/50 hover:bg-slate-800/50 rounded-[1.5rem] transition-all border border-slate-700/50 group/event">
                                                                    <div className="flex items-center flex-1">
                                                                        <button
                                                                            onClick={() => toggleMainEvent(event.id)}
                                                                            className={cn(
                                                                                "mr-3 w-8 h-8 flex items-center justify-center rounded-lg transition-all",
                                                                                isMainExpanded ? "bg-slate-200 text-slate-700" : "bg-slate-800 text-slate-400 hover:text-slate-300 border border-slate-700"
                                                                            )}
                                                                        >
                                                                            {isMainExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                        </button>
                                                                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mr-3 shadow-sm">
                                                                            <Calendar className="w-5 h-5 text-slate-400" />
                                                                        </div>
                                                                        <div>
                                                                            {isOtherUserEvent && !section.groupByOwner && (
                                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                                                                    Shared by {getEventOwnerEmail(event)}
                                                                                </p>
                                                                            )}
                                                                            <span className="text-base font-bold text-slate-200">{event.title}</span>
                                                                            <div className="flex items-center space-x-2 mt-1">
                                                                                {event.isSampleGallery && (
                                                                                    <span className="text-xs text-royal-gold font-bold">• Sample</span>
                                                                                )}
                                                                                {eventAdmins.length > 0 && (
                                                                                    <span className="text-xs text-teal-600 font-bold">• {eventAdmins.length} Admin{eventAdmins.length > 1 ? "s" : ""}</span>
                                                                                )}
                                                                                {eventLogs.length > 0 && (
                                                                                    <span className="text-xs text-amber-400 font-bold">• {eventLogs.length} Visit{eventLogs.length > 1 ? "s" : ""}</span>
                                                                                )}
                                                                                {pendingCount > 0 && (
                                                                                    <span className="text-xs text-rose-500 font-bold">• {pendingCount} Pending</span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {user?.role === "admin" && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(buttonEvent) => {
                                                                                buttonEvent.stopPropagation();
                                                                                handleToggleSampleGallery(event);
                                                                            }}
                                                                            disabled={sampleGalleryUpdating === event.id}
                                                                            className={cn(
                                                                                "shrink-0 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-50",
                                                                                event.isSampleGallery
                                                                                    ? "border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                                                                                    : "border border-royal-gold/30 bg-royal-gold/10 text-royal-gold hover:bg-royal-gold/20"
                                                                            )}
                                                                        >
                                                                            {sampleGalleryUpdating === event.id ? "Updating..." : event.isSampleGallery ? "Remove from Samples" : "Add to Samples"}
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {isMainExpanded && (
                                                                    <div className="pl-12 pr-4 py-3 space-y-5">
                                                                        {/* Event Admins */}
                                                                        <div className="mb-2">
                                                                            <div 
                                                                                className="flex items-center space-x-1 text-xs font-bold text-teal-600 uppercase tracking-widest mb-2 px-1 cursor-pointer hover:text-teal-700 transition-colors w-fit"
                                                                                onClick={() => toggleEventAdmins(event.id)}
                                                                            >
                                                                                {expandedEventAdmins.has(event.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                                <UserCog className="w-3.5 h-3.5" />
                                                                                <span>Event Admins ({eventAdmins.length})</span>
                                                                            </div>
                                                                            {expandedEventAdmins.has(event.id) && (
                                                                                <div className="mt-2 space-y-2 pl-4 border-l border-teal-100 ml-2">
                                                                                    {eventAdmins.length > 0 ? (
                                                                                        eventAdmins.map(ea => (
                                                                                            <div key={ea.id} className="flex items-center p-3 bg-slate-800 border border-slate-700 rounded-xl group/ea hover:border-slate-700 transition-all">
                                                                                                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center mr-3">
                                                                                                    <UserCog className="w-4 h-4 text-teal-600" />
                                                                                                </div>
                                                                                                <div>
                                                                                                    <span className="text-sm font-bold text-slate-200">{ea.name || "Unnamed"}</span>
                                                                                                    <p className="text-xs text-slate-400">{ea.email}</p>
                                                                                                </div>
                                                                                                <div className="ml-auto flex items-center gap-2">
                                                                                                    <button
                                                                                                        onClick={() => handleUpdateUserRole(ea.id, "user", "primary", [])}
                                                                                                        className="px-3 py-2 bg-sky-500/10 text-sky-400 text-[10px] font-bold uppercase rounded-lg hover:bg-royal-gold/20 transition-colors"
                                                                                                    >
                                                                                                        Make Primary Admin
                                                                                                    </button>
                                                                                                    <button
                                                                                                        onClick={() => handleUpdateUserRole(ea.id, "revoke")}
                                                                                                        className="px-3 py-2 bg-rose-50 text-rose-600 text-[10px] font-bold uppercase rounded-lg hover:bg-rose-100 transition-colors flex items-center gap-1"
                                                                                                        title="Revoke Admin"
                                                                                                    >
                                                                                                        <UserMinus size={14} />
                                                                                                        <span>Make Guest</span>
                                                                                                    </button>
                                                                                                </div>
                                                                                            </div>
                                                                                        ))
                                                                                    ) : (
                                                                                        <p className="text-xs text-slate-400 italic px-2">No admins assigned.</p>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Event Guests */}
                                                                        <div className="mb-2">
                                                                            <div 
                                                                                className="flex items-center space-x-1 text-xs font-bold text-amber-400 uppercase tracking-widest mb-2 px-1 cursor-pointer hover:text-amber-400 transition-colors w-fit"
                                                                                onClick={() => toggleEventGuests(event.id)}
                                                                            >
                                                                                {expandedEventGuests.has(event.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                                                                <Users className="w-3.5 h-3.5" />
                                                                                <span>Guest Users ({eventLogs.length})</span>
                                                                            </div>
                                                                            {expandedEventGuests.has(event.id) && (
                                                                                <div className="mt-2 space-y-2 pl-4 border-l border-amber-500/30 ml-2">
                                                                                    {eventLogs.length > 0 ? (
                                                                                        [...eventLogs].sort((a, b) => b.loginAt?.seconds - a.loginAt?.seconds).map(log => {
                                                                                            const loginDate = log.loginAt ? new Date(log.loginAt.seconds * 1000).toLocaleString('en-IN', {
                                                                                                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                                                                            }) : 'Unknown';

                                                                                            const isEmailMethod = log.phone?.includes('@');
                                                                                            const displayMethod = isEmailMethod ? "Email" : "Mobile";
                                                                                            
                                                                                            // Find matching registered user to allow admin promotion
                                                                                            const matchingUser = allUsers.find(u => 
                                                                                                (isEmailMethod && u.email === log.phone) || 
                                                                                                (!isEmailMethod && u.phone === log.phone)
                                                                                            );

                                                                                            const isPrimaryAdmin = matchingUser?.roleType === 'primary' && matchingUser?.delegatedBy === user?.uid;
                                                                                            const isEventAdmin = matchingUser?.roleType === 'event' && matchingUser?.delegatedBy === user?.uid && matchingUser?.assignedEvents?.includes(event.id);
                                                                                            const isAdmin = isPrimaryAdmin || isEventAdmin;

                                                                                            return (
                                                                                                <div key={log.id} className="flex items-center p-3 bg-slate-800 border border-slate-700 rounded-xl group/g hover:border-slate-700 transition-all">
                                                                                                    <div className="w-10 h-10 rounded-lg bg-amber-900/30 flex items-center justify-center mr-3">
                                                                                                        <span className="text-xs font-bold text-amber-400">{(log.name || 'G').charAt(0)}</span>
                                                                                                    </div>
                                                                                                    <div>
                                                                                                        <p className="font-bold text-slate-200 text-sm">{log.name || 'Anonymous'}</p>
                                                                                                        <div className="flex items-center space-x-2 text-xs text-slate-400 font-sans mt-0.5">
                                                                                                            <span className="truncate max-w-[150px]">{log.phone || 'N/A'}</span>
                                                                                                            <span>•</span>
                                                                                                            <span className="font-bold uppercase tracking-widest text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md text-[10px]">{displayMethod}</span>
                                                                                                            <span>•</span>
                                                                                                            <span>{loginDate}</span>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    <div className="ml-auto flex items-center space-x-2">
                                                                                                        {log.status === 'pending' ? (
                                                                                                            <>
                                                                                                                <button onClick={() => handleGuestStatusUpdate(log.id, 'approved')} className="px-4 py-2 bg-emerald-50 text-emerald-600 text-xs font-bold uppercase rounded-lg hover:bg-emerald-100 transition-all">Approve View</button>
                                                                                                                <button onClick={() => handleGuestStatusUpdate(log.id, 'rejected')} className="px-4 py-2 bg-rose-50 text-rose-600 text-xs font-bold uppercase rounded-lg hover:bg-rose-100 transition-all">Deny</button>
                                                                                                            </>
                                                                                                        ) : (
                                                                                                            <span className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest", log.status === 'approved' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600")}>
                                                                                                                {log.status === 'approved' ? 'View Access' : log.status}
                                                                                                            </span>
                                                                                                        )}

                                                                                                        {matchingUser && (
                                                                                                            <>
                                                                                                                <div className="h-4 w-px bg-stone-200 mx-1"></div>
                                                                                                                {isAdmin ? (
                                                                                                                    <>
                                                                                                                        <span className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-slate-700 text-slate-300">
                                                                                                                            {isPrimaryAdmin ? "Primary Admin" : "Event Admin"}
                                                                                                                        </span>
                                                                                                                        {isPrimaryAdmin ? (
                                                                                                                            <button
                                                                                                                                onClick={() => handleUpdateUserRole(matchingUser.id, "user", "event", [event.id])}
                                                                                                                                className="px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase rounded-lg hover:bg-slate-800 transition-all"
                                                                                                                            >
                                                                                                                                Make Event Admin
                                                                                                                            </button>
                                                                                                                        ) : (
                                                                                                                            <button
                                                                                                                                onClick={() => handleUpdateUserRole(matchingUser.id, "user", "primary", [])}
                                                                                                                                className="px-4 py-2 bg-sky-500/10 text-sky-400 text-xs font-bold uppercase rounded-lg hover:bg-royal-gold/20 transition-all"
                                                                                                                            >
                                                                                                                                Make Primary Admin
                                                                                                                            </button>
                                                                                                                        )}
                                                                                                                        <button 
                                                                                                                            onClick={() => handleUpdateUserRole(matchingUser.id, "revoke")}
                                                                                                                            className="px-4 py-2 bg-rose-50 text-rose-600 text-xs font-bold uppercase rounded-lg hover:bg-rose-100 transition-all"
                                                                                                                        >
                                                                                                                            Revoke
                                                                                                                        </button>
                                                                                                                    </>
                                                                                                                ) : (
                                                                                                                    <>
                                                                                                                        <button 
                                                                                                                            onClick={() => handleUpdateUserRole(matchingUser.id, "user", "event", [event.id])}
                                                                                                                            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold uppercase rounded-lg hover:bg-slate-800 transition-all"
                                                                                                                        >
                                                                                                                            Make Event Admin
                                                                                                                        </button>
                                                                                                                        <button 
                                                                                                                            onClick={() => handleUpdateUserRole(matchingUser.id, "user", "primary", [])}
                                                                                                                            className="px-4 py-2 bg-sky-500/10 text-sky-400 text-xs font-bold uppercase rounded-lg hover:bg-royal-gold/20 transition-all"
                                                                                                                        >
                                                                                                                            Make Primary Admin
                                                                                                                        </button>
                                                                                                                    </>
                                                                                                                )}
                                                                                                            </>
                                                                                                        )}

                                                                                                        <div className="h-4 w-px bg-stone-200 mx-1"></div>
                                                                                                        <button 
                                                                                                            onClick={() => handleGuestDelete(log.id)}
                                                                                                            className="p-1.5 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                                                                                            title="Remove Guest"
                                                                                                        >
                                                                                                            <Trash2 className="w-4 h-4" />
                                                                                                        </button>
                                                                                                    </div>
                                                                                                </div>
                                                                                            );
                                                                                        })
                                                                                    ) : (
                                                                                        <p className="text-xs text-slate-400 italic px-2">No guests recorded.</p>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                            })}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="py-8 text-center border-2 border-dashed border-slate-700 rounded-[2rem]">
                                                        <p className="text-slate-400 text-sm font-sans italic">No events created yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>


                {/* Category Selection Modal */}
                <AnimatePresence>
                    {showCategoryModal && selectedMainEvent && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center p-4"
                            onClick={() => setShowCategoryModal(false)}
                        >
                            <motion.div
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-md rounded-[2.5rem] bg-slate-900 border border-slate-800 p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
                            >
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-royal-gold to-rose-400" />
                                
                                <div className="flex items-center justify-between mb-6 mt-2">
                                    <div>
                                        <h2 className="text-2xl font-black text-white">Event Type</h2>
                                        <p className="text-sm font-medium text-slate-400 mt-1">Choose a category for your gallery</p>
                                    </div>
                                    <button 
                                        onClick={() => setShowCategoryModal(false)}
                                        className="rounded-full bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="overflow-y-auto pr-2 -mr-2 space-y-2 pb-4">
                                    {EVENT_TYPE_OPTIONS.map(({ name, icon: Icon }) => {
                                        const isActive = selectedMainEvent.category === name;
                                        // Match mobile colors
                                        const getCatColor = (n: string) => {
                                            if (n === 'Wedding') return '#ff4b72';
                                            if (n === 'Birthday') return '#3b82f6';
                                            if (n === 'Anniversary') return '#eab308';
                                            if (n === 'Corporate') return '#10b981';
                                            if (n === 'Sports') return '#06b6d4';
                                            if (n === 'College') return '#6366f1';
                                            return '#64748b'; // Other
                                        };
                                        const color = getCatColor(name);
                                        
                                        return (
                                            <button
                                                key={name}
                                                onClick={() => {
                                                    handleUpdateEventCategory(selectedMainEvent, name);
                                                    setShowCategoryModal(false);
                                                }}
                                                className={cn(
                                                    "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                                                    isActive 
                                                        ? "border-amber-400 bg-amber-400/10" 
                                                        : "border-slate-800 bg-slate-800/50 hover:border-slate-700 hover:bg-slate-800"
                                                )}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div 
                                                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                                                        style={{ backgroundColor: `${color}20` }}
                                                    >
                                                        <Icon className="h-5 w-5" style={{ color }} />
                                                    </div>
                                                    <span className={cn(
                                                        "text-base font-bold",
                                                        isActive ? "text-amber-400" : "text-slate-200"
                                                    )}>
                                                        {name}
                                                    </span>
                                                </div>
                                                {isActive && (
                                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-slate-950">
                                                        <Check className="h-4 w-4" />
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Template Selection Modal */}
                <AnimatePresence>
                    {showTemplateModal && templateTargetEvent && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4"
                            onClick={() => setShowTemplateModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                onClick={(e) => e.stopPropagation()}
                                className="bg-slate-800 w-full max-w-2xl rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-royal-gold to-rose-400" />

                                <div className="flex justify-between items-start mb-8 w-full">
                                    <div className="flex-1 mr-4">
                                        <h2 className="text-3xl font-serif text-white mb-2">Choose Style</h2>
                                        <p className="text-slate-700 font-sans">Select a design template for this event.</p>
                                    </div>
                                    <button 
                                        onClick={() => {
                                            setShowTemplateModal(false);
                                            setTemplateTargetEvent(null);
                                        }}
                                        className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors shrink-0 mt-1"
                                    >
                                        <X className="w-5 h-5 text-amber-400" />
                                    </button>
                                </div>

                                <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-2 pb-4">
                                    {getTemplatesForEventCategory(templateTargetEvent.category).map((template) => {
                                        const isActive = templateTargetEvent.templateId === template.id;
                                        return (
                                            <div
                                                key={template.id}
                                                onClick={() => handleUpdateTemplate(template.id)}
                                                className={cn(
                                                    "flex items-center justify-between p-3 rounded-2xl border-2 transition-colors cursor-pointer",
                                                    isActive ? "bg-white/5" : "bg-white/5 border-white/5 hover:border-white/20"
                                                )}
                                                style={{ borderColor: isActive ? template.accent : undefined }}
                                            >
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div 
                                                        className="w-10 h-10 rounded-full flex items-center justify-center border border-white/10"
                                                        style={{ backgroundColor: template.background?.dark || '#000' }}
                                                    >
                                                        <div 
                                                            className="w-3.5 h-3.5 rounded-full"
                                                            style={{ backgroundColor: template.accent || '#fff' }}
                                                        />
                                                    </div>
                                                    
                                                    <div className="flex-1 mr-2">
                                                        <div 
                                                            className="text-sm font-bold font-outfit"
                                                            style={{ color: isActive ? template.accent : '#fff' }}
                                                        >
                                                            {template.label}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 font-inter mt-0.5 truncate">
                                                            {template.desc}
                                                        </div>
                                                    </div>
                                                </div>

                                                {isActive && (
                                                    <div 
                                                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                                                        style={{ backgroundColor: template.accent }}
                                                    >
                                                        <Check className="w-3 h-3 text-black" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
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
                                className="bg-slate-800 rounded-[2.5rem] p-8 md:p-12 w-full max-w-md shadow-2xl"
                            >
                                <h3 className="text-2xl font-bold mb-6 italic tracking-tight">
                                    {editDetailsMode === "date"
                                        ? renamingEvent.type === "sub" ? "Edit Gallery Date" : "Edit Event Date"
                                        : renamingEvent.type === "sub" ? "Edit Gallery Title" : "Edit Event Title"}
                                </h3>
                                <form onSubmit={handleRenameSubmit} className="space-y-6">
                                    {editDetailsMode === "title" && (
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-400 mb-4 ml-1">New Name</label>
                                            <input
                                                type="text"
                                                value={newTitle}
                                                onChange={(e) => setNewTitle(e.target.value)}
                                                className="w-full px-6 py-4 bg-slate-900/50 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all outline-none text-lg font-medium text-white"
                                                required
                                                autoFocus
                                            />
                                        </div>
                                    )}
                                    {editDetailsMode === "date" && (
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-[0.2em] text-stone-400 mb-4 ml-1">Date</label>
                                            <button
                                                type="button"
                                                onClick={() => openDatePicker("rename")}
                                                className="flex w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/50 px-5 py-4 text-left transition-all hover:border-sky-500/60 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                                            >
                                                <span className="flex min-w-0 items-center gap-4">
                                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
                                                        <Calendar className="h-5 w-5" />
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Selected Date</span>
                                                        <span className="block truncate text-lg font-bold text-white">
                                                            {newDate ? formatEventDate(newDate) : "Tap to choose date"}
                                                        </span>
                                                    </span>
                                                </span>
                                                <span className="rounded-full bg-slate-800 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-300">
                                                    Change
                                                </span>
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex space-x-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRenamingEvent(null);
                                                setEditDetailsMode("title");
                                                setNewTitle("");
                                                setNewDate("");
                                            }}
                                            className="flex-1 py-4 px-6 border border-slate-700 rounded-2xl font-bold text-slate-400 hover:bg-slate-900/50 transition-all active:scale-95"
                                            title="Discard changes"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={status === "uploading"}
                                            className="flex-1 py-4 px-6 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all shadow-lg active:scale-95 disabled:bg-stone-300"
                                            title="Save changes"
                                        >
                                            {status === "uploading" ? "Saving..." : editDetailsMode === "date" ? "Save Date" : "Save Title"}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Plan Details Modal */}
                <AnimatePresence>
                    {showPlanDetailsModal && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                            <button
                                type="button"
                                aria-label="Close plan details"
                                onClick={() => setShowPlanDetailsModal(false)}
                                className="absolute inset-0 cursor-default"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.92, y: 18 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.92, y: 18 }}
                                className="relative w-full max-w-md overflow-hidden rounded-[2rem] border bg-slate-800 shadow-2xl"
                                style={{ borderColor: planDetails.accentSoft }}
                            >
                                <div className="px-7 pb-6 pt-7" style={{ background: `linear-gradient(to bottom, ${planDetails.accentSoft}, rgba(15, 23, 42, 0.2), transparent)` }}>
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
                                            style={{
                                                borderColor: planDetails.accentSoft,
                                                backgroundColor: planDetails.accentSoft,
                                                color: planDetails.accent,
                                            }}
                                        >
                                            <svg
                                                width="22"
                                                height="22"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="1.8"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                aria-hidden="true"
                                            >
                                                <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
                                                <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
                                                <line x1="6" x2="6.01" y1="6" y2="6" />
                                                <line x1="6" x2="6.01" y1="18" y2="18" />
                                            </svg>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-2xl font-black text-white">Storage & Quota</h3>
                                            <p className="text-sm font-semibold text-slate-400">Your current plan usage</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowPlanDetailsModal(false)}
                                            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/70 text-slate-400 transition-colors hover:text-white"
                                            aria-label="Close plan details"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <p className="mt-6 text-sm font-semibold text-slate-300">
                                        Active plan: <span className="font-black" style={{ color: planDetails.accent }}>{planDetails.name}</span>
                                    </p>
                                    {subscriptionStatus.message && (
                                        <div
                                            className={cn(
                                                "mt-5 rounded-2xl border p-4 text-sm font-semibold leading-6",
                                                subscriptionStatus.tone === "danger"
                                                    ? "border-rose-400/25 bg-rose-400/10 text-rose-100"
                                                    : "border-amber-400/25 bg-amber-400/10 text-amber-100"
                                            )}
                                        >
                                            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.16em]">
                                                {subscriptionStatus.label}
                                            </div>
                                            {subscriptionStatus.message}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-5 px-7 py-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-amber-300" />
                                                <span className="text-sm font-black text-slate-100">Storage</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="font-black text-white">{formatStorageSize(totalStorage)}</span>
                                                <span className="font-semibold text-slate-500">
                                                    / {planDetails.storageLabel}
                                                </span>
                                                <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-black text-amber-300">
                                                    {planDetails.storageBytes === Infinity ? "∞" : `${Math.round(storagePercent)}%`}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-slate-950">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-200"
                                                style={{ width: `${planDetails.storageBytes === Infinity ? 5 : storagePercent}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="h-px bg-slate-700/70" />

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2">
                                                <span className="h-2 w-2 rounded-full bg-indigo-400" />
                                                <span className="text-sm font-black text-slate-100">Events</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="font-black text-white">{totalMainEvents}</span>
                                                <span className="font-semibold text-slate-500">
                                                    / {planDetails.eventLabel}
                                                </span>
                                                <span className="rounded-full bg-indigo-400/10 px-2 py-1 text-[10px] font-black text-indigo-300">
                                                    {planDetails.eventLimit === Infinity ? "∞" : `${Math.round(eventPercent)}%`}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-slate-950">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-200"
                                                style={{ width: `${planDetails.eventLimit === Infinity ? 5 : eventPercent}%` }}
                                            />
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowPlanDetailsModal(false);
                                            router.push("/pricing");
                                        }}
                                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-4 text-sm font-black uppercase tracking-wide text-slate-950 transition-colors hover:bg-amber-300"
                                    >
                                        Manage Plan
                                        <ArrowRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Share Modal */}
                <AnimatePresence>
                    {shareModalEvent && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                            <button
                                type="button"
                                aria-label="Close share modal"
                                onClick={() => setShareModalEvent(null)}
                                className="absolute inset-0 cursor-default"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0.92, y: 18 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.92, y: 18 }}
                                className="relative w-full max-w-md rounded-[2rem] border border-amber-400/25 bg-slate-800 px-7 py-9 text-center shadow-2xl sm:px-10"
                            >
                                <h3 className="text-3xl font-black tracking-tight text-white">Share Event</h3>

                                <div className="mx-auto mt-7 w-full max-w-[250px] rounded-[2rem] bg-white p-6 shadow-xl">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareModalUrl)}`}
                                        alt={`QR code for ${shareModalEvent.title}`}
                                        className="mx-auto h-52 w-52 object-contain"
                                    />
                                    <p className="mt-3 text-xs font-black uppercase tracking-widest text-slate-950">Scan to Join</p>
                                </div>

                                <div className="mt-8">
                                    <p className="text-sm font-black uppercase tracking-widest text-slate-400">Unique Join ID</p>
                                    <div className="mx-auto mt-4 inline-flex min-w-56 items-center justify-center rounded-2xl border border-amber-400/40 px-8 py-4">
                                        <span className="text-3xl font-black uppercase tracking-[0.25em] text-amber-400">{shareModalJoinId}</span>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleShareInvitation}
                                    className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-amber-400 px-6 py-5 text-sm font-black uppercase tracking-wide text-slate-950 shadow-lg transition-all hover:bg-amber-300 active:scale-[0.98]"
                                >
                                    <Share2 className="h-5 w-5" />
                                    <span>Share Invitation</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShareModalEvent(null)}
                                    className="mt-7 text-lg font-semibold text-slate-400 transition-colors hover:text-white"
                                >
                                    Close
                                </button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Cover Position Toolbar */}
                <AnimatePresence>
                    {coverPositionEvent && (
                        <motion.div
                            initial={{ opacity: 0, y: -16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -16 }}
                            className="fixed left-1/2 top-24 z-[80] flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col gap-3 rounded-[1.5rem] border border-white/15 bg-slate-950/90 p-3 text-white shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="flex flex-col gap-1 px-2">
                                <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">Drag image</span>
                                <span className="truncate text-sm font-bold text-slate-300">{coverPositionEvent.title}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
                                    <button
                                        type="button"
                                        onClick={() => adjustCoverZoom(-0.1)}
                                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-white transition hover:bg-slate-700"
                                        aria-label="Zoom out"
                                    >
                                        -
                                    </button>
                                    <span className="min-w-14 text-center text-xs font-black text-white">{Math.round(coverDraft.coverScale * 100)}%</span>
                                    <button
                                        type="button"
                                        onClick={() => adjustCoverZoom(0.1)}
                                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-white transition hover:bg-slate-700"
                                        aria-label="Zoom in"
                                    >
                                        +
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        coverDragStartRef.current = null;
                                        setCoverPositionEvent(null);
                                    }}
                                    className="rounded-full border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-200 transition hover:bg-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveCoverPosition}
                                    className="rounded-full bg-amber-400 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-950 transition hover:bg-amber-300"
                                >
                                    Save
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Date Picker Modal */}
                <AnimatePresence>
                    {showDatePickerModal && (
                        <div
                            className="fixed inset-0 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                            style={{ zIndex: 10000 }}
                        >
                            <motion.div
                                initial={{ opacity: 0, scale: 0.92, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.92, y: 12 }}
                                className="relative w-full max-w-sm rounded bg-white p-6 text-slate-950 shadow-2xl"
                                style={{ zIndex: 10001 }}
                            >
                                <div className="grid grid-cols-3 gap-6">
                                    <DatePickerColumn
                                        options={DATE_PICKER_MONTHS.map((label, value) => ({ label, value }))}
                                        selectedValue={datePickerValue.month}
                                        onSelect={(month) => setDatePickerValue(prev => clampDatePickerValue({ ...prev, month }))}
                                    />
                                    <DatePickerColumn
                                        key={`${datePickerValue.month}-${datePickerValue.year}`}
                                        options={Array.from({ length: getDaysInMonth(datePickerValue.month, datePickerValue.year) }, (_, index) => ({
                                            label: String(index + 1).padStart(2, "0"),
                                            value: index + 1,
                                        }))}
                                        selectedValue={datePickerValue.day}
                                        onSelect={(day) => setDatePickerValue(prev => ({ ...prev, day }))}
                                    />
                                    <DatePickerColumn
                                        options={Array.from({ length: 201 }, (_, index) => {
                                            const value = 1950 + index;
                                            return { label: String(value), value };
                                        })}
                                        selectedValue={datePickerValue.year}
                                        onSelect={(year) => setDatePickerValue(prev => clampDatePickerValue({ ...prev, year }))}
                                    />
                                </div>

                                <div className="mt-10 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowDatePickerModal(false)}
                                        className="rounded-full px-5 py-3 text-sm font-black uppercase tracking-widest text-slate-800 transition-colors hover:bg-slate-100"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const formattedDate = formatDatePickerValue(datePickerValue);
                                            if (datePickerTarget === "create") {
                                                setEventDate(formatFriendlyDatePickerValue(datePickerValue));
                                            } else {
                                                setNewDate(formattedDate);
                                            }
                                            setShowDatePickerModal(false);
                                        }}
                                        className="rounded-full bg-slate-950 px-5 py-3 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-slate-800"
                                    >
                                        OK
                                    </button>
                                </div>
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
                                className="bg-white rounded-md p-6 w-full max-w-xs shadow-2xl"
                            >
                                {(() => {
                                    const eventToDelete = userEvents.find(e => e.id === showDeleteConfirm) || eventDetailGalleries.find(e => e.id === showDeleteConfirm);
                                    const itemType = eventToDelete?.type === "sub" ? "gallery" : "event";
                                    const itemTypeTitle = eventToDelete?.type === "sub" ? "Gallery" : "Event";
                                    return (
                                        <>
                                            <h3 className="text-[20px] font-medium mb-3 tracking-tight text-slate-900">Delete {itemTypeTitle}</h3>
                                            <p className="text-slate-600 mb-8 font-inter text-[15px] leading-relaxed">
                                                Are you sure you want to delete the {itemType} "{eventToDelete?.title}"? This will permanently remove all photos inside this {itemType}.
                                            </p>
                                            <div className="flex justify-end space-x-6">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowDeleteConfirm(null)}
                                                    className="font-bold text-teal-500 hover:text-teal-400 transition-colors uppercase text-sm tracking-wide"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteEvent(showDeleteConfirm)}
                                                    disabled={status === "uploading"}
                                                    className="font-bold text-teal-500 hover:text-teal-400 transition-colors uppercase text-sm tracking-wide disabled:opacity-50"
                                                >
                                                    {status === "uploading" ? "Deleting..." : "Delete"}
                                                </button>
                                            </div>
                                        </>
                                    );
                                })()}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Delete Success Modal */}
                <AnimatePresence>
                    {showDeleteSuccessType && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="bg-white rounded-md p-6 w-full max-w-xs shadow-2xl"
                            >
                                <h3 className="text-[20px] font-medium mb-3 tracking-tight text-slate-900">Success</h3>
                                <p className="text-slate-600 mb-8 font-inter text-[15px] leading-relaxed">
                                    {showDeleteSuccessType === "gallery" ? "Gallery" : "Event"} deleted successfully.
                                </p>
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteSuccessType(null)}
                                        className="font-bold text-teal-500 hover:text-teal-400 transition-colors uppercase text-sm tracking-wide"
                                    >
                                        OK
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
                {/* Image Preview Lightbox */}
                <Lightbox
                    isOpen={!!viewingPhoto}
                    photo={viewingPhoto ? (() => {
                        // Merge live photo data so HLSVideoPlayer gets the latest
                        // HLS URL if Realtime updated it after the lightbox was opened
                        const livePhoto = currentEventPhotos.find(p => p.id === viewingPhoto.id);
                        return {
                            ...viewingPhoto,
                            src: livePhoto?.url || viewingPhoto.src,
                            thumbnailUrl: livePhoto?.thumbnailUrl || viewingPhoto.thumbnailUrl,
                        };
                    })() : null}
                    onClose={() => setViewingPhoto(null)}
                    theme={getWebLightboxTheme(selectedMainEvent?.templateId)}
                    onRotate={(direction) => viewingPhoto?.id ? handleRotatePhoto(viewingPhoto.id, direction) : undefined}
                    isFavourite={!!viewingPhoto?.id && eventFavouritePhotoIds.has(viewingPhoto.id)}
                    onToggleFavourite={
                        viewingPhoto?.id && viewingPhoto.mediaType !== "video" && viewingPhoto.resourceType !== "video"
                            ? () => handleToggleEventFavourite(viewingPhoto.id)
                            : undefined
                    }
                    onNext={() => {
                        const currentIndex = activeGalleryItems.findIndex(p => p.id === viewingPhoto?.id);
                        if (currentIndex !== -1) {
                            const nextIndex = (currentIndex + 1) % activeGalleryItems.length;
                            const nextPhoto = activeGalleryItems[nextIndex];
                            const isVideo = nextPhoto.mediaType === "video" || nextPhoto.resourceType === "video";
                            setViewingPhoto({
                                id: nextPhoto.id,
                                src: nextPhoto.url,
                                storageKey: nextPhoto.storageKey,
                                width: nextPhoto.width,
                                height: nextPhoto.height,
                                filename: nextPhoto.storageKey?.split('/').pop() || (isVideo ? "video" : "photo"),
                                mediaType: isVideo ? "video" : "photo",
                                resourceType: isVideo ? "video" : "image"
                            });
                        }
                    }}
                    onPrev={() => {
                        const currentIndex = activeGalleryItems.findIndex(p => p.id === viewingPhoto?.id);
                        if (currentIndex !== -1) {
                            const prevIndex = (currentIndex - 1 + activeGalleryItems.length) % activeGalleryItems.length;
                            const prevPhoto = activeGalleryItems[prevIndex];
                            const isVideo = prevPhoto.mediaType === "video" || prevPhoto.resourceType === "video";
                            setViewingPhoto({
                                id: prevPhoto.id,
                                src: prevPhoto.url,
                                storageKey: prevPhoto.storageKey,
                                width: prevPhoto.width,
                                height: prevPhoto.height,
                                filename: prevPhoto.storageKey?.split('/').pop() || (isVideo ? "video" : "photo"),
                                mediaType: isVideo ? "video" : "photo",
                                resourceType: isVideo ? "video" : "image"
                            });
                        }
                    }}
                />

                <AnimatePresence>
                    {photoActionItem && (
                        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setPhotoActionItem(null)}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                                className="w-full max-w-md rounded-[2rem] border border-slate-700 bg-slate-900 p-6 shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="mb-5 flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-2xl font-black text-white">Photo Actions</h3>
                                        <p className="mt-1 text-sm font-bold text-slate-400">Choose where this photo should appear as a thumbnail.</p>
                                    </div>
                                    <button
                                        onClick={() => setPhotoActionItem(null)}
                                        className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    <button
                                        onClick={async () => {
                                            await handleSetAsCover(photoActionItem.url);
                                            setPhotoActionItem(null);
                                        }}
                                        className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-amber-400 px-5 py-4 text-left font-black text-slate-950 transition-transform active:scale-[0.98]"
                                    >
                                        <ImageIcon className="h-5 w-5 shrink-0" />
                                        <span>Make Gallery Thumbnail</span>
                                    </button>
                                    {selectedMainEvent && (
                                        <button
                                            onClick={async () => {
                                                await handleSetAsCover(photoActionItem.url, selectedMainEvent.id, true);
                                                setPhotoActionItem(null);
                                            }}
                                            className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-left font-black text-amber-300 transition-transform active:scale-[0.98]"
                                        >
                                            <Star className="h-5 w-5 shrink-0" />
                                            <span>Make Event Thumbnail</span>
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {selectedGuestLog && (
                        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setSelectedGuestLog(null)}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                                className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-slate-700 bg-slate-950 shadow-2xl"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className="bg-gradient-to-b from-slate-900 to-slate-950 px-6 py-6">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-amber-400 text-xl font-black text-slate-950">
                                            {selectedGuestProfile?.profileImage ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={selectedGuestProfile.profileImage} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                                (selectedGuestProfile?.name || selectedGuestLog.name || "G").charAt(0)
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="truncate text-2xl font-black text-white">{selectedGuestProfile?.name || selectedGuestLog.name || "Guest"}</h3>
                                            <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                                                Member #{String(eventDetailLogs.findIndex(log => log.id === selectedGuestLog.id) + 1).padStart(2, "0")}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedGuestLog(null)}
                                            className="rounded-full bg-slate-900 p-2 text-slate-400 transition-colors hover:text-white"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-5 p-6">
                                    <div className="rounded-[1.5rem] border border-slate-800 bg-slate-900/70 p-4">
                                        {loadingGuestProfile ? (
                                            <div className="flex items-center justify-center py-6 text-slate-400">
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                <span className="text-sm font-bold">Loading profile...</span>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {[
                                                    ["Profile Name", selectedGuestProfile?.name || selectedGuestLog.name || "Not set"],
                                                    ["Username", selectedGuestProfile?.username ? `@${selectedGuestProfile.username}` : "Not set"],
                                                    ["Email ID", selectedGuestProfile?.email || selectedGuestLog.email || (selectedGuestLog.phone?.includes("@") ? selectedGuestLog.phone : "") || "Not set"],
                                                    ["Phone Number", selectedGuestProfile?.phone || (!selectedGuestLog.phone?.includes("@") ? selectedGuestLog.phone : "") || "Not set"],
                                                ].map(([label, value]) => (
                                                    <div key={label} className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3 last:border-b-0 last:pb-0">
                                                        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</span>
                                                        <span className="min-w-0 truncate text-right text-sm font-bold text-slate-100">{value}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-amber-300">Member Privileges</p>
                                        <div className="space-y-3">
                                            {[
                                                { key: "viewAccess", label: "View Access", desc: "Can open and view this event gallery", icon: Eye },
                                                { key: "canAdmin", label: "Admin Access", desc: "Manage event, sub-galleries, and other guests", icon: ShieldCheck },
                                                { key: "canUpload", label: "Allow Uploads", desc: "Can add photos and videos to the event", icon: Camera },
                                                { key: "canComment", label: "Allow Comments", desc: "Can react and post comments on media", icon: MessageCircle },
                                            ].map(({ key, label, desc, icon: Icon }) => {
                                                const isViewAccess = key === "viewAccess";
                                                const permKey = key as "canAdmin" | "canUpload" | "canComment";
                                                const isActive = isViewAccess
                                                    ? selectedGuestLog.status === "approved"
                                                    : Boolean(selectedGuestLog[permKey] || (selectedGuestLog.canAdmin && (permKey === "canUpload" || permKey === "canComment")));

                                                return (
                                                    <button
                                                        key={key}
                                                        type="button"
                                                        onClick={() => {
                                                            if (isViewAccess) {
                                                                handleGuestViewAccessToggle(selectedGuestLog);
                                                                return;
                                                            }
                                                            handleGuestPermissionToggle(selectedGuestLog, permKey);
                                                        }}
                                                        className={cn(
                                                            "flex w-full items-center gap-4 rounded-[1.25rem] border p-4 text-left transition-colors",
                                                            isActive ? "border-amber-400/45 bg-amber-400/10" : "border-slate-800 bg-slate-900/70 hover:border-slate-700"
                                                        )}
                                                    >
                                                        <span className={cn(
                                                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                                                            isActive ? "bg-amber-400/15 text-amber-300" : "bg-slate-800 text-slate-400"
                                                        )}>
                                                            <Icon className="h-5 w-5" />
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block text-sm font-black text-white">{label}</span>
                                                            <span className="mt-1 block text-xs font-bold text-slate-500">{desc}</span>
                                                        </span>
                                                        <span className={cn(
                                                            "relative h-7 w-12 rounded-full transition-colors",
                                                            isActive ? "bg-amber-400" : "bg-slate-700"
                                                        )}>
                                                            <span className={cn(
                                                                "absolute top-1 h-5 w-5 rounded-full bg-white transition-transform",
                                                                isActive ? "translate-x-6" : "translate-x-1"
                                                            )} />
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setSelectedGuestLog(null)}
                                        className="w-full rounded-2xl bg-amber-400 px-5 py-4 text-sm font-black uppercase tracking-widest text-slate-950"
                                    >
                                        Save Permissions
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {showCreateSuccessModal && (
                        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.94, y: 12 }}
                                className="w-full max-w-sm rounded-[2rem] border border-emerald-400/25 bg-slate-900 p-7 text-center shadow-2xl"
                            >
                                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                                    <Check className="h-7 w-7" />
                                </div>
                                <h3 className="text-2xl font-black text-white">Success</h3>
                                <p className="mt-3 text-sm font-bold text-slate-300">Your event has been created! ✨</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateSuccessModal(false);
                                        setStatus("idle");
                                        setMessage("");
                                    }}
                                    className="mt-7 w-full rounded-2xl bg-amber-400 px-5 py-4 text-sm font-black uppercase tracking-widest text-slate-950 transition-colors hover:bg-amber-300"
                                >
                                    OK
                                </button>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Create Event Modal */}
                <AnimatePresence>
                    {isCreateModalOpen && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                className="bg-slate-800 rounded-[2.5rem] p-8 md:p-12 w-full max-w-lg shadow-2xl relative overflow-hidden my-8"
                            >
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-sky-400 via-sky-200 to-sky-400"></div>
                                
                                <div className="flex justify-between items-center mb-8">
                                    <h3 className="text-3xl font-bold tracking-tight text-white">Create Event</h3>
                                    <button 
                                        onClick={() => setIsCreateModalOpen(false)}
                                        className="p-2 hover:bg-slate-900/50 rounded-full transition-colors"
                                    >
                                        <X className="w-6 h-6 text-stone-400" />
                                    </button>
                                </div>

                                {status === "error" && message && (
                                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                                        <p className="text-red-400 text-sm font-medium text-center">{message}</p>
                                    </div>
                                )}

                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    const success = await handleCreateEventOnly(e);
                                    if (success) {
                                        setIsCreateModalOpen(false);
                                    }
                                }} className="space-y-6">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3 ml-1">Event Name</label>
                                        <input
                                            type="text"
                                            value={eventName}
                                            onChange={(e) => setEventName(e.target.value)}
                                            placeholder="e.g. Wedding of John & Jane"
                                            className="w-full px-6 py-5 bg-slate-900/50 border border-slate-700 rounded-2xl focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all outline-none text-lg font-medium text-white"
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3 ml-1">Event Type</label>
                                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                            {EVENT_TYPE_OPTIONS.map(({ name, icon: Icon }) => {
                                                const isSelected = eventType === name;
                                                return (
                                                    <button
                                                        key={name}
                                                        type="button"
                                                        onClick={() => {
                                                            setEventType(name);
                                                            const newTemplates = getTemplatesForEventCategory(name);
                                                            if (newTemplates.length > 0) setSelectedTemplate(newTemplates[0].id);
                                                        }}
                                                        className={cn(
                                                            "flex min-h-12 items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-sm font-black transition-colors",
                                                            isSelected
                                                                ? "border-amber-400 bg-amber-400 text-slate-950"
                                                                : "border-slate-700 bg-slate-900/50 text-slate-300 hover:border-amber-400/50 hover:text-white"
                                                        )}
                                                    >
                                                        <Icon className="h-4 w-4 shrink-0" />
                                                        <span className="truncate">{name}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3 ml-1">Event Date</label>
                                        <button
                                            type="button"
                                            onClick={() => openDatePicker("create")}
                                            className="flex w-full items-center justify-between rounded-2xl border border-slate-700 bg-slate-900/50 px-6 py-5 text-left text-lg font-medium text-white transition-colors hover:border-amber-400/50"
                                        >
                                            <span className={eventDate ? "text-white" : "text-slate-500"}>
                                                {eventDate || "Select event date"}
                                            </span>
                                            <Calendar className="h-5 w-5 text-amber-300" />
                                        </button>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={status === "uploading"}
                                        className="w-full py-5 bg-amber-400 text-slate-950 rounded-2xl font-black hover:bg-amber-300 transition-all shadow-xl active:scale-[0.98] disabled:bg-stone-200 disabled:shadow-none flex items-center justify-center gap-3 text-lg"
                                    >
                                        {status === "uploading" ? (
                                            <>
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                <span>Creating...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Create Event</span>
                                                <Sparkles className="w-5 h-5" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
                {/* Global Message Toast */}
                <AnimatePresence>
                    {message && !isCreateModalOpen && !showCreateSuccessModal && !showDeleteConfirm && (
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm pointer-events-none"
                        >
                            <div className={cn(
                                "px-6 py-4 rounded-2xl shadow-2xl font-bold text-sm text-center border backdrop-blur-xl",
                                status === "success" 
                                    ? "bg-emerald-500/20 text-emerald-100 border-emerald-500/30" 
                                    : status === "error" 
                                        ? "bg-rose-500/20 text-rose-100 border-rose-500/30" 
                                        : "bg-sky-500/20 text-sky-100 border-sky-500/30"
                            )}>
                                {message}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Floating Upload Queue Panel (Google Drive style) */}
                <AnimatePresence>
                    {isUploadPanelOpen && uploadQueue.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 50, scale: 0.95 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="fixed bottom-6 right-6 z-[100] w-96 bg-slate-950/95 border border-slate-800 backdrop-blur-xl shadow-2xl rounded-2xl overflow-hidden font-sans"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
                                <div className="flex items-center gap-2 min-w-0">
                                    {(uploadingItems > 0 || processingItems > 0) ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                                    ) : (
                                        <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                                    )}
                                    <span className="text-xs font-bold text-slate-200 truncate">
                                        {overallStatusText}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {completedItems === totalItems && (
                                        <button
                                            onClick={() => setUploadQueue([])}
                                            className="text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                                        >
                                            Clear
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setIsUploadPanelMinimized(!isUploadPanelMinimized)}
                                        className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                                        title={isUploadPanelMinimized ? "Expand" : "Minimize"}
                                    >
                                        {isUploadPanelMinimized ? (
                                            <ChevronUp className="w-4 h-4" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setIsUploadPanelOpen(false)}
                                        className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                                        title="Close"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Overall progress bar at the very bottom of minimized header */}
                            {isUploadPanelMinimized && (uploadingItems > 0 || processingItems > 0 || (indexingStatus && indexingStatus.status === "processing")) && (
                                <div className="w-full h-1 bg-slate-900 overflow-hidden relative">
                                    <div 
                                        className="h-full bg-gradient-to-r from-amber-500 to-sky-500 transition-all duration-300"
                                        style={{ 
                                            width: `${
                                                indexingStatus && indexingStatus.status === "processing"
                                                    ? indexingStatus.percentComplete
                                                    : (uploadQueue.reduce((acc, curr) => acc + curr.progress, 0) / (totalItems * 100)) * 100
                                            }%` 
                                        }}
                                    ></div>
                                </div>
                            )}

                            {/* Body (List of items) */}
                            <AnimatePresence initial={false}>
                                {!isUploadPanelMinimized && (
                                    <motion.div
                                        initial={{ height: 0 }}
                                        animate={{ height: "auto" }}
                                        exit={{ height: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="max-h-72 overflow-y-auto divide-y divide-slate-900">
                                            {uploadQueue.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between gap-3 p-3 hover:bg-slate-900/50 transition-colors"
                                                >
                                                    {/* File Preview Icon */}
                                                    <div className="w-10 h-10 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center shrink-0">
                                                        {item.mediaType === "video" ? (
                                                            <Video className="w-5 h-5 text-sky-400" />
                                                        ) : (
                                                            <ImageIcon className="w-5 h-5 text-amber-500" />
                                                        )}
                                                    </div>

                                                    {/* File Details & Progress */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2 mb-1">
                                                            <p className="text-xs font-bold text-slate-300 truncate" title={item.fileName}>
                                                                {item.fileName}
                                                            </p>
                                                            {item.status === "pending" && (
                                                                <span className="text-[10px] font-bold text-slate-500 shrink-0">
                                                                    Queued...
                                                                </span>
                                                            )}
                                                            {item.status === "uploading" && (
                                                                <span className="text-[10px] font-bold text-amber-400 shrink-0">
                                                                    {item.progress}%
                                                                </span>
                                                            )}
                                                            {item.status === "processing" && (
                                                                <span className="text-[10px] font-bold text-sky-400 shrink-0 animate-pulse">
                                                                    {indexingStatus && indexingStatus.status === "processing" ? "Indexing..." : "Resizing..."}
                                                                </span>
                                                            )}
                                                            {item.status === "success" && (
                                                                <span className="text-[10px] font-bold text-emerald-400 shrink-0">
                                                                    Done
                                                                </span>
                                                            )}
                                                            {item.status === "error" && (
                                                                <span className="text-[10px] font-bold text-rose-400 shrink-0 truncate max-w-[80px]">
                                                                    Error
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Progress bar */}
                                                        <div className="w-full bg-slate-900 h-1 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn(
                                                                    "h-full rounded-full transition-all duration-300",
                                                                    item.status === "pending" ? "bg-slate-700" :
                                                                    item.status === "uploading" ? "bg-amber-400" :
                                                                    item.status === "processing" ? "bg-sky-400 animate-pulse" :
                                                                    item.status === "success" ? "bg-emerald-400" : "bg-rose-400"
                                                                )}
                                                                style={{ 
                                                                    width: item.status === "pending" ? "0%" : item.status === "processing" ? "90%" : `${item.progress}%` 
                                                                }}
                                                            ></div>
                                                        </div>
                                                    </div>

                                                    {/* Status Icon */}
                                                    <div className="shrink-0">
                                                        {item.status === "uploading" && (
                                                            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                                                        )}
                                                        {item.status === "processing" && (
                                                            <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                                                        )}
                                                        {item.status === "success" && (
                                                            <Check className="w-4 h-4 text-emerald-400" />
                                                        )}
                                                        {item.status === "error" && (
                                                            <div title={item.error}>
                                                                <X className="w-4 h-4 text-rose-400" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    )}
                </AnimatePresence>

            </main >
        </div >
    );
}

export default function UserDashboard() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-900/50">
                <Loader2 className="w-10 h-10 animate-spin text-sky-400" />
            </div>
        }>
            <DashboardContent />
        </Suspense>
    );
}

function OptionCard({ title, description, icon: Icon, onClick, href, color, hoverBorder, badge, actionTitle }: any) {
    const router = useRouter();

    return (
        <Tooltip text={actionTitle}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={(event) => {
                    if (href) {
                        navigateWithModifierClick(event, href, router.push);
                        return;
                    }

                    onClick?.(event);
                }}
                className={cn(
                    "group cursor-pointer bg-slate-800 p-10 rounded-[3rem] border border-slate-700 shadow-sm transition-all duration-500 hover:shadow-2xl hover:-translate-y-1 relative overflow-hidden h-full flex flex-col",
                    hoverBorder
                )}
            >
                {badge && (
                    <div className="absolute top-8 right-8 px-3 py-1 bg-stone-100 text-[10px] font-bold uppercase tracking-widest text-stone-700 rounded-full">
                        {badge}
                    </div>
                )}
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-transform group-hover:scale-110", color)}>
                    <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-bold mb-4 group-hover:text-white transition-colors">
                    {title}
                </h3>
                <p className="text-slate-700 font-sans leading-relaxed mb-6 text-sm">
                    {description}
                </p>
                <div className="flex items-center text-xs font-bold uppercase tracking-widest text-white mt-auto">
                    Explore
                    <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </div>
            </motion.div>
        </Tooltip>
    );
}

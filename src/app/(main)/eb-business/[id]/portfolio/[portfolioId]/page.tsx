"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Calendar, Camera, Check, ChevronLeft, ChevronRight, Loader2, Palette, Pencil, Plus, RefreshCw, Save, Settings, Trash2, X } from "lucide-react";
import { Business, BusinessPortfolioMedia, getBusinessById, updateBusiness } from "@/lib/database";
import { uploadEventImage } from "@/lib/storage";
import { useAuth } from "@/context/AuthContext";

const DEFAULT_PORTFOLIO_COVER_IMAGE = "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop";
const PORTFOLIO_TYPES = ["Wedding", "Birthday", "Corporate", "Sports", "Other"];
const PORTFOLIO_TEMPLATE_THEMES = [
  { id: "royal", category: "Wedding", label: "Royal Emerald", desc: "Deep imperial emerald & palace gold", background: { dark: "#02231c" }, accent: "#ca9c69" },
  { id: "classic", category: "Wedding", label: "Classic White", desc: "Vintage sage & warm silk ivory elegance", background: { dark: "#F7F2EB" }, accent: "#8B9A6E" },
  { id: "hero", category: "Wedding", label: "Midnight Hero", desc: "Big impact cinematic dark aesthetic", background: { dark: "#000000" }, accent: "#ca9c69" },
  { id: "ethereal", category: "Wedding", label: "Ethereal Mist", desc: "Vintage fine-art album & steel blue", background: { dark: "#F8FAFC" }, accent: "#4A6984" },
  { id: "scrapbook", category: "Birthday", label: "Playful Scrapbook", desc: "Soft modern keepsake aesthetic", background: { dark: "#151c1b" }, accent: "#d9826b" },
  { id: "neon", category: "Birthday", label: "Neon Party", desc: "Premium neon birthday album", background: { dark: "#070611" }, accent: "#ff3df2" },
  { id: "pastel", category: "Birthday", label: "Pastel Dream", desc: "Dreamy pastel memory journal", background: { dark: "#fff7f4" }, accent: "#c9768b" },
  { id: "pop", category: "Birthday", label: "Pop Art", desc: "Comic poster birthday album", background: { dark: "#ffe84a" }, accent: "#ef2b3a" },
  { id: "museum", category: "Corporate", label: "Museum Gallery", desc: "Luxury dark mood blue exhibition", background: { dark: "#0D1117" }, accent: "#3D5F8A" },
  { id: "brutalist", category: "Corporate", label: "Brutalist Grid", desc: "Modern architectural olive earth grid", background: { dark: "#171914" }, accent: "#988B71" },
  { id: "tech_sleek", category: "Corporate", label: "Tech Sleek", desc: "Deep ocean navy & electric cyan blue theme", background: { dark: "#040c1a" }, accent: "#00a2ff" },
  { id: "executive", category: "Corporate", label: "Executive Suite", desc: "Professional theme", background: { dark: "#08111f" }, accent: "#d4b474" },
  { id: "bohemian", category: "Other", label: "Bohemian Rhapsody", desc: "Vintage retro cream & olive green festival theme", background: { dark: "#2f1b12" }, accent: "#73863a" },
  { id: "diamond", category: "Other", label: "Diamond Shine", desc: "Cool blues and sparkle", background: { dark: "#082f49" }, accent: "#0284c7" },
  { id: "blush", category: "Other", label: "Blush & Bashful", desc: "Velvet burgundy & rose gold luxury editorial journal", background: { dark: "#230a12" }, accent: "#d89c8a" },
  { id: "garden", category: "Other", label: "Garden Path", desc: "Misty botanical sage & leaf green natural theme", background: { dark: "#3f4f40" }, accent: "#7a9a6b" },
  { id: "midnight_glam", category: "Other", label: "Midnight Glam", desc: "Twilight indigo & deep violet nocturnal theme", background: { dark: "#1A1035" }, accent: "#6B5BBF" },
  { id: "cinematic", category: "Other", label: "Cinematic Noir", desc: "Vintage biker & dramatic crimson cinematic theme", background: { dark: "#0f0f12" }, accent: "#e62b3a" },
  { id: "modern_lounge", category: "Other", label: "Modern Lounge", desc: "Dark mood blue & sleek steel architecture", background: { dark: "#0D1117" }, accent: "#3D5F8A" },
  { id: "elegant_night", category: "Other", label: "Elegant Night", desc: "Sophisticated design", background: { dark: "#111111" }, accent: "#171717" },
  { id: "polaroid", category: "Other", label: "Vintage Polaroid", desc: "Classic photo frames", background: { dark: "#1c1917" }, accent: "#b45309" },
  { id: "editorial", category: "Other", label: "Editorial Mag", desc: "Magazine layout style", background: { dark: "#171717" }, accent: "#111827" },
  { id: "vibrant", category: "Other", label: "Vibrant Energy", desc: "Colorful and dynamic", background: { dark: "#4c1d95" }, accent: "#8b5cf6" },
  { id: "zen", category: "Other", label: "Zen Garden", desc: "Calm and peaceful", background: { dark: "#1c1917" }, accent: "#57534e" },
];

function getTemplateCategoryForPortfolioType(type?: string) {
  if (type === "Sports") return "Other";
  return type || "Wedding";
}

function getPortfolioTemplatesForType(type?: string) {
  const category = getTemplateCategoryForPortfolioType(type);
  return PORTFOLIO_TEMPLATE_THEMES.filter((template) => template.category === category);
}

function getTemplateAccent(templateId?: string) {
  return PORTFOLIO_TEMPLATE_THEMES.find((template) => template.id === templateId)?.accent || "#818cf8";
}

export default function ManagePortfolioEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string; portfolioId: string }>();
  const { user, loading: authLoading } = useAuth();
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const coverPreviewRef = useRef<HTMLDivElement | null>(null);
  const coverDragStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    coverOffset: number;
    coverOffsetX: number;
  } | null>(null);

  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("Wedding");
  const [editDate, setEditDate] = useState(new Date().toISOString().slice(0, 10));
  const [editTemplateId, setEditTemplateId] = useState("hero");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState<number | null>(null);
  const [isPositioningCover, setIsPositioningCover] = useState(false);
  const [coverDraft, setCoverDraft] = useState({ coverOffset: 0, coverOffsetX: 0, coverScale: 1 });

  const portfolio = business?.portfolioEvents?.find((item) => item.id === params.portfolioId);
  const mediaItems = portfolio?.media || [];
  const selectedMedia = selectedMediaIndex !== null ? mediaItems[selectedMediaIndex] : null;
  const templateAccent = getTemplateAccent(portfolio?.templateId);
  const availableTemplates = getPortfolioTemplatesForType(portfolio?.type);
  const currentTemplate = PORTFOLIO_TEMPLATE_THEMES.find((template) => template.id === (portfolio?.templateId || editTemplateId));
  const canManage = Boolean(user && business && (
    business.createdBy === user.uid ||
    business.admins?.includes(user.uid) ||
    business.ownerEmail === user.email
  ));

  const goBack = (fallback = `/eb-business/${params.id}`) => {
    const returnTo = searchParams.get("returnTo");
    if (returnTo?.startsWith("/")) {
      router.push(returnTo);
      return;
    }
    if (fallback) {
      router.push(fallback);
      return;
    }
    router.back();
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const data = await getBusinessById(params.id);
      if (!cancelled) {
        setBusiness(data);
        setLoading(false);
      }
    }
    if (!authLoading) load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, params.id]);

  useEffect(() => {
    if (!portfolio) return;
    setEditName(portfolio.name || "");
    setEditType(portfolio.type || "Wedding");
    setEditDate(portfolio.date || new Date().toISOString().slice(0, 10));
    setEditTemplateId(portfolio.templateId || "hero");
  }, [portfolio?.id]);

  const updatePortfolio = async (updater: (media: NonNullable<Business["portfolioEvents"]>) => NonNullable<Business["portfolioEvents"]>) => {
    if (!business?.portfolioEvents) return false;
    const nextPortfolioEvents = updater(business.portfolioEvents);
    const success = await updateBusiness(business.id, { portfolioEvents: nextPortfolioEvents });
    if (success) {
      setBusiness({ ...business, portfolioEvents: nextPortfolioEvents });
    }
    return success;
  };

  const getCoverStyle = (): React.CSSProperties => {
    if ((portfolio?.coverMode || "fill") === "fit") {
      return {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain",
        backgroundColor: "#050505",
      };
    }

    const x = isPositioningCover ? coverDraft.coverOffsetX : (portfolio?.coverOffsetX || 0);
    const y = isPositioningCover ? coverDraft.coverOffset : (portfolio?.coverOffset || 0);
    const scale = isPositioningCover ? coverDraft.coverScale : (portfolio?.coverScale || 1);
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

  const openCoverPosition = () => {
    if (!portfolio) return;
    setCoverDraft({
      coverOffset: portfolio.coverOffset || 0,
      coverOffsetX: portfolio.coverOffsetX || 0,
      coverScale: portfolio.coverScale || 1,
    });
    setIsPositioningCover(true);
  };

  const handleCoverPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPositioningCover) return;
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
    setCoverDraft(clampCoverDraft({
      ...coverDraft,
      coverOffsetX: start.coverOffsetX + event.clientX - start.startX,
      coverOffset: start.coverOffset + event.clientY - start.startY,
    }));
  };

  const handleCoverPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (coverDragStartRef.current?.pointerId === event.pointerId) {
      coverDragStartRef.current = null;
    }
  };

  const adjustCoverZoom = (delta: number) => {
    setCoverDraft((prev) => {
      const nextScale = Math.min(Math.max(Number((prev.coverScale + delta).toFixed(2)), 1), 2.5);
      return clampCoverDraft({ ...prev, coverScale: nextScale });
    });
  };

  const toggleCoverMode = async () => {
    if (!portfolio || !canManage) return;
    const nextMode: "fit" | "fill" = (portfolio.coverMode || "fill") === "fill" ? "fit" : "fill";
    const success = await updatePortfolio((items) => items.map((item) => item.id === portfolio.id ? {
      ...item,
      coverMode: nextMode,
      coverOffset: 0,
      coverOffsetX: 0,
      coverScale: 1,
      updatedAt: new Date().toISOString(),
    } : item));
    setMessage(success ? (nextMode === "fit" ? "Cover set to Fit." : "Cover set to Fill.") : "Could not update cover mode.");
  };

  const saveCoverPosition = async () => {
    if (!portfolio || !canManage) return;
    const success = await updatePortfolio((items) => items.map((item) => item.id === portfolio.id ? {
      ...item,
      coverMode: "fill",
      coverOffset: coverDraft.coverOffset,
      coverOffsetX: coverDraft.coverOffsetX,
      coverScale: coverDraft.coverScale,
      updatedAt: new Date().toISOString(),
    } : item));
    setMessage(success ? "Cover position saved." : "Could not save cover position.");
    if (success) setIsPositioningCover(false);
  };

  const uploadPortfolioFiles = async (files: File[]) => {
    if (!files.length || !business || !portfolio || !user || !canManage) return;
    const supportedFiles = files.filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"));
    if (!supportedFiles.length) {
      setMessage("Please upload image or video files only.");
      return;
    }

    setUploading(true);
    setUploadStatus("uploading");
    setMessage(`Uploading ${supportedFiles.length} ${supportedFiles.length === 1 ? "file" : "files"}...`);
    try {
      const uploaded = await Promise.all(supportedFiles.map(async (file, index) => {
        const upload = await uploadEventImage(file, `business-${business.id}`, user.uid);
        return {
          id: `media_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`,
          url: upload.url,
          type: file.type.startsWith("video/") ? "video" as const : "image" as const,
          createdAt: new Date().toISOString(),
        };
      }));

      const success = await updatePortfolio((items) => items.map((item) => (
        item.id === portfolio.id ? { ...item, media: [...(item.media || []), ...uploaded] } : item
      )));
      setUploadStatus(success ? "success" : "error");
      setMessage(success ? `${supportedFiles.length === 1 ? "File uploaded" : "Files uploaded"} successfully! ✨` : "Could not save uploaded images.");
    } catch (error) {
      console.error("Portfolio media upload failed:", error);
      setUploadStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not upload portfolio images.");
    } finally {
      setUploading(false);
    }
  };

  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    await uploadPortfolioFiles(files);
  };

  const handleMediaDrag = (event: React.DragEvent<HTMLElement>) => {
    if (!canManage || uploading) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingMedia(true);
  };

  const handleMediaDragLeave = (event: React.DragEvent<HTMLElement>) => {
    if (!canManage || uploading) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingMedia(false);
    }
  };

  const handleMediaDrop = async (event: React.DragEvent<HTMLElement>) => {
    if (!canManage || uploading) return;
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingMedia(false);
    await uploadPortfolioFiles(Array.from(event.dataTransfer.files || []));
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !business || !portfolio || !user || !canManage) return;

    setUploading(true);
    setMessage("");
    try {
      const upload = await uploadEventImage(file, `business-${business.id}`, user.uid);
      const success = await updatePortfolio((items) => items.map((item) => (
        item.id === portfolio.id ? { ...item, coverImage: upload.url, coverMode: "fill", coverOffset: 0, coverOffsetX: 0, coverScale: 1 } : item
      )));
      setMessage(success ? "Portfolio cover updated." : "Could not save cover image.");
    } catch (error) {
      console.error("Portfolio cover upload failed:", error);
      setMessage(error instanceof Error ? error.message : "Could not upload portfolio cover.");
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = async (mediaId: string) => {
    if (!portfolio || !canManage) return;
    await updatePortfolio((items) => items.map((item) => (
      item.id === portfolio.id
        ? { ...item, media: (item.media || []).filter((media) => media.id !== mediaId) }
        : item
    )));
  };

  const setMediaAsCover = async (media: BusinessPortfolioMedia) => {
    if (!portfolio || !canManage || media.type === "video") return;
    const success = await updatePortfolio((items) => items.map((item) => (
      item.id === portfolio.id ? { ...item, coverImage: media.url, coverMode: "fill", coverOffset: 0, coverOffsetX: 0, coverScale: 1, updatedAt: new Date().toISOString() } : item
    )));
    setMessage(success ? "Portfolio cover updated from gallery image." : "Could not update portfolio cover.");
  };

  const openDetailsModal = () => {
    if (!portfolio) return;
    setEditName(portfolio.name || "");
    setEditType(portfolio.type || "Wedding");
    setEditDate(portfolio.date || new Date().toISOString().slice(0, 10));
    setShowDetailsModal(true);
  };

  const saveDetails = async () => {
    if (!portfolio || !editName.trim()) return;
    const templatesForType = getPortfolioTemplatesForType(editType);
    const nextTemplateId = templatesForType.some((template) => template.id === editTemplateId)
      ? editTemplateId
      : templatesForType[0]?.id || "hero";
    setEditTemplateId(nextTemplateId);
    const success = await updatePortfolio((items) => items.map((item) => (
      item.id === portfolio.id
        ? { ...item, name: editName.trim(), type: editType, date: editDate, templateId: nextTemplateId, updatedAt: new Date().toISOString() }
        : item
    )));
    setMessage(success ? "Portfolio details updated." : "Could not update portfolio details.");
    if (success) setShowDetailsModal(false);
  };

  const handleUpdateTemplate = async (templateId: string) => {
    if (!portfolio || !canManage) return;
    setEditTemplateId(templateId);
    const success = await updatePortfolio((items) => items.map((item) => (
      item.id === portfolio.id ? { ...item, templateId, updatedAt: new Date().toISOString() } : item
    )));
    setMessage(success ? "Portfolio template updated." : "Could not update portfolio template.");
    if (success) setShowTemplateModal(false);
  };

  const handleUpdateType = async (type: string) => {
    if (!portfolio || !canManage) return;
    const templatesForType = getPortfolioTemplatesForType(type);
    const currentTemplateId = portfolio.templateId || editTemplateId;
    const nextTemplateId = templatesForType.some((template) => template.id === currentTemplateId)
      ? currentTemplateId
      : templatesForType[0]?.id || "hero";
    setEditType(type);
    setEditTemplateId(nextTemplateId);
    const success = await updatePortfolio((items) => items.map((item) => (
      item.id === portfolio.id ? { ...item, type, templateId: nextTemplateId, updatedAt: new Date().toISOString() } : item
    )));
    setMessage(success ? "Portfolio event type updated." : "Could not update portfolio event type.");
    if (success) setShowTypeModal(false);
  };

  const handleDeletePortfolio = async () => {
    if (!business || !portfolio || !canManage || deleting) return;
    const confirmed = window.confirm(`Delete "${portfolio.name}"? This will remove this portfolio event from your business.`);
    if (!confirmed) return;

    setDeleting(true);
    setMessage("");
    try {
      const nextPortfolioEvents = (business.portfolioEvents || []).filter((item) => item.id !== portfolio.id);
      const success = await updateBusiness(business.id, { portfolioEvents: nextPortfolioEvents });
      if (success) {
        router.replace(`/eb-business/${business.id}?tab=Portfolio`);
        return;
      }
      setMessage("Could not delete portfolio event.");
    } catch (error) {
      console.error("Portfolio event delete failed:", error);
      setMessage(error instanceof Error ? error.message : "Could not delete portfolio event.");
    } finally {
      setDeleting(false);
    }
  };

  const openMediaViewer = (index: number) => {
    setSelectedMediaIndex(index);
  };

  const closeMediaViewer = () => {
    setSelectedMediaIndex(null);
  };

  const showPreviousMedia = () => {
    if (!mediaItems.length) return;
    setSelectedMediaIndex((current) => {
      const index = current ?? 0;
      return (index - 1 + mediaItems.length) % mediaItems.length;
    });
  };

  const showNextMedia = () => {
    if (!mediaItems.length) return;
    setSelectedMediaIndex((current) => {
      const index = current ?? 0;
      return (index + 1) % mediaItems.length;
    });
  };

  if (loading || authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#050505] text-white"><Loader2 className="h-8 w-8 animate-spin text-indigo-300" /></div>;
  }

  if (!business || !portfolio) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 text-center text-white">
        <h1 className="text-2xl font-black">Portfolio event not found.</h1>
        <button onClick={() => goBack()} className="mt-5 rounded-full bg-indigo-400 px-5 py-3 text-sm font-black text-[#101010]">Back to Business</button>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] px-4 text-center text-white">
        <h1 className="text-2xl font-black">You do not have access to manage this portfolio.</h1>
        <button onClick={() => router.replace("/eb-network")} className="mt-5 rounded-full bg-indigo-400 px-5 py-3 text-sm font-black text-[#101010]">Go to EB Network</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <button onClick={() => goBack(`/eb-business/${business.id}?tab=Portfolio`)} className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-slate-200">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-2xl font-black">{portfolio.name}</h1>
            <p className="mt-1 text-sm font-bold text-slate-400">Manage portfolio gallery</p>
          </div>
          <div className="h-11 w-11" />
        </header>

        <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950">
          <div
            ref={coverPreviewRef}
            className={`relative h-[22rem] bg-black ${isPositioningCover ? "cursor-grab active:cursor-grabbing" : ""}`}
            onPointerDown={isPositioningCover ? handleCoverPointerDown : undefined}
            onPointerMove={isPositioningCover ? handleCoverPointerMove : undefined}
            onPointerUp={isPositioningCover ? handleCoverPointerEnd : undefined}
            onPointerCancel={isPositioningCover ? handleCoverPointerEnd : undefined}
            style={isPositioningCover ? { touchAction: "none" } : undefined}
          >
            <img
              src={portfolio.coverImage || DEFAULT_PORTFOLIO_COVER_IMAGE}
              alt={portfolio.name}
              draggable={false}
              className="select-none"
              style={getCoverStyle()}
            />
            <div className="absolute left-5 top-5 rounded-lg border bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em]" style={{ borderColor: `${templateAccent}55`, color: templateAccent }}>{portfolio.type}</div>
            {isPositioningCover && (
              <div className="pointer-events-none absolute inset-x-5 top-5 z-20 rounded-full border border-white/15 bg-black/60 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.2em] text-white/90 backdrop-blur-md">
                Drag image
              </div>
            )}
            {!isPositioningCover && (
              <div className="absolute right-5 top-5 z-10 flex flex-wrap justify-end gap-2">
                <button onClick={toggleCoverMode} disabled={uploading} className="inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xs font-black uppercase tracking-widest text-white ring-1 ring-white/15 backdrop-blur disabled:opacity-60">
                  <RefreshCw className="h-4 w-4" />
                  {(portfolio.coverMode || "fill") === "fill" ? "Fit" : "Fill"}
                </button>
                {(portfolio.coverMode || "fill") === "fill" && (
                  <button onClick={openCoverPosition} disabled={uploading} className="inline-flex items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xs font-black uppercase tracking-widest text-white ring-1 ring-white/15 backdrop-blur disabled:opacity-60">
                    <Settings className="h-4 w-4" />
                    Position
                  </button>
                )}
                <button onClick={() => coverInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-full bg-indigo-400 px-4 py-2 text-xs font-black text-[#101010] disabled:opacity-60">
                  <Camera className="h-4 w-4" />
                  Cover
                </button>
                <button onClick={openDetailsModal} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-white ring-1 ring-white/15 backdrop-blur" aria-label="Edit portfolio details" title="Edit portfolio details">
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black p-6">
              <h2 className="text-3xl font-black" style={{ color: "#ffffff" }}>{portfolio.name}</h2>
              <p className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-400">
                <Calendar className="h-4 w-4" style={{ color: templateAccent }} />
                {new Date(portfolio.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>
        </section>

        {isPositioningCover && (
          <div className="fixed left-1/2 top-24 z-50 flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 flex-col gap-3 rounded-[1.5rem] border border-white/15 bg-slate-950/90 p-3 text-white shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1 px-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-300">Drag image</span>
              <span className="truncate text-sm font-bold text-slate-300">{portfolio.name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
                <button type="button" onClick={() => adjustCoverZoom(-0.1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-white transition hover:bg-slate-700" aria-label="Zoom out">-</button>
                <span className="min-w-14 text-center text-xs font-black text-white">{Math.round(coverDraft.coverScale * 100)}%</span>
                <button type="button" onClick={() => adjustCoverZoom(0.1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-white transition hover:bg-slate-700" aria-label="Zoom in">+</button>
              </div>
              <button type="button" onClick={() => { coverDragStartRef.current = null; setIsPositioningCover(false); }} className="rounded-full border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-200 transition hover:bg-white/10">Cancel</button>
              <button type="button" onClick={saveCoverPosition} className="rounded-full bg-indigo-400 px-5 py-3 text-xs font-black uppercase tracking-widest text-[#101010] transition hover:bg-indigo-300">Save</button>
            </div>
          </div>
        )}

        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
        <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleMediaUpload} />

        {showDetailsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-[2rem] border border-slate-800 bg-slate-950 p-5 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-white">Edit Portfolio</h3>
                  <p className="mt-1 text-sm font-bold text-slate-400">Update the event name, type, and date.</p>
                </div>
                <button onClick={() => setShowDetailsModal(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-slate-300" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">Event Name</span>
                  <input value={editName} onChange={(event) => setEditName(event.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-400" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">Event Type</span>
                  <select value={editType} onChange={(event) => setEditType(event.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-400">
                    {PORTFOLIO_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500">Event Date</span>
                  <input type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-indigo-400" />
                </label>
                <button onClick={saveDetails} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-4 text-sm font-black text-[#101010]">
                  <Save className="h-5 w-5" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        <section className="rounded-[2rem] border border-slate-800 bg-slate-950 p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-400/10 text-indigo-300">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-xl font-black">Design</h3>
                <p className="mt-1 text-sm font-bold text-slate-400">Choose a template for this portfolio.</p>
              </div>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setShowTypeModal(true)}
                className="flex w-full items-center justify-between rounded-[1.2rem] border border-slate-700 bg-slate-900/50 p-4 text-left transition-colors hover:border-amber-400/50"
              >
                <span>
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Event Type</span>
                  <span className="text-base font-bold text-white">{portfolio.type || "Select Type"}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-amber-400" />
              </button>

              <button
                type="button"
                onClick={() => setShowTemplateModal(true)}
                className="flex w-full items-center justify-between rounded-[1.2rem] border border-slate-700 bg-slate-900/50 p-4 text-left transition-colors hover:border-amber-400/50"
              >
                <span>
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500">Change Template</span>
                  <span className="text-base font-bold text-white">{currentTemplate?.label || "Hero (Default)"}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-amber-400" />
              </button>
            </div>
        </section>

        {showTypeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={() => setShowTypeModal(false)}>
            <div className="w-full max-w-md rounded-[2rem] border border-slate-800 bg-slate-950 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-white">Event Type</h3>
                  <p className="mt-1 text-sm font-bold text-slate-400">Choose the portfolio event type.</p>
                </div>
                <button onClick={() => setShowTypeModal(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-slate-300" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                {PORTFOLIO_TYPES.map((type) => {
                  const active = portfolio.type === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleUpdateType(type)}
                      className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-colors ${active ? "border-amber-400 bg-amber-400/10" : "border-slate-800 bg-slate-900 hover:border-amber-400/50"}`}
                    >
                      <span className="font-black text-white">{type}</span>
                      {active && <Check className="h-5 w-5 text-amber-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {showTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm" onClick={() => setShowTemplateModal(false)}>
            <div className="w-full max-w-2xl rounded-[2rem] border border-slate-800 bg-slate-950 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-white">Choose Style</h3>
                  <p className="mt-1 text-sm font-bold text-slate-400">Templates shown for {portfolio.type || "this event type"}.</p>
                </div>
                <button onClick={() => setShowTemplateModal(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-slate-300" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                {availableTemplates.map((template) => {
                  const active = (portfolio.templateId || editTemplateId || "hero") === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleUpdateTemplate(template.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors ${active ? "bg-white/5" : "border-white/5 bg-white/5 hover:border-white/20"}`}
                      style={{ borderColor: active ? template.accent : undefined }}
                    >
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10" style={{ backgroundColor: template.background.dark }}>
                        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: template.accent }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black" style={{ color: active ? template.accent : "#ffffff" }}>{template.label}</span>
                        <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-400">{template.desc}</span>
                      </span>
                      {active && (
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: template.accent }}>
                          <Check className="h-3.5 w-3.5 text-black" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <section
          className={`relative rounded-[2rem] border p-5 transition-colors ${isDraggingMedia ? "border-indigo-300 bg-indigo-400/10" : "border-slate-800 bg-slate-950"}`}
          onDragEnter={handleMediaDrag}
          onDragOver={handleMediaDrag}
          onDragLeave={handleMediaDragLeave}
          onDrop={handleMediaDrop}
        >
          {isDraggingMedia && (
            <div className="pointer-events-none absolute inset-3 z-10 flex items-center justify-center rounded-[1.6rem] border-2 border-dashed border-indigo-300 bg-black/70 text-center backdrop-blur-sm">
              <div>
                <Camera className="mx-auto mb-3 h-10 w-10 text-indigo-200" />
                <p className="text-lg font-black text-white">Drop files to upload</p>
                <p className="mt-1 text-sm font-bold text-indigo-100/70">Images and videos are supported.</p>
              </div>
            </div>
          )}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">Images</h3>
              <p className="mt-1 text-sm font-bold text-slate-400">{portfolio.media?.length || 0} uploaded · Drag files here or use upload</p>
            </div>
            <button onClick={() => mediaInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-full bg-indigo-400 px-5 py-3 text-sm font-black text-[#101010] disabled:opacity-60">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
              Upload Images
            </button>
          </div>

          {message && (
            <div className={`mb-4 flex items-center gap-2 rounded-2xl border p-3 text-sm font-bold ${
              uploadStatus === "uploading"
                ? "border-sky-400/20 bg-sky-400/10 text-sky-200"
                : uploadStatus === "success"
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                  : uploadStatus === "error"
                    ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                    : "border-indigo-400/20 bg-indigo-400/10 text-indigo-200"
            }`}>
              {uploadStatus === "uploading" && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{message}</span>
            </div>
          )}

          {mediaItems.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mediaItems.map((media: BusinessPortfolioMedia, index) => (
                <div
                  key={media.id}
                  className="relative cursor-zoom-in overflow-hidden rounded-2xl border border-slate-800 bg-black"
                  onClick={() => openMediaViewer(index)}
                >
                  {media.type === "video" ? (
                    <video src={media.url} controls className="aspect-square h-full w-full object-cover" />
                  ) : (
                    <img src={media.url} alt="" className="aspect-square h-full w-full object-cover" />
                  )}
                  {media.type !== "video" && (
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setMediaAsCover(media);
                      }}
                      className="absolute left-3 top-3 rounded-full bg-black/70 p-2 text-indigo-200 transition-colors hover:bg-indigo-400 hover:text-[#101010]"
                      title="Set as portfolio cover"
                      aria-label="Set as portfolio cover"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  )}
                  {portfolio.coverImage === media.url && (
                    <span className="absolute bottom-3 left-3 rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[#101010]">
                      Cover
                    </span>
                  )}
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      removeMedia(media.id);
                    }}
                    className="absolute right-3 top-3 rounded-full bg-black/70 p-2 text-rose-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <button onClick={() => mediaInputRef.current?.click()} className="flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 text-slate-500">
              <Camera className="mb-3 h-10 w-10" />
              <span className="font-black">Upload images for this portfolio event</span>
            </button>
          )}
        </section>

        {selectedMedia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4 py-6" onClick={closeMediaViewer}>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                closeMediaViewer();
              }}
              className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
              aria-label="Close media viewer"
            >
              <X className="h-5 w-5" />
            </button>
            {mediaItems.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    showPreviousMedia();
                  }}
                  className="absolute left-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
                  aria-label="Previous media"
                >
                  <ChevronLeft className="h-7 w-7" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    showNextMedia();
                  }}
                  className="absolute right-4 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
                  aria-label="Next media"
                >
                  <ChevronRight className="h-7 w-7" />
                </button>
              </>
            )}
            <div className="max-h-full max-w-6xl" onClick={(event) => event.stopPropagation()}>
              {selectedMedia.type === "video" ? (
                <video src={selectedMedia.url} controls autoPlay className="max-h-[86vh] max-w-full rounded-2xl object-contain" />
              ) : (
                <img src={selectedMedia.url} alt="" className="max-h-[86vh] max-w-full rounded-2xl object-contain" />
              )}
              <p className="mt-4 text-center text-sm font-bold text-white/70">
                {(selectedMediaIndex ?? 0) + 1} / {mediaItems.length}
              </p>
            </div>
          </div>
        )}

        <section className="rounded-[2rem] border border-rose-500/20 bg-rose-500/5 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-black text-rose-200">Delete Portfolio Event</h3>
              <p className="mt-1 text-sm font-bold text-rose-100/60">This removes the portfolio event from your business.</p>
            </div>
            <button
              type="button"
              onClick={handleDeletePortfolio}
              disabled={deleting}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/15 px-5 py-3 text-sm font-black text-rose-200 transition-colors hover:bg-rose-500/25 disabled:opacity-60"
            >
              {deleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
              Delete Portfolio Event
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

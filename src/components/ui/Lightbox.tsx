"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onPhotoInteractions, toggleLike, addComment, deletePhotoComment } from "@/lib/database";
import { useAuth } from "@/context/AuthContext";
import { getImageUrl } from "@/lib/imageUrl";
import { Heart, MessageCircle, Send, X, Download, ChevronLeft, ChevronRight, Trash2, Loader2, Image as ImageIcon, RotateCcw, RotateCw, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { HLSVideoPlayer } from "@/components/ui/HLSVideoPlayer";

export interface LightboxTheme {
    background?: string;
    panel?: string;
    tile?: string;
    text?: string;
    muted?: string;
    accent?: string;
    accentBg?: string;
    border?: string;
    radius?: number;
    useSerif?: boolean;
}

interface LightboxProps {
    isOpen: boolean;
    onClose: () => void;
    photo: {
        id: string;
        src: string;
        storageKey?: string;
        alt?: string;
        width?: number;
        height?: number;
        filename?: string;
        thumbnailUrl?: string;
        previewUrl?: string;
        mediaType?: "photo" | "video";
        resourceType?: "image" | "video" | string;
    } | null;
    onNext?: () => void;
    onPrev?: () => void;
    onRotate?: (direction: "left" | "right") => Promise<void> | void;
    disableDownload?: boolean;
    className?: string;
    theme?: LightboxTheme;
    onLikeChange?: () => void;
    isFavourite?: boolean;
    onToggleFavourite?: () => Promise<void> | void;
}

function addAlpha(color: string, alpha: string) {
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return `${color}${alpha}`;
    return color;
}

export function Lightbox({
    isOpen,
    onClose,
    photo,
    onNext,
    onPrev,
    onRotate,
    disableDownload = false,
    className,
    theme,
    onLikeChange,
    isFavourite = false,
    onToggleFavourite
}: LightboxProps) {
    const { user } = useAuth();
    const [likes, setLikes] = useState<any[]>([]);
    const [comments, setComments] = useState<any[]>([]);
    const [showComments, setShowComments] = useState(true);
    const [newComment, setNewComment] = useState("");
    const [replyingTo, setReplyingTo] = useState<any | null>(null);
    const [isLiking, setIsLiking] = useState(false);
    const [isCommenting, setIsCommenting] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    const [imageSrc, setImageSrc] = useState("");
    const [isRotating, setIsRotating] = useState(false);
    const [isTogglingFavourite, setIsTogglingFavourite] = useState(false);

    useEffect(() => {
        if (photo?.id) {
            setImageLoading(true);
            setImageError(false);
            const nextSrc = photo.previewUrl || (photo.src ? getImageUrl(photo.src, { width: 900, quality: 75, format: 'webp' }) : "");
            setImageSrc(nextSrc);
            if (!nextSrc) {
                setImageLoading(false);
                setImageError(true);
            }
        }
    }, [photo?.id, photo?.src, photo?.previewUrl]);

    const commentsEndRef = useRef<HTMLDivElement>(null);
    const commentInputRef = useRef<HTMLInputElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const commentsPanelRef = useRef<HTMLDivElement>(null);

    // Get identifier and name
    const getIdentity = () => {
        if (user) {
            return {
                id: user.uid,
                name: user.name || user.email?.split('@')[0] || "User"
            };
        }
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("wedding_guest_details");
            if (saved) {
                const { name, phone } = JSON.parse(saved);
                return { id: phone, name };
            }
        }
        return { id: "anonymous", name: "Guest" };
    };

    const identity = getIdentity();
    const isLiked = likes.some(l => l.userId === identity.id);
    const isVideo = photo?.mediaType === "video" || photo?.resourceType === "video";
    const viewerTheme = {
        background: theme?.background || "#000000",
        panel: theme?.panel || "rgba(255,255,255,0.04)",
        tile: theme?.tile || "#09090b",
        text: theme?.text || "#ffffff",
        muted: theme?.muted || "rgba(255,255,255,0.64)",
        accent: theme?.accent || "#cca43b",
        accentBg: theme?.accentBg || "rgba(204,164,59,0.14)",
        border: theme?.border || "rgba(255,255,255,0.12)",
        radius: theme?.radius ?? 18,
        useSerif: theme?.useSerif ?? true,
    };

    useEffect(() => {
        if (photo?.id && isOpen) {
            const unsubscribe = onPhotoInteractions(photo.id, (data) => {
                setLikes(data.likes);
                setComments(data.comments);
            });
            return () => unsubscribe();
        }
    }, [photo?.id, isOpen]);

    useEffect(() => {
        if (showComments && comments.length > 0) {
            commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [comments.length, showComments]);

    const handleToggleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!photo || isLiking) return;
        setIsLiking(true);
        try {
            await toggleLike(photo.id, identity.id, identity.name);
            onLikeChange?.();
        } catch (err) {
            console.error("Like failed", err);
        } finally {
            setIsLiking(false);
        }
    };

    const handleAddComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!photo || !newComment.trim() || isCommenting) return;
        setIsCommenting(true);
        try {
            await addComment(
                photo.id,
                identity.id,
                identity.name,
                newComment.trim(),
                replyingTo?.id
            );
            setNewComment("");
            setReplyingTo(null);
        } catch (err) {
            console.error("Comment failed", err);
        } finally {
            setIsCommenting(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        if (!confirm("Are you sure you want to delete this comment?")) return;
        try {
            await deletePhotoComment(commentId);
        } catch (err) {
            console.error("Delete failed", err);
        }
    };

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!photo || disableDownload) return;
        try {
            const downloadUrl = photo.src;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', photo.filename || 'wedding-photo');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Download failed", error);
        }
    };

    const handleRotate = async (e: React.MouseEvent, direction: "left" | "right") => {
        e.stopPropagation();
        if (!onRotate || isRotating || isVideo) return;
        setIsRotating(true);
        try {
            await onRotate(direction);
            setImageLoading(true);
            setImageError(false);
        } catch (error) {
            console.error("Rotate failed", error);
        } finally {
            setIsRotating(false);
        }
    };

    const handleToggleFavourite = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onToggleFavourite || isTogglingFavourite) return;

        setIsTogglingFavourite(true);
        try {
            await onToggleFavourite();
        } catch (error) {
            console.error("Favourite toggle failed", error);
        } finally {
            setIsTogglingFavourite(false);
        }
    };

    // Handle Keyboard events
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            
            // Don't navigate if user is typing in a comment or reply
            const isTyping = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
            if (isTyping) return;

            if (e.key === "ArrowRight") onNext?.();
            if (e.key === "ArrowLeft") onPrev?.();
        };

        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden";
            document.body.setAttribute("data-lightbox-open", "true");
        }

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "unset";
            document.body.removeAttribute("data-lightbox-open");
        };
    }, [isOpen, onClose, onNext, onPrev, showComments]);

    if (!photo) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={scrollContainerRef}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                        "fixed inset-0 z-[100] overflow-y-auto [-webkit-overflow-scrolling:touch]",
                        className
                    )}
                    style={{ backgroundColor: viewerTheme.background, color: viewerTheme.text }}
                >
                    {/* Background overlay - covers full scrollable area */}
                    <div className="absolute inset-0 z-0 cursor-pointer" onClick={onClose} />

                    {/* TOP ACTION BAR */}
                    <div
                        className="fixed top-0 inset-x-0 h-20 z-[60] flex items-center justify-between px-6 pointer-events-none"
                        style={{ background: `linear-gradient(to bottom, ${addAlpha(viewerTheme.background, "cc")}, transparent)` }}
                    >
                        <div className="flex items-center space-x-2 pointer-events-auto">
                            <span className="text-sm font-medium tracking-wide drop-shadow-md" style={{ color: viewerTheme.muted }}>
                                {imageLoading ? "Loading..." : (photo.filename || "Photo")}
                            </span>
                        </div>

                        <div className="flex items-center space-x-1 pointer-events-auto">
                            {onToggleFavourite && (
                                <button
                                    onClick={handleToggleFavourite}
                                    disabled={isTogglingFavourite}
                                    className="p-2.5 rounded-full transition-all disabled:opacity-40"
                                    style={{ color: isFavourite ? "#fbbf24" : viewerTheme.muted }}
                                    title={isFavourite ? "Remove from Favourite" : "Add to Favourite"}
                                >
                                    {isTogglingFavourite ? (
                                        <Loader2 size={20} className="animate-spin" />
                                    ) : (
                                        <Star size={20} className={cn(isFavourite && "fill-current")} />
                                    )}
                                </button>
                            )}
                            {onRotate && !isVideo && (
                                <>
                                    <button
                                        onClick={(event) => handleRotate(event, "left")}
                                        disabled={isRotating}
                                        className="p-2.5 rounded-full transition-all disabled:opacity-40"
                                        style={{ color: viewerTheme.muted }}
                                        title="Rotate left"
                                    >
                                        {isRotating ? <Loader2 size={20} className="animate-spin" /> : <RotateCcw size={20} />}
                                    </button>
                                    <button
                                        onClick={(event) => handleRotate(event, "right")}
                                        disabled={isRotating}
                                        className="p-2.5 rounded-full transition-all disabled:opacity-40"
                                        style={{ color: viewerTheme.muted }}
                                        title="Rotate right"
                                    >
                                        {isRotating ? <Loader2 size={20} className="animate-spin" /> : <RotateCw size={20} />}
                                    </button>
                                </>
                            )}
                            {!disableDownload && (
                                <button
                                    onClick={handleDownload}
                                    className="p-2.5 rounded-full transition-all"
                                    style={{ color: viewerTheme.muted }}
                                    title="Download"
                                >
                                    <Download size={20} />
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="p-2.5 rounded-full transition-all"
                                style={{ color: viewerTheme.muted }}
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    <div className="relative w-full min-h-[100dvh] flex flex-col items-center justify-start pt-24 pb-32 z-20 pointer-events-none">
                        {/* Main Image Area */}
                        <div className="relative w-full flex items-center justify-center px-4 md:px-16 mb-10 mt-auto">
                            {/* Navigation Buttons */}
                            {onPrev && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onPrev(); }}
                                    className="fixed left-2 md:left-6 top-1/2 -translate-y-1/2 p-2 md:p-4 rounded-full transition-all z-[70] pointer-events-auto backdrop-blur-sm md:backdrop-blur-none border"
                                    style={{ color: viewerTheme.muted, backgroundColor: viewerTheme.accentBg, borderColor: viewerTheme.border }}
                                >
                                    <ChevronLeft size={32} className="md:w-11 md:h-11" />
                                </button>
                            )}

                            {onNext && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onNext(); }}
                                    className="fixed right-2 md:right-6 top-1/2 -translate-y-1/2 p-2 md:p-4 rounded-full transition-all z-[70] pointer-events-auto backdrop-blur-sm md:backdrop-blur-none border"
                                    style={{ color: viewerTheme.muted, backgroundColor: viewerTheme.accentBg, borderColor: viewerTheme.border }}
                                >
                                    <ChevronRight size={32} className="md:w-11 md:h-11" />
                                </button>
                            )}

                            <motion.div
                                key={photo.src}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.05 }}
                                transition={{ duration: 0.3 }}
                                className="relative flex w-full items-center justify-center pointer-events-none"
                            >
                                {isVideo ? (
                                    <HLSVideoPlayer
                                        mediaId={photo.id}
                                        src={photo.src}
                                        poster={photo.thumbnailUrl}
                                        className="max-h-[60vh] w-[95vw] max-w-5xl shadow-2xl pointer-events-auto md:max-h-[85vh]"
                                        style={{ borderRadius: viewerTheme.radius }}
                                        controls
                                        playsInline
                                        autoPlay
                                    />
                                ) : (
                                    <div className="relative flex items-center justify-center min-h-[300px] w-full max-w-5xl">
                                        {imageLoading && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 pointer-events-none">
                                                <Loader2 className="w-10 h-10 animate-spin" style={{ color: viewerTheme.accent }} />
                                                <span className="text-xs font-bold uppercase tracking-widest animate-pulse" style={{ color: viewerTheme.muted }}>Loading memory...</span>
                                            </div>
                                        )}
                                        {imageError && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-auto">
                                                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-4 text-rose-500">
                                                    <ImageIcon size={32} />
                                                </div>
                                                <h3 className="text-lg font-bold mb-1" style={{ color: viewerTheme.text }}>Failed to load image</h3>
                                                <p className="text-xs max-w-xs leading-relaxed" style={{ color: viewerTheme.muted }}>
                                                    This file might still be processing or was removed from storage.
                                                </p>
                                            </div>
                                        )}
                                        {imageSrc && (
                                            <img
                                                src={imageSrc}
                                                alt={photo.alt || "Event Photo"}
                                                onLoad={() => setImageLoading(false)}
                                                onError={() => {
                                                    setImageLoading(false);
                                                    setImageError(true);
                                                }}
                                                className={cn(
                                                    "max-w-[95vw] md:max-w-full max-h-[60vh] md:max-h-[85vh] w-auto h-auto object-contain shadow-2xl pointer-events-auto transition-all duration-300",
                                                    imageLoading || imageError ? "opacity-0 scale-95" : "opacity-100 scale-100"
                                                )}
                                                style={{ borderRadius: viewerTheme.radius, backgroundColor: viewerTheme.tile }}
                                            />
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        </div>

                        {/* MOBILE BOTTOM ACTIONS */}
                        <div className="flex items-center space-x-10 z-[60] md:hidden pointer-events-auto">
                                <button
                                    onClick={handleToggleLike}
                                    className="flex flex-col items-center space-y-1"
                                >
                                    <Heart
                                        size={32}
                                        className={cn("transition-all duration-300 drop-shadow-lg", isLiked ? "fill-rose-500 text-rose-500 scale-125" : "")}
                                        style={!isLiked ? { color: viewerTheme.text } : undefined}
                                    />
                                    <span className="text-[10px] font-bold drop-shadow-md" style={{ color: viewerTheme.text }}>{likes.length}</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setShowComments(true);
                                        setTimeout(() => {
                                            commentsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }, 100);
                                    }}
                                    className="flex flex-col items-center space-y-1"
                                >
                                    <MessageCircle size={32} className="drop-shadow-lg transition-colors" style={{ color: showComments ? viewerTheme.accent : viewerTheme.text }} />
                                    <span className="text-[10px] font-bold drop-shadow-md" style={{ color: viewerTheme.text }}>{comments.length}</span>
                                </button>
                            </div>

                        {/* DESKTOP BOTTOM ACTIONS */}
                        <div className="hidden md:flex flex-row items-center space-x-8 z-[60] pointer-events-auto">
                                <button
                                    onClick={handleToggleLike}
                                    className="group flex flex-col items-center space-y-2 pointer-events-auto"
                                >
                                    <div className={cn(
                                        "p-4 rounded-3xl border transition-all duration-400 ease-out transform group-active:scale-90 backdrop-blur-sm",
                                        isLiked && "text-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)]"
                                    )}
                                        style={{
                                            backgroundColor: isLiked ? "rgba(244,63,94,0.2)" : viewerTheme.panel,
                                            borderColor: isLiked ? "rgba(244,63,94,0.5)" : viewerTheme.border,
                                            color: isLiked ? "#f43f5e" : viewerTheme.muted,
                                        }}
                                    >
                                        <Heart size={24} className={cn(isLiked && "fill-current")} />
                                    </div>
                                    <span className="text-[10px] font-bold tracking-[0.2em] drop-shadow-md" style={{ color: viewerTheme.muted }}>{likes.length} LIKES</span>
                                </button>

                                <button
                                    onClick={() => {
                                        setShowComments(true);
                                        setTimeout(() => {
                                            commentsPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                        }, 100);
                                    }}
                                    className="group flex flex-col items-center space-y-2 pointer-events-auto"
                                >
                                    <div className={cn(
                                        "p-4 rounded-3xl border transition-all duration-400 ease-out transform group-active:scale-90 backdrop-blur-sm"
                                    )}
                                        style={{
                                            backgroundColor: showComments ? viewerTheme.accentBg : viewerTheme.panel,
                                            borderColor: showComments ? addAlpha(viewerTheme.accent, "80") : viewerTheme.border,
                                            color: showComments ? viewerTheme.accent : viewerTheme.muted,
                                            boxShadow: showComments ? `0 0 20px ${addAlpha(viewerTheme.accent, "44")}` : undefined,
                                        }}
                                    >
                                        <MessageCircle size={24} />
                                    </div>
                                    <span className="text-[10px] font-bold tracking-[0.2em] drop-shadow-md" style={{ color: viewerTheme.muted }}>{comments.length} COMMENTS</span>
                                </button>
                            </div>

                        {/* COMMENTS PANEL */}
                        <AnimatePresence>
                            {showComments && (
                                <motion.div
                                    ref={commentsPanelRef}
                                    initial={{ y: 50, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    exit={{ y: 50, opacity: 0 }}
                                    transition={{ type: "spring", damping: 28, stiffness: 220 }}
                                    className="w-[95vw] md:w-[600px] mt-16 backdrop-blur-2xl z-[70] flex flex-col shadow-2xl overflow-hidden pointer-events-auto border"
                                    style={{ backgroundColor: viewerTheme.panel, borderColor: viewerTheme.border, borderRadius: viewerTheme.radius + 18, color: viewerTheme.text }}
                                >
                                    <div className="p-8 pb-6 flex items-center justify-between border-b" style={{ borderColor: viewerTheme.border }}>
                                        <div>
                                            <h3 className={cn("text-2xl font-bold italic", viewerTheme.useSerif && "font-serif")} style={{ color: viewerTheme.text }}>Guestbook</h3>
                                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] mt-1.5 flex items-center" style={{ color: viewerTheme.muted }}>
                                                <div className="w-1 h-1 rounded-full mr-2 animate-pulse" style={{ backgroundColor: viewerTheme.accent }} />
                                                {comments.length} Shared Thoughts
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setShowComments(false)}
                                            className="p-3 rounded-2xl transition-all active:scale-95"
                                            style={{ backgroundColor: viewerTheme.accentBg, color: viewerTheme.text }}
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="flex-grow overflow-y-auto max-h-[60vh] p-8 space-y-8 scroll-smooth">
                                        {comments.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center opacity-30 py-20 text-center">
                                                <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: viewerTheme.accentBg }}>
                                                    <MessageCircle size={32} style={{ color: viewerTheme.accent }} />
                                                </div>
                                                <p className={cn("italic text-lg", viewerTheme.useSerif && "font-serif")} style={{ color: viewerTheme.text }}>No whispers yet...</p>
                                                <p className="text-sm mt-2" style={{ color: viewerTheme.muted }}>Write the first beautiful word.</p>
                                            </div>
                                        ) : (
                                            (() => {
                                                const mainComments = comments.filter(c => !c.parentId);
                                                const replies = comments.filter(c => c.parentId);

                                                return mainComments.map((comment, i) => (
                                                    <div key={comment.id} className="space-y-6">
                                                        {/* Main Comment */}
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: i * 0.05 }}
                                                            className="flex space-x-4"
                                                        >
                                                            <div className="flex-shrink-0 w-10 h-10 rounded-2xl border flex items-center justify-center text-xs font-bold shadow-lg" style={{ backgroundColor: viewerTheme.accent, borderColor: viewerTheme.border, color: viewerTheme.background }}>
                                                                {comment.userName.charAt(0)}
                                                            </div>
                                                            <div className="flex-grow space-y-1.5 min-w-0">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs font-bold truncate pr-2" style={{ color: viewerTheme.text }}>{comment.userName}</span>
                                                                    <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: viewerTheme.muted }}>
                                                                        {comment.createdAt ? new Date(comment.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                                                    </span>
                                                                </div>
                                                                <div className="p-4 rounded-2xl rounded-tl-none border shadow-sm group" style={{ backgroundColor: viewerTheme.tile, borderColor: viewerTheme.border }}>
                                                                    <p className="text-[13px] leading-relaxed font-sans" style={{ color: viewerTheme.muted }}>{comment.text}</p>
                                                                    <div className="mt-2 flex items-center space-x-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={() => {
                                                                                setReplyingTo(comment);
                                                                                commentInputRef.current?.focus();
                                                                            }}
                                                                            className="text-[10px] font-bold uppercase tracking-widest"
                                                                            style={{ color: viewerTheme.accent }}
                                                                        >
                                                                            Reply
                                                                        </button>
                                                                        {comment.userId === identity.id && (
                                                                            <button
                                                                                onClick={() => handleDeleteComment(comment.id)}
                                                                                className="text-[10px] font-bold text-rose-400 uppercase tracking-widest hover:text-rose-600 flex items-center"
                                                                            >
                                                                                <Trash2 size={10} className="mr-1" />
                                                                                Delete
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </motion.div>

                                                        {/* Replies */}
                                                        {replies.filter(r => r.parentId === comment.id).map((reply, ri) => (
                                                            <motion.div
                                                                key={reply.id}
                                                                initial={{ opacity: 0, x: 10 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: ri * 0.05 }}
                                                                className="flex space-x-3 ml-12"
                                                            >
                                                                <div className="flex-shrink-0 w-8 h-8 rounded-xl border flex items-center justify-center text-[10px] font-bold shadow-md" style={{ backgroundColor: viewerTheme.accentBg, borderColor: viewerTheme.border, color: viewerTheme.text }}>
                                                                    {reply.userName.charAt(0)}
                                                                </div>
                                                                <div className="flex-grow space-y-1 min-w-0">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[11px] font-bold truncate pr-2" style={{ color: viewerTheme.text }}>{reply.userName}</span>
                                                                        <span className="text-[9px] font-medium whitespace-nowrap" style={{ color: viewerTheme.muted }}>
                                                                            {reply.createdAt ? new Date(reply.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="p-3 rounded-xl rounded-tl-none border shadow-sm group" style={{ backgroundColor: viewerTheme.tile, borderColor: viewerTheme.border }}>
                                                                        <p className="text-[12px] leading-relaxed font-sans italic" style={{ color: viewerTheme.muted }}>{reply.text}</p>
                                                                        {reply.userId === identity.id && (
                                                                            <button
                                                                                onClick={() => handleDeleteComment(reply.id)}
                                                                                className="mt-1 text-[8px] font-bold text-rose-400 uppercase tracking-widest hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center"
                                                                            >
                                                                                <Trash2 size={8} className="mr-1" />
                                                                                Delete
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                ));
                                            })()
                                        )}
                                        <div ref={commentsEndRef} />
                                    </div>

                                    <div className="p-8 border-t shadow-[0_-10px_30px_rgba(0,0,0,0.02)]" style={{ backgroundColor: viewerTheme.panel, borderColor: viewerTheme.border }}>
                                        <form onSubmit={handleAddComment} className="space-y-4">
                                            {replyingTo && (
                                                <motion.div
                                                    initial={{ opacity: 0, height: 0 }}
                                                    animate={{ opacity: 1, height: 'auto' }}
                                                    className="flex items-center justify-between px-4 py-2 rounded-xl border"
                                                    style={{ backgroundColor: viewerTheme.accentBg, borderColor: viewerTheme.border }}
                                                >
                                                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: viewerTheme.muted }}>
                                                        Replying to <span style={{ color: viewerTheme.accent }}>{replyingTo.userName}</span>
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setReplyingTo(null)}
                                                        className="hover:text-rose-500 transition-colors"
                                                        style={{ color: viewerTheme.muted }}
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </motion.div>
                                            )}

                                            <div className="relative group">
                                                <input
                                                    ref={commentInputRef}
                                                    type="text"
                                                    placeholder={replyingTo ? "Write a reply..." : "Share a wish..."}
                                                    value={newComment}
                                                    onChange={(e) => setNewComment(e.target.value)}
                                                    className="w-full pl-6 pr-14 py-5 border rounded-[1.5rem] text-sm focus:outline-none focus:ring-4 transition-all font-sans"
                                                    style={{ backgroundColor: viewerTheme.tile, borderColor: viewerTheme.border, color: viewerTheme.text }}
                                                />
                                                <button
                                                    type="submit"
                                                    disabled={!newComment.trim() || isCommenting}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-xl disabled:opacity-20 transition-all active:scale-90 shadow-xl"
                                                    style={{ backgroundColor: viewerTheme.accent, color: viewerTheme.background }}
                                                >
                                                    <Send size={18} />
                                                </button>
                                            </div>
                                        </form>
                                        <div className="mt-4 flex items-center justify-center space-x-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <p className="text-[10px] font-bold uppercase tracking-widest leading-none" style={{ color: viewerTheme.muted }}>Posting as {identity.name}</p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

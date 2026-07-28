"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { onPhotoInteractions, toggleLike } from "@/lib/database";
import { useAuth } from "@/context/AuthContext";
import { Heart, MessageCircle, Download, Play } from "lucide-react";
import type { LightboxTheme } from "./Lightbox";
import { getGridThumbnail, getImageUrl } from "@/lib/imageUrl";
import { PageFlipViewer, type GalleryMediaItem, type PageFlipTheme, type ViewerLayout } from "@/components/page-flip/PageFlipViewer";
import { getPageFlipThemeForTemplateId } from "@/components/page-flip/pageFlipThemes";

interface Photo {
    id: string;
    src: string;
    thumbnailUrl?: string;
    previewUrl?: string;
    storageKey?: string;
    alt?: string;
    height?: number;
    width?: number;
    filename?: string;
    mediaType?: "photo" | "video";
    resourceType?: "image" | "video" | string;
}

interface MasonryGridProps {
    photos: Photo[];
    className?: string;
    eventSlug?: string;
    disableDownload?: boolean;
    gridClassName?: string;
    itemClassName?: string;
    lightboxClassName?: string;
    lightboxTheme?: LightboxTheme;
    pageFlipTheme?: PageFlipTheme;
    viewerLayout?: ViewerLayout;
    templateId?: string;
    showPageFlipThumbnails?: boolean;
    onLikeChange?: () => void;
}

interface PhotoCardProps {
    photo: Photo;
    index: number;
    eventSlug?: string;
    disableDownload?: boolean;
    itemClassName?: string;
    onViewPhoto: (photo: Photo) => void;
    onLikeChange?: () => void;
}

type PhotoLike = {
    userId: string;
};

function PhotoCard({
    photo,
    index,
    eventSlug,
    disableDownload = false,
    itemClassName,
    onViewPhoto,
    onLikeChange
}: PhotoCardProps) {
    const { user } = useAuth();
    const [likes, setLikes] = useState<PhotoLike[]>([]);
    const [commentsCount, setCommentsCount] = useState(0);
    const [isLiking, setIsLiking] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

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
    const isVideo = photo.mediaType === "video" || photo.resourceType === "video";
    const [imageSrc, setImageSrc] = useState(photo.thumbnailUrl || (photo.src ? getGridThumbnail(photo.src) : ""));

    useEffect(() => {
        setImageSrc(photo.thumbnailUrl || (photo.src ? getGridThumbnail(photo.src) : ""));
    }, [photo.src, photo.thumbnailUrl]);

    useEffect(() => {
        const unsubscribe = onPhotoInteractions(photo.id, (data) => {
            setLikes(data.likes);
            setCommentsCount(data.comments.length);
        });
        return () => unsubscribe();
    }, [photo.id]);

    const handleToggleLike = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isLiking) return;
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

    const handleDownload = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (disableDownload) return;
        setIsDownloading(true);
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
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: index * 0.05, ease: "easeOut" }}
            onClick={() => onViewPhoto(photo)}
            className={cn(
                "break-inside-avoid overflow-hidden group relative mb-4 shadow-md hover:shadow-xl transition-all duration-500 bg-white border border-stone-150 rounded-2xl cursor-pointer flex flex-col",
                itemClassName
            )}
        >
            <div className="relative w-full overflow-hidden">
                {isVideo ? (
                    <div className="relative aspect-[4/5] w-full bg-slate-950 overflow-hidden">
                        <video
                            src={photo.src}
                            className="h-full w-full object-cover transform transition-all duration-700 group-hover:scale-[1.02]"
                            muted
                            playsInline
                            preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 group-hover:bg-slate-950/10 transition-colors">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white shadow-xl backdrop-blur-sm group-hover:scale-110 transition-transform">
                                <Play className="h-5 w-5 fill-current ml-0.5" />
                            </div>
                        </div>
                    </div>
                ) : imageSrc ? (
                    <img
                        src={imageSrc}
                        alt={photo.alt || "Event Photo"}
                        onError={() => {
                            setImageSrc("");
                        }}
                        className="w-full h-auto object-cover transform transition-all duration-700 group-hover:scale-[1.02]"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex aspect-[4/5] w-full items-center justify-center bg-stone-100 text-xs font-bold uppercase tracking-widest text-stone-400">
                        Image unavailable
                    </div>
                )}
            </div>

            {/* Bottom Instagram-style Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-stone-50/70 border-t border-stone-100">
                <div className="flex items-center space-x-4">
                    {/* Like Option */}
                    <button
                        onClick={handleToggleLike}
                        className="flex items-center space-x-1.5 group/like"
                        aria-label="Like photo"
                    >
                        <Heart
                            size={19}
                            className={cn(
                                "transition-all duration-300",
                                isLiked 
                                    ? "fill-rose-500 text-rose-500 scale-110" 
                                    : "text-stone-500 group-hover/like:text-rose-500 group-hover/like:scale-110"
                            )}
                        />
                        <span className="text-xs font-bold text-stone-600 tracking-wider">
                            {likes.length}
                        </span>
                    </button>

                    {/* Comment Option */}
                    <div
                        className="flex items-center space-x-1.5 group/comment"
                        aria-label="Comments"
                    >
                        <MessageCircle
                            size={19}
                            className="text-stone-500 group-hover/comment:text-amber-600 transition-all duration-300"
                        />
                        <span className="text-xs font-bold text-stone-600 tracking-wider">
                            {commentsCount}
                        </span>
                    </div>
                </div>

                {/* Save (Download) Option */}
                {eventSlug && photo.filename && !disableDownload && (
                    <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        className="p-1 text-stone-500 hover:text-slate-800 hover:scale-110 transition-all disabled:opacity-50"
                        title="Download Original"
                    >
                        {isDownloading ? (
                            <svg className="animate-spin h-5 w-5 text-stone-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <Download size={18} />
                        )}
                    </button>
                )}
            </div>
        </motion.div>
    );
}

export function MasonryGrid({
    photos,
    className,
    eventSlug,
    disableDownload = false,
    gridClassName,
    itemClassName,
    lightboxClassName,
    pageFlipTheme,
    viewerLayout,
    templateId,
    showPageFlipThumbnails = true,
    onLikeChange
}: MasonryGridProps) {
    // Track which photo is currently being viewed in the Lightbox
    const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);
    const viewingIndex = photos.findIndex((photo) => photo.id === viewingPhoto?.id);
    const resolvedViewerLayout = viewerLayout || "cover-flow";
    const viewerItems: GalleryMediaItem[] = photos.map((photo) => {
        const isVideo = photo.mediaType === "video" || photo.resourceType === "video";
        const previewUrl = isVideo
            ? photo.src
            : photo.previewUrl || (photo.src ? getImageUrl(photo.src, { width: 1400, quality: 78, format: "webp" }) : "");
        return {
            id: photo.id,
            type: isVideo ? "video" : "image",
            previewUrl,
            originalUrl: photo.src,
            thumbnailUrl: photo.thumbnailUrl || (isVideo ? undefined : getGridThumbnail(photo.src)),
            alt: photo.alt,
            filename: photo.filename,
            width: photo.width,
            height: photo.height,
        };
    });
    const resolvedPageFlipTheme = pageFlipTheme || getPageFlipThemeForTemplateId(templateId);

    return (
        <div className={cn("container mx-auto px-4 py-8", className)}>
            <div className={cn("columns-1 sm:columns-2 md:columns-3 gap-4 space-y-4", gridClassName)}>
                {photos.map((photo, index) => (
                    <PhotoCard
                        key={photo.id}
                        photo={photo}
                        index={index}
                        eventSlug={eventSlug}
                        disableDownload={disableDownload}
                        itemClassName={itemClassName}
                        onViewPhoto={setViewingPhoto}
                        onLikeChange={onLikeChange}
                    />
                ))}
            </div>

            {viewingPhoto && viewingIndex >= 0 && (
                <div className={lightboxClassName}>
                    <PageFlipViewer
                        items={viewerItems}
                        initialIndex={viewingIndex}
                        theme={resolvedPageFlipTheme}
                        loop
                        showThumbnails={showPageFlipThumbnails}
                        showDownload={!disableDownload}
                        viewerLayout={resolvedViewerLayout}
                        onClose={() => setViewingPhoto(null)}
                        onIndexChange={(index) => setViewingPhoto(photos[index] || null)}
                    />
                </div>
            )}
        </div>
    );
}

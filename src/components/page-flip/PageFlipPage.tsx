/* eslint-disable @next/next/no-img-element */
"use client";

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GalleryMediaItem, PageFlipDirection, PageFlipThemeConfig } from "./types";
import { HLSVideoPlayer } from "@/components/ui/HLSVideoPlayer";

interface PageFlipPageProps {
  item: GalleryMediaItem;
  config: PageFlipThemeConfig;
  isActive?: boolean;
  isTurning?: boolean;
  direction?: PageFlipDirection;
  zoomed?: boolean;
  coverMode?: boolean;
  onMediaReady?: () => void;
  onPreviousMedia?: () => void;
  onNextMedia?: () => void;
  onToggleFullscreen?: () => void | Promise<void>;
  onVideoElementChange?: (node: HTMLVideoElement | null) => void;
  videoControls?: boolean;
}

export const PageFlipPage = memo(function PageFlipPage({
  item,
  config,
  isActive = false,
  isTurning = false,
  direction = "next",
  zoomed = false,
  coverMode = false,
  onMediaReady,
  onPreviousMedia,
  onNextMedia,
  onToggleFullscreen,
  onVideoElementChange,
  videoControls = true,
}: PageFlipPageProps) {
  const [loading, setLoading] = useState(item.type === "image");
  const [error, setError] = useState(false);
  const handleVideoError = useCallback(() => setError(true), []);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const setVideoRefs = useCallback((node: HTMLVideoElement | null) => {
    localVideoRef.current = node;
    onVideoElementChange?.(node);
  }, [onVideoElementChange]);

  useEffect(() => {
    if (isTurning) localVideoRef.current?.pause();
  }, [isTurning]);

  return (
    <div
      className={cn(
        "page-flip-page relative flex h-full w-full items-center justify-center overflow-hidden border",
        config.pageClass,
        config.enableTexture && "page-flip-texture",
        config.enableGlow && "page-flip-glow",
        isTurning && direction === "next" && "page-flip-page-turning-next",
        isTurning && direction === "prev" && "page-flip-page-turning-prev"
      )}
      style={{
        borderRadius: config.cornerRadius,
        transitionDuration: `${config.durationMs}ms`,
        transitionTimingFunction: config.easing,
      }}
    >
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-9 w-9 animate-spin opacity-80" />
          <span className="text-[10px] font-black uppercase tracking-[0.22em] opacity-70">Loading page</span>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center">
          <ImageIcon className="mb-3 h-11 w-11 opacity-60" />
          <p className="text-sm font-bold">Media could not be loaded</p>
          <p className="mt-1 max-w-xs text-xs opacity-70">This file may still be processing or is no longer available.</p>
        </div>
      )}

      {item.type === "video" ? (
        <div className="relative flex h-full w-full items-center justify-center bg-black">
          {!isActive && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/25 bg-black/60 text-white backdrop-blur">
                <Play className="ml-1 h-7 w-7 fill-current" />
              </div>
            </div>
          )}
          <HLSVideoPlayer
            ref={setVideoRefs}
            mediaId={item.id}
            src={item.previewUrl}
            poster={item.thumbnailUrl}
            controls={isActive && !isTurning && videoControls}
            playsInline
            className={cn("h-full max-h-full w-full max-w-full", coverMode ? "object-cover" : "object-contain")}
            onLoadedMetadata={onMediaReady}
            onError={handleVideoError}
            onPreviousMedia={onPreviousMedia}
            onNextMedia={onNextMedia}
            onToggleFullscreen={onToggleFullscreen}
          />
        </div>
      ) : (
        <img
          src={item.previewUrl}
          alt={item.alt || "Gallery media"}
          decoding="async"
          draggable={false}
          className={cn(
            "select-none transition-all duration-500",
            coverMode ? "h-full w-full object-cover" : "max-h-full max-w-full object-contain",
            loading || error ? "opacity-0" : "opacity-100",
            zoomed ? "scale-125 cursor-zoom-out" : "scale-100 cursor-zoom-in",
            config.enableZoom && isTurning && "scale-[1.03]"
          )}
          onLoad={() => {
            setLoading(false);
            onMediaReady?.();
          }}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
        />
      )}

      <div className={cn("pointer-events-none absolute inset-y-0 w-1/4 bg-gradient-to-r opacity-0", config.edgeHighlightClass)} />
      <div className="page-flip-fold pointer-events-none absolute inset-y-0 w-20 opacity-0" />
      <div className="page-flip-page-shadow pointer-events-none absolute inset-0 opacity-0" />
    </div>
  );
});

"use client";

import { ChevronLeft, ChevronRight, Download, Grid2X2, Maximize2, Minimize2, Pause, Play, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageFlipThemeConfig } from "./types";

interface PageFlipControlsProps {
  config: PageFlipThemeConfig;
  canPrev: boolean;
  canNext: boolean;
  zoomed: boolean;
  fullscreen: boolean;
  slideshow: boolean;
  showArrows: boolean;
  showDownload?: boolean;
  showFullscreen?: boolean;
  showGridButton?: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onDownload: () => void;
  onOpenGrid?: () => void;
  onToggleZoom: () => void;
  onToggleFullscreen: () => void;
  onToggleSlideshow: () => void;
}

export function PageFlipControls({
  config,
  canPrev,
  canNext,
  zoomed,
  fullscreen,
  slideshow,
  showArrows,
  showDownload = true,
  showFullscreen = true,
  showGridButton = false,
  onPrev,
  onNext,
  onClose,
  onDownload,
  onOpenGrid,
  onToggleZoom,
  onToggleFullscreen,
  onToggleSlideshow,
}: PageFlipControlsProps) {
  const buttonClass = cn("flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur-md transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-35", config.controlClass);

  return (
    <>
      <div className="fixed right-4 top-4 z-[115] flex items-center gap-2 md:right-6 md:top-6">
        {showGridButton && (
          <button type="button" className={buttonClass} onClick={onOpenGrid} aria-label="Open gallery grid">
            <Grid2X2 className="h-4 w-4" />
          </button>
        )}
        <button type="button" className={buttonClass} onClick={onToggleSlideshow} aria-label={slideshow ? "Pause slideshow" : "Start slideshow"}>
          {slideshow ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button type="button" className={buttonClass} onClick={onToggleZoom} aria-label={zoomed ? "Reset zoom" : "Zoom media"}>
          <Search className="h-4 w-4" />
        </button>
        {showFullscreen && (
          <button type="button" className={buttonClass} onClick={onToggleFullscreen} aria-label={fullscreen ? "Exit fullscreen" : "Open fullscreen"}>
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        )}
        {showDownload && (
          <button type="button" className={buttonClass} onClick={onDownload} aria-label="Download original media">
            <Download className="h-4 w-4" />
          </button>
        )}
        <button type="button" className={buttonClass} onClick={onClose} aria-label="Close viewer">
          <X className="h-5 w-5" />
        </button>
      </div>

      {showArrows && (
        <>
          <button type="button" className={cn(buttonClass, "fixed left-3 top-1/2 z-[110] h-12 w-12 -translate-y-1/2 md:left-7 md:h-14 md:w-14")} onClick={onPrev} disabled={!canPrev} aria-label="Previous media">
            <ChevronLeft className="h-7 w-7" />
          </button>
          <button type="button" className={cn(buttonClass, "fixed right-3 top-1/2 z-[110] h-12 w-12 -translate-y-1/2 md:right-7 md:h-14 md:w-14")} onClick={onNext} disabled={!canNext} aria-label="Next media">
            <ChevronRight className="h-7 w-7" />
          </button>
        </>
      )}
    </>
  );
}

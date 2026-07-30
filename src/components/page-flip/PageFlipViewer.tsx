"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PageFlipControls } from "./PageFlipControls";
import { ThumbnailDrawer, VIEWER_LAYOUT_COMPONENTS } from "./PageFlipLayouts";
import { PageFlipPage } from "./PageFlipPage";
import { PageFlipProgress } from "./PageFlipProgress";
import { PageFlipSocialBar } from "./PageFlipSocialBar";
import { getPageFlipThemeConfig } from "./pageFlipThemes";
import { getVisiblePageFlipIndexes } from "./pageFlipNavigation";
import { usePageFlipNavigation } from "./usePageFlipNavigation";
import { useSwipeNavigation } from "./useSwipeNavigation";
import type { GalleryMediaItem, GalleryTransitionMode, PageFlipTheme, PageFlipThemeConfig, ViewerLayout } from "./types";

export interface PageFlipViewerProps {
  items: GalleryMediaItem[];
  initialIndex?: number;
  theme: PageFlipTheme;
  loop?: boolean;
  showArrows?: boolean;
  showThumbnails?: boolean;
  showProgress?: boolean;
  transitionMode?: GalleryTransitionMode;
  viewerLayout?: ViewerLayout;
  showDownload?: boolean;
  showFullscreen?: boolean;
  showGridButton?: boolean;
  showLikes?: boolean;
  showComments?: boolean;
  showShare?: boolean;
  showFindYou?: boolean;
  onFindYou?: () => void;
  onClose?: () => void;
  onIndexChange?: (index: number) => void;
}

function downloadItem(item?: GalleryMediaItem) {
  if (!item) return;
  const link = document.createElement("a");
  link.href = item.originalUrl || item.previewUrl;
  link.setAttribute("download", item.filename || "evebash-media");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function getTransitionVariants(mode: GalleryTransitionMode, direction: "next" | "prev", reducedMotion: boolean) {
  if (reducedMotion || mode === "fade") {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }

  if (mode === "slide") {
    return {
      initial: { opacity: 0, x: direction === "next" ? 90 : -90 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: direction === "next" ? -90 : 90 },
    };
  }

  if (mode === "zoom") {
    return {
      initial: { opacity: 0, scale: 0.92 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 1.06 },
    };
  }

  return {
    initial: { opacity: 0, rotateY: direction === "next" ? 58 : -58, x: direction === "next" ? 34 : -34 },
    animate: { opacity: 1, rotateY: 0, x: 0 },
    exit: { opacity: 0, rotateY: direction === "next" ? -58 : 58, x: direction === "next" ? -34 : 34 },
  };
}

function getThumbnailDrawerPosition(layout: ViewerLayout): PageFlipThemeConfig["thumbnailDrawerPosition"] {
  if (layout === "story") return "fullscreen";
  if (layout === "side-preview" || layout === "numbered-navigation") return "right";
  return "bottom";
}

export function PageFlipViewer({
  items,
  initialIndex = 0,
  theme,
  loop = false,
  showArrows = true,
  showThumbnails = true,
  showProgress = true,
  transitionMode,
  viewerLayout,
  showDownload = true,
  showFullscreen = true,
  showGridButton,
  showLikes = true,
  showComments = true,
  showShare = true,
  showFindYou = false,
  onFindYou,
  onClose,
  onIndexChange,
}: PageFlipViewerProps) {
  const themeConfig = useMemo(() => getPageFlipThemeConfig(theme), [theme]);
  const resolvedLayout = viewerLayout || themeConfig.layout || "bottom-filmstrip";
  const config = useMemo<PageFlipThemeConfig>(() => ({
    ...themeConfig,
    layout: resolvedLayout,
    transition: transitionMode || (resolvedLayout === "cover-flow" ? "slide" : themeConfig.transition || "page-flip"),
    showPersistentThumbnails: resolvedLayout === "bottom-filmstrip" && showThumbnails,
    thumbnailDrawerPosition: resolvedLayout === themeConfig.layout
      ? themeConfig.thumbnailDrawerPosition
      : getThumbnailDrawerPosition(resolvedLayout),
  }), [resolvedLayout, showThumbnails, themeConfig, transitionMode]);
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const lastWheelRef = useRef(0);
  const socialRevealTimerRef = useRef<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showImmersiveSocial, setShowImmersiveSocial] = useState(false);
  const [slideshow, setSlideshow] = useState(false);
  const [thumbnailDrawerOpen, setThumbnailDrawerOpen] = useState(false);
  const supports3dTransforms = typeof CSS === "undefined" ? true : CSS.supports?.("transform-style", "preserve-3d") !== false;
  const prefersFade = reducedMotion || !supports3dTransforms;
  const effectiveMode: GalleryTransitionMode = prefersFade && config.transition === "page-flip" ? "fade" : config.transition;
  const isCoverFlow = resolvedLayout === "cover-flow";
  const isImmersiveCoverFlow = isCoverFlow;
  const navigation = usePageFlipNavigation({ initialIndex, itemCount: items.length, loop, onIndexChange });
  const currentItem = items[navigation.currentIndex];
  const visibleIndexes = useMemo(() => getVisiblePageFlipIndexes(navigation.currentIndex, items.length, isCoverFlow && !isImmersiveCoverFlow ? 2 : 1), [items.length, navigation.currentIndex, isCoverFlow, isImmersiveCoverFlow]);
  const transition = getTransitionVariants(effectiveMode, navigation.direction, Boolean(reducedMotion));
  const LayoutComponent = VIEWER_LAYOUT_COMPONENTS[resolvedLayout] || VIEWER_LAYOUT_COMPONENTS["bottom-filmstrip"];
  const shouldShowGridButton = showGridButton ?? (resolvedLayout !== "bottom-filmstrip" && !isCoverFlow);
  const revealImmersiveSocial = useCallback(() => {
    if (!isImmersiveCoverFlow) return;
    setShowImmersiveSocial(true);
    if (socialRevealTimerRef.current) window.clearTimeout(socialRevealTimerRef.current);
    socialRevealTimerRef.current = window.setTimeout(() => setShowImmersiveSocial(false), 3600);
  }, [isImmersiveCoverFlow]);
  const pauseVideos = useCallback(() => {
    containerRef.current?.querySelectorAll("video").forEach((video) => video.pause());
  }, []);
  const goPrev = useCallback(() => {
    pauseVideos();
    setZoomed(false);
    navigation.prev();
  }, [navigation, pauseVideos]);
  const goNext = useCallback(() => {
    pauseVideos();
    setZoomed(false);
    navigation.next();
  }, [navigation, pauseVideos]);
  const goTo = useCallback((index: number) => {
    pauseVideos();
    setZoomed(false);
    navigation.goTo(index);
  }, [navigation, pauseVideos]);
  const swipeHandlers = useSwipeNavigation(goPrev, goNext, 48, resolvedLayout === "cover-flow");

  useEffect(() => {
    visibleIndexes.forEach((index) => {
      const item = items[index];
      if (!item || item.type !== "image") return;
      const image = new Image();
      image.src = item.previewUrl;
    });
  }, [items, visibleIndexes]);

  useEffect(() => {
    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableSelector = "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])";
    const focusTimer = window.setTimeout(() => {
      const first = containerRef.current?.querySelector<HTMLElement>(focusableSelector);
      first?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      const isTyping = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      if (event.key === "Escape") {
        if (thumbnailDrawerOpen) setThumbnailDrawerOpen(false);
        else onClose?.();
      }
      if (!isTyping && event.key === "ArrowRight") goNext();
      if (!isTyping && event.key === "ArrowLeft") goPrev();
      if (!isTyping && event.key === "Home") goTo(0);
      if (!isTyping && event.key === "End") goTo(items.length - 1);
      if (event.key !== "Tab" || !containerRef.current) return;

      const focusable = Array.from(containerRef.current.querySelectorAll<HTMLElement>(focusableSelector)).filter((node) => !node.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    document.body.setAttribute("data-lightbox-open", "true");

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      document.body.removeAttribute("data-lightbox-open");
      lastFocusedRef.current?.focus();
    };
    }, [goNext, goPrev, goTo, items.length, onClose, thumbnailDrawerOpen]);

  useEffect(() => {
    if (!slideshow || navigation.isTurning) return;
    const timer = window.setTimeout(() => {
      if (navigation.canNext || loop) goNext();
      else setSlideshow(false);
    }, Math.max(config.durationMs + 2200, 2800));
    return () => window.clearTimeout(timer);
  }, [config.durationMs, goNext, loop, navigation, slideshow]);

  useEffect(() => {
    if (!navigation.isTurning) return;
    const timer = window.setTimeout(navigation.finishTurn, prefersFade ? 220 : config.durationMs);
    return () => window.clearTimeout(timer);
  }, [config.durationMs, navigation, prefersFade]);

  useEffect(() => {
    if (!isCoverFlow) return;
    const node = containerRef.current;
    if (!node) return;

    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 28 && Math.abs(event.deltaX) < 28) return;
      if (isImmersiveCoverFlow) {
        event.preventDefault();
        revealImmersiveSocial();
        return;
      }
      const now = Date.now();
      if (now - lastWheelRef.current < 520) return;
      lastWheelRef.current = now;
      event.preventDefault();
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        if (event.deltaX > 0) goNext();
        else goPrev();
      } else {
        if (event.deltaY > 0) goNext();
        else goPrev();
      }
    };

    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
  }, [goNext, goPrev, isCoverFlow, isImmersiveCoverFlow, revealImmersiveSocial]);

  useEffect(() => {
    if (!isImmersiveCoverFlow) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (window.innerHeight - event.clientY < 170) revealImmersiveSocial();
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [isImmersiveCoverFlow, revealImmersiveSocial]);

  useEffect(() => () => {
    if (socialRevealTimerRef.current) window.clearTimeout(socialRevealTimerRef.current);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setFullscreen(active);
      if (!active) setShowImmersiveSocial(false);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen?.();
      setFullscreen(true);
      if (isCoverFlow) setShowImmersiveSocial(false);
    } else {
      await document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  if (!currentItem) return null;

  const renderConfig = isImmersiveCoverFlow
    ? {
      ...config,
      pageClass: "bg-transparent border-transparent text-white",
      shadowClass: "shadow-none",
      cornerRadius: "0px",
    }
    : config;

  const currentPage = (
    <AnimatePresence initial={false} custom={navigation.direction} mode="wait">
      {/* The stage owns perspective; each page preserves 3D space and changes its transform-origin
         by direction so forward turns feel hinged on the left edge and backward turns on the right. */}
      <motion.div
        key={currentItem.id}
        custom={navigation.direction}
        initial={transition.initial}
        animate={transition.animate}
        exit={transition.exit}
        transition={{ duration: (reducedMotion ? 180 : config.durationMs) / 1000, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transformOrigin: navigation.direction === "next" ? "left center" : "right center",
          backfaceVisibility: "hidden",
        }}
      >
        <PageFlipPage
          item={currentItem}
          config={renderConfig}
          isActive
          isTurning={navigation.isTurning && effectiveMode === "page-flip"}
          direction={navigation.direction}
          zoomed={zoomed}
        />
      </motion.div>
    </AnimatePresence>
  );

  const renderPreviewPage = (item: GalleryMediaItem, keyPrefix: string) => (
    <PageFlipPage key={`${keyPrefix}-${item.id}`} item={item} config={renderConfig} zoomed={false} />
  );

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Page flip media viewer"
      className={cn("fixed inset-0 z-[9999] overflow-hidden text-white", config.backgroundClass, isImmersiveCoverFlow && "bg-black")}
      {...swipeHandlers}
    >
      <div className="absolute inset-0 cursor-pointer bg-black/10" onClick={onClose} />

      {showProgress && resolvedLayout !== "story" && !isImmersiveCoverFlow && <PageFlipProgress index={navigation.currentIndex} total={items.length} config={config} />}

      <PageFlipControls
        config={config}
        canPrev={navigation.canPrev}
        canNext={navigation.canNext}
        zoomed={zoomed}
        fullscreen={fullscreen}
        slideshow={slideshow}
        showArrows={showArrows}
        showDownload={showDownload && !isCoverFlow}
        showFullscreen={showFullscreen && !isCoverFlow}
        showGridButton={shouldShowGridButton && items.length > 1}
        onPrev={goPrev}
        onNext={goNext}
        onClose={() => onClose?.()}
        onDownload={() => downloadItem(currentItem)}
        onOpenGrid={() => setThumbnailDrawerOpen(true)}
        onToggleZoom={() => setZoomed((value) => !value)}
        onToggleFullscreen={toggleFullscreen}
        onToggleSlideshow={() => setSlideshow((value) => !value)}
      />

      <LayoutComponent
        items={items}
        currentIndex={navigation.currentIndex}
        config={renderConfig}
        currentPage={currentPage}
        renderPreviewPage={renderPreviewPage}
        canPrev={navigation.canPrev}
        canNext={navigation.canNext}
        showThumbnails={config.showPersistentThumbnails}
        drawerOpen={thumbnailDrawerOpen}
        onOpenDrawer={() => setThumbnailDrawerOpen(true)}
        onCloseDrawer={() => setThumbnailDrawerOpen(false)}
        onPrev={goPrev}
        onNext={goNext}
        onGoTo={goTo}
        reducedMotion={Boolean(reducedMotion)}
        immersive={isImmersiveCoverFlow}
      />

      {isCoverFlow && (
        <PageFlipSocialBar
          item={currentItem}
          config={config}
          positionLabel={`${navigation.currentIndex + 1} of ${items.length}`}
          showLikes={showLikes}
          showComments={showComments}
          showShare={showShare}
          showDownload={showDownload}
          showFullscreen={showFullscreen}
          showFindYou={showFindYou}
          visible={!isImmersiveCoverFlow || showImmersiveSocial}
          immersive={isImmersiveCoverFlow}
          onDownload={() => downloadItem(currentItem)}
          onFullscreen={toggleFullscreen}
          onFindYou={onFindYou}
        />
      )}

      <ThumbnailDrawer
        items={items}
        currentIndex={navigation.currentIndex}
        config={config}
        open={thumbnailDrawerOpen}
        onClose={() => setThumbnailDrawerOpen(false)}
        onGoTo={goTo}
      />

      <span className="sr-only" aria-live="polite">
        {currentItem.type === "video" ? "Video" : "Image"} {navigation.currentIndex + 1} of {items.length}
      </span>
    </div>
  );
}

export * from "./types";
export { getPageFlipThemeForTemplateId } from "./pageFlipThemes";

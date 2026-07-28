/* eslint-disable @next/next/no-img-element */
"use client";

import type React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageFlipThumbnailStrip } from "./PageFlipThumbnailStrip";
import { getCoverFlowTransform } from "./pageFlipNavigation";
import type { GalleryMediaItem, PageFlipThemeConfig, ViewerLayout } from "./types";

export interface PageFlipLayoutProps {
  items: GalleryMediaItem[];
  currentIndex: number;
  config: PageFlipThemeConfig;
  currentPage: React.ReactNode;
  renderPreviewPage: (item: GalleryMediaItem, keyPrefix: string) => React.ReactNode;
  canPrev: boolean;
  canNext: boolean;
  showThumbnails: boolean;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
  onCloseDrawer: () => void;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (index: number) => void;
  reducedMotion?: boolean;
}

function getNearbyNumberIndexes(currentIndex: number, total: number) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index);
  const start = Math.max(0, Math.min(currentIndex - 2, total - 5));
  const indexes = Array.from({ length: 5 }, (_, offset) => start + offset);
  if (!indexes.includes(0)) indexes.unshift(0);
  if (!indexes.includes(total - 1)) indexes.push(total - 1);
  return indexes;
}

interface ThumbnailDrawerProps {
  items: GalleryMediaItem[];
  currentIndex: number;
  config: PageFlipThemeConfig;
  open: boolean;
  onClose: () => void;
  onGoTo: (index: number) => void;
}

export function ThumbnailDrawer({ items, currentIndex, config, open, onClose, onGoTo }: ThumbnailDrawerProps) {
  if (!open) return null;
  const position = config.thumbnailDrawerPosition || "bottom";
  const isSide = position === "left" || position === "right";

  return (
    <div className="fixed inset-0 z-[130] bg-black/45 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Gallery thumbnails">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close thumbnail drawer" />
      <div
        className={cn(
          "absolute overflow-hidden border backdrop-blur-2xl",
          config.pageClass,
          position === "fullscreen" && "inset-4 rounded-3xl",
          position === "bottom" && "inset-4 rounded-3xl md:inset-x-0 md:bottom-0 md:top-auto md:max-h-[72dvh] md:rounded-b-none md:rounded-t-3xl",
          position === "left" && "inset-4 rounded-3xl md:inset-y-0 md:left-0 md:right-auto md:w-[min(380px,88vw)] md:rounded-l-none md:rounded-r-3xl",
          position === "right" && "inset-4 rounded-3xl md:inset-y-0 md:left-auto md:right-0 md:w-[min(380px,88vw)] md:rounded-l-3xl md:rounded-r-none"
        )}
      >
        <div className="flex items-center justify-between border-b border-current/10 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Gallery Grid</p>
          <button type="button" onClick={onClose} className={cn("flex h-11 w-11 items-center justify-center rounded-full border", config.controlClass)} aria-label="Close thumbnail drawer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={cn("grid gap-3 overflow-y-auto p-5", isSide ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9")}>
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onGoTo(index);
                onClose();
              }}
              className={cn("relative aspect-square overflow-hidden border transition focus-visible:outline-none focus-visible:ring-2", config.controlClass, index === currentIndex ? "scale-100 opacity-100" : "opacity-60 hover:opacity-100")}
              style={{ borderRadius: config.cornerRadius }}
              aria-label={`Open media ${index + 1}`}
            >
              <img src={item.thumbnailUrl || item.previewUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ViewerStage({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: React.MouseEventHandler<HTMLDivElement> }) {
  return (
    <div className="relative z-10 flex h-full w-full items-center justify-center px-3 py-24 md:px-20 md:py-20">
      <div className={cn("page-flip-stage relative h-[min(72dvh,820px)] w-[min(92vw,1180px)]", className)} onClick={onClick} style={{ perspective: "1400px" }}>
        {children}
      </div>
    </div>
  );
}

export function BottomFilmstripLayout(props: PageFlipLayoutProps) {
  return (
    <>
      <ViewerStage className={props.config.shadowClass} onClick={(event) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        (event.clientX - rect.left > rect.width / 2 ? props.onNext : props.onPrev)();
      }}>
        {props.currentPage}
      </ViewerStage>
      {props.showThumbnails && props.items.length > 1 && (
        <PageFlipThumbnailStrip items={props.items} currentIndex={props.currentIndex} config={props.config} onSelect={props.onGoTo} />
      )}
    </>
  );
}

export function HiddenThumbnailDrawerLayout(props: PageFlipLayoutProps) {
  return (
    <div>
      <ViewerStage className={props.config.shadowClass} onClick={(event) => {
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        (event.clientX - rect.left > rect.width / 2 ? props.onNext : props.onPrev)();
      }}>
        {props.currentPage}
      </ViewerStage>
    </div>
  );
}

export function TwoPageSpreadLayout(props: PageFlipLayoutProps) {
  const nextItem = props.items[props.currentIndex + 1];
  return (
    <div>
      <ViewerStage className={cn("max-md:w-[min(92vw,760px)]", props.config.shadowClass)}>
        <div className="h-full w-full gap-1 md:grid md:grid-cols-2">
          <div role="button" tabIndex={0} onClick={props.onPrev} onKeyDown={(event) => event.key === "Enter" && props.onPrev()} className="relative h-full overflow-hidden rounded-[inherit] text-left md:rounded-l-[inherit] md:rounded-r-none md:border-r md:border-black/20" aria-label="Previous media" aria-disabled={!props.canPrev}>
            {props.currentPage}
          </div>
          <div role="button" tabIndex={0} onClick={props.onNext} onKeyDown={(event) => event.key === "Enter" && props.onNext()} className="relative hidden overflow-hidden rounded-r-[inherit] text-left md:block" aria-label="Next media" aria-disabled={!props.canNext}>
            {nextItem ? props.renderPreviewPage(nextItem, "spread-next") : <div className={cn("h-full w-full border", props.config.pageClass)} />}
          </div>
          <div className="pointer-events-none absolute inset-y-8 left-1/2 z-20 hidden w-px -translate-x-1/2 bg-black/30 shadow-[0_0_22px_rgba(0,0,0,0.55)] md:block" />
        </div>
      </ViewerStage>
    </div>
  );
}

export function SidePreviewLayout(props: PageFlipLayoutProps) {
  const previousItem = props.items[props.currentIndex - 1];
  const nextItem = props.items[props.currentIndex + 1];
  return (
    <div>
      <ViewerStage className={cn("w-[min(78vw,980px)]", props.config.shadowClass)}>
        {previousItem && (
          <button type="button" onClick={props.onPrev} disabled={!props.canPrev} className="absolute -left-[18vw] top-1/2 hidden h-[70%] w-[26vw] -translate-y-1/2 overflow-hidden rounded-3xl opacity-45 blur-[1px] transition hover:opacity-70 md:block" aria-label="Previous preview">
            {props.renderPreviewPage(previousItem, "side-prev")}
          </button>
        )}
        {props.currentPage}
        {nextItem && (
          <button type="button" onClick={props.onNext} disabled={!props.canNext} className="absolute -right-[18vw] top-1/2 hidden h-[70%] w-[26vw] -translate-y-1/2 overflow-hidden rounded-3xl opacity-45 blur-[1px] transition hover:opacity-70 md:block" aria-label="Next preview">
            {props.renderPreviewPage(nextItem, "side-next")}
          </button>
        )}
      </ViewerStage>
    </div>
  );
}

export function StackedCardsLayout(props: PageFlipLayoutProps) {
  const nextItem = props.items[props.currentIndex + 1];
  return (
    <div>
      <ViewerStage className={cn("max-w-3xl", props.config.shadowClass)}>
        <div className={cn("absolute inset-x-8 top-8 h-full rotate-6 scale-90 border opacity-25", props.config.pageClass)} style={{ borderRadius: props.config.cornerRadius }} />
        {nextItem && <div className="absolute inset-x-4 top-4 h-full -rotate-3 scale-95 opacity-45">{props.renderPreviewPage(nextItem, "stack-next")}</div>}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragEnd={(_, info) => {
            if (info.offset.x > 90) props.onPrev();
            if (info.offset.x < -90) props.onNext();
          }}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
        >
          {props.currentPage}
        </motion.div>
      </ViewerStage>
    </div>
  );
}

export function StoryLayout(props: PageFlipLayoutProps) {
  return (
    <>
      <div className="fixed left-4 right-4 top-20 z-[112] flex gap-1 md:left-28 md:right-28 md:top-4">
        {props.items.map((item, index) => (
          <button key={item.id} type="button" onClick={() => props.onGoTo(index)} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20" aria-label={`Open story item ${index + 1}`}>
            <span className={cn("block h-full bg-current transition-all", index <= props.currentIndex ? "w-full" : "w-0")} />
          </button>
        ))}
      </div>
      <ViewerStage className="h-[100dvh] w-screen">
        {props.currentPage}
      </ViewerStage>
    </>
  );
}

export function NumberedNavigationLayout(props: PageFlipLayoutProps) {
  const indexes = getNearbyNumberIndexes(props.currentIndex, props.items.length);
  return (
    <>
      <ViewerStage className={cn("max-w-5xl", props.config.shadowClass)}>
        {props.currentPage}
      </ViewerStage>
      <div className="fixed inset-x-0 bottom-6 z-[112] flex items-center justify-center gap-2 px-4">
        {indexes.map((index, itemPosition) => (
          <div key={`${index}-${itemPosition}`} className="flex items-center gap-2">
            {itemPosition > 0 && indexes[itemPosition - 1] !== index - 1 && <span className="opacity-50">...</span>}
            <button type="button" onClick={() => props.onGoTo(index)} className={cn("min-h-11 min-w-11 rounded-full border px-3 text-xs font-black tracking-widest transition", props.config.controlClass, index === props.currentIndex && "scale-110")} aria-label={`Open media ${index + 1}`}>
              {String(index + 1).padStart(2, "0")}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

function CoverFlowSideMedia({ item, config }: { item: GalleryMediaItem; config: PageFlipThemeConfig }) {
  const source = item.thumbnailUrl || item.posterUrl || item.previewUrl;

  return (
    <div
      className={cn("relative flex h-full w-full items-center justify-center overflow-hidden border bg-black", config.pageClass)}
      style={{ borderRadius: config.cornerRadius }}
    >
      {item.type === "video" ? (
        <>
          {source ? <img src={source} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
          <div className="absolute inset-0 bg-black/25" />
        </>
      ) : (
        <img src={source} alt="" className="h-full w-full object-cover" loading="lazy" />
      )}
    </div>
  );
}

export function CoverFlowLayout(props: PageFlipLayoutProps) {
  const indexes = Array.from({ length: 5 }, (_, offset) => props.currentIndex - 2 + offset)
    .filter((index) => index >= 0 && index < props.items.length);

  return (
    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-3 pb-28 pt-24 md:px-10 md:pb-32 md:pt-24">
      <div className="pointer-events-none absolute inset-x-0 bottom-24 h-28 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.18),transparent_62%)] opacity-40 blur-2xl" />
      <div
        className="relative h-[min(72dvh,780px)] w-[min(98vw,1500px)] overflow-visible"
        style={{ perspective: "1400px", transformStyle: "preserve-3d" }}
      >
        {indexes.map((index) => {
          const offset = index - props.currentIndex;
          const transform = getCoverFlowTransform(offset, props.reducedMotion);
          const isActive = offset === 0;

          return (
            <div
              key={props.items[index].id}
              role={isActive ? undefined : "button"}
              tabIndex={isActive ? -1 : 0}
              onClick={(event) => {
                event.stopPropagation();
                if (isActive) return;
                props.onGoTo(index);
              }}
              onKeyDown={(event) => {
                if (isActive || event.key !== "Enter") return;
                props.onGoTo(index);
              }}
              className={cn(
                "absolute left-1/2 top-1/2 h-[min(70dvh,760px)] w-[min(88vw,1040px)] -translate-x-1/2 -translate-y-1/2 overflow-visible focus-visible:outline-none focus-visible:ring-2",
                isActive ? "cursor-default" : "cursor-pointer"
              )}
              style={{ zIndex: transform.zIndex }}
              aria-label={isActive ? `Current media ${index + 1}` : `Open media ${index + 1}`}
            >
              <motion.div
                className={cn("relative h-full w-full", isActive ? props.config.shadowClass : "shadow-black/40")}
                animate={{
                  x: transform.x,
                  rotateY: transform.rotateY,
                  scale: transform.scale,
                  opacity: transform.opacity,
                  z: transform.z,
                }}
                transition={props.reducedMotion ? { duration: 0.16 } : { type: "spring", stiffness: 180, damping: 25, mass: 0.9 }}
                style={{
                  transformStyle: "preserve-3d",
                  backfaceVisibility: "hidden",
                }}
              >
                {isActive ? props.currentPage : <CoverFlowSideMedia item={props.items[index]} config={props.config} />}
                <div className="pointer-events-none absolute inset-x-6 -bottom-8 h-8 rounded-[50%] bg-black/45 blur-xl" />
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const VIEWER_LAYOUT_COMPONENTS: Record<ViewerLayout, React.ComponentType<PageFlipLayoutProps>> = {
  "bottom-filmstrip": BottomFilmstripLayout,
  "hidden-thumbnail-drawer": HiddenThumbnailDrawerLayout,
  "two-page-spread": TwoPageSpreadLayout,
  "side-preview": SidePreviewLayout,
  "stacked-cards": StackedCardsLayout,
  story: StoryLayout,
  "numbered-navigation": NumberedNavigationLayout,
  "cover-flow": CoverFlowLayout,
};

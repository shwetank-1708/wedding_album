"use client";

export type PageFlipTheme =
  | "royal-emerald"
  | "classic-white"
  | "midnight-hero"
  | "ethereal-mist"
  | "playful-scrapbook"
  | "neon-party"
  | "pastel-dream"
  | "pop-art"
  | "golden-years"
  | "vintage-noir"
  | "rose-garden"
  | "minimal-love"
  | "museum-gallery"
  | "brutalist-grid"
  | "tech-sleek"
  | "executive-suite"
  | "cyber-tech"
  | "retro-arcade"
  | "academic-editorial"
  | "neon-carnival"
  | "bohemian-rhapsody"
  | "diamond-shine"
  | "blush-bashful"
  | "garden-path"
  | "midnight-glam"
  | "cinematic-noir"
  | "modern-lounge"
  | "elegant-night"
  | "vintage-polaroid"
  | "editorial-mag"
  | "vibrant-energy"
  | "zen-garden";

export type FlipIntensity = "subtle" | "cinematic" | "playful";
export type GalleryTransitionMode = "slide" | "fade" | "page-flip" | "zoom";
export type PageFlipDirection = "next" | "prev";
export type ViewerLayout =
  | "bottom-filmstrip"
  | "hidden-thumbnail-drawer"
  | "two-page-spread"
  | "side-preview"
  | "stacked-cards"
  | "story"
  | "numbered-navigation"
  | "cover-flow";

export interface GalleryMediaItem {
  id: string;
  galleryId?: string;
  type: "image" | "video";
  previewUrl: string;
  originalUrl?: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  alt?: string;
  filename?: string;
  width?: number;
  height?: number;
  likeCount?: number;
  commentCount?: number;
  viewerHasLiked?: boolean;
}

export interface PageFlipThemeConfig {
  layout: ViewerLayout;
  transition: GalleryTransitionMode;
  showPersistentThumbnails: boolean;
  thumbnailDrawerPosition?: "bottom" | "left" | "right" | "fullscreen";
  backgroundClass: string;
  pageClass: string;
  controlClass: string;
  shadowClass: string;
  edgeHighlightClass?: string;
  cornerRadius: string;
  durationMs: number;
  easing: string;
  intensity: FlipIntensity;
  enableCrossfade?: boolean;
  enableZoom?: boolean;
  enableBounce?: boolean;
  enableGlow?: boolean;
  enableTexture?: boolean;
}

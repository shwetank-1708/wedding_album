"use client";

import type { GalleryTransitionMode, PageFlipTheme, PageFlipThemeConfig, ViewerLayout } from "./types";

const base = {
  layout: "bottom-filmstrip",
  transition: "page-flip",
  showPersistentThumbnails: true,
  thumbnailDrawerPosition: "bottom",
  backgroundClass: "bg-black",
  pageClass: "bg-zinc-950 border-white/10 text-white",
  controlClass: "border-white/15 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white/70",
  shadowClass: "shadow-black/70",
  edgeHighlightClass: "from-white/30",
  cornerRadius: "18px",
  durationMs: 650,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  intensity: "cinematic",
} satisfies PageFlipThemeConfig;

export const themeLayoutMap: Record<PageFlipTheme | "default", ViewerLayout> = {
  "royal-emerald": "two-page-spread",
  "classic-white": "two-page-spread",
  "midnight-hero": "side-preview",
  "ethereal-mist": "hidden-thumbnail-drawer",
  "playful-scrapbook": "stacked-cards",
  "neon-party": "story",
  "pastel-dream": "stacked-cards",
  "pop-art": "stacked-cards",
  "golden-years": "two-page-spread",
  "vintage-noir": "side-preview",
  "rose-garden": "two-page-spread",
  "minimal-love": "hidden-thumbnail-drawer",
  "museum-gallery": "numbered-navigation",
  "brutalist-grid": "numbered-navigation",
  "tech-sleek": "numbered-navigation",
  "executive-suite": "numbered-navigation",
  "cyber-tech": "story",
  "retro-arcade": "story",
  "academic-editorial": "numbered-navigation",
  "neon-carnival": "story",
  "bohemian-rhapsody": "stacked-cards",
  "diamond-shine": "side-preview",
  "blush-bashful": "hidden-thumbnail-drawer",
  "garden-path": "two-page-spread",
  "midnight-glam": "side-preview",
  "cinematic-noir": "side-preview",
  "modern-lounge": "hidden-thumbnail-drawer",
  "elegant-night": "side-preview",
  "vintage-polaroid": "stacked-cards",
  "editorial-mag": "numbered-navigation",
  "vibrant-energy": "story",
  "zen-garden": "hidden-thumbnail-drawer",
  default: "bottom-filmstrip",
};

export const themeTransitionMap: Record<PageFlipTheme | "default", GalleryTransitionMode> = {
  "royal-emerald": "page-flip",
  "classic-white": "page-flip",
  "midnight-hero": "fade",
  "ethereal-mist": "fade",
  "playful-scrapbook": "slide",
  "neon-party": "slide",
  "pastel-dream": "fade",
  "pop-art": "slide",
  "golden-years": "page-flip",
  "vintage-noir": "fade",
  "rose-garden": "page-flip",
  "minimal-love": "fade",
  "museum-gallery": "fade",
  "brutalist-grid": "slide",
  "tech-sleek": "slide",
  "executive-suite": "fade",
  "cyber-tech": "slide",
  "retro-arcade": "slide",
  "academic-editorial": "fade",
  "neon-carnival": "slide",
  "bohemian-rhapsody": "slide",
  "diamond-shine": "fade",
  "blush-bashful": "fade",
  "garden-path": "page-flip",
  "midnight-glam": "fade",
  "cinematic-noir": "zoom",
  "modern-lounge": "fade",
  "elegant-night": "fade",
  "vintage-polaroid": "slide",
  "editorial-mag": "slide",
  "vibrant-energy": "slide",
  "zen-garden": "fade",
  default: "page-flip",
};

function getDrawerPosition(layout: ViewerLayout): PageFlipThemeConfig["thumbnailDrawerPosition"] {
  if (layout === "side-preview" || layout === "numbered-navigation") return "right";
  if (layout === "hidden-thumbnail-drawer") return "bottom";
  if (layout === "story") return "fullscreen";
  return "bottom";
}

export const PAGE_FLIP_THEMES: Record<PageFlipTheme, PageFlipThemeConfig> = {
  "royal-emerald": { ...base, backgroundClass: "bg-[#02231c]", pageClass: "bg-[#021a15] border-[#cca43b]/30 text-[#fcfbf7]", controlClass: "border-[#cca43b]/35 bg-[#cca43b]/15 text-[#cca43b] hover:bg-[#cca43b]/25 focus-visible:ring-[#cca43b]", edgeHighlightClass: "from-[#cca43b]/45", durationMs: 800, intensity: "cinematic", enableTexture: true },
  "classic-white": { ...base, backgroundClass: "bg-[#FAF9F6]", pageClass: "bg-white border-slate-200 text-slate-900", controlClass: "border-slate-200 bg-white/85 text-slate-800 hover:bg-slate-100 focus-visible:ring-slate-700", shadowClass: "shadow-slate-300/60", edgeHighlightClass: "from-slate-200/80", cornerRadius: "2px", durationMs: 580, intensity: "subtle", enableTexture: true },
  "midnight-hero": { ...base, backgroundClass: "bg-black", pageClass: "bg-[#09090b] border-[#cca43b]/25 text-white", controlClass: "border-[#cca43b]/30 bg-[#cca43b]/15 text-[#cca43b] hover:bg-[#cca43b]/25 focus-visible:ring-[#cca43b]", edgeHighlightClass: "from-[#cca43b]/35", durationMs: 720, intensity: "cinematic", enableZoom: true },
  "ethereal-mist": { ...base, backgroundClass: "bg-[#F8FAFC]", pageClass: "bg-white border-[#4A6984]/20 text-[#1E293B]", controlClass: "border-[#4A6984]/25 bg-[#E2E8F0]/80 text-[#4A6984] hover:bg-[#dbe5ef] focus-visible:ring-[#4A6984]", shadowClass: "shadow-slate-300/50", edgeHighlightClass: "from-[#4A6984]/20", cornerRadius: "4px", durationMs: 700, intensity: "subtle", enableCrossfade: true },
  "playful-scrapbook": { ...base, backgroundClass: "bg-[#151c1b]", pageClass: "bg-[#1d2826] border-[#d9826b]/30 text-[#f8f5f0]", controlClass: "border-[#d9826b]/35 bg-[#d9826b]/15 text-[#d9826b] hover:bg-[#d9826b]/25 focus-visible:ring-[#d9826b]", edgeHighlightClass: "from-[#d9826b]/35", durationMs: 620, intensity: "playful", enableBounce: true, enableTexture: true },
  "neon-party": { ...base, backgroundClass: "bg-[#070611]", pageClass: "bg-[#111020] border-[#ff3df2]/35 text-[#f8f7ff]", controlClass: "border-[#66e8ff]/40 bg-[#ff3df2]/15 text-[#66e8ff] hover:bg-[#ff3df2]/25 focus-visible:ring-[#ff3df2]", shadowClass: "shadow-[#ff3df2]/30", edgeHighlightClass: "from-[#66e8ff]/70", durationMs: 470, intensity: "playful", enableGlow: true },
  "pastel-dream": { ...base, backgroundClass: "bg-[#fff7f4]", pageClass: "bg-[#fffdfb] border-[#c9768b]/20 text-[#4d4542]", controlClass: "border-[#c9768b]/25 bg-white/80 text-[#c9768b] hover:bg-[#f8e7ef] focus-visible:ring-[#c9768b]", shadowClass: "shadow-rose-200/50", edgeHighlightClass: "from-[#c9768b]/20", cornerRadius: "24px", durationMs: 680, intensity: "subtle" },
  "pop-art": { ...base, backgroundClass: "bg-[#ffe84a]", pageClass: "bg-white border-4 border-[#231f20] text-[#231f20]", controlClass: "border-2 border-[#231f20] bg-white text-[#231f20] hover:bg-[#ef2b3a] hover:text-white focus-visible:ring-[#ef2b3a]", shadowClass: "shadow-[#231f20]/70", edgeHighlightClass: "from-[#ef2b3a]/55", durationMs: 480, intensity: "playful", enableBounce: true },
  "golden-years": { ...base, backgroundClass: "bg-[#1f1710]", pageClass: "bg-[#2a2117] border-[#c99a2e]/30 text-[#fbf4e6]", controlClass: "border-[#c99a2e]/35 bg-[#c99a2e]/15 text-[#c99a2e] hover:bg-[#c99a2e]/25 focus-visible:ring-[#c99a2e]", edgeHighlightClass: "from-[#c99a2e]/45", durationMs: 800, intensity: "cinematic", enableTexture: true },
  "vintage-noir": { ...base, backgroundClass: "bg-[#0F0E0B]", pageClass: "bg-[#15130F] border-[#B89145]/30 text-[#F2E7D2]", controlClass: "border-[#B89145]/35 bg-[#B89145]/15 text-[#C7A96B] hover:bg-[#B89145]/25 focus-visible:ring-[#B89145]", edgeHighlightClass: "from-[#B89145]/40", durationMs: 730, intensity: "cinematic", enableTexture: true },
  "rose-garden": { ...base, backgroundClass: "bg-[#30151d]", pageClass: "bg-[#45212b] border-[#b76578]/30 text-[#fff6f7]", controlClass: "border-[#b76578]/35 bg-[#b76578]/15 text-[#e7b6bf] hover:bg-[#b76578]/25 focus-visible:ring-[#b76578]", edgeHighlightClass: "from-[#b76578]/35", cornerRadius: "24px", durationMs: 680, intensity: "subtle", enableTexture: true },
  "minimal-love": { ...base, backgroundClass: "bg-[#17120d]", pageClass: "bg-[#241c15] border-[#6d4b34]/30 text-[#fff7eb]", controlClass: "border-[#6d4b34]/35 bg-[#6d4b34]/20 text-[#cab79f] hover:bg-[#6d4b34]/30 focus-visible:ring-[#6d4b34]", edgeHighlightClass: "from-[#6d4b34]/25", cornerRadius: "8px", durationMs: 520, intensity: "subtle" },
  "museum-gallery": { ...base, backgroundClass: "bg-[#0b1118]", pageClass: "bg-[#111827] border-[#9b7a44]/30 text-[#f8fafc]", controlClass: "border-[#9b7a44]/35 bg-[#9b7a44]/15 text-[#9b7a44] hover:bg-[#9b7a44]/25 focus-visible:ring-[#9b7a44]", edgeHighlightClass: "from-[#9b7a44]/30", cornerRadius: "4px", durationMs: 620, intensity: "subtle", enableTexture: true },
  "brutalist-grid": { ...base, backgroundClass: "bg-[#111113]", pageClass: "bg-[#050505] border-2 border-[#a3e635] text-[#f4f4f5]", controlClass: "border-[#a3e635] bg-[#18181b] text-[#a3e635] hover:bg-[#a3e635] hover:text-black focus-visible:ring-[#a3e635]", edgeHighlightClass: "from-[#a3e635]/55", cornerRadius: "0px", durationMs: 420, intensity: "cinematic" },
  "tech-sleek": { ...base, backgroundClass: "bg-[#050b17]", pageClass: "bg-[#07111f] border-[#22d3ee]/35 text-[#e0f2fe]", controlClass: "border-[#22d3ee]/40 bg-[#22d3ee]/15 text-[#22d3ee] hover:bg-[#22d3ee]/25 focus-visible:ring-[#22d3ee]", edgeHighlightClass: "from-[#22d3ee]/45", durationMs: 470, intensity: "subtle", enableGlow: true },
  "executive-suite": { ...base, backgroundClass: "bg-[#08111f]", pageClass: "bg-[#0f172a] border-[#d4b474]/30 text-[#f8fafc]", controlClass: "border-[#d4b474]/35 bg-[#d4b474]/15 text-[#d4b474] hover:bg-[#d4b474]/25 focus-visible:ring-[#d4b474]", edgeHighlightClass: "from-[#d4b474]/30", cornerRadius: "10px", durationMs: 580, intensity: "subtle" },
  "cyber-tech": { ...base, backgroundClass: "bg-[#020617]", pageClass: "bg-[#08111f] border-[#38bdf8]/40 text-[#e0f2fe]", controlClass: "border-[#38bdf8]/45 bg-[#38bdf8]/15 text-[#38bdf8] hover:bg-[#38bdf8]/25 focus-visible:ring-[#38bdf8]", edgeHighlightClass: "from-[#38bdf8]/70", cornerRadius: "8px", durationMs: 430, intensity: "playful", enableGlow: true },
  "retro-arcade": { ...base, backgroundClass: "bg-[#12061f]", pageClass: "bg-[#1e0b32] border-[#ec4899]/40 text-[#fdf2f8]", controlClass: "border-[#ec4899]/45 bg-[#ec4899]/15 text-[#f9a8d4] hover:bg-[#ec4899]/25 focus-visible:ring-[#ec4899]", edgeHighlightClass: "from-[#ec4899]/60", durationMs: 430, intensity: "playful", enableBounce: true, enableGlow: true },
  "academic-editorial": { ...base, backgroundClass: "bg-[#f8f5ef]", pageClass: "bg-[#fffdf8] border-[#92400e]/20 text-[#1f2937]", controlClass: "border-[#92400e]/25 bg-white/80 text-[#92400e] hover:bg-[#f4eadc] focus-visible:ring-[#92400e]", shadowClass: "shadow-stone-300/60", edgeHighlightClass: "from-[#92400e]/18", cornerRadius: "2px", durationMs: 580, intensity: "subtle", enableTexture: true },
  "neon-carnival": { ...base, backgroundClass: "bg-[#090311]", pageClass: "bg-[#170921] border-[#a855f7]/40 text-[#faf5ff]", controlClass: "border-[#a855f7]/45 bg-[#a855f7]/15 text-[#d8b4fe] hover:bg-[#a855f7]/25 focus-visible:ring-[#a855f7]", edgeHighlightClass: "from-[#a855f7]/65", cornerRadius: "24px", durationMs: 480, intensity: "playful", enableGlow: true },
  "bohemian-rhapsody": { ...base, backgroundClass: "bg-[#2f241d]", pageClass: "bg-[#3f2f26] border-[#fb923c]/30 text-[#ffedd5]", controlClass: "border-[#fb923c]/35 bg-[#fb923c]/15 text-[#fb923c] hover:bg-[#fb923c]/25 focus-visible:ring-[#fb923c]", edgeHighlightClass: "from-[#fb923c]/35", cornerRadius: "22px", durationMs: 680, intensity: "playful", enableBounce: true, enableTexture: true },
  "diamond-shine": { ...base, backgroundClass: "bg-[#082f49]", pageClass: "bg-[#0c4a6e] border-[#0284c7]/40 text-[#f0f9ff]", controlClass: "border-[#0284c7]/45 bg-[#0284c7]/15 text-[#7dd3fc] hover:bg-[#0284c7]/25 focus-visible:ring-[#0284c7]", edgeHighlightClass: "from-[#7dd3fc]/60", durationMs: 680, intensity: "cinematic", enableGlow: true },
  "blush-bashful": { ...base, backgroundClass: "bg-[#431407]", pageClass: "bg-[#4a1d0f] border-[#ea580c]/30 text-[#ffedd5]", controlClass: "border-[#ea580c]/35 bg-[#ea580c]/15 text-[#fdba74] hover:bg-[#ea580c]/25 focus-visible:ring-[#ea580c]", edgeHighlightClass: "from-[#fdba74]/35", cornerRadius: "22px", durationMs: 680, intensity: "subtle" },
  "garden-path": { ...base, backgroundClass: "bg-[#112217]", pageClass: "bg-[#183323] border-[#2E6F40]/40 text-[#f0fdf4]", controlClass: "border-[#2E6F40]/45 bg-[#2E6F40]/20 text-[#bbf7d0] hover:bg-[#2E6F40]/30 focus-visible:ring-[#2E6F40]", edgeHighlightClass: "from-[#bbf7d0]/35", cornerRadius: "20px", durationMs: 680, intensity: "subtle", enableTexture: true },
  "midnight-glam": { ...base, backgroundClass: "bg-[#050505]", pageClass: "bg-[#0f172a] border-[#3b82f6]/35 text-white", controlClass: "border-[#3b82f6]/40 bg-[#3b82f6]/15 text-[#bfdbfe] hover:bg-[#3b82f6]/25 focus-visible:ring-[#3b82f6]", edgeHighlightClass: "from-[#bfdbfe]/45", durationMs: 720, intensity: "cinematic", enableGlow: true },
  "cinematic-noir": { ...base, backgroundClass: "bg-black", pageClass: "bg-[#111111] border-[#ef4444]/35 text-white", controlClass: "border-[#ef4444]/40 bg-[#ef4444]/15 text-[#fecaca] hover:bg-[#ef4444]/25 focus-visible:ring-[#ef4444]", edgeHighlightClass: "from-[#ef4444]/40", cornerRadius: "6px", durationMs: 820, intensity: "cinematic", enableZoom: true },
  "modern-lounge": { ...base, backgroundClass: "bg-[#101010]", pageClass: "bg-[#171717] border-[#818cf8]/30 text-white", controlClass: "border-[#818cf8]/35 bg-[#818cf8]/15 text-[#c7d2fe] hover:bg-[#818cf8]/25 focus-visible:ring-[#818cf8]", edgeHighlightClass: "from-[#818cf8]/25", durationMs: 520, intensity: "subtle" },
  "elegant-night": { ...base, backgroundClass: "bg-[#111111]", pageClass: "bg-[#18181b] border-white/15 text-[#f5f5f5]", controlClass: "border-white/15 bg-white/10 text-[#f5f5f5] hover:bg-white/20 focus-visible:ring-white", edgeHighlightClass: "from-white/30", durationMs: 680, intensity: "cinematic", enableGlow: true },
  "vintage-polaroid": { ...base, backgroundClass: "bg-[#1c1917]", pageClass: "bg-[#fafaf9] border-[#b45309]/35 text-[#1c1917]", controlClass: "border-[#b45309]/35 bg-[#292524] text-[#fafaf9] hover:bg-[#b45309] focus-visible:ring-[#b45309]", shadowClass: "shadow-stone-950/70", edgeHighlightClass: "from-white/80", cornerRadius: "2px", durationMs: 620, intensity: "playful", enableBounce: true, enableTexture: true },
  "editorial-mag": { ...base, backgroundClass: "bg-[#171717]", pageClass: "bg-white border-black text-[#111827]", controlClass: "border-white/20 bg-white text-[#111827] hover:bg-neutral-200 focus-visible:ring-white", edgeHighlightClass: "from-black/25", cornerRadius: "0px", durationMs: 520, intensity: "cinematic" },
  "vibrant-energy": { ...base, backgroundClass: "bg-[#4c1d95]", pageClass: "bg-[#581c87] border-[#8b5cf6]/40 text-white", controlClass: "border-[#8b5cf6]/45 bg-[#8b5cf6]/20 text-[#ddd6fe] hover:bg-[#8b5cf6]/35 focus-visible:ring-[#8b5cf6]", edgeHighlightClass: "from-[#ddd6fe]/55", durationMs: 420, intensity: "playful", enableBounce: true, enableGlow: true },
  "zen-garden": { ...base, backgroundClass: "bg-[#1c1917]", pageClass: "bg-[#292524] border-[#a8a29e]/30 text-[#fafaf9]", controlClass: "border-[#a8a29e]/35 bg-[#a8a29e]/15 text-[#d6d3d1] hover:bg-[#a8a29e]/25 focus-visible:ring-[#a8a29e]", edgeHighlightClass: "from-[#a8a29e]/20", cornerRadius: "20px", durationMs: 800, intensity: "subtle", enableTexture: true },
};

export const TEMPLATE_ID_TO_PAGE_FLIP_THEME: Record<string, PageFlipTheme> = {
  royal: "royal-emerald",
  classic: "classic-white",
  hero: "midnight-hero",
  ethereal: "ethereal-mist",
  scrapbook: "playful-scrapbook",
  neon: "neon-party",
  pastel: "pastel-dream",
  pop: "pop-art",
  golden_years: "golden-years",
  vintage: "vintage-noir",
  rose: "rose-garden",
  minimal_love: "minimal-love",
  museum: "museum-gallery",
  brutalist: "brutalist-grid",
  tech_sleek: "tech-sleek",
  executive: "executive-suite",
  cyber_tech: "cyber-tech",
  retro_arcade: "retro-arcade",
  academic_editorial: "academic-editorial",
  neon_carnival: "neon-carnival",
  bohemian: "bohemian-rhapsody",
  diamond: "diamond-shine",
  blush: "blush-bashful",
  garden: "garden-path",
  midnight_glam: "midnight-glam",
  cinematic: "cinematic-noir",
  modern_lounge: "modern-lounge",
  elegant_night: "elegant-night",
  polaroid: "vintage-polaroid",
  editorial: "editorial-mag",
  vibrant: "vibrant-energy",
  zen: "zen-garden",
};

export function getPageFlipThemeForTemplateId(templateId?: string): PageFlipTheme {
  return TEMPLATE_ID_TO_PAGE_FLIP_THEME[templateId || "hero"] || "midnight-hero";
}

export function getPageFlipThemeConfig(theme: PageFlipTheme): PageFlipThemeConfig {
  const visualConfig = PAGE_FLIP_THEMES[theme] || PAGE_FLIP_THEMES["midnight-hero"];
  const layout = themeLayoutMap[theme] || themeLayoutMap.default;
  const transition = themeTransitionMap[theme] || themeTransitionMap.default;
  return {
    ...visualConfig,
    layout,
    transition,
    showPersistentThumbnails: layout === "bottom-filmstrip",
    thumbnailDrawerPosition: getDrawerPosition(layout),
  };
}

export function resolvePageFlipLayout(theme: PageFlipTheme, override?: ViewerLayout): ViewerLayout {
  return override || themeLayoutMap[theme] || themeLayoutMap.default;
}

export function resolvePageFlipTransition(theme: PageFlipTheme, override?: GalleryTransitionMode): GalleryTransitionMode {
  return override || themeTransitionMap[theme] || themeTransitionMap.default;
}

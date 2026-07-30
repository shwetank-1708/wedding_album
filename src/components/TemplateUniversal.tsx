"use client";

import Image from "next/image";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

type TemplateVariant = "split" | "poster" | "gallery" | "terminal" | "soft" | "editorial";

type TemplatePreset = {
  id: string;
  label: string;
  eyebrow: string;
  cta: string;
  variant: TemplateVariant;
  background: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentAlt: string;
  border: string;
  glow: string;
  imageFilter?: string;
  serif?: boolean;
};

const PRESETS: Record<string, TemplatePreset> = {
  ethereal: {
    id: "ethereal",
    label: "Ethereal Mist",
    eyebrow: "Fine Art Album",
    cta: "Enter The Mist",
    variant: "soft",
    background: "#f8fafc",
    surface: "rgba(238,242,246,0.82)",
    text: "#1e293b",
    muted: "#64748b",
    accent: "#4a6984",
    accentAlt: "#dbe6ef",
    border: "rgba(74,105,132,0.24)",
    glow: "rgba(74,105,132,0.18)",
    imageFilter: "saturate(0.86) contrast(0.96) brightness(1.04)",
    serif: true,
  },
  neon: {
    id: "neon",
    label: "Neon Party",
    eyebrow: "After Dark Edition",
    cta: "Light Up Gallery",
    variant: "poster",
    background: "#070611",
    surface: "rgba(18,16,35,0.84)",
    text: "#f8f7ff",
    muted: "#b9b1d9",
    accent: "#ff3df2",
    accentAlt: "#66e8ff",
    border: "rgba(255,61,242,0.34)",
    glow: "rgba(255,61,242,0.32)",
    imageFilter: "saturate(1.24) contrast(1.06)",
  },
  pastel: {
    id: "pastel",
    label: "Pastel Dream",
    eyebrow: "Soft Memory Journal",
    cta: "Open Dream",
    variant: "soft",
    background: "#fff7f4",
    surface: "rgba(255,255,255,0.78)",
    text: "#4d4542",
    muted: "#9a8583",
    accent: "#c9768b",
    accentAlt: "#d5b4dc",
    border: "rgba(201,118,139,0.24)",
    glow: "rgba(213,180,220,0.28)",
    imageFilter: "saturate(0.9) brightness(1.04)",
    serif: true,
  },
  golden_years: {
    id: "golden_years",
    label: "Golden Years",
    eyebrow: "Legacy Celebration",
    cta: "View Legacy",
    variant: "gallery",
    background: "#fbf4e6",
    surface: "rgba(255,251,242,0.86)",
    text: "#3f2f22",
    muted: "#8b765e",
    accent: "#c99a2e",
    accentAlt: "#f3d68b",
    border: "rgba(201,154,46,0.3)",
    glow: "rgba(201,154,46,0.24)",
    imageFilter: "sepia(0.12) saturate(0.94)",
    serif: true,
  },
  vintage: {
    id: "vintage",
    label: "Vintage Noir",
    eyebrow: "Archive Issue",
    cta: "Open Archive",
    variant: "editorial",
    background: "#0f0e0b",
    surface: "#1c1812",
    text: "#f2e7d2",
    muted: "#c7a96b",
    accent: "#b89145",
    accentAlt: "#efe0bd",
    border: "rgba(184,145,69,0.32)",
    glow: "rgba(184,145,69,0.2)",
    imageFilter: "sepia(0.28) contrast(0.96) brightness(0.9)",
    serif: true,
  },
  rose: {
    id: "rose",
    label: "Rose Garden",
    eyebrow: "Floral Keepsake",
    cta: "Enter Garden",
    variant: "soft",
    background: "#fff9f5",
    surface: "rgba(255,252,247,0.9)",
    text: "#562733",
    muted: "#9a6c74",
    accent: "#b76578",
    accentAlt: "#f2c8d0",
    border: "rgba(183,101,120,0.28)",
    glow: "rgba(183,101,120,0.18)",
    imageFilter: "saturate(0.96) brightness(1.02)",
    serif: true,
  },
  minimal_love: {
    id: "minimal_love",
    label: "Minimal Love",
    eyebrow: "Quiet Editorial",
    cta: "View Story",
    variant: "editorial",
    background: "#f7efe4",
    surface: "#fffaf2",
    text: "#3b2618",
    muted: "#8a7461",
    accent: "#6d4b34",
    accentAlt: "#d7c3ad",
    border: "rgba(109,75,52,0.2)",
    glow: "rgba(109,75,52,0.12)",
    imageFilter: "saturate(0.85) contrast(0.96)",
    serif: true,
  },
  diamond: {
    id: "diamond",
    label: "Diamond Luxe",
    eyebrow: "Crystal Ceremony",
    cta: "Reveal Moments",
    variant: "split",
    background: "#f5f7fb",
    surface: "rgba(255,255,255,0.86)",
    text: "#172033",
    muted: "#667085",
    accent: "#a7b7d8",
    accentAlt: "#eef2ff",
    border: "rgba(126,149,190,0.3)",
    glow: "rgba(126,149,190,0.2)",
    imageFilter: "saturate(0.82) brightness(1.05)",
    serif: true,
  },
  blush: {
    id: "blush",
    label: "Blush Romance",
    eyebrow: "Modern Romance",
    cta: "Open Romance",
    variant: "soft",
    background: "#fff1f2",
    surface: "rgba(255,255,255,0.82)",
    text: "#4c1d28",
    muted: "#9f6b78",
    accent: "#e87993",
    accentAlt: "#ffd5de",
    border: "rgba(232,121,147,0.25)",
    glow: "rgba(232,121,147,0.22)",
    imageFilter: "saturate(0.94) brightness(1.04)",
    serif: true,
  },
  garden: {
    id: "garden",
    label: "Botanical Garden",
    eyebrow: "Botanical Register",
    cta: "Walk The Gallery",
    variant: "gallery",
    background: "#f4f1e8",
    surface: "rgba(255,252,246,0.9)",
    text: "#1a3322",
    muted: "#6b7f67",
    accent: "#2e6f40",
    accentAlt: "#b7d2a8",
    border: "rgba(46,111,64,0.24)",
    glow: "rgba(46,111,64,0.2)",
    imageFilter: "saturate(0.9) contrast(0.98)",
    serif: true,
  },
  midnight_glam: {
    id: "midnight_glam",
    label: "Midnight Glam",
    eyebrow: "Velvet Night",
    cta: "Enter Night",
    variant: "poster",
    background: "#07070b",
    surface: "rgba(20,18,28,0.86)",
    text: "#fff8ee",
    muted: "#b9a88e",
    accent: "#d4af37",
    accentAlt: "#7c3aed",
    border: "rgba(212,175,55,0.34)",
    glow: "rgba(124,58,237,0.24)",
    imageFilter: "contrast(1.02) brightness(0.86)",
    serif: true,
  },
  modern_lounge: {
    id: "modern_lounge",
    label: "Modern Lounge",
    eyebrow: "Private Lounge",
    cta: "Step Inside",
    variant: "split",
    background: "#111827",
    surface: "rgba(30,41,59,0.82)",
    text: "#f8fafc",
    muted: "#cbd5e1",
    accent: "#38bdf8",
    accentAlt: "#64748b",
    border: "rgba(148,163,184,0.26)",
    glow: "rgba(56,189,248,0.22)",
    imageFilter: "saturate(0.9) brightness(0.92)",
  },
  elegant_night: {
    id: "elegant_night",
    label: "Elegant Night",
    eyebrow: "Evening Reception",
    cta: "Open Evening",
    variant: "gallery",
    background: "#0b1018",
    surface: "rgba(18,24,38,0.88)",
    text: "#f8fafc",
    muted: "#a8b3c5",
    accent: "#c7a76c",
    accentAlt: "#f4d28c",
    border: "rgba(199,167,108,0.28)",
    glow: "rgba(199,167,108,0.2)",
    imageFilter: "contrast(1.02) brightness(0.9)",
    serif: true,
  },
  tech_sleek: {
    id: "tech_sleek",
    label: "Tech Sleek",
    eyebrow: "Future Archive",
    cta: "Initialize Gallery",
    variant: "terminal",
    background: "#050b17",
    surface: "rgba(8,18,34,0.9)",
    text: "#e0f7ff",
    muted: "#7dd3fc",
    accent: "#22d3ee",
    accentAlt: "#8b5cf6",
    border: "rgba(34,211,238,0.32)",
    glow: "rgba(34,211,238,0.28)",
    imageFilter: "saturate(1.08) contrast(1.04) brightness(0.9)",
  },
  executive: {
    id: "executive",
    label: "Executive Suite",
    eyebrow: "Private Portfolio",
    cta: "Open Suite",
    variant: "split",
    background: "#08111f",
    surface: "rgba(15,23,42,0.9)",
    text: "#f8fafc",
    muted: "#a7b2c5",
    accent: "#d4b474",
    accentAlt: "#516070",
    border: "rgba(212,180,116,0.26)",
    glow: "rgba(212,180,116,0.18)",
    imageFilter: "saturate(0.84) contrast(1.02) brightness(0.9)",
    serif: true,
  },
  vibrant: {
    id: "vibrant",
    label: "Vibrant Energy",
    eyebrow: "Color Edition",
    cta: "Open Energy",
    variant: "poster",
    background: "#f5f3ff",
    surface: "rgba(255,255,255,0.86)",
    text: "#27104d",
    muted: "#6d5f91",
    accent: "#8b5cf6",
    accentAlt: "#f97316",
    border: "rgba(139,92,246,0.26)",
    glow: "rgba(249,115,22,0.22)",
    imageFilter: "saturate(1.16) contrast(1.02)",
  },
  zen: {
    id: "zen",
    label: "Zen Garden",
    eyebrow: "Calm Collection",
    cta: "Enter Calm",
    variant: "editorial",
    background: "#f5f5f4",
    surface: "#ffffff",
    text: "#292524",
    muted: "#78716c",
    accent: "#57534e",
    accentAlt: "#d6d3d1",
    border: "rgba(87,83,78,0.18)",
    glow: "rgba(87,83,78,0.12)",
    imageFilter: "saturate(0.78) contrast(0.96)",
    serif: true,
  },
  cyber_tech: {
    id: "cyber_tech",
    label: "Cyber Tech",
    eyebrow: "System Gallery",
    cta: "Run Gallery",
    variant: "terminal",
    background: "#05070c",
    surface: "rgba(9,13,22,0.9)",
    text: "#e6fbff",
    muted: "#75f6ff",
    accent: "#00f0ff",
    accentAlt: "#ff2bd6",
    border: "rgba(0,240,255,0.36)",
    glow: "rgba(0,240,255,0.3)",
    imageFilter: "saturate(1.18) contrast(1.08) brightness(0.82)",
  },
  retro_arcade: {
    id: "retro_arcade",
    label: "Retro Arcade",
    eyebrow: "Press Start",
    cta: "Start Gallery",
    variant: "poster",
    background: "#ffe663",
    surface: "#fff7c2",
    text: "#1f1635",
    muted: "#5a3d52",
    accent: "#ff3562",
    accentAlt: "#2563eb",
    border: "rgba(31,22,53,0.34)",
    glow: "rgba(255,53,98,0.26)",
    imageFilter: "saturate(1.2) contrast(1.06)",
  },
  academic_editorial: {
    id: "academic_editorial",
    label: "Academic Editorial",
    eyebrow: "Campus Journal",
    cta: "Read Gallery",
    variant: "editorial",
    background: "#fcfaf7",
    surface: "#ffffff",
    text: "#111827",
    muted: "#6b7280",
    accent: "#800020",
    accentAlt: "#d6a15f",
    border: "rgba(128,0,32,0.2)",
    glow: "rgba(128,0,32,0.12)",
    imageFilter: "saturate(0.85) contrast(0.98)",
    serif: true,
  },
  neon_carnival: {
    id: "neon_carnival",
    label: "Neon Carnival",
    eyebrow: "Festival Lights",
    cta: "Enter Carnival",
    variant: "poster",
    background: "#06030a",
    surface: "rgba(18,8,30,0.88)",
    text: "#fff7ff",
    muted: "#e9b8ff",
    accent: "#d946ef",
    accentAlt: "#22d3ee",
    border: "rgba(217,70,239,0.32)",
    glow: "rgba(217,70,239,0.28)",
    imageFilter: "saturate(1.22) contrast(1.04) brightness(0.88)",
  },
};

interface TemplateUniversalProps {
  event: Event;
  children?: React.ReactNode;
  presetId: string;
}

const darkPresets = new Set([
  "neon",
  "vintage",
  "midnight_glam",
  "modern_lounge",
  "elegant_night",
  "tech_sleek",
  "executive",
  "cyber_tech",
  "neon_carnival",
]);

function scrollToContent() {
  document.getElementById("event-content")?.scrollIntoView({ behavior: "smooth" });
}

function getVariantClasses(variant: TemplateVariant) {
  switch (variant) {
    case "poster":
      return "lg:grid-cols-[0.95fr_1.05fr] items-center";
    case "gallery":
      return "lg:grid-cols-[1.1fr_0.9fr] items-end";
    case "terminal":
      return "lg:grid-cols-[1fr_1fr] items-center";
    case "editorial":
      return "lg:grid-cols-[0.82fr_1.18fr] items-center";
    case "soft":
      return "lg:grid-cols-[1fr_0.95fr] items-center";
    default:
      return "lg:grid-cols-[1fr_1fr] items-center";
  }
}

export function TemplateUniversal({ event, children, presetId }: TemplateUniversalProps) {
  const preset = PRESETS[presetId] || PRESETS.zen;
  const isDark = darkPresets.has(preset.id);
  const imageShape =
    preset.variant === "poster"
      ? "rounded-[2rem] rotate-[-1deg]"
      : preset.variant === "terminal"
        ? "rounded-2xl"
        : preset.variant === "editorial"
          ? "rounded-none"
          : "rounded-[2.25rem]";

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        backgroundColor: preset.background,
        color: preset.text,
        backgroundImage: `radial-gradient(circle at 15% 10%, ${preset.glow}, transparent 32%), radial-gradient(circle at 85% 0%, ${preset.accentAlt}22, transparent 30%)`,
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .web-template-${preset.id} a {
              border-color: ${preset.border} !important;
            }
            .web-template-${preset.id} .break-inside-avoid {
              border-radius: ${preset.variant === "editorial" ? "0" : "1.25rem"} !important;
              background: ${preset.surface} !important;
              border: 1px solid ${preset.border} !important;
              overflow: hidden !important;
            }
            .web-template-${preset.id} h2,
            .web-template-${preset.id} h3 {
              color: ${preset.text} !important;
            }
            .web-template-${preset.id} p {
              color: ${preset.muted} !important;
            }
          `,
        }}
      />

      <main className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-10 px-5 pb-16 pt-28 md:px-10 lg:px-12">
        <div className={`grid grid-cols-1 gap-10 ${getVariantClasses(preset.variant)}`}>
          <ScrollReveal className={preset.variant === "poster" ? "lg:order-2" : ""}>
            <div
              className="relative overflow-hidden border shadow-2xl"
              style={{
                borderColor: preset.border,
                backgroundColor: preset.surface,
                boxShadow: `0 28px 90px ${preset.glow}`,
              }}
            >
              <div className={`relative aspect-[4/5] md:aspect-[16/10] ${imageShape}`}>
                {event.coverImage ? (
                  <Image
                    src={event.coverImage}
                    alt={event.title}
                    fill
                    priority
                    className="object-cover"
                    style={{ filter: preset.imageFilter }}
                  />
                ) : (
                  <div className="h-full w-full" style={{ backgroundColor: preset.surface }} />
                )}
                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(180deg, transparent 45%, ${preset.background}cc 100%)`,
                  }}
                />
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.12}>
            <section
              className="border p-6 shadow-xl backdrop-blur-xl md:p-8 lg:p-10"
              style={{
                backgroundColor: preset.variant === "terminal" ? "#020617cc" : preset.surface,
                borderColor: preset.border,
                borderRadius: preset.variant === "editorial" ? 0 : 28,
              }}
            >
              <p
                className="mb-4 text-[10px] font-black uppercase tracking-[0.28em]"
                style={{ color: preset.accent }}
              >
                {preset.eyebrow}
              </p>
              <h1
                className={`${preset.serif ? "font-serif" : "font-sans"} text-4xl font-black leading-[0.95] tracking-tight md:text-6xl lg:text-7xl`}
                style={{ color: preset.text }}
              >
                {event.title}
              </h1>
              <div className="my-6 h-px w-24" style={{ backgroundColor: preset.accent }} />
              <p className="max-w-2xl text-sm font-semibold leading-7 md:text-base" style={{ color: preset.muted }}>
                {event.description || "A curated gallery of moments from this event."}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  onClick={scrollToContent}
                  className="rounded-full px-6 py-3 text-xs font-black uppercase tracking-[0.18em] transition-transform hover:-translate-y-0.5"
                  style={{ backgroundColor: preset.accent, color: isDark ? "#050505" : "#ffffff" }}
                >
                  {preset.cta}
                </button>
                <span
                  className="rounded-full border px-4 py-3 text-xs font-black uppercase tracking-[0.16em]"
                  style={{ borderColor: preset.border, color: preset.muted }}
                >
                  {event.date || "Event Date"}
                </span>
              </div>
            </section>
          </ScrollReveal>
        </div>
      </main>

      {children && (
        <section id="event-content" className="relative z-10 px-5 pb-20 md:px-10 lg:px-12">
          <div
            className={`web-template-${preset.id} mx-auto max-w-7xl border p-5 md:p-8 lg:p-10`}
            style={{
              backgroundColor: preset.surface,
              borderColor: preset.border,
              borderRadius: preset.variant === "editorial" ? 0 : 32,
            }}
          >
            <div className="mb-10 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: preset.accent }}>
                  Event Collection
                </p>
                <h2
                  className={`${preset.serif ? "font-serif" : "font-sans"} mt-2 text-3xl font-black md:text-5xl`}
                  style={{ color: preset.text }}
                >
                  Gallery
                </h2>
              </div>
              <p className="max-w-sm text-sm font-semibold" style={{ color: preset.muted }}>
                Explore the albums and memories captured for this event.
              </p>
            </div>
            {children}
          </div>
        </section>
      )}
    </div>
  );
}

export const makeUniversalTemplate = (presetId: string) => {
  function WebTemplate(props: { event: Event; children?: React.ReactNode }) {
    return <TemplateUniversal {...props} presetId={presetId} />;
  }
  WebTemplate.displayName = `Template${presetId}`;
  return WebTemplate;
};

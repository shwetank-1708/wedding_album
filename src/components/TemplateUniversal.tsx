"use client";

import Image from "next/image";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

import { GALLERY_PRESETS, type TemplateVariant } from "@/lib/galleryPresets";
import { getReadableTextColor } from "@/lib/webTemplateTheme";

interface TemplateUniversalProps {
  event: Event;
  children?: React.ReactNode;
  presetId: string;
}


function scrollToContent() {
  document.getElementById("event-content")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
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
  const preset = GALLERY_PRESETS[presetId] || GALLERY_PRESETS.zen;
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

      <main className="mx-auto grid min-h-[80svh] max-w-7xl grid-cols-1 gap-10 px-5 pb-16 pt-28 md:px-10 lg:px-12">
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
                backgroundColor: preset.surface,
                borderColor: preset.border,
                borderRadius: preset.variant === "editorial" ? 0 : 28,
              }}
            >
              <p
                className="mb-4 text-[10px] font-black uppercase tracking-[0.28em]"
                style={{ color: preset.muted }}
              >
                {preset.eyebrow}
              </p>
              <h1
                className={`${preset.serif ? "font-serif" : "font-sans"} text-4xl break-words text-balance font-black leading-[1.08] tracking-tight md:text-6xl lg:text-7xl`}
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
                  style={{ backgroundColor: preset.accent, color: getReadableTextColor(preset.accent) }}
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
            className={`web-template-${preset.id} mx-auto max-w-7xl border p-3 sm:p-5 md:p-8`}
            style={{
              backgroundColor: preset.surface,
              borderColor: preset.border,
              borderRadius: preset.variant === "editorial" ? 0 : 32,
            }}
          >
            <div className="mb-10 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: preset.muted }}>
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

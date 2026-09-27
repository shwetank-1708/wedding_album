"use client";

import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { cn } from "@/lib/utils";
import { Crown, Sparkles, Calendar, MapPin, ArrowRight, ShieldCheck, Heart } from "lucide-react";

interface TemplateRoyalProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplateRoyal({ event, children }: TemplateRoyalProps) {
    const heroImageSrc = event.coverImage || "/royal_emerald_palace_hero.jpg";

    const scrollToContent = () => {
        const target = document.getElementById("royal-collection-section");
        if (target) {
            target.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <div className="min-h-screen bg-[#02231c] text-[#fcfbf7] font-serif selection:bg-[#cca43b] selection:text-[#02231c] relative overflow-hidden">
            {/* Ambient Imperial Lighting Gradients */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-[radial-gradient(circle,_rgba(204,164,59,0.08)_0%,_transparent_70%)] blur-3xl" />
                <div className="absolute bottom-0 left-1/3 w-[800px] h-[800px] bg-[radial-gradient(circle,_rgba(3,48,38,0.4)_0%,_transparent_70%)] blur-3xl" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_transparent_40%,_rgba(0,0,0,0.6)_100%)]" />
            </div>

            {/* Double Ornate Gold Frame Borders */}
            <div className="fixed inset-3 md:inset-5 border border-[#cca43b]/25 z-40 pointer-events-none rounded-sm" />
            <div className="fixed inset-4 md:inset-7 border border-[#cca43b]/10 z-40 pointer-events-none rounded-sm" />

            {/* Split Screen Hero Section (Matching Reference Mockup) */}
            <section id="hero" className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 pt-12 md:pt-20 pb-20 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center min-h-[calc(100vh-80px)]">

                {/* Left Column: Text Content & CTA */}
                <div className="lg:col-span-6 flex flex-col justify-center space-y-6 md:space-y-8 pr-0 lg:pr-4">
                    <ScrollReveal>
                        <div className="inline-flex items-center gap-2 border-b border-[#cca43b]/40 pb-1.5">
                            <span className="text-xs md:text-sm tracking-[0.35em] text-[#cca43b] uppercase font-sans font-light">
                                {event.date || "NITES • LUXURY WEDDING & CELEBRATION"}
                            </span>
                        </div>
                    </ScrollReveal>

                    <ScrollReveal delay={0.1}>
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-normal leading-[1.15] bg-gradient-to-r from-[#fffbf0] via-[#cca43b] to-[#e5c158] bg-clip-text text-transparent tracking-tight drop-shadow-sm">
                            {event.title || "An Elegant & Timeless Wedding"}
                        </h1>
                    </ScrollReveal>

                    <ScrollReveal delay={0.2}>
                        <p className="text-[#a3b899] text-base md:text-lg font-light leading-relaxed max-w-xl">
                            {event.description || "Entering a realm of imperial splendour and timeless elegance. Celebrating a monumental union of love, heritage, and royal celebrations."}
                        </p>
                    </ScrollReveal>

                    {/* Metadata Pill Indicators */}
                    <ScrollReveal delay={0.3}>
                        <div className="flex flex-wrap gap-4 text-xs font-sans text-[#a3b899] pt-2">
                            {event.date && (
                                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#021a15]/80 border border-[#cca43b]/25">
                                    <Calendar className="w-3.5 h-3.5 text-[#cca43b]" />
                                    <span>{event.date}</span>
                                </div>
                            )}
                            {(event as any).location && (
                                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#021a15]/80 border border-[#cca43b]/25">
                                    <MapPin className="w-3.5 h-3.5 text-[#cca43b]" />
                                    <span>{(event as any).location}</span>
                                </div>
                            )}
                        </div>
                    </ScrollReveal>

                    {/* Action CTA Button */}
                    <ScrollReveal delay={0.4}>
                        <div className="pt-4 flex items-center gap-4">
                            <button
                                onClick={scrollToContent}
                                className="inline-flex items-center gap-3 bg-[#cca43b] hover:bg-[#d9b348] text-[#02231c] text-xs font-bold uppercase tracking-[0.25em] px-8 py-4 rounded-full transition-all duration-300 transform hover:scale-[1.03] shadow-lg shadow-[#cca43b]/25 cursor-pointer"
                            >
                                <span>Explore Gallery</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </ScrollReveal>
                </div>

                {/* Right Column: Architectural Palace Entrance Visual */}
                <div className="lg:col-span-6 relative flex justify-center items-center">
                    <ScrollReveal delay={0.2} className="w-full max-w-lg lg:max-w-none">
                        <div className="relative aspect-[4/5] sm:aspect-[4/5] md:aspect-[16/14] lg:aspect-[4/5] rounded-[2.5rem] p-3 bg-gradient-to-b from-[#cca43b]/30 via-[#cca43b]/10 to-transparent border border-[#cca43b]/35 shadow-2xl shadow-black/80">

                            {/* Inner Framed Image */}
                            <div className="relative w-full h-full rounded-[2rem] overflow-hidden border border-[#cca43b]/40 group">
                                <Image
                                    src={heroImageSrc}
                                    alt={event.title || "Royal Palace"}
                                    fill
                                    className="object-cover object-center transition-transform duration-1000 group-hover:scale-105"
                                    priority
                                />
                                {/* Soft Vignette Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#02231c] via-transparent to-transparent opacity-50" />

                                {/* Ornate Corner Accents */}
                                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#cca43b] pointer-events-none" />
                                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#cca43b] pointer-events-none" />
                                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#cca43b] pointer-events-none" />
                                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#cca43b] pointer-events-none" />
                            </div>

                            {/* Floating Decorative Crest Pill */}
                            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-6 py-2.5 rounded-full bg-[#021a15] border border-[#cca43b]/50 text-[#cca43b] text-xs font-sans tracking-[0.25em] uppercase shadow-xl flex items-center gap-2">
                                <Heart className="w-3.5 h-3.5 fill-[#cca43b]" />
                                <span>Imperial Album</span>
                            </div>
                        </div>
                    </ScrollReveal>
                </div>
            </section>

            {/* Collection Section Header */}
            <div id="royal-collection-section" className="relative z-10 pt-16 pb-8 text-center px-4">
                <ScrollReveal>
                    <span className="text-xs font-sans tracking-[0.3em] uppercase text-[#cca43b] block mb-2">
                        Treasured Moments
                    </span>
                    <h2 className="text-3xl md:text-5xl font-serif text-[#fcfbf7] tracking-tight mb-4">
                        The Wedding Collection
                    </h2>
                    <div className="mx-auto w-32 h-[1px] bg-gradient-to-r from-transparent via-[#cca43b] to-transparent mb-8" />
                </ScrollReveal>
            </div>

            {/* Content Area for Gallery & Photos */}
            {children && (
                <main className="relative z-10 bg-[#021a15]/60 min-h-screen border-t border-[#cca43b]/15 py-8">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </main>
            )}

            {/* Footer */}
            <footer className="relative z-10 py-16 text-center border-t border-[#cca43b]/20 bg-[#021a15]">
                <div className="flex items-center justify-center gap-2 mb-3 text-[#cca43b]">
                    <Crown className="w-5 h-5" />
                </div>
                <p className="text-[#a3b899] text-xs font-sans tracking-[0.25em] uppercase">
                    Elegantly Captured • Royal Emerald Edition
                </p>
            </footer>
        </div>
    );
}

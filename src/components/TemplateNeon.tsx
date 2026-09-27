"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplateNeonProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplateNeon({ event, children }: TemplateNeonProps) {
    const scrollToContent = () => {
        const contentElement = document.getElementById("event-content");
        if (contentElement) {
            contentElement.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <div className="min-h-screen bg-[#070611] text-[#f8f7ff] font-sans selection:bg-[#ff3df2] selection:text-white relative overflow-x-hidden pb-32">
            {/* Custom Embedded CSS for targeting child Gallery components (SubEventsGrid & MasonryGrid) */}
            <style dangerouslySetInnerHTML={{ __html: `
                .neon-party-gallery-override a,
                .neon-party-gallery-override .break-inside-avoid {
                    border-radius: 1.25rem !important;
                    border: 1px solid rgba(255, 61, 242, 0.3) !important;
                    background: rgba(17, 16, 32, 0.75) !important;
                    backdrop-filter: blur(16px) !important;
                    box-shadow: 0 0 15px rgba(255, 61, 242, 0.15) !important;
                    transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1) !important;
                }
                .neon-party-gallery-override a:hover,
                .neon-party-gallery-override .break-inside-avoid:hover {
                    border-color: rgba(102, 232, 255, 0.8) !important;
                    box-shadow: 0 0 25px rgba(102, 232, 255, 0.4), 0 0 50px rgba(255, 61, 242, 0.25) !important;
                    transform: translateY(-4px) scale(1.01) !important;
                }
                .neon-party-gallery-override h2,
                .neon-party-gallery-override h3 {
                    color: #f8f7ff !important;
                    font-family: var(--font-inter), sans-serif !important;
                    font-weight: 800 !important;
                    letter-spacing: 0.05em !important;
                }
                .neon-party-gallery-override p {
                    color: #b9b1d9 !important;
                }
            ` }} />

            {/* Ambient Glowing Neon Light Orbs in Background */}
            <div className="fixed top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#ff3df2]/20 rounded-full blur-[120px] pointer-events-none z-0 animate-pulse" />
            <div className="fixed bottom-1/3 right-1/4 translate-x-1/2 w-96 h-96 bg-[#66e8ff]/20 rounded-full blur-[130px] pointer-events-none z-0 animate-pulse" style={{ animationDuration: "4s" }} />

            {/* Main Hero Header */}
            <main className="pt-36 pb-20 px-4 max-w-5xl mx-auto flex flex-col items-center justify-center text-center relative z-10">
                
                {/* Luminous Neon Micro-Badge */}
                <ScrollReveal>
                    <div className="inline-flex items-center gap-2.5 bg-[#111020]/90 border border-[#ff3df2]/50 px-5 py-2 rounded-full mb-8 shadow-[0_0_20px_rgba(255,61,242,0.35)] backdrop-blur-md">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#ff3df2] animate-ping" />
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.25em] text-[#ff3df2]">
                            ⚡ NIGHTLIFE & PARTY GALLERY ⚡
                        </span>
                    </div>
                </ScrollReveal>

                {/* Big Neon Glow Title */}
                <ScrollReveal delay={0.15}>
                    <h1 className="text-5xl sm:text-7xl md:text-8xl font-black uppercase tracking-tight text-white mb-6 drop-shadow-[0_0_35px_rgba(255,61,242,0.5)] leading-tight">
                        {event.title}
                    </h1>
                </ScrollReveal>

                {/* Event Description Glass Card */}
                {event.description && (
                    <ScrollReveal delay={0.25}>
                        <div className="max-w-2xl mx-auto mb-12 p-6 rounded-2xl bg-[#111020]/60 border border-white/10 backdrop-blur-xl shadow-[0_0_25px_rgba(0,0,0,0.5)]">
                            <p className="text-base md:text-lg font-medium text-[#b9b1d9] leading-relaxed">
                                &quot;{event.description}&quot;
                            </p>
                        </div>
                    </ScrollReveal>
                )}

                {/* Featured Cover Image with Neon Cyber Frame */}
                {event.coverImage && (
                    <ScrollReveal delay={0.35} className="w-full max-w-4xl mx-auto mb-16 px-2">
                        <div className="relative aspect-[16/9] w-full rounded-3xl overflow-hidden border-2 border-[#66e8ff]/50 shadow-[0_0_40px_rgba(102,232,255,0.3),0_0_80px_rgba(255,61,242,0.2)] group">
                            <Image
                                src={event.coverImage}
                                alt={event.title}
                                fill
                                className="object-cover group-hover:scale-105 transition-transform duration-700"
                                priority
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#070611] via-transparent to-transparent opacity-80" />
                        </div>
                    </ScrollReveal>
                )}

                {/* Action CTA Button */}
                <ScrollReveal delay={0.45}>
                    <button
                        onClick={scrollToContent}
                        className="px-10 py-4 rounded-full bg-gradient-to-r from-[#ff3df2] to-[#66e8ff] text-slate-950 font-black uppercase tracking-[0.2em] text-xs md:text-sm shadow-[0_0_30px_rgba(255,61,242,0.5)] hover:shadow-[0_0_50px_rgba(102,232,255,0.7)] hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
                    >
                        ENTER PARTY ALBUM ✦
                    </button>
                </ScrollReveal>

            </main>

            {/* Gallery Content Section */}
            {children && (
                <section id="event-content" className="relative z-10 max-w-7xl mx-auto px-4 pb-20">
                    <div className="text-center mb-12">
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#ff3df2] via-white to-[#66e8ff] drop-shadow-[0_0_20px_rgba(255,61,242,0.4)]">
                            PARTY MEMORIES
                        </h2>
                        <div className="w-24 h-1 mx-auto mt-4 bg-gradient-to-r from-[#ff3df2] to-[#66e8ff] rounded-full shadow-[0_0_10px_rgba(255,61,242,0.6)]" />
                    </div>

                    <div className="neon-party-gallery-override">
                        {children}
                    </div>
                </section>
            )}
        </div>
    );
}

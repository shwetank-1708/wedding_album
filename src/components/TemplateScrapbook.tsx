"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplateScrapbookProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplateScrapbook({ event, children }: TemplateScrapbookProps) {
    const scrollToContent = () => {
        const contentElement = document.getElementById("event-content");
        if (contentElement) {
            contentElement.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <div className="min-h-screen bg-[#f6f1e8] text-[#263331] font-sans selection:bg-[#d9826b] selection:text-white relative overflow-x-hidden pb-32">
            {/* Custom Embedded CSS for targeting child Gallery components (SubEventsGrid & MasonryGrid) */}
            <style dangerouslySetInnerHTML={{ __html: `
                .scrapbook-gallery-override a,
                .scrapbook-gallery-override .break-inside-avoid {
                    border-radius: 1.25rem !important;
                    border: 3px solid #e2d9cd !important;
                    background: #fffdf9 !important;
                    box-shadow: 0 6px 18px rgba(38, 51, 49, 0.08) !important;
                    transform: rotate(-1deg) !important;
                    margin-bottom: 1.5rem !important;
                    transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
                }
                .scrapbook-gallery-override a:nth-child(even),
                .scrapbook-gallery-override .break-inside-avoid:nth-child(even) {
                    transform: rotate(1.2deg) !important;
                }
                .scrapbook-gallery-override a:hover,
                .scrapbook-gallery-override .break-inside-avoid:hover {
                    transform: translate(-4px, -6px) rotate(0deg) scale(1.01) !important;
                    box-shadow: 0 14px 28px rgba(38, 51, 49, 0.14) !important;
                }
                .scrapbook-gallery-override h2,
                .scrapbook-gallery-override h3 {
                    color: #263331 !important;
                    font-family: var(--font-inter), sans-serif !important;
                    font-weight: 800 !important;
                }
                .scrapbook-gallery-override p {
                    color: #74827d !important;
                }
            ` }} />

            {/* Subtle Physical Paper Grain Overlay */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-0"
                 style={{
                     backgroundImage: "radial-gradient(#263331 30%, transparent 30%)",
                     backgroundSize: "20px 20px"
                 }}
            />

            {/* Background Doodles & Stamps */}
            <div className="fixed top-28 left-8 w-36 h-36 border-4 border-dashed border-[#d9826b]/40 rounded-full opacity-40 pointer-events-none -rotate-12 z-0" />
            <div className="fixed bottom-36 right-8 w-40 h-40 border-4 border-[#74827d]/30 pointer-events-none rotate-45 transform opacity-30 z-0" />

            {/* Main Header */}
            <main className="pt-36 pb-20 px-4 max-w-5xl mx-auto flex flex-col items-center justify-center text-center relative z-10">

                {/* Washi Tape Strip on Header Title */}
                <ScrollReveal>
                    <div className="relative inline-block mb-10">
                        {/* Washi Tape Accent */}
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 w-36 h-8 bg-[#d9826b]/25 border-y border-[#d9826b]/40 backdrop-blur-sm -rotate-2 z-20 shadow-sm rounded-sm" />

                        <div className="relative bg-[#fffdf9] border-2 border-[#e2d9cd] px-8 py-6 rounded-3xl shadow-md rotate-1">
                            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-[#263331] tracking-tight">
                                {event.title}
                            </h1>
                        </div>
                    </div>
                </ScrollReveal>

                {/* Event Description Card */}
                {event.description && (
                    <ScrollReveal delay={0.2}>
                        <div className="relative max-w-2xl mx-auto mb-16 px-4">
                            {/* Washi Tape Top Corner */}
                            <div className="absolute -top-3 right-6 w-24 h-6 bg-amber-200/80 border-t border-b border-amber-300/60 backdrop-blur-sm rotate-6 z-20 shadow-sm" />

                            <div className="bg-[#fffdf9] border-2 border-[#e2d9cd] p-6 rounded-2xl shadow-md -rotate-1">
                                <p className="font-serif italic text-lg md:text-xl text-[#74827d] leading-relaxed">
                                    &quot;{event.description}&quot;
                                </p>
                            </div>
                        </div>
                    </ScrollReveal>
                )}

                {/* Featured Cover Image as a Physical Polaroid Collage Card */}
                {event.coverImage && (
                    <ScrollReveal delay={0.35} className="w-full max-w-3xl mx-auto mb-16 px-2">
                        <div className="relative aspect-[4/3] md:aspect-[16/9] bg-[#fffdf9] border-2 border-[#e2d9cd] p-4 md:p-6 shadow-xl rounded-3xl transform rotate-1 hover:rotate-0 hover:scale-[1.01] transition-all duration-500 group">

                            {/* Top Left Washi Tape Pin */}
                            <div className="absolute -top-4 -left-2 w-28 h-7 bg-amber-200/80 border-t border-b border-amber-300/60 backdrop-blur-sm -rotate-12 z-20 shadow-sm" />

                            {/* Bottom Right Washi Tape Pin */}
                            <div className="absolute -bottom-4 -right-2 w-28 h-7 bg-[#d9826b]/30 border-t border-b border-[#d9826b]/50 backdrop-blur-sm rotate-6 z-20 shadow-sm" />

                            <div className="relative w-full h-full rounded-2xl overflow-hidden border border-[#e2d9cd] bg-stone-100">
                                <Image
                                    src={event.coverImage}
                                    alt={event.title}
                                    fill
                                    className="object-cover group-hover:scale-105 transition-transform duration-700"
                                    priority
                                />
                            </div>
                        </div>
                    </ScrollReveal>
                )}

                {/* Action CTA Button */}
                <ScrollReveal delay={0.45}>
                    <button
                        onClick={scrollToContent}
                        className="px-9 py-4 rounded-full bg-[#d9826b] hover:bg-[#c6715b] text-white font-bold uppercase tracking-widest text-xs md:text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 cursor-pointer"
                    >
                        EXPLORE KEEPSAKE ALBUM ➔
                    </button>
                </ScrollReveal>

            </main>

            {/* Gallery Content Section */}
            {children && (
                <section id="event-content" className="relative z-10 max-w-7xl mx-auto px-4 pb-20">
                    <div className="bg-[#fffdf9] border-2 border-[#e2d9cd] rounded-[2.5rem] p-6 md:p-12 shadow-lg relative overflow-hidden">

                        <div className="text-center mb-12">
                            <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-wider text-[#263331]">
                                KEEPSAKE MEMORIES
                            </h2>
                            <div className="w-16 h-1 bg-[#d9826b] mx-auto mt-3 rounded-full" />
                        </div>

                        <div className="scrapbook-gallery-override">
                            {children}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}

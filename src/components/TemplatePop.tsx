"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplatePopProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplatePop({ event, children }: TemplatePopProps) {
    return (
        <div className="min-h-screen bg-[#ffe84a] text-slate-900 font-sans selection:bg-[#ef2b3a] selection:text-white relative overflow-x-hidden pb-32">
            {/* Custom Embedded CSS Styles for targeting child Gallery components (SubEventsGrid & MasonryGrid) */}
            <style dangerouslySetInnerHTML={{ __html: `
                /* 1. SubEventsGrid Card Overrides */
                .pop-art-gallery-override a {
                    border-radius: 1.5rem !important;
                    border: 5px solid #111111 !important;
                    box-shadow: 8px 8px 0px 0px #111111 !important;
                    background-color: #fffdf3 !important;
                    transform: rotate(-1.5deg) !important;
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
                }
                .pop-art-gallery-override a:nth-child(even) {
                    transform: rotate(1.5deg) !important;
                }
                .pop-art-gallery-override a:hover {
                    transform: translate(-6px, -6px) rotate(0deg) !important;
                    box-shadow: 16px 16px 0px 0px #111111 !important;
                }
                .pop-art-gallery-override a h3 {
                    font-family: var(--font-inter), Helvetica, Arial, sans-serif !important;
                    font-weight: 950 !important;
                    text-transform: uppercase !important;
                    letter-spacing: -0.05em !important;
                    font-style: normal !important;
                    color: #111111 !important;
                }
                .pop-art-gallery-override a p {
                    font-weight: 800 !important;
                    color: #5b4b3d !important;
                }
                .pop-art-gallery-override a img {
                    filter: contrast(1.05) brightness(0.98) !important;
                    border-bottom: 4px solid #111111 !important;
                }

                /* 2. MasonryGrid Image Card Overrides */
                .pop-art-gallery-override .break-inside-avoid {
                    border-radius: 1.25rem !important;
                    border: 4px solid #111111 !important;
                    box-shadow: 6px 6px 0px 0px #111111 !important;
                    background-color: #fffdf3 !important;
                    overflow: hidden !important;
                    transform: rotate(-0.5deg) !important;
                    margin-bottom: 1.5rem !important;
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
                }
                .pop-art-gallery-override .break-inside-avoid:nth-child(even) {
                    transform: rotate(0.5deg) !important;
                }
                .pop-art-gallery-override .break-inside-avoid:hover {
                    transform: translate(-4px, -4px) rotate(0deg) !important;
                    box-shadow: 12px 12px 0px 0px #111111 !important;
                }

                /* 3. Section Headers & Text styling inside children */
                .pop-art-gallery-override h2 {
                    font-family: var(--font-inter), Helvetica, Arial, sans-serif !important;
                    font-weight: 950 !important;
                    text-transform: uppercase !important;
                    letter-spacing: -0.03em !important;
                }
            ` }} />

            {/* Halftone dot pattern overlay across the page */}
            <div className="fixed inset-0 pointer-events-none opacity-[0.06] z-0" 
                 style={{ 
                     backgroundImage: "radial-gradient(#111 25%, transparent 25%)", 
                     backgroundSize: "24px 24px" 
                 }} 
            />

            {/* Floating Doodles */}
            <div className="fixed top-36 left-[-2rem] w-32 h-32 border-8 border-black bg-[#0080ff] rounded-full opacity-20 pointer-events-none -rotate-12 z-0" />
            <div className="fixed bottom-40 right-[-3rem] w-40 h-40 border-8 border-black bg-[#ef2b3a] pointer-events-none rotate-45 transform opacity-20 z-0" />



            {/* Hero Main Content */}
            <main className="pt-36 pb-20 px-4 max-w-6xl mx-auto flex flex-col items-center justify-center text-center relative z-10">

                {/* Event Title Starburst Badge */}
                <ScrollReveal>
                    <div className="relative inline-block mb-12 transform -rotate-1 hover:rotate-0 transition-transform duration-300">
                        {/* Red Burst Background Shadow */}
                        <div className="absolute -inset-4 bg-[#ef2b3a] rounded-3xl transform rotate-2 border-4 border-black shadow-[8px_8px_0px_0px_#111111]" />
                        
                        {/* White/Cream Content container */}
                        <div className="relative bg-[#fffdf3] border-4 border-black px-8 py-5 rounded-3xl">
                            <h1 className="text-4xl sm:text-6xl md:text-8xl font-black uppercase text-[#111111] tracking-tighter leading-none select-none">
                                {event.title}
                            </h1>
                        </div>
                    </div>
                </ScrollReveal>

                {/* Event Description Speech Bubble */}
                <ScrollReveal delay={0.2}>
                    <div className="relative max-w-2xl mx-auto mb-16 px-4">
                        <div className="bg-[#fffdf3] border-4 border-black p-6 rounded-3xl shadow-[6px_6px_0px_0px_#111111] relative">
                            <p className="font-sans font-black text-lg md:text-2xl italic text-[#5b4b3d] leading-relaxed uppercase">
                                &quot;{event.description || "GET READY TO POP SOME AMAZING MEMORIES! MAKE IT ICONIC!"}&quot;
                            </p>
                            {/* Speech Bubble Tail */}
                            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 bg-[#fffdf3] border-b-4 border-r-4 border-black transform rotate-45" />
                        </div>
                    </div>
                </ScrollReveal>

                {/* Featured Cover Image Polaroid Cell with Starburst Stickers */}
                {event.coverImage && (
                    <ScrollReveal delay={0.4}>
                        <div className="relative w-full max-w-3xl mx-auto mb-20 px-4">
                            {/* Left Starburst Sticker "BOOM!" */}
                            <div className="absolute -top-10 -left-2 md:-left-12 z-20 bg-[#0080ff] text-white border-4 border-black font-black uppercase px-6 py-3 rounded-2xl transform -rotate-12 shadow-[4px_4px_0px_0px_#111111] hover:scale-110 transition-transform cursor-default select-none animate-bounce">
                                BOOM! 🎉
                            </div>
                            
                            {/* Right Starburst Sticker "YEAH!" */}
                            <div className="absolute -bottom-6 -right-2 md:-right-12 z-20 bg-[#ef2b3a] text-white border-4 border-black font-black uppercase px-6 py-3 rounded-2xl transform rotate-12 shadow-[4px_4px_0px_0px_#111111] hover:scale-110 transition-transform cursor-default select-none animate-pulse">
                                YEAH! 💥
                            </div>

                            {/* The Crooked Comic Frame */}
                            <div className="relative aspect-[4/3] md:aspect-[16/9] bg-white border-[6px] md:border-8 border-black p-4 md:p-6 shadow-[12px_12px_0px_0px_#111111] transform -rotate-1 hover:rotate-0 hover:scale-[1.01] hover:shadow-[18px_18px_0px_0px_#111111] transition-all duration-500 ease-out rounded-3xl overflow-hidden group">
                                <div className="relative w-full h-full overflow-hidden rounded-2xl border-4 border-black bg-stone-100">
                                    <Image
                                        src={event.coverImage}
                                        alt={event.title}
                                        fill
                                        className="object-cover bg-stone-50 group-hover:scale-105 transition-transform duration-700"
                                        priority
                                    />
                                    {/* High contrast comic-blend filter */}
                                    <div className="absolute inset-0 bg-[#ffe84a]/5 mix-blend-color-burn pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    </ScrollReveal>
                )}

                {/* Tactile Retro Action Button */}
                <ScrollReveal delay={0.5}>
                    <button
                        onClick={() => {
                            const contentElement = document.getElementById("event-content");
                            if (contentElement) {
                                contentElement.scrollIntoView({ behavior: "smooth" });
                            }
                        }}
                        className="group relative bg-[#ef2b3a] hover:bg-[#ff3d4c] text-white font-black uppercase border-4 border-black px-10 py-5 rounded-3xl shadow-[8px_8px_0px_0px_#111111] hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0px_0px_#111111] active:translate-x-2 active:translate-y-2 active:shadow-none transition-all duration-150 select-none cursor-pointer tracking-wider text-lg"
                    >
                        OPEN ALBUM ➔
                    </button>
                </ScrollReveal>

            </main>

            {/* Gallery Content Section */}
            {children && (
                <section id="event-content" className="relative z-10 max-w-7xl mx-auto px-4 pb-16">
                    {/* Comic Book Page Sheet */}
                    <div className="bg-[#fffdf3] border-[6px] md:border-8 border-black rounded-[2.5rem] p-6 md:p-12 shadow-[12px_12px_0px_0px_#111111] relative overflow-hidden">
                        
                        {/* Decorative Half-tone dots sidebar strip inside sheet */}
                        <div className="absolute top-0 right-0 w-8 md:w-16 h-full opacity-[0.04] pointer-events-none" 
                             style={{ 
                                 backgroundImage: "radial-gradient(#111 25%, transparent 25%)", 
                                 backgroundSize: "16px 16px" 
                             }} 
                        />
                        
                        {/* Section Header Banner */}
                        <div className="text-center mb-16 relative">
                            <div className="inline-block bg-[#0080ff] border-4 border-black px-8 py-3.5 rounded-2xl transform -rotate-1 shadow-[4px_4px_0px_0px_#111111]">
                                <h2 className="text-2xl md:text-4xl font-black uppercase text-white tracking-wider">
                                    THE COLLECTION
                                </h2>
                            </div>
                            <p className="mt-4 text-xs md:text-sm font-black uppercase tracking-widest text-[#5b4b3d] animate-pulse">
                                CLICK PANELS TO EXPLORE VIBES! ⚡
                            </p>
                        </div>
                        
                        {/* Main Grid Wrapper with our CSS selector overrides */}
                        <div className="relative z-10 pop-art-gallery-override">
                            {children}
                        </div>
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer className="text-center pt-16 pb-12 font-black text-slate-900 uppercase tracking-widest text-sm relative z-10">
                <div className="inline-block bg-white border-4 border-black px-6 py-2 rounded-2xl shadow-[4px_4px_0px_0px_#111111]">
                    {event.title} — {new Date().getFullYear()} — MADE WITH ❤️
                </div>
            </footer>
        </div>
    );
}

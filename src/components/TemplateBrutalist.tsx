"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { useRouter } from "next/navigation";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { navigateWithModifierClick } from "@/lib/navigation";
import { getWebLightboxTheme } from "@/lib/webTemplateTheme";

interface TemplateBrutalistProps {
    event: Event;
    subEvents?: Event[];
    photos?: any[];
    isShared?: boolean;
    user?: any;
    onBack?: () => void;
    onShare?: () => void;
    canManage?: boolean;
    onManage?: () => void;
    hasParent?: boolean;
    copied?: boolean;
    error?: string | null;
    children?: React.ReactNode;
}

export function TemplateBrutalist({
    event,
    subEvents = [],
    photos = [],
    isShared,
    user,
    children
}: TemplateBrutalistProps) {
    const router = useRouter();

    return (
        <div className="min-h-screen overflow-x-clip bg-[#171914] text-[#c0b49e] font-mono selection:bg-[#c0b49e] selection:text-[#171914] pb-20">

            {/* Grid Lines Overlay */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-20"
                style={{ backgroundImage: 'linear-gradient(to right, #3B3C32 1px, transparent 1px), linear-gradient(to bottom, #3B3C32 1px, transparent 1px)', backgroundSize: '40px 40px' }}
            />

            <header className="relative w-full border-b border-[#c0b49e]/50 bg-[#171914] z-10">
                {/* Top Bar */}
                <div className="flex flex-wrap gap-4 justify-between items-start p-4 md:p-12 border-b border-[#c0b49e]">
                    <div className="border border-[#c0b49e] p-2 text-xs uppercase bg-[#272921]/50">
                        <p>System: Wedding_OS</p>
                        <p>Status: Online</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase text-[#c0b49e]">ID: {event.id}</p>
                        <p className="text-[10px] uppercase text-[#c0b49e]">DATE: {event.date || "Unknown"}</p>
                    </div>
                </div>

                {/* Middle Hero */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                    <div className="min-w-0 p-6 md:p-12 border-r border-[#c0b49e] flex flex-col justify-center">
                        <ScrollReveal>
                            <h1 className="text-5xl md:text-6xl lg:text-8xl font-bold uppercase tracking-tighter leading-[1.02] mb-8 text-[#E6DFD3]  break-words">
                                {event.title}
                            </h1>
                        </ScrollReveal>
                        <ScrollReveal delay={0.2}>
                            <p className="text-sm md:text-base border-l-4 border-[#c0b49e] pl-4 max-w-md uppercase leading-relaxed font-bold bg-[#272921]/90 p-4 text-[#c0b49e]">
                                {event.description}
                            </p>
                        </ScrollReveal>
                    </div>

                    <div className="relative aspect-square md:aspect-auto h-[50vh] md:h-full border-t md:border-t-0 border-[#c0b49e] overflow-hidden transition-all duration-700">
                        {event.coverImage && (
                            <>
                                <Image src={event.coverImage} fill className="object-contain bg-[#171914]" alt="" priority />
                                <div className="absolute inset-0 bg-[#c0b49e]/20 mix-blend-overlay" />
                            </>
                        )}
                        <div className="absolute bottom-4 left-4 bg-[#c0b49e] text-[#171914] px-3 py-2 text-xs font-bold uppercase border-2 border-[#171914] shadow-[4px_4px_0_0_rgba(23,25,20,1)]">
                            Fig. 1.0 // Cover
                        </div>
                    </div>
                </div>

                {/* Bottom Marquee */}
                <div className="overflow-hidden whitespace-nowrap py-4 bg-[#c0b49e] text-[#171914] font-bold uppercase text-2xl tracking-widest border-t border-[#171914]">
                    <p className="animate-marquee">
                        SYSTEM.RENDER({event.title}) /// STATUS: ACTIVE /// SYSTEM.RENDER({event.title}) /// STATUS: ACTIVE ///
                    </p>
                </div>
            </header>

            {/* Custom Content Rendering */}
            <main className="relative z-10 border-x border-[#c0b49e]/30 max-w-[95%] mx-auto mt-12">
                {event.type === 'main' && subEvents.length > 0 && (
                    <div className="grid grid-cols-12 border border-[#c0b49e]/30 bg-[#272921]">
                        <div className="col-span-1 border-r border-[#c0b49e]/30 p-4 hidden md:flex items-center justify-center text-[10px] uppercase [writing-mode:vertical-rl] font-bold bg-[#c0b49e]/5 text-[#c0b49e]">
                            DIRECTORY / CONTENTS
                        </div>
                        <div className="col-span-12 md:col-span-11 p-4 md:p-12">
                            <div className="flex items-center space-x-4 mb-12">
                                <div className="h-4 w-4 bg-[#c0b49e] animate-pulse"></div>
                                <h2 className="text-3xl font-bold uppercase tracking-widest border-b-2 border-[#c0b49e] inline-block pb-2 text-[#E6DFD3]">Albums</h2>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                {subEvents.map((sub, idx) => (
                                    <div
                                        key={sub.id}
                                        onClick={(e) => navigateWithModifierClick(e, `/events/${sub.id}${isShared ? "?shared=true" : ""}`, router.push)}
                                        className="group cursor-pointer border-2 border-[#c0b49e] bg-[#171914] p-4 transition-all hover:bg-[#c0b49e] hover:text-[#171914] hover:-translate-y-2 hover:shadow-[8px_8px_0_0_rgba(152,139,113,0.5)]"
                                    >
                                        <div className="flex justify-between items-center mb-4 text-xs font-bold uppercase border-b border-current pb-2">
                                            <span>DIR_{String(idx + 1).padStart(2, '0')}</span>
                                            <span>{sub.date || "NULL"}</span>
                                        </div>
                                        <div className="relative aspect-video w-full overflow-hidden border border-current mb-4 grayscale group-hover:grayscale-0">
                                            {sub.coverImage ? (
                                                <Image src={sub.coverImage} fill className="object-cover" alt="" />
                                            ) : (
                                                <div className="w-full h-full bg-[#3B3C32] flex items-center justify-center text-xs">NO_IMAGE</div>
                                            )}
                                        </div>
                                        <h3 className="text-2xl font-bold uppercase truncate">{sub.title}</h3>
                                        <div className="mt-4 flex justify-end">
                                            <span className="text-[10px] bg-current text-[#171914] px-2 py-1 font-bold group-hover:bg-[#171914] group-hover:text-[#c0b49e]">VIEW GALLERY ➔</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {event.type === 'sub' && photos.length > 0 && (
                    <div className="grid grid-cols-12 border border-[#c0b49e]/30 bg-[#272921]">
                        <div className="col-span-1 border-r border-[#c0b49e]/30 p-4 hidden md:flex items-center justify-center text-[10px] uppercase [writing-mode:vertical-rl] font-bold bg-[#c0b49e]/5 text-[#c0b49e]">
                            IMAGE / BUFFER
                        </div>
                        <div className="col-span-12 md:col-span-11 p-4 md:p-12">
                            <div className="flex items-center space-x-4 mb-12">
                                <div className="h-4 w-4 border-2 border-[#c0b49e] bg-transparent"></div>
                                <h2 className="text-3xl font-bold uppercase tracking-widest border-b-2 border-[#c0b49e] inline-block pb-2 text-[#E6DFD3]">Gallery</h2>
                                <span className="text-xs ml-4 bg-[#c0b49e] text-[#171914] px-2 py-1 font-bold">[{photos.length} FILE(S)]</span>
                            </div>

                            <MasonryGrid
                                photos={photos}
                                eventSlug={event.id}
                                disableDownload={isShared && !user}
                                gridClassName="gap-4 md:gap-8"
                                itemClassName="border-2 border-[#c0b49e] bg-[#171914] rounded-none mix-blend-luminosity hover:mix-blend-normal hover:shadow-[8px_8px_0_0_rgba(152,139,113,0.5)] transition-all duration-300"
                                lightboxClassName="bg-[#171914]/98 backdrop-blur-none border-4 border-[#c0b49e] font-mono text-[#c0b49e] [&_.bg-white]:bg-[#272921] [&_.text-slate-900]:text-[#c0b49e] [&_.border-stone-100]:border-[#c0b49e] [&_input]:bg-[#171914] [&_input]:text-[#c0b49e] [&_button]:bg-[#c0b49e] [&_button]:text-[#171914]"
                                lightboxTheme={getWebLightboxTheme(event.templateId)}
                                templateId={event.templateId}
                            />
                        </div>
                    </div>
                )}

                {/* Fallback for standard content if empty or unmigrated */}
                {(!subEvents?.length && !photos?.length && children) && (
                    <div className="p-4 md:p-12 border border-[#c0b49e]/30 bg-[#272921]">
                        {children}
                    </div>
                )}
            </main>

            <footer className="mt-20 p-12 border-y border-[#c0b49e] bg-[#171914] text-[#c0b49e] text-xs uppercase font-bold text-center">
                [ END OF LINE ] /// SYSTEM.HALT
            </footer>
        </div>
    );
}

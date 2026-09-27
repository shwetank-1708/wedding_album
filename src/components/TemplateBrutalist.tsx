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
        <div className="min-h-screen bg-[#171914] text-[#988B71] font-mono selection:bg-[#988B71] selection:text-[#171914] pb-20">

            {/* Grid Lines Overlay */}
            <div className="fixed inset-0 z-0 pointer-events-none opacity-20"
                style={{ backgroundImage: 'linear-gradient(to right, #3B3C32 1px, transparent 1px), linear-gradient(to bottom, #3B3C32 1px, transparent 1px)', backgroundSize: '40px 40px' }}
            />

            <header className="relative w-full border-b border-[#988B71]/50 bg-[#171914] z-10">
                {/* Top Bar */}
                <div className="flex justify-between items-start p-4 md:p-12 border-b border-[#988B71]">
                    <div className="border border-[#988B71] p-2 text-xs uppercase bg-[#272921]/50">
                        <p>System: Wedding_OS</p>
                        <p>Status: Online</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] uppercase text-[#5B5746]">ID: {event.id}</p>
                        <p className="text-[10px] uppercase text-[#5B5746]">DATE: {event.date || "Unknown"}</p>
                    </div>
                </div>

                {/* Middle Hero */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                    <div className="p-8 md:p-16 border-r border-[#988B71] flex flex-col justify-center">
                        <ScrollReveal>
                            <h1 className="text-6xl md:text-8xl lg:text-[10rem] font-bold uppercase tracking-tighter leading-[0.85] mb-8 text-[#E6DFD3] mix-blend-difference break-words">
                                {event.title}
                            </h1>
                        </ScrollReveal>
                        <ScrollReveal delay={0.2}>
                            <p className="text-sm md:text-base border-l-4 border-[#988B71] pl-4 max-w-md uppercase leading-relaxed font-bold bg-[#272921]/90 p-4 text-[#988B71]">
                                {event.description}
                            </p>
                        </ScrollReveal>
                    </div>

                    <div className="relative aspect-square md:aspect-auto h-[50vh] md:h-full border-t md:border-t-0 border-[#988B71] overflow-hidden grayscale hover:grayscale-0 transition-all duration-700">
                        {event.coverImage && (
                            <>
                                <Image src={event.coverImage} fill className="object-contain bg-[#171914]" alt="" priority />
                                <div className="absolute inset-0 bg-[#988B71]/20 mix-blend-overlay" />
                            </>
                        )}
                        <div className="absolute bottom-4 left-4 bg-[#988B71] text-[#171914] px-3 py-2 text-xs font-bold uppercase border-2 border-[#171914] shadow-[4px_4px_0_0_rgba(23,25,20,1)]">
                            Fig. 1.0 // Cover
                        </div>
                    </div>
                </div>

                {/* Bottom Marquee */}
                <div className="overflow-hidden whitespace-nowrap py-4 bg-[#988B71] text-[#171914] font-bold uppercase text-2xl tracking-widest border-t border-[#171914]">
                    <p className="animate-marquee">
                        SYSTEM.RENDER({event.title}) /// STATUS: ACTIVE /// SYSTEM.RENDER({event.title}) /// STATUS: ACTIVE ///
                    </p>
                </div>
            </header>

            {/* Custom Content Rendering */}
            <main className="relative z-10 border-x border-[#988B71]/30 max-w-[95%] mx-auto mt-12">
                {event.type === 'main' && subEvents.length > 0 && (
                    <div className="grid grid-cols-12 border border-[#988B71]/30 bg-[#272921]">
                        <div className="col-span-1 border-r border-[#988B71]/30 p-4 hidden md:flex items-center justify-center text-[10px] uppercase [writing-mode:vertical-rl] font-bold bg-[#988B71]/5 text-[#5B5746]">
                            DIRECTORY / CONTENTS
                        </div>
                        <div className="col-span-12 md:col-span-11 p-4 md:p-12">
                            <div className="flex items-center space-x-4 mb-12">
                                <div className="h-4 w-4 bg-[#988B71] animate-pulse"></div>
                                <h2 className="text-3xl font-bold uppercase tracking-widest border-b-2 border-[#988B71] inline-block pb-2 text-[#E6DFD3]">Index_Folders</h2>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                                {subEvents.map((sub, idx) => (
                                    <div
                                        key={sub.id}
                                        onClick={(e) => navigateWithModifierClick(e, `/events/${sub.id}${isShared ? "?shared=true" : ""}`, router.push)}
                                        className="group cursor-pointer border-2 border-[#988B71] bg-[#171914] p-4 transition-all hover:bg-[#988B71] hover:text-[#171914] hover:-translate-y-2 hover:shadow-[8px_8px_0_0_rgba(152,139,113,0.5)]"
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
                                            <span className="text-[10px] bg-current text-[#171914] px-2 py-1 font-bold group-hover:bg-[#171914] group-hover:text-[#988B71]">EXECUTE ➔</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {event.type === 'sub' && photos.length > 0 && (
                    <div className="grid grid-cols-12 border border-[#988B71]/30 bg-[#272921]">
                        <div className="col-span-1 border-r border-[#988B71]/30 p-4 hidden md:flex items-center justify-center text-[10px] uppercase [writing-mode:vertical-rl] font-bold bg-[#988B71]/5 text-[#5B5746]">
                            IMAGE / BUFFER
                        </div>
                        <div className="col-span-12 md:col-span-11 p-4 md:p-12">
                            <div className="flex items-center space-x-4 mb-12">
                                <div className="h-4 w-4 border-2 border-[#988B71] bg-transparent"></div>
                                <h2 className="text-3xl font-bold uppercase tracking-widest border-b-2 border-[#988B71] inline-block pb-2 text-[#E6DFD3]">Data_Stream</h2>
                                <span className="text-xs ml-4 bg-[#988B71] text-[#171914] px-2 py-1 font-bold">[{photos.length} FILE(S)]</span>
                            </div>

                            <MasonryGrid
                                photos={photos}
                                eventSlug={event.id}
                                disableDownload={isShared && !user}
                                gridClassName="gap-4 md:gap-8"
                                itemClassName="border-2 border-[#988B71] bg-[#171914] rounded-none mix-blend-luminosity hover:mix-blend-normal hover:shadow-[8px_8px_0_0_rgba(152,139,113,0.5)] transition-all duration-300"
                                lightboxClassName="bg-[#171914]/98 backdrop-blur-none border-4 border-[#988B71] font-mono text-[#988B71] [&_.bg-white]:bg-[#272921] [&_.text-slate-900]:text-[#988B71] [&_.border-stone-100]:border-[#5B5746] [&_input]:bg-[#171914] [&_input]:text-[#988B71] [&_button]:bg-[#988B71] [&_button]:text-[#171914]"
                                lightboxTheme={getWebLightboxTheme(event.templateId)}
                                templateId={event.templateId}
                            />
                        </div>
                    </div>
                )}

                {/* Fallback for standard content if empty or unmigrated */}
                {(!subEvents?.length && !photos?.length && children) && (
                    <div className="p-4 md:p-12 border border-[#988B71]/30 bg-[#272921]">
                        {children}
                    </div>
                )}
            </main>

            <footer className="mt-20 p-12 border-y border-[#988B71] bg-[#171914] text-[#5B5746] text-xs uppercase font-bold text-center">
                [ END OF LINE ] /// SYSTEM.HALT
            </footer>
        </div>
    );
}

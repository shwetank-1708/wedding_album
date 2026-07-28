"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { useRouter } from "next/navigation";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { Play, Film } from "lucide-react";
import { navigateWithModifierClick } from "@/lib/navigation";
import { getWebLightboxTheme } from "@/lib/webTemplateTheme";

interface TemplateCinematicProps {
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

export function TemplateCinematic({
    event,
    subEvents = [],
    photos = [],
    isShared,
    user,
    children
}: TemplateCinematicProps) {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-purple-500 selection:text-white overflow-x-hidden">

            {/* Cinematic Letterbox effect */}
            <div className="fixed top-0 left-0 w-full h-12 bg-black z-[100] pointer-events-none" />
            <div className="fixed bottom-0 left-0 w-full h-12 bg-black z-[100] pointer-events-none" />

            {/* Background Glows */}
            <div className="fixed top-1/4 left-1/4 w-[800px] h-[800px] bg-purple-900/10 rounded-full blur-[128px] pointer-events-none" />
            <div className="fixed bottom-1/4 right-1/4 w-[800px] h-[800px] bg-blue-900/10 rounded-full blur-[128px] pointer-events-none" />

            {/* Hero */}
            <header className="relative w-full h-screen flex flex-col justify-end p-8 md:p-16 text-center md:text-left">
                {/* Fullscreen Video/Image Background */}
                <div className="absolute inset-0 z-0">
                    {event.coverImage && (
                        <Image
                            src={event.coverImage}
                            alt={event.title}
                            fill
                            className="object-contain opacity-50 block md:hidden"
                            priority
                        />
                    )}
                    {event.coverImage && (
                        <div
                            className="hidden md:block absolute inset-0 bg-contain bg-center opacity-40 will-change-transform"
                            style={{
                                backgroundImage: `url(${event.coverImage})`,
                                transform: 'scale(1.05)',
                                animation: 'slowPan 30s ease-in-out infinite alternate'
                            }}
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent" />
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay" />
                </div>

                <div className="relative z-10 max-w-5xl mx-auto md:mx-0 w-full flex flex-col md:flex-row items-end justify-between pb-12">
                    <div>
                        <ScrollReveal delay={0.2}>
                            <div className="flex items-center justify-center md:justify-start space-x-3 text-purple-400 font-bold tracking-[0.4em] uppercase mb-6 text-xs animate-pulse">
                                <Film className="w-4 h-4" />
                                <span>A Cinematic Experience</span>
                            </div>
                        </ScrollReveal>

                        <ScrollReveal>
                            <h1 className="text-5xl md:text-7xl lg:text-9xl font-bold tracking-tighter mb-4 leading-[0.9] text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-500 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                                {event.title}
                            </h1>
                        </ScrollReveal>

                        <ScrollReveal delay={0.4}>
                            <p className="text-lg md:text-2xl text-gray-600 font-light max-w-2xl leading-relaxed mt-6">
                                {event.description}
                            </p>
                        </ScrollReveal>
                    </div>

                    <ScrollReveal delay={0.6} className="hidden md:block">
                        <div className="flex flex-col items-center space-y-4">
                            <div className="w-px h-24 bg-gradient-to-b from-transparent via-purple-500 to-transparent" />
                            <span className="text-xs uppercase tracking-[0.3em] font-bold text-gray-700 [writing-mode:vertical-rl] rotate-180">Scroll to Explore</span>
                        </div>
                    </ScrollReveal>
                </div>
            </header>

            {/* Custom Content Stream */}
            <main className="relative z-10 py-12 md:py-24 px-6 md:px-16 lg:px-24">

                {event.type === 'main' && subEvents.length > 0 && (
                    <div className="max-w-[100rem] mx-auto">
                        <div className="flex items-center justify-between mb-16 border-b border-gray-800 pb-6">
                            <h2 className="text-2xl md:text-4xl font-light tracking-widest text-white uppercase">Scenes</h2>
                            <span className="text-sm text-gray-700 font-mono">01 // {String(subEvents.length).padStart(2, '0')}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 md:gap-8">
                            {subEvents.map((sub, idx) => (
                                <ScrollReveal key={sub.id} delay={idx * 0.1}>
                                    <div
                                        onClick={(e) => navigateWithModifierClick(e, `/events/${sub.id}${isShared ? "?shared=true" : ""}`, router.push)}
                                        className="group cursor-pointer block"
                                    >
                                        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl shadow-2xl mb-6 bg-gray-900 border border-gray-800 group-hover:border-purple-500/50 transition-colors duration-500">
                                            {sub.coverImage ? (
                                                <Image
                                                    src={sub.coverImage}
                                                    fill
                                                    className="object-cover transform group-hover:scale-105 transition-transform duration-1000 ease-out brightness-75 group-hover:brightness-100"
                                                    alt=""
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-700 font-mono text-xs">NO SIGNAL</div>
                                            )}

                                            {/* Play Button Overlay */}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                                <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                                                    <Play className="w-6 h-6 text-white ml-1 shadow-lg" fill="currentColor" />
                                                </div>
                                            </div>

                                            {/* Letterbox on cards */}
                                            <div className="absolute top-0 left-0 w-full h-4 bg-black/80 pointer-events-none" />
                                            <div className="absolute bottom-0 left-0 w-full h-4 bg-black/80 pointer-events-none" />
                                        </div>

                                        <div className="flex justify-between items-end">
                                            <div>
                                                <h3 className="text-xl font-bold tracking-wide uppercase text-gray-200 group-hover:text-white transition-colors">
                                                    {sub.title}
                                                </h3>
                                            </div>
                                            <span className="text-xs font-mono text-gray-600 group-hover:text-purple-400 transition-colors">
                                                CH.{String(idx + 1).padStart(2, '0')}
                                            </span>
                                        </div>
                                    </div>
                                </ScrollReveal>
                            ))}
                        </div>
                    </div>
                )}

                {event.type === 'sub' && photos.length > 0 && (
                    <div className="max-w-[100rem] mx-auto">
                        <div className="flex items-center justify-between mb-16 border-b border-gray-800 pb-6">
                            <h2 className="text-2xl md:text-4xl font-light tracking-widest text-white uppercase">Reel</h2>
                            <span className="text-sm text-gray-700 font-mono">FRAMES // {String(photos.length).padStart(3, '0')}</span>
                        </div>

                        <MasonryGrid
                            photos={photos}
                            eventSlug={event.id}
                            disableDownload={isShared && !user}
                            gridClassName="gap-3 md:gap-6 lg:px-12"
                            itemClassName="bg-[#0a0a0a] rounded-xl border border-white/5 opacity-80 hover:opacity-100 hover:scale-[1.02] hover:shadow-[0_20px_40px_-15px_rgba(168,85,247,0.3)] hover:z-10 transition-all duration-500 ease-out"
                            lightboxClassName="bg-black/98 backdrop-blur-3xl font-mono [&_.bg-white]:bg-gray-900 [&_.text-slate-900]:text-white [&_.text-stone-600]:text-gray-600 [&_.border-stone-100]:border-gray-800 [&_input]:bg-black [&_input]:text-white [&_input]:border-gray-800 [&_button.bg-slate-900]:bg-purple-600 [&_button.bg-slate-900]:hover:bg-purple-500"
                            lightboxTheme={getWebLightboxTheme(event.templateId)}
                            templateId={event.templateId}
                        />
                    </div>
                )}

                {/* Fallback for standard content */}
                {(!subEvents?.length && !photos?.length && children) && (
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                )}

            </main>

            <footer className="bg-[#050505] pt-20 pb-24 text-center text-gray-600 relative z-10">
                <div className="w-24 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent mx-auto mb-8" />
                <p className="text-[10px] font-mono uppercase tracking-[0.5em] text-gray-700">
                    A Wedding_OS Production
                </p>
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @keyframes slowPan {
                        0% { background-position: 0% 50%; }
                        100% { background-position: 100% 50%; }
                    }
                `}} />
            </footer>
        </div>
    );
}

"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplateBohemianProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplateBohemian({ event, children }: TemplateBohemianProps) {
    return (
        <div className="min-h-screen bg-[#f3e8d3] text-[#38241b] font-sans selection:bg-[#73863a]/30">
            {/* Texture Overlay */}
            <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-0 mix-blend-multiply" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/paper-fibers.png")' }}></div>

            {/* Hero Section */}
            <header className="relative w-full min-h-[90vh] flex flex-col items-center justify-center p-6 pt-24">

                {/* Organic Shape Background */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-[#e6d7bb] rounded-[40%_60%_70%_30%/50%_60%_30%_60%] blur-3xl opacity-40 animate-pulse duration-[10s]" />

                <div className="relative z-10 text-center max-w-4xl mx-auto">
                    <ScrollReveal>
                        <div className="inline-block border border-[#73863a] rounded-full px-6 py-2 mb-8 bg-[#fffdf9]/70 backdrop-blur-sm shadow-sm">
                            <span className="text-sm font-medium tracking-[0.2em] uppercase text-[#73863a]">
                                {event.date || "Pure & Simple"}
                            </span>
                        </div>
                    </ScrollReveal>

                    <ScrollReveal delay={0.2}>
                        <h1 className="text-6xl md:text-8xl lg:text-9xl font-serif text-[#38241b] mb-8 leading-tight">
                            {event.title.toLowerCase()}
                        </h1>
                    </ScrollReveal>

                    <ScrollReveal delay={0.4}>
                        <p className="text-xl md:text-2xl font-light italic text-[#7d6457] max-w-2xl mx-auto leading-relaxed">
                            ~ {event.description} ~
                        </p>
                    </ScrollReveal>
                </div>

                {/* Floating Images (Decorative) */}
                {event.coverImage && (
                    <div className="absolute bottom-0 right-0 md:right-10 w-64 md:w-96 aspect-[3/4] rotate-6 translate-y-20 opacity-80 z-0 hidden md:block">
                        <div className="relative w-full h-full rounded-t-[10rem] overflow-hidden border-4 border-[#fffdf9] shadow-xl">
                            <Image src={event.coverImage} alt="" fill className="object-cover" />
                        </div>
                    </div>
                )}
            </header>

            {/* Wrapper for Content */}
            {children && (
                <main className="relative z-10 bg-[#fffdf9] rounded-t-[3rem] shadow-[0_-20px_60px_rgba(47,27,18,0.08)] min-h-screen py-24 px-4">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-20">
                            <span className="text-[#73863a] text-4xl">❖</span>
                            <h2 className="text-3xl font-serif text-[#38241b] mt-4">Memories</h2>
                        </div>
                        {children}
                    </div>
                </main>
            )}

            <footer className="bg-[#2f1b12] py-16 text-center text-[#f3e8d3]/80">
                <p className="font-serif italic text-lg">Thank you for sharing our joy.</p>
            </footer>
        </div>
    );
}

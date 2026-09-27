"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplatePolaroidProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplatePolaroid({ event, children }: TemplatePolaroidProps) {
    const explicitYear = event.date?.match(/\b(?:19|20)\d{2}\b/)?.[0];
    const parsedDate = event.date ? new Date(event.date) : null;
    const eventYear = explicitYear || (parsedDate && !Number.isNaN(parsedDate.getTime())
        ? String(parsedDate.getFullYear())
        : null);

    return (
        <div className="relative min-h-screen overflow-x-clip bg-[#f7efe1] font-sans text-[#3f2a1e] selection:bg-[#b45309] selection:text-white">
            {/* Background Patterns (Corkboard / Texture) */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(#806653 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

            <header className="relative flex w-full flex-col items-center px-4 pb-20 pt-28 sm:px-6">
                <ScrollReveal className="w-full max-w-2xl">
                    <div className="relative mx-auto w-full rotate-[-2deg] bg-[#fffaf0] p-3 pb-6 shadow-xl transition-transform duration-500 hover:rotate-0 motion-reduce:rotate-0 motion-reduce:transition-none sm:p-4 sm:pb-8">
                        {/* Tape Effect */}
                        <div className="absolute -top-5 left-1/2 h-9 w-28 -translate-x-1/2 rotate-2 bg-[#ead7ad]/90 shadow-sm sm:-top-6 sm:h-10 sm:w-32" />

                        {event.coverImage ? (
                            <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#e7dcc9] grayscale-[16%] sepia-[24%]">
                                <Image src={event.coverImage} alt={event.title} fill className="object-cover" priority />
                            </div>
                        ) : (
                            <div className="flex aspect-[4/3] w-full items-center justify-center bg-[#e7dcc9] text-[#806653]">
                                No Preview
                            </div>
                        )}

                        <h1 className="mt-5 break-words px-2 text-center text-3xl font-bold leading-tight text-[#3f2a1e] sm:text-4xl md:text-5xl" style={{ fontFamily: "var(--font-inter), Helvetica, Arial, sans-serif" }}>
                            {event.title}
                        </h1>
                    </div>
                </ScrollReveal>

                <div className="relative mx-auto mt-12 w-full max-w-xl px-2 text-center">
                    {eventYear && (
                        <div className="mx-auto mb-6 flex h-20 w-20 -rotate-12 items-center justify-center rounded-full bg-[#b45309] shadow-md motion-safe:animate-pulse motion-reduce:animate-none sm:absolute sm:-right-6 sm:top-0 sm:mb-0">
                            <span className="text-center text-xs font-bold uppercase tracking-widest text-white">Since<br />{eventYear}</span>
                        </div>
                    )}

                    <ScrollReveal delay={0.2}>
                        {event.description && (
                            <p className="font-serif text-xl italic leading-relaxed text-[#806653] sm:pr-16">
                                &ldquo;{event.description}&rdquo;
                            </p>
                        )}
                    </ScrollReveal>
                </div>
            </header>

            {children && (
                <main className="relative w-full py-12">
                    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                        {children}
                    </div>
                </main>
            )}

            <footer className="relative py-12 text-center font-mono text-xs text-[#806653]">
                Captured on Film
            </footer>
        </div>
    );
}

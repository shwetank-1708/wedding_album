"use client";

import React from "react";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplateMuseumProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplateMuseum({ event, children }: TemplateMuseumProps) {
    return (
        <div className="min-h-screen bg-[#0D1117] text-[#A7B7C9] font-sans selection:bg-[#263544] selection:text-[#A7B7C9]">

            {/* Header */}
            <header className="pt-40 pb-20 px-4 md:px-12 max-w-[90rem] mx-auto">
                <div className="grid grid-cols-12 gap-8">
                    <div className="col-span-12 md:col-span-8">
                        <ScrollReveal>
                            <h1 className="text-4xl md:text-6xl font-light tracking-tight text-[#A7B7C9] mb-2">
                                {event.title}
                            </h1>
                        </ScrollReveal>
                        <ScrollReveal delay={0.1}>
                            <p className="text-xs font-bold uppercase tracking-widest text-[#798FAF]">
                                Exhibit {new Date().getFullYear()} • Collection No. 001
                            </p>
                        </ScrollReveal>
                    </div>

                    <div className="col-span-12 md:col-span-4 flex flex-col justify-end space-y-4">
                        <ScrollReveal delay={0.2}>
                            <div className="w-full h-px bg-[#263544]" />
                        </ScrollReveal>
                        <ScrollReveal delay={0.3}>
                            <p className="text-sm md:text-base text-[#798FAF] font-light leading-relaxed">
                                {event.description}
                            </p>
                        </ScrollReveal>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            {children && (
                <main className="px-4 md:px-12 pb-32">
                    <div className="max-w-[90rem] mx-auto">
                        <div className="museum-grid">
                            {children}
                        </div>
                    </div>
                </main>
            )}

            <footer className="py-12 border-t border-[#1C2430] mx-12">
                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-[#798FAF] font-mono">
                    <p>MUSEUM OF MEMORIES</p>
                    <p>{event.date}</p>
                </div>
            </footer>
        </div>
    );
}

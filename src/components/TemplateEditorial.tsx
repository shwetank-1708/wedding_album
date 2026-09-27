"use client";

import React from "react";
import Image from "next/image";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplateEditorialProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplateEditorial({ event, children }: TemplateEditorialProps) {
    return (
        <div className="min-h-screen bg-white text-[#111827] font-sans selection:bg-[#111827] selection:text-white">
            {/* Header */}
            <header className="relative w-full pt-28 pb-12 border-b-4 border-black">
                <div className="max-w-[90rem] mx-auto px-6 grid grid-cols-12 gap-6 items-end">

                    <div className="col-span-12 lg:col-span-8">
                        <ScrollReveal>
                            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-[6.5vw] xl:text-[7vw] leading-[0.88] font-black tracking-tighter uppercase mb-4 text-[#111827] break-words max-w-full">
                                {event.title.split(' ')[0]}
                                {event.title.split(' ').length > 1 && (
                                    <>
                                        <br />
                                        <span className="text-[#111827] block mt-1">
                                            {event.title.split(' ').slice(1).join(' ')}
                                        </span>
                                    </>
                                )}
                            </h1>
                        </ScrollReveal>
                    </div>

                    <div className="col-span-12 lg:col-span-4 flex flex-col justify-end items-start lg:items-end mb-4">
                        <ScrollReveal delay={0.2}>
                            <p className="font-serif text-xl sm:text-2xl italic mb-4 max-w-sm lg:text-right text-[#1f2937]">
                                {event.description}
                            </p>
                            <div className="bg-[#111827] text-white px-4 py-2 text-sm font-bold uppercase tracking-widest inline-block transform -rotate-2">
                                {event.date || "Edition 01"}
                            </div>
                        </ScrollReveal>
                    </div>
                </div>
            </header>

            {/* Hero Image Band */}
            {event.coverImage && (
                <section className="w-full h-[60vh] md:h-[80vh] relative overflow-hidden border-b-4 border-black">
                    <Image
                        src={event.coverImage}
                        alt={event.title}
                        fill
                        className="object-contain bg-white grayscale hover:grayscale-0 transition-all duration-700"
                        priority
                    />
                    <div className="absolute inset-0 bg-black/10" />

                    <div className="absolute bottom-8 left-8 bg-white/95 backdrop-blur p-4 border border-black max-w-sm shadow-md">
                        <p className="text-xs font-mono uppercase tracking-tight text-[#111827]">
                            Featured Collection • {new Date().getFullYear()} • Vol. 1
                        </p>
                    </div>
                </section>
            )}

            {/* Main Content */}
            {children && (
                <main className="py-20 px-4 md:px-8">
                    <div className="max-w-[90rem] mx-auto">
                        <div className="flex items-center justify-between border-b border-black pb-4 mb-12">
                            <h2 className="text-4xl font-bold uppercase tracking-tighter text-[#111827]">Galleries</h2>
                            <span className="font-mono text-xl text-[#374151]">(08)</span>
                        </div>
                        {children}
                    </div>
                </main>
            )}

            <footer className="bg-[#111827] text-white py-16 px-8">
                <div className="max-w-[90rem] mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div>
                        <h3 className="text-6xl font-serif italic mb-4">The End.</h3>
                    </div>
                    <div className="flex flex-col justify-end items-start md:items-end font-mono text-sm text-gray-300 uppercase">
                        <p>{event.title} © {new Date().getFullYear()}</p>
                        <p>Editorial Template</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}

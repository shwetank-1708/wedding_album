"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Event } from "@/lib/firestore";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplateClassicProps {
    event: Event;
}

export function TemplateClassic({ event }: TemplateClassicProps) {
    return (
        <div className="min-h-screen bg-[#f8f5f2] text-slate-800 font-sans selection:bg-rose-200">
            {/* Header / Navigation Placeholder */}
            <header className="fixed top-0 inset-x-0 z-50 p-6 flex justify-center mix-blend-multiply">
                <div className="text-xl tracking-widest uppercase font-serif border-b border-slate-800 pb-1">
                    {event.date || "Save the Date"}
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-32 pb-20 px-4 max-w-4xl mx-auto text-center">

                {/* Title Section */}
                <ScrollReveal>
                    <h1 className="text-6xl md:text-9xl font-serif text-slate-900 mb-8 tracking-tighter loading-none">
                        {event.title}
                    </h1>
                </ScrollReveal>

                <ScrollReveal delay={0.2}>
                    <div className="w-24 h-1 bg-rose-400 mx-auto mb-12" />
                </ScrollReveal>

                <ScrollReveal delay={0.3}>
                    <p className="text-xl md:text-2xl font-light text-slate-600 mb-16 max-w-2xl mx-auto italic leading-relaxed">
                        &quot;{event.description || "Join us in celebrating our special day."}&quot;
                    </p>
                </ScrollReveal>

                {/* Hero Image - Centered and framed */}
                <ScrollReveal delay={0.4} direction="up">
                    <div className="relative aspect-[3/4] md:aspect-[16/9] w-full max-w-3xl mx-auto mb-16 p-4 bg-white shadow-2xl rotate-1 hover:rotate-0 transition-transform duration-700 ease-out">
                        <div className="relative w-full h-full overflow-hidden border border-slate-100">
                            {event.coverImage ? (
                                <Image
                                    src={event.coverImage}
                                    alt={event.title}
                                    fill
                                    className="object-cover hover:scale-105 transition-transform duration-[2s]"
                                    priority
                                />
                            ) : (
                                <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400">
                                    No Cover Image
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollReveal>

                {/* Action Button */}
                <ScrollReveal delay={0.6}>
                    <Link href="/gallery" className="group inline-flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-full hover:bg-rose-500 transition-colors duration-300 shadow-lg">
                        <span className="uppercase tracking-widest text-sm font-medium">Open Guest Gallery</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 group-hover:translate-x-1 transition-transform">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                    </Link>
                </ScrollReveal>

            </main>

            {/* Footer */}
            <footer className="py-12 text-center text-slate-400 text-sm uppercase tracking-widest">
                {event.title} — {new Date().getFullYear()}
            </footer>
        </div>
    );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Event } from "@/lib/database";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

interface TemplateClassicProps {
    event: Event;
    children?: React.ReactNode;
}

export function TemplateClassic({ event, children }: TemplateClassicProps) {
    const scrollToContent = () => {
        const contentElement = document.getElementById('event-content');
        if (contentElement) {
            contentElement.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen bg-[#f8f5f2] text-slate-800 font-sans selection:bg-rose-200">
            {/* Main Content */}
            <main className="pt-32 pb-20 px-4 max-w-4xl mx-auto text-center min-h-screen flex flex-col justify-center">

                {/* Title Section */}
                <ScrollReveal>
                    <h1 className="text-6xl md:text-9xl font-serif text-slate-900 mb-8 tracking-tighter leading-none">
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
                    <div className="relative aspect-[3/4] md:aspect-[16/9] w-full max-w-3xl mx-auto mb-16 p-4 bg-white shadow-xl rotate-1 hover:rotate-0 transition-transform duration-700 ease-out">
                        <div className="relative w-full h-full overflow-hidden border border-slate-100">
                            {event.coverImage ? (
                                <Image
                                    src={event.coverImage}
                                    alt={event.title}
                                    fill
                                    className="object-contain bg-slate-50 hover:scale-105 transition-transform duration-[2s]"
                                    priority
                                />
                            ) : (
                                <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-600">
                                    No Cover Image
                                </div>
                            )}
                        </div>
                    </div>
                </ScrollReveal>

                {/* Action Button */}
                <ScrollReveal delay={0.6}>
                    <button
                        onClick={scrollToContent}
                        className="group inline-flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-full hover:bg-rose-500 transition-colors duration-300 shadow-lg"
                    >
                        <span className="uppercase tracking-widest text-sm font-medium">Open Guest Gallery</span>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 group-hover:translate-x-1 transition-transform">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                    </button>
                </ScrollReveal>

            </main>

            {children && (
                <section id="event-content" className="bg-white py-20 min-h-screen">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl font-serif italic text-slate-800">The Gallery</h2>
                            <div className="w-12 h-0.5 bg-rose-400 mx-auto mt-4" />
                        </div>
                        {children}
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer className="py-12 text-center text-slate-600 text-sm uppercase tracking-widest bg-[#f8f5f2]">
                {event.title} — {new Date().getFullYear()}
            </footer>
        </div>
    );
}

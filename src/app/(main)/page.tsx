"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { ArrowRight, Camera, Sparkles } from "lucide-react";

export default function Home() {
    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end start"]
    });

    // Parallax effect: Image moves slower than scroll
    const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
    const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

    return (
        <div className="flex flex-col min-h-screen bg-[var(--site-bg)] font-serif text-[var(--site-text)] selection:bg-royal-gold/30" ref={containerRef}>
            {/* Hero Section with Parallax */}
            <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
                <motion.div style={{ y, opacity }} className="absolute inset-0 z-0 h-[120%] -top-[10%]">
                    <Image
                        src="https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1400&auto=format&fit=crop"
                        alt="Royal Couple"
                        fill
                        className="object-cover object-[50%_35%] opacity-90"
                        priority
                    />
                </motion.div>

                {/* Subtle gradient for text readability */}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/20 to-transparent z-0 hero-overlay"></div>

                {/* Hero Content */}
                <div className="relative z-10 text-center space-y-8 px-4 mt-20 max-w-5xl mx-auto">
                    <ScrollReveal direction="down" delay={0.2}>
                        <div className="inline-flex items-center space-x-3 px-6 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-2xl hero-chip">
                            <Sparkles className="w-4 h-4 text-royal-gold" />
                            <p className="text-xs md:text-sm text-white font-bold uppercase tracking-[0.3em]">
                                Premium Wedding Photography
                            </p>
                        </div>
                    </ScrollReveal>

                    <ScrollReveal delay={0.4}>
                        <h1 className="text-5xl md:text-8xl font-bold text-white drop-shadow-2xl tracking-tight leading-tight italic hero-title">
                            Capturing <span className="text-royal-gold">Timeless</span> Moments
                        </h1>
                    </ScrollReveal>

                    <ScrollReveal delay={0.6}>
                        <p className="text-lg md:text-2xl text-white/90 font-sans font-light tracking-wide max-w-2xl mx-auto leading-relaxed drop-shadow-lg hero-subtitle">
                            Where every frame tells a story of elegance, and every moment becomes a masterpiece.
                        </p>
                    </ScrollReveal>

                    <div className="mt-12 flex flex-col md:flex-row gap-6 justify-center items-center">
                        <ScrollReveal direction="left" delay={0.8}>
                            <Link href="/sample-galleries" className="group">
                                <span className="inline-flex items-center space-x-3 px-10 py-5 bg-white text-slate-900 hover:bg-slate-100 transition-all duration-500 uppercase tracking-widest text-sm font-bold rounded-full shadow-2xl hover:scale-105 transform hero-btn-portfolio">
                                    <span>View Samples</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </Link>
                        </ScrollReveal>

                        <ScrollReveal direction="right" delay={1.0}>
                            <Link href="/login" className="group">
                                <span className="inline-flex items-center space-x-3 px-10 py-5 bg-transparent border-2 border-white/60 text-white hover:bg-white/10 backdrop-blur-sm transition-all duration-500 uppercase tracking-widest text-sm font-bold rounded-full hover:shadow-2xl hover:scale-105 transform hero-btn-book">
                                    <span>Create Account</span>
                                </span>
                            </Link>
                        </ScrollReveal>
                    </div>

                    <ScrollReveal delay={1.1}>
                        <Link href="/login" className="inline-flex text-sm font-bold text-white/80 underline decoration-white/25 underline-offset-4 transition-colors hover:text-white hover:decoration-white">
                            Already have an account? Login
                        </Link>
                    </ScrollReveal>
                </div>
                
                {/* Scroll Indicator */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2, duration: 1 }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center space-y-2"
                >
                    <div className="w-px h-12 bg-gradient-to-b from-royal-gold to-transparent"></div>
                    <span className="text-[10px] text-white/50 uppercase tracking-[0.4em] font-sans">Scroll</span>
                </motion.div>
            </section>

            {/* About Section */}
            <section className="py-32 px-4 md:px-12 max-w-7xl mx-auto w-full bg-[var(--site-bg)] relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-24 items-center">
                    <ScrollReveal direction="left" delay={0.2}>
                        <div className="relative aspect-[3/4] w-full max-w-md mx-auto shadow-2xl rounded-[3rem] overflow-hidden group border-8 border-[var(--site-border)]">
                            <Image
                                src="https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1400&auto=format&fit=crop"
                                alt="Photographer"
                                fill
                                className="object-cover transition-transform duration-1000 group-hover:scale-110"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        </div>
                    </ScrollReveal>

                    <div className="text-left space-y-10">
                        <ScrollReveal delay={0.3}>
                            <div className="space-y-4">
                                <div className="flex items-center space-x-4">
                                    <div className="w-12 h-px bg-royal-gold"></div>
                                    <h3 className="text-sm font-bold text-royal-gold uppercase tracking-[0.3em]">About The Artist</h3>
                                </div>
                                <h2 className="text-5xl md:text-6xl font-bold text-[var(--site-text)] italic tracking-tight leading-tight">
                                    Preserving Your <span className="text-royal-gold">Legacy</span>
                                </h2>
                            </div>
                        </ScrollReveal>

                        <ScrollReveal delay={0.5}>
                            <div className="space-y-6 text-[var(--site-subtle)] leading-relaxed font-sans font-light text-lg">
                                <p>
                                    With over a decade of experience in capturing the grandest celebrations, we believe that photography is more than just clicking a button—it's about capturing the soul of a moment.
                                </p>
                                <p>
                                    Our signature "Royal Aesthetic" combines the warmth of traditional storytelling with the precision of modern fine art, ensuring your memories are preserved in their most beautiful form.
                                </p>
                            </div>
                        </ScrollReveal>

                        <ScrollReveal delay={0.7}>
                            <Link href="/contact-us" className="inline-flex items-center space-x-4 group">
                                <span className="text-[var(--site-text)] font-bold uppercase tracking-widest text-sm border-b-2 border-royal-gold/30 pb-2 group-hover:border-royal-gold transition-all duration-300">
                                    Discover Our Journey
                                </span>
                                <div className="w-10 h-10 rounded-full bg-[var(--site-surface-2)] text-[var(--site-text)] flex items-center justify-center group-hover:bg-royal-gold group-hover:text-slate-950 transition-all duration-300 shadow-lg">
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </Link>
                        </ScrollReveal>
                    </div>
                </div>
            </section>

            <footer className="py-20 text-center text-[var(--site-muted)] font-sans text-sm border-t border-royal-gold/10">
                <p>© 2026 EveBash. The Gold Standard in Memories.</p>
            </footer>
        </div>
    );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Camera } from "lucide-react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Event, getSampleGalleryEvents } from "@/lib/database";

export default function SampleGalleries() {
    const [albums, setAlbums] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        getSampleGalleryEvents().then((events) => {
            if (!mounted) return;
            setAlbums(events);
            setLoading(false);
        });

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <div className="min-h-screen bg-[var(--site-bg)] font-serif text-[var(--site-text)] selection:bg-royal-gold/30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
                <header className="mb-20 text-center space-y-6">
                    <ScrollReveal direction="up">
                        <div className="inline-flex items-center space-x-3 px-4 py-2 bg-royal-gold/10 rounded-full text-royal-gold text-xs font-bold uppercase tracking-widest mb-4 border border-royal-gold/20">
                            <Camera className="w-4 h-4" />
                            <span>Portfolio Showcase</span>
                        </div>
                    </ScrollReveal>
                    
                    <ScrollReveal direction="up" delay={0.1}>
                        <h1 className="text-5xl md:text-7xl font-bold text-[var(--site-text)] italic tracking-tight">
                            Sample <span className="text-royal-gold">Galleries</span>
                        </h1>
                    </ScrollReveal>
                    
                    <ScrollReveal direction="up" delay={0.2}>
                        <p className="text-[var(--site-subtle)] text-lg md:text-xl max-w-2xl mx-auto font-sans leading-relaxed">
                            Experience the artistry of storytelling through our curated collection of beautiful wedding memories.
                        </p>
                    </ScrollReveal>
                </header>

                {loading ? (
                    <div className="py-20 text-center font-sans text-[var(--site-muted)]">Loading sample galleries...</div>
                ) : albums.length === 0 ? (
                    <div className="mx-auto max-w-2xl rounded-[2rem] border border-[var(--site-border)] bg-[var(--site-card)] p-10 text-center font-sans text-[var(--site-muted)]">
                        No sample galleries are available yet.
                    </div>
                ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                    {albums.map((album, index) => (
                        <ScrollReveal key={album.id} delay={index * 0.1 + 0.3}>
                            <Link 
                                href={`/sample-galleries/${album.id}`} 
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group block relative aspect-[4/5] rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-[var(--site-border)] bg-[var(--site-card)]"
                            >
                                <div className="absolute inset-0">
                                    <Image
                                        src={album.coverImage}
                                        alt={album.title}
                                        fill
                                        className="object-cover transition-transform duration-1000 group-hover:scale-110"
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent group-hover:via-black/40 transition-all duration-500" />
                                </div>

                                <div className="absolute bottom-0 left-0 p-8 w-full text-left">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-royal-gold text-xs font-bold uppercase tracking-[0.2em]">{album.category || "Event"}</span>
                                        <span className="text-white/80 text-sm italic">{album.date}</span>
                                    </div>
                                    <h3 className="text-3xl font-bold text-white mb-6 group-hover:text-royal-gold transition-colors duration-300 italic tracking-tight">
                                        {album.title}
                                    </h3>
                                    <div className="flex items-center text-white text-xs font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                                        View Collection
                                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-2 transition-transform" />
                                    </div>
                                </div>
                            </Link>
                        </ScrollReveal>
                    ))}
                </div>
                )}
            </div>

            <footer className="py-20 text-center text-[var(--site-muted)] font-sans text-sm">
                <p>© 2026 EveBash. Crafted with elegance.</p>
            </footer>
        </div>
    );
}

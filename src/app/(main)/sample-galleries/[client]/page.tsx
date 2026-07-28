"use client";

import { use, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { ChevronLeft, ArrowRight } from "lucide-react";

// In a real app, this would come from a database based on the client slug
const clients = {
    "samarth-jyoti-wedding": {
        title: "Samarth & Jyoti Wedding",
        description: "A royal celebration of love in Dehradun.",
        coverImg: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1400&auto=format&fit=crop",
        events: [
            { name: "Haldi", slug: "haldi", category: "Pre-Wedding", img: "https://images.unsplash.com/photo-1606800052052-a08af7148866?q=80&w=1400&auto=format&fit=crop" },
            { name: "Mehendi", slug: "mehendi", category: "Pre-Wedding", img: "https://images.unsplash.com/photo-1610173827043-62c0f1f05d04?q=80&w=1400&auto=format&fit=crop" },
            { name: "Wedding", slug: "wedding", category: "Ceremony", img: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1400&auto=format&fit=crop" },
            { name: "Reception", slug: "reception", category: "Celebration", img: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?q=80&w=1400&auto=format&fit=crop" },
        ]
    }
};

export default function ClientGallery({ params }: { params: Promise<{ client: string }> }) {
    // Correctly unwrap params using React.use()
    const { client } = use(params);
    const data = clients[client as keyof typeof clients];

    const containerRef = useRef(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end start"]
    });

    const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
    const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

    if (!data) {
        return notFound();
    }

    return (
        <div className="min-h-screen bg-[var(--site-bg)] font-serif text-[var(--site-text)]" ref={containerRef}>
            {/* Hero Cover Image with Parallax */}
            <div className="relative h-[85vh] w-full overflow-hidden">
                <motion.div style={{ y, opacity }} className="absolute inset-0 h-[120%] -top-[10%]">
                    <Image
                        src={data.coverImg!}
                        alt={data.title}
                        fill
                        className="object-cover"
                        priority
                    />
                </motion.div>
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

                <div className="absolute inset-0 flex flex-col justify-end items-center text-center px-4 pb-20">
                    <ScrollReveal direction="up" delay={0.3}>
                        <h1 className="text-4xl md:text-7xl font-bold text-white drop-shadow-xl mb-6 italic tracking-tight">{data.title}</h1>
                    </ScrollReveal>
                    <ScrollReveal direction="up" delay={0.5}>
                        <p className="text-white/90 text-lg md:text-xl max-w-2xl font-sans font-light drop-shadow-lg tracking-wide">
                            {data.description}
                        </p>
                    </ScrollReveal>
                </div>
            </div>

            <div className="relative z-10 mx-auto -mt-20 max-w-7xl rounded-t-[3rem] bg-[var(--site-bg)] px-4 py-24 shadow-2xl shadow-black/20 sm:px-6 lg:px-8">
                {/* Breadcrumb / Back Link */}
                <div className="mb-16 flex items-center justify-between">
                    <Link href="/sample-galleries" className="group inline-flex items-center space-x-2 text-royal-gold hover:text-royal-gold/80 transition-all text-sm font-bold uppercase tracking-widest">
                        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span>Back to Albums</span>
                    </Link>
                    
                    <div className="h-px flex-1 bg-royal-gold/20 mx-8 hidden md:block"></div>
                    
                    <span className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--site-muted)]">Curated Collection</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
                    {data.events.map((event, index) => (
                        <ScrollReveal key={event.slug} delay={index * 0.1}>
                            <Link 
                                href={`/events/${event.slug}`} 
                                className="group relative block aspect-[3/4] w-full overflow-hidden rounded-[2rem] bg-[var(--site-card)] shadow-md transition-all duration-700 hover:shadow-2xl"
                            >
                                {/* Image */}
                                <Image
                                    src={event.img}
                                    alt={event.name}
                                    fill
                                    className="object-cover transition-transform duration-1000 group-hover:scale-110"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                                />

                                {/* Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent opacity-60 group-hover:opacity-80 transition-all duration-500"></div>

                                {/* Content */}
                                <div className="absolute bottom-0 left-0 p-8 w-full transform translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                                    <p className="text-royal-gold text-[10px] font-bold uppercase tracking-[0.2em] mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">{event.category}</p>
                                    <h3 className="text-2xl font-bold text-white mb-4 italic tracking-tight">{event.name}</h3>
                                    <div className="flex items-center text-white/70 text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all duration-500">
                                        Open Gallery <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            </Link>
                        </ScrollReveal>
                    ))}
                </div>
            </div>
            
            <footer className="py-20 text-center font-sans text-sm text-[var(--site-muted)]">
                <p>© 2026 WedAlbum. Elegant Memories.</p>
            </footer>
        </div>
    );
}

"use client";

import { use, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { motion, useScroll, useTransform } from "framer-motion";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

// In a real app, this would come from a database based on the client slug
const clients = {
    "samarth-jyoti-wedding": {
        title: "Samarth & Jyoti Wedding",
        description: "A royal celebration of love in Dehradun.",
        coverImg: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767722218/0D2A5838_2_cgepes.jpg",
        events: [
            { name: "Haldi", slug: "haldi", category: "Pre-Wedding", img: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767724606/7C0A9948_1_cwl7g6.jpg" },
            { name: "Mehendi", slug: "mehendi", category: "Pre-Wedding", img: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767692471/7C0A0649_kkwbbu.jpg" },
            { name: "Wedding", slug: "wedding", category: "Ceremony", img: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767692961/0D2A5755_1_cipyfz.jpg" },
            { name: "Reception", slug: "reception", category: "Celebration", img: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767724545/VIS_5683_1_fx794l.jpg" },
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
        <div className="min-h-screen bg-slate-50 relative" ref={containerRef}>
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
                        <h1 className="text-4xl md:text-7xl font-serif text-white drop-shadow-xl mb-6">{data.title}</h1>
                    </ScrollReveal>
                    <ScrollReveal direction="up" delay={0.5}>
                        <p className="text-white/90 text-lg md:text-xl max-w-2xl font-light drop-shadow-lg tracking-wide">
                            {data.description}
                        </p>
                    </ScrollReveal>
                </div>
            </div>

            <div className="max-w-7xl mx-auto py-16 px-4 bg-slate-50 relative z-10 -mt-10 rounded-t-3xl">
                {/* Breadcrumb / Back Link */}
                <div className="mb-12">
                    <Link href="/sample-galleries" className="text-sky-600 hover:text-sky-800 transition-colors text-sm font-semibold flex items-center">
                        &larr; Back to Albums
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {data.events.map((event, index) => (
                        <ScrollReveal key={event.slug} delay={index * 0.1}>
                            <Link href={`/events/${event.slug}`} className="group relative block w-full aspect-[3/4] overflow-hidden rounded-2xl shadow-md hover:shadow-2xl transition-all duration-500">
                                {/* Image */}
                                <Image
                                    src={event.img}
                                    alt={event.name}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                                />

                                {/* Overlay - appearing on hover */}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>

                                {/* Content */}
                                <div className="absolute bottom-0 left-0 p-6 w-full transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                    <p className="text-sky-400 text-xs font-bold uppercase tracking-widest mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">{event.category}</p>
                                    <h3 className="text-2xl font-serif text-white mb-2">{event.name}</h3>
                                    <div className="h-[2px] w-0 bg-white group-hover:w-full transition-all duration-500 ease-out"></div>
                                </div>
                            </Link>
                        </ScrollReveal>
                    ))}
                </div>
            </div>
        </div>
    );
}

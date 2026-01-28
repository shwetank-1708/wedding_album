"use client";

import React from "react";
import { motion } from "framer-motion";
import { ArrowDown, Search, Camera } from "lucide-react";
import Link from "next/link";

export function Hero() {
    const scrollToGallery = () => {
        const gallerySection = document.getElementById("gallery-start");
        if (gallerySection) {
            gallerySection.scrollIntoView({ behavior: "smooth" });
        }
    };

    return (
        <div className="relative h-screen w-full overflow-hidden flex items-center justify-center bg-stone-900 text-stone-50">
            {/* Background Image Parallax */}
            <div className="absolute inset-0">
                <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center bg-fixed opacity-60 scale-105" />
            </div>

            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/70" />

            {/* Content */}
            <div className="relative z-10 text-center px-6 space-y-10 max-w-5xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="space-y-6"
                >
                    <div className="flex items-center justify-center gap-4 text-gold-400 tracking-[0.4em] text-sm md:text-base uppercase font-semibold">
                        <span className="w-8 h-[1px] bg-gold-400/50" />
                        We Are Getting Married
                        <span className="w-8 h-[1px] bg-gold-400/50" />
                    </div>

                    <h1 className="font-serif text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight drop-shadow-2xl">
                        Samarth <span className="text-gold-500 italic font-light">&</span> Jyoti
                    </h1>

                    <p className="text-stone-200 tracking-[0.2em] text-lg md:text-xl font-light uppercase">
                        November 18th, 2024 • Dehradun, India
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8"
                >
                    <button
                        onClick={scrollToGallery}
                        className="group relative px-10 py-4 bg-gradient-to-r from-gold-400 to-gold-600 text-stone-900 font-bold tracking-widest uppercase transition-all overflow-hidden rounded-full shadow-lg hover:shadow-gold-500/20 hover:scale-105"
                    >
                        <span className="relative z-10 flex items-center justify-center gap-2">
                            <Camera className="w-5 h-5" /> Open Gallery
                        </span>
                    </button>

                    <Link
                        href="/find-me"
                        className="group px-10 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold tracking-widest uppercase transition-all rounded-full flex items-center justify-center gap-2 hover:scale-105"
                    >
                        <Search className="w-5 h-5" /> Find My Photos
                    </Link>
                </motion.div>
            </div>

            {/* Scroll Indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 1 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce cursor-pointer"
                onClick={scrollToGallery}
            >
                <ArrowDown className="text-white/70 hover:text-white w-8 h-8" />
            </motion.div>
        </div>
    );
}

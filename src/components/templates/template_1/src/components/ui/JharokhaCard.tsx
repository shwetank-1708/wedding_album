"use client";

import Link from "next/link";
import Image from "next/image";

interface JharokhaCardProps {
    name: string;
    slug: string;
    img: string;
    description?: string;
}

export function JharokhaCard({ name, slug, img, description }: JharokhaCardProps) {
    return (
        <Link href={`/events/${slug}`} className="group relative block w-full aspect-[3/4.5] transition-transform duration-500 hover:-translate-y-2">
            {/* Main Container - The "Card" */}
            <div className="relative w-full h-full flex flex-col">

                {/* SVG Frame/Mask Layer - This creates the shape */}
                <div className="absolute inset-0 z-20 pointer-events-none drop-shadow-2xl filter">
                    {/* 
                        Complex Mughal Arch SVG 
                        This SVG acts as the "Border" and "Frame". 
                        The center is transparent to show the image/content.
                        The edges are the Royal Maroon/Gold border.
                     */}
                    <svg viewBox="0 0 100 150" className="w-full h-full preserve-3d" preserveAspectRatio="none">
                        <defs>
                            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#806319" />
                                <stop offset="50%" stopColor="#F0DEAA" />
                                <stop offset="100%" stopColor="#806319" />
                            </linearGradient>
                            <filter id="inset-shadow">
                                <feOffset dx="0" dy="0" />
                                <feGaussianBlur stdDeviation="1" result="offset-blur" />
                                <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
                                <feFlood floodColor="black" floodOpacity="0.5" result="color" />
                                <feComposite operator="in" in="color" in2="inverse" result="shadow" />
                                <feComposite operator="over" in="shadow" in2="SourceGraphic" />
                            </filter>
                        </defs>

                        {/* The Main Border Path - Cusped Arch */}
                        {/* 
                           Path logic:
                           Start bottom left (0,150) -> bottom right (100,150) -> up to shoulder (100, 50)
                           -> Curves for the arch to top center (50, 0)
                           -> Mirror curves down to left shoulder (0, 50) -> close
                        */}
                        <path
                            d="M 0 150 L 100 150 L 100 50 
                               Q 100 40 95 35 
                               Q 90 30 92 25
                               Q 95 20 85 15
                               Q 75 10 75 20
                               Q 75 30 65 25
                               Q 55 20 50 5
                               Q 45 20 35 25
                               Q 25 30 25 20
                               Q 25 10 15 15
                               Q 5 20 8 25
                               Q 10 30 5 35
                               Q 0 40 0 50
                               Z"
                            fill="none"
                            stroke="url(#goldGradient)"
                            strokeWidth="3"
                        />
                        {/* A thicker path for the main 'Frame' fill if we wanted a solid border, 
                             but here we want the content to fill the shape.
                             Actually, to MASK the image, we need a clipPath in CSS or a mask in SVG. 
                             Correction: We will use a CSS clip-path for the CONTENT container, 
                             and just overlay this SVG for the BORDER.
                         */}
                    </svg>
                </div>

                {/* Content Container - Clipped to match the arch */}
                <div
                    className="relative w-full h-full bg-royal-cream overflow-hidden"
                    style={{
                        clipPath: `path('M 0 100% L 100% 100% L 100% 33% 
                                   Q 100% 26% 95% 23% 
                                   Q 90% 20% 92% 16%
                                   Q 95% 13% 85% 10%
                                   Q 75% 6% 75% 13%
                                   Q 75% 20% 65% 16%
                                   Q 55% 13% 50% 3%
                                   Q 45% 13% 35% 16%
                                   Q 25% 20% 25% 13%
                                   Q 25% 6% 15% 10%
                                   Q 5% 13% 8% 16%
                                   Q 10% 20% 5% 23%
                                   Q 0% 26% 0% 33%
                                   Z')`
                    }}
                >
                    {/* Image Section (Top 70%) */}
                    <div className="absolute top-0 left-0 w-full h-[70%]">
                        <Image
                            src={img}
                            alt={name}
                            fill
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-royal-maroon/80 to-transparent opacity-60"></div>
                    </div>

                    {/* Text Section (Bottom 30%) - Cream BG */}
                    <div className="absolute bottom-0 left-0 w-full h-[32%] bg-gradient-to-t from-[#FFFDD0] via-[#FFFDD0] to-[#FFFDD0]/90 flex flex-col items-center justify-center px-4 pt-6 text-center border-t border-royal-gold/30">
                        {/* Decorative flourish */}
                        <div className="text-royal-gold mb-1 opacity-80">✦</div>
                        <h3 className="text-2xl font-serif text-royal-maroon mb-1 group-hover:text-[#AA8422] transition-colors">
                            {name}
                        </h3>
                        {description && (
                            <p className="text-[10px] md:text-sm text-royal-maroon/80 font-serif leading-tight">
                                {description}
                            </p>
                        )}
                        <div className="mt-2 text-xs uppercase tracking-widest text-[#AA8422] border border-[#AA8422]/30 px-3 py-1 rounded-full group-hover:bg-[#AA8422] group-hover:text-white transition-all">
                            Details
                        </div>
                    </div>
                </div>

                {/* Re-overlay the Border (SVG) on top of the clipped content to hide jagged edges */}
                <div className="absolute inset-0 z-30 pointer-events-none">
                    <svg viewBox="0 0 100 150" className="w-full h-full" preserveAspectRatio="none">
                        <path
                            d="M 0 150 L 100 150 L 100 50 
                               Q 100 40 95 35 
                               Q 90 30 92 25
                               Q 95 20 85 15
                               Q 75 10 75 20
                               Q 75 30 65 25
                               Q 55 20 50 5
                               Q 45 20 35 25
                               Q 25 30 25 20
                               Q 25 10 15 15
                               Q 5 20 8 25
                               Q 10 30 5 35
                               Q 0 40 0 50
                               Z"
                            fill="none"
                            stroke="#D4AF37"
                            strokeWidth="2" // Gold Border
                        />
                        <path
                            d="M 0 150 L 100 150 L 100 50 
                               Q 100 40 95 35 
                               Q 90 30 92 25
                               Q 95 20 85 15
                               Q 75 10 75 20
                               Q 75 30 65 25
                               Q 55 20 50 5
                               Q 45 20 35 25
                               Q 25 30 25 20
                               Q 25 10 15 15
                               Q 5 20 8 25
                               Q 10 30 5 35
                               Q 0 40 0 50
                               Z"
                            fill="none"
                            stroke="#5D001E"
                            strokeWidth="8" // Maroon Outer Border
                            className="opacity-100"
                            style={{ transform: "scale(1.02)", transformOrigin: "center" }}
                        />
                    </svg>
                </div>
            </div>
        </Link>
    );
}

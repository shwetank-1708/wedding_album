"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

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
    <div className="flex flex-col min-h-screen bg-slate-50" ref={containerRef}>
      {/* Light & Airy Hero Section with Parallax */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        {/* Background Image - Clean without dark overlay */}
        <motion.div style={{ y, opacity }} className="absolute inset-0 z-0 h-[120%] -top-[10%]">
          <Image
            src="https://res.cloudinary.com/dkphvdlwk/image/upload/v1767692961/0D2A5755_1_cipyfz.jpg"
            alt="Royal Couple"
            fill
            className="object-cover object-[50%_35%] opacity-90"
            priority
          />
        </motion.div>

        {/* Subtle gradient from bottom white to transparent for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-slate-900/60 to-transparent z-0"></div>

        {/* Hero Content */}
        <div className="relative z-10 text-center space-y-6 px-4 mt-20 max-w-5xl mx-auto">
          <ScrollReveal direction="down" delay={0.2}>
            <div className="inline-block border border-white/60 py-2 px-8 mb-6 bg-white/20 backdrop-blur-md rounded-full shadow-lg">
              <p className="text-sm md:text-lg text-white font-serif uppercase tracking-[0.2em]">
                Professional Photography
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.4}>
            <h1 className="text-5xl md:text-8xl font-serif text-white drop-shadow-md tracking-tight leading-tight">
              Capturing <span className="font-light italic text-sky-200">Timeless</span> Moments
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.6}>
            <p className="text-lg md:text-xl text-white/90 font-light tracking-wide max-w-2xl mx-auto leading-relaxed drop-shadow-sm">
              We believe that every moment is a piece of art waiting to be captured. Let us tell your story with elegance and simplicity.
            </p>
          </ScrollReveal>

          <div className="mt-12 flex flex-col md:flex-row gap-6 justify-center">
            <ScrollReveal direction="left" delay={0.8}>
              <Link href="/sample-galleries" className="inline-block">
                <span className="inline-block px-8 py-4 bg-white text-slate-800 hover:bg-sky-50 transition-all duration-300 uppercase tracking-widest text-sm font-semibold rounded-lg shadow-xl hover:shadow-2xl hover:scale-105 transform">
                  View Our Work
                </span>
              </Link>
            </ScrollReveal>

            <ScrollReveal direction="right" delay={1.0}>
              <Link href="/contact-us" className="inline-block">
                <span className="inline-block px-8 py-4 bg-transparent border border-white text-white hover:bg-white hover:text-slate-800 transition-all duration-300 uppercase tracking-widest text-sm font-semibold rounded-lg hover:shadow-lg hover:scale-105 transform">
                  Book a Session
                </span>
              </Link>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* About Section - Clean & Minimal */}
      <section className="py-24 px-4 md:px-12 max-w-7xl mx-auto w-full bg-white relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <ScrollReveal direction="left" delay={0.2}>
            <div className="relative aspect-[3/4] w-full max-w-md mx-auto shadow-2xl rounded-2xl overflow-hidden group">
              <Image
                src="https://res.cloudinary.com/dkphvdlwk/image/upload/v1767692961/0D2A5755_1_cipyfz.jpg"
                alt="Photographer"
                fill
                className="object-cover transition-transform duration-1000 group-hover:scale-110"
              />
              <div className="absolute inset-0 border-[1px] border-white/20 rounded-2xl m-4"></div>
            </div>
          </ScrollReveal>

          <div className="text-left space-y-8">
            <ScrollReveal delay={0.3}>
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-sky-600 uppercase tracking-widest">About The Artist</h3>
                <h2 className="text-4xl md:text-5xl font-serif text-slate-800">Preserving Your Legacy</h2>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.5}>
              <div className="space-y-4 text-slate-600 leading-relaxed font-light text-lg">
                <p>
                  With over a decade of experience in capturing weddings, portraits, and events, we strive to create images that are not just photographs, but heirlooms.
                </p>
                <p>
                  Our style is a blend of fine art and photojournalism, ensuring that every emotion is captured authentically. From the grandest gestures to the quietest whispers, we are there to document it all.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={0.7}>
              <Link href="/contact-us" className="inline-block group">
                <span className="text-slate-800 font-semibold border-b-2 border-sky-400 pb-1 hover:text-sky-600 hover:border-sky-600 transition-all duration-300">
                  Read More About Us
                  <span className="inline-block ml-2 transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
                </span>
              </Link>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </div>
  );
}

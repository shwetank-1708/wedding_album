"use client";

import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Event } from "@/lib/database";

interface TemplateHeroProps {
  event: Event;
  children?: React.ReactNode;
}

export function TemplateHero({ event, children }: TemplateHeroProps) {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  // Modern cinematic Parallax effect
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  const scrollToContent = () => {
    const contentElement = document.getElementById('event-content');
    if (contentElement) {
      contentElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: event.title,
        text: event.description || "Check out our wedding album!",
        url: window.location.href,
      }).catch((err) => console.log(err));
    } else {
      // Fallback
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white selection:bg-amber-900 selection:text-white relative overflow-x-hidden" ref={containerRef}>
      {/* Cinematic Cover Section */}
      <section className="relative h-screen w-full overflow-hidden">
        <motion.div style={{ y, opacity }} className="absolute inset-0 z-0 h-[120%] -top-[10%]">
          {event.coverImage ? (
            <Image
              src={event.coverImage}
              alt={event.title}
              fill
              className="object-cover object-[50%_35%] opacity-60"
              priority
            />
          ) : (
            <div className="w-full h-full bg-zinc-950" />
          )}
        </motion.div>

        {/* Ambient Dark Glow Gradients */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black z-0"></div>
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/90 to-transparent z-0"></div>

        {/* Floating Glassmorphic Details Card */}
        <div className="relative z-10 flex flex-col justify-end items-center px-4 pb-20 h-full max-w-5xl mx-auto">
          
          <ScrollReveal direction="up" delay={0.2} className="w-full max-w-xl">
            <div className="bg-[#0a0a0c]/70 backdrop-blur-xl border border-[#ca9c69]/30 p-8 md:p-12 rounded-sm shadow-2xl text-center flex flex-col items-center">
              
              {/* Modern Micro-Badge */}
              <div className="inline-block bg-black border border-[#ca9c69]/30 px-5 py-1 rounded-sm mb-6">
                <p className="text-[9px] text-[#ca9c69] font-black uppercase tracking-[0.3em]">
                  The Celebration Of
                </p>
              </div>

              {/* Bold Cinematic Title - Spaced-out Serif Italic */}
              <h1 className="text-3xl md:text-5xl font-serif italic text-white tracking-wide mb-4 drop-shadow-md capitalize">
                {event.title}
              </h1>

              {/* Platinum divider line with gold star */}
              <div className="flex items-center justify-center gap-4 w-48 my-4">
                <div className="flex-1 h-[0.5px] bg-[#ca9c69]/30" />
                <span className="text-[#ca9c69] text-xs">✦</span>
                <div className="flex-1 h-[0.5px] bg-[#ca9c69]/30" />
              </div>

              {/* Event Date */}
              <p className="text-[10px] md:text-xs text-zinc-400 font-bold uppercase tracking-[0.25em] mb-6">
                — {event.date || "Save The Date"} —
              </p>

              {/* Description */}
              {event.description && (
                <p className="text-xs md:text-sm text-zinc-400 font-light leading-relaxed mb-8 max-w-md">
                  {event.description}
                </p>
              )}

              {/* Parallel Action Row */}
              <div className="flex items-center justify-center gap-4 w-full">
                {/* Back Button */}
                <Link
                  href="/gallery"
                  className="flex items-center justify-center w-12 h-12 border border-[#ca9c69]/60 rounded-sm hover:bg-white/5 transition-all text-[#ca9c69] bg-black/60"
                  title="Back to gallery"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                  </svg>
                </Link>

                {/* Primary CTA (Enter Gallery) */}
                <button
                  onClick={scrollToContent}
                  className="flex-1 py-3.5 bg-[#ca9c69] hover:bg-[#d9aa75] text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-sm transition-all duration-300 shadow-md shadow-[#ca9c69]/10 hover:shadow-[#ca9c69]/30 transform hover:-translate-y-0.5"
                >
                  Enter Gallery
                </button>

                {/* Share Button */}
                <button
                  onClick={handleShare}
                  className="flex items-center justify-center w-12 h-12 border border-[#ca9c69]/60 rounded-sm hover:bg-white/5 transition-all text-[#ca9c69] bg-black/60"
                  title="Share event"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935-2.186 2.25 2.25 0 00-3.935 2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                </button>
              </div>

            </div>
          </ScrollReveal>

          {/* Scrolling indicator */}
          <ScrollReveal direction="up" delay={0.6} className="mt-4">
            <button onClick={scrollToContent} className="animate-bounce flex flex-col items-center gap-2">
              <span className="text-[8px] uppercase tracking-[0.3em] text-[#ca9c69]/70 font-semibold">Scroll Down</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-[#ca9c69]/60">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
          </ScrollReveal>
        </div>
      </section>

      {/* Main Content Area */}
      {children && (
        <section id="event-content" className="relative z-10 bg-black border-t border-zinc-900 py-24 min-h-[50vh]">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-[10px] uppercase tracking-[0.3em] text-[#ca9c69] mb-3 font-black">The Guest Gallery</h2>
              <div className="mx-auto w-px h-16 bg-gradient-to-b from-[#ca9c69] to-transparent" />
            </div>
            {children}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-black border-t border-zinc-950 text-zinc-600 py-16 text-center text-[10px] tracking-[0.25em] uppercase relative z-10">
        <p>Delivered by Wed Album — Cinematic Editions</p>
      </footer>
    </div>
  );
}

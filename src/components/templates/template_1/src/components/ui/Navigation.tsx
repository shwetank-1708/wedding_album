"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
    { name: "Overview", href: "/" },
    { name: "Haldi", href: "/events/haldi" },
    { name: "Mehendi", href: "/events/mehendi" },
    { name: "Wedding", href: "/events/wedding" },
    { name: "Reception", href: "/events/reception" },
];

export function Navigation() {
    const pathname = usePathname();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <nav
            className={cn(
                "fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b border-transparent",
                scrolled ? "bg-white/90 backdrop-blur-md shadow-sm border-stone-200 py-3" : "bg-transparent py-6"
            )}
        >
            <div className="container mx-auto px-6 flex items-center justify-between">
                {/* Logo / Names */}
                <Link href="/" className={cn(
                    "font-serif text-2xl font-bold tracking-widest group transition-colors",
                    scrolled ? "text-stone-900" : "text-white"
                )}>
                    S <span className={cn("transition-colors", scrolled ? "text-gold-500 group-hover:text-gold-600" : "text-gold-400 group-hover:text-gold-300")}>&</span> J
                </Link>

                {/* Desktop Navigation */}
                <div className="hidden md:flex items-center space-x-8">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                className={cn(
                                    "uppercase tracking-widest text-xs font-bold relative py-1 transition-colors",
                                    isActive
                                        ? (scrolled ? "text-gold-600" : "text-gold-400")
                                        : (scrolled ? "text-stone-500 hover:text-stone-900" : "text-white/80 hover:text-white")
                                )}
                            >
                                {item.name}
                                {isActive && (
                                    <motion.div
                                        layoutId="underline"
                                        className={cn("absolute left-0 right-0 bottom-0 h-[2px]", scrolled ? "bg-gold-500" : "bg-gold-400")}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* CTA */}
                <Link
                    href="/find-me"
                    className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold tracking-widest uppercase transition-all shadow-lg",
                        scrolled
                            ? "bg-stone-900 text-gold-100 hover:bg-stone-800"
                            : "bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20"
                    )}
                >
                    <Search className="w-4 h-4" />
                    <span>Find Photos</span>
                </Link>
            </div>
        </nav>
    );
}

"use client";

import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import clsx from "clsx";

import { Menu, X } from "lucide-react";

export default function Navbar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();

    const navLinks = [
        { name: "Haldi", href: "/events/haldi" },
        { name: "Mehendi", href: "/events/mehendi" },
        { name: "Wedding", href: "/events/wedding" },
        { name: "Reception", href: "/events/reception" },
        { name: "Find You", href: "/find-you" },
    ];

    if (user?.role === "admin") {
        navLinks.push({ name: "Admin", href: "/admin" });
    }

    return (
        <nav className="fixed top-0 left-0 w-full z-50 bg-royal-maroon/95 backdrop-blur-sm text-royal-gold shadow-2xl border-b-[3px] border-royal-gold playfair-font">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">
                    <div className="flex-shrink-0 flex items-center">
                        <Link href="/" className="font-serif text-2xl font-bold tracking-widest z-50 relative" onClick={() => setIsOpen(false)}>
                            S & J
                        </Link>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden md:ml-6 md:flex md:space-x-8 items-center">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={clsx(
                                    "hover:text-white px-3 py-2 rounded-md text-lg font-medium transition-colors duration-300 uppercase tracking-widest drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]",
                                    pathname === link.href ? "text-white underline decoration-royal-gold underline-offset-4" : ""
                                )}
                            >
                                {link.name}
                            </Link>
                        ))}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="flex items-center md:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="inline-flex items-center justify-center p-2 rounded-md text-royal-gold hover:text-white hover:bg-white/10 focus:outline-none transition-colors"
                            aria-expanded="false"
                        >
                            <span className="sr-only">Open main menu</span>
                            {isOpen ? (
                                <X className="block h-8 w-8" aria-hidden="true" />
                            ) : (
                                <Menu className="block h-8 w-8" aria-hidden="true" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            <div className={clsx(
                "md:hidden absolute top-20 left-0 w-full bg-royal-maroon/98 backdrop-blur-xl border-b-2 border-royal-gold shadow-2xl transition-all duration-300 ease-in-out origin-top",
                isOpen ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0 pointer-events-none"
            )}>
                <div className="px-4 pt-2 pb-6 space-y-2 flex flex-col items-center">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            onClick={() => setIsOpen(false)}
                            className={clsx(
                                "block px-3 py-4 rounded-md text-xl font-medium uppercase tracking-widest w-full text-center hover:bg-white/5 transition-colors",
                                pathname === link.href ? "text-white bg-white/10" : "text-royal-gold"
                            )}
                        >
                            {link.name}
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
}

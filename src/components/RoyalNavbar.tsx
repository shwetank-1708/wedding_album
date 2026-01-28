"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import clsx from "clsx";
import { Menu, X } from "lucide-react";
import { Event } from "@/lib/firestore";

interface RoyalNavbarProps {
    event: Event;
    subEvents: Event[];
    basePath?: string; // e.g. /tenant/haldi - if provided, links will be relative to this
}

export function RoyalNavbar({ event, subEvents, basePath }: RoyalNavbarProps) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    const [isAdmin, setIsAdmin] = useState(false);

    // Check Admin Role
    // We infer slug from basePath: /tenant/[slug]
    const slug = basePath?.split('/tenant/')[1]?.split('/')[0];

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        if (!slug) return;

        const checkAdmin = () => {
            const sessionKey = `guest_session_${slug}`;
            const stored = localStorage.getItem(sessionKey);
            setIsAdmin(false); // Default to false
            if (stored) {
                try {
                    const session = JSON.parse(stored);
                    if (session.role === 'admin') setIsAdmin(true);
                } catch { }
            }
        };

        // Check immediately
        checkAdmin();

        // Listen for updates
        window.addEventListener("guest_session_changed", checkAdmin);
        return () => window.removeEventListener("guest_session_changed", checkAdmin);
    }, [slug]);

    // Hide Navbar on Login Page (AFTER hooks to prevent React errors)
    if (pathname?.endsWith("/login")) {
        return null;
    }

    // Construct main links dynamically
    const homeLink = basePath || "/";
    const findYouLink = basePath ? `${basePath}/find-you` : "/find-you";
    const adminLink = basePath ? `${basePath}/admin` : "/admin";

    // Dynamic Navigation Links
    const navLinks = [
        { name: "Home", href: homeLink },
        ...subEvents.map(se => ({
            name: se.title,
            href: basePath ? `${basePath}/events/${se.id}` : `/events/${se.id}`
        })),
        { name: "Find You", href: findYouLink },
        ...(isAdmin ? [{ name: "Admin", href: adminLink }] : [])
    ];

    return (
        <nav className="fixed top-0 left-0 w-full z-50 bg-royal-maroon/95 backdrop-blur-sm text-royal-gold shadow-2xl border-b-[3px] border-royal-gold">
            <div className="w-full px-4 sm:px-8 lg:px-12">
                <div className="flex items-center justify-between h-20">
                    <div className="flex-shrink-0 flex items-center">
                        <Link href="/" className="font-serif text-2xl font-bold tracking-widest z-50 relative" onClick={() => setIsOpen(false)}>
                            {event.title.split(' ').map(w => w[0]).join(' & ')}
                            {/* Initials fallback or just Title */}
                        </Link>
                    </div>

                    {/* Desktop Menu - Pushed to the right */}
                    <div className="hidden md:flex md:items-center md:space-x-8 ml-auto">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
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
                            key={link.href}
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

"use client";


import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { Event } from "@/lib/firestore";

import { Menu, X } from "lucide-react";

interface NavbarProps {
    event: Event;
    subEvents?: Event[];
    basePath: string; // Made required to match usage
}

export default function Navbar({ event, subEvents = [], basePath }: NavbarProps) {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useAuth();

    // Generate links from sub-events
    const dynamicLinks = subEvents.map(sub => ({
        name: sub.title || sub.id, // Fallback to ID if title missing
        href: `${basePath}/events/${sub.id}` // sub-events routed via /events/[subId]
    }));

    const navLinks = [
        ...dynamicLinks,
        { name: "Find You", href: `${basePath}/find-you` },
    ];

    if (user?.role === "admin") {
        navLinks.push({ name: "Admin", href: `${basePath}/admin` });
    }

    // Dynamic Initials or Title
    const brandName = event.title
        ? event.title.split(' ').map(w => w[0]).join('').substring(0, 5) // Minimal: just initials fused
        : "WA";

    return (
        <nav className="fixed top-0 left-0 w-full z-50 bg-white/95 backdrop-blur-sm text-black border-b border-gray-100 transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">
                    <div className="flex-shrink-0 flex items-center">
                        <Link href={basePath} className="font-serif text-3xl font-bold tracking-tighter" onClick={() => setIsOpen(false)}>
                            {brandName}
                        </Link>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden md:ml-6 md:flex md:space-x-8 items-center">
                        {navLinks.map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={clsx(
                                    "px-3 py-2 text-xs font-bold uppercase tracking-[0.15em] hover:text-gray-500 transition-colors duration-300",
                                    pathname === link.href ? "text-black border-b-2 border-black" : "text-gray-800"
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
                            className="inline-flex items-center justify-center p-2 rounded-md text-black hover:bg-gray-100 focus:outline-none transition-colors"
                            aria-expanded="false"
                        >
                            <span className="sr-only">Open main menu</span>
                            {isOpen ? (
                                <X className="block h-6 w-6" aria-hidden="true" />
                            ) : (
                                <Menu className="block h-6 w-6" aria-hidden="true" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            <div className={clsx(
                "md:hidden absolute top-20 left-0 w-full bg-white border-b border-gray-100 shadow-lg transition-all duration-300 ease-in-out origin-top",
                isOpen ? "opacity-100 scale-y-100" : "opacity-0 scale-y-0 pointer-events-none"
            )}>
                <div className="px-4 pt-2 pb-6 space-y-2 flex flex-col items-center">
                    {navLinks.map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            onClick={() => setIsOpen(false)}
                            className={clsx(
                                "block px-3 py-4 text-sm font-bold uppercase tracking-widest w-full text-center hover:bg-gray-50 transition-colors",
                                pathname === link.href ? "bg-gray-50" : "text-black"
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

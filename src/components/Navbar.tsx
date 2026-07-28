"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { EveBashLogo } from "@/components/EveBashLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

const guestNavLinks = [
    { name: "Sample Galleries", href: "/sample-galleries" },
    { name: "Pricing", href: "/pricing" },
    { name: "EB Network", href: "/eb-network" },
    { name: "Contact Us", href: "/contact-us" },
];

const authNavLinks = [
    { name: "Dashboard", href: "/dashboard" },
    { name: "Host", href: "/host" },
    { name: "EB Business", href: "/eb-business" },
    { name: "EB Network", href: "/eb-network" },
];

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();
    const { user, logout } = useAuth();
    const isActiveLink = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));

    const getPlanLabel = (role?: string) => {
        switch (role) {
            case "admin": return "Super Admin";
            case "ultimate": return "1 TB Plan";
            case "elite": return "Elite Plan";
            case "pro": return "200 GB Plan";
            case "premium": return "Premium Plan";
            case "standard": return "Standard Plan";
            case "basic": return "Basic Plan";
            case "starter": return "10 GB Plan";
            default: return "Free Plan";
        }
    };

    if (pathname === '/login') return null;

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--site-border)] bg-[var(--site-bg)]/90 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    {/* Logo & Brand */}
                    <Link href="/" className="flex items-center space-x-2 group">
                        <div className="bg-white text-[#0f172a] p-2 rounded-lg group-hover:bg-slate-200 transition-colors">
                            <EveBashLogo className="h-6 w-6" aria-hidden="true" />
                        </div>
                        <span className="font-playfair text-xl font-bold text-[var(--site-text)]">
                            EveBash
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center space-x-8">
                        {(user ? authNavLinks : guestNavLinks).map((link) => (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={cn(
                                    "inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-[var(--site-text)] pb-1 border-b-2 border-transparent",
                                    isActiveLink(link.href)
                                        ? "text-[var(--site-text)] border-[var(--site-text)]"
                                        : "text-[var(--site-muted)] hover:border-slate-500"
                                )}
                            >
                                {link.name}
                            </Link>
                        ))}

                        <ThemeToggle compact />

                        {user ? (
                            <Link
                                href="/profile"
                                aria-label="Profile"
                                title="Profile"
                                className={cn(
                                    "ml-4 flex h-11 w-11 items-center justify-center rounded-full border transition-all",
                                    pathname === "/profile"
                                        ? "border-yellow-400 bg-yellow-400 text-slate-950"
                                        : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:bg-slate-800 hover:text-white"
                                )}
                            >
                                {user.profileImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={user.profileImage} alt="" className="h-full w-full rounded-full object-cover" />
                                ) : (
                                    <UserIcon className="h-5 w-5" />
                                )}
                            </Link>
                        ) : (
                            <Link
                                href="/login"
                                className="px-5 py-2 bg-white text-[#0f172a] text-sm font-bold rounded-full hover:bg-slate-200 transition-colors shadow-sm"
                            >
                                Login
                            </Link>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden flex items-center gap-2">
                        <ThemeToggle compact />
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="p-2 text-[var(--site-muted)] hover:text-[var(--site-text)] focus:outline-none transition-colors"
                            aria-label="Toggle menu"
                        >
                            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            <div
                className={cn(
                    "md:hidden absolute top-20 left-0 w-full bg-[var(--site-surface)] border-b border-[var(--site-border)] shadow-xl transition-all duration-300 ease-in-out origin-top overflow-hidden",
                    isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
                )}
            >
                <div className="px-4 pt-4 pb-6 space-y-2 flex flex-col">
                    {(user ? authNavLinks : guestNavLinks).map((link) => (
                        <Link
                            key={link.name}
                            href={link.href}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-3 rounded-lg text-lg font-medium transition-colors",
                                isActiveLink(link.href)
                                    ? "text-sky-400 bg-sky-900/30 font-semibold"
                                    : "text-[var(--site-muted)] hover:bg-[var(--site-card-muted)] hover:text-[var(--site-text)]"
                            )}
                        >
                            {link.name}
                        </Link>
                    ))}
                    <div className="pt-4 border-t border-[var(--site-border)] mt-2 space-y-3">
                        {user ? (
                            <>
                                <div className="mb-2 flex items-center space-x-3 rounded-lg bg-[var(--site-card-muted)] px-4 py-2">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--site-border)] bg-white">
                                        <UserIcon className="w-5 h-5 text-[#0f172a]" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[var(--site-text)]">{user.name}</p>
                                        <p className="text-xs text-[var(--site-muted)]">{getPlanLabel(user.role)}</p>
                                    </div>
                                </div>
                                <Link
                                    href="/profile"
                                    onClick={() => setIsOpen(false)}
                                    className={cn(
                                        "block w-full text-center px-4 py-3 rounded-lg text-lg font-medium transition-colors",
                                        pathname === "/profile" ? "bg-sky-900/30 text-sky-400" : "text-[var(--site-muted)] hover:bg-[var(--site-card-muted)] hover:text-[var(--site-text)]"
                                    )}
                                >
                                    Profile
                                </Link>
                                <button
                                    onClick={() => {
                                        setIsOpen(false);
                                        logout();
                                    }}
                                    className="block w-full rounded-lg border border-[var(--site-border)] px-4 py-3 text-center text-lg font-medium text-[var(--site-muted)] transition-colors hover:bg-[var(--site-card-muted)] hover:text-[var(--site-text)]"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <Link
                                href="/login"
                                onClick={() => setIsOpen(false)}
                                className="block w-full text-center px-4 py-3 bg-white text-[#0f172a] rounded-lg text-lg font-medium hover:bg-slate-200 transition-colors"
                            >
                                Login
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </nav >
    );
}

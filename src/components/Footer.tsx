"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Footer() {
    const pathname = usePathname();
    const isEventPage = pathname.startsWith("/events/");

    if (pathname === '/login') return null;
    return (
        <footer
            className={cn(
                "bg-[var(--site-bg)] text-[var(--site-muted)] pt-16 pb-8 border-t border-[var(--site-border)]",
                isEventPage && "event-footer"
            )}
            style={isEventPage ? {
                backgroundColor: "var(--event-template-primary)",
                borderColor: "var(--event-template-border)",
                color: "var(--event-template-muted)",
            } : undefined}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
                    {/* Brand Section */}
                    <div className="space-y-6">
                        <Link href="/" className="inline-block">
                            <h3 className="font-serif text-2xl font-bold tracking-tight text-[var(--site-text)] hover:text-sky-400 transition-colors">
                                EveBash
                            </h3>
                        </Link>
                        <p className="text-[var(--site-muted)] leading-relaxed font-light text-base">
                            Capturing the most precious moments of your life with elegance and style.
                            We believe every picture tells a story, and we are here to tell yours.
                        </p>
                        <div className="flex space-x-6 pt-4">
                            <a href="#" className="text-[var(--site-muted)] hover:text-sky-400 transition-colors transform hover:-translate-y-1 duration-300">
                                <Instagram className="w-5 h-5" />
                            </a>
                            <a href="#" className="text-[var(--site-muted)] hover:text-sky-400 transition-colors transform hover:-translate-y-1 duration-300">
                                <Facebook className="w-5 h-5" />
                            </a>
                            <a href="#" className="text-[var(--site-muted)] hover:text-sky-400 transition-colors transform hover:-translate-y-1 duration-300">
                                <Twitter className="w-5 h-5" />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-6 lg:pl-8">
                        <h4 className="font-serif text-lg text-[var(--site-text)] font-semibold tracking-wide">Explore</h4>
                        <ul className="space-y-3 text-base">
                            <li>
                                <Link href="/" className="text-[var(--site-muted)] hover:text-sky-400 transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-sky-500 transition-colors"></span>
                                    About Us
                                </Link>
                            </li>
                            <li>
                                <Link href="/sample-galleries" className="text-[var(--site-muted)] hover:text-sky-400 transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-sky-500 transition-colors"></span>
                                    Sample Galleries
                                </Link>
                            </li>
                            <li>
                                <Link href="/pricing" className="text-[var(--site-muted)] hover:text-sky-400 transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-sky-500 transition-colors"></span>
                                    Pricing
                                </Link>
                            </li>
                            <li>
                                <Link href="/eb-network" className="text-[var(--site-muted)] hover:text-sky-400 transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-sky-500 transition-colors"></span>
                                    EB Network
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact-us" className="text-[var(--site-muted)] hover:text-sky-400 transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-sky-500 transition-colors"></span>
                                    Contact Us
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Legal Links */}
                    <div className="space-y-6">
                        <h4 className="font-serif text-lg text-[var(--site-text)] font-semibold tracking-wide">Legal</h4>
                        <ul className="space-y-3 text-base">
                            <li>
                                <Link href="/privacy-policy" className="text-[var(--site-muted)] hover:text-sky-400 transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-sky-500 transition-colors"></span>
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms-and-conditions" className="text-[var(--site-muted)] hover:text-sky-400 transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-sky-500 transition-colors"></span>
                                    Terms & Conditions
                                </Link>
                            </li>
                            <li>
                                <Link href="/cancellation-refund-policy" className="text-[var(--site-muted)] hover:text-sky-400 transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-sky-500 transition-colors"></span>
                                    Cancellation & Refund
                                </Link>
                            </li>
                            <li>
                                <Link href="/shipping-delivery-policy" className="text-[var(--site-muted)] hover:text-sky-400 transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-[var(--site-muted)] mr-2 group-hover:bg-sky-500 transition-colors"></span>
                                    Shipping & Delivery
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-6">
                        <h4 className="font-serif text-lg text-[var(--site-text)] font-semibold tracking-wide">Contact Us</h4>
                        <div className="space-y-4 text-base">
                            <div className="flex items-start">
                                <MapPin className="w-4 h-4 text-sky-400 mt-1 shrink-0" />
                                <p className="ml-3">
                                    Dehradun, Uttarakhand, India - 248001
                                </p>
                            </div>
                            <div className="flex items-center">
                                <Phone className="w-4 h-4 text-sky-400 shrink-0" />
                                <div className="ml-3">
                                    <p>+91 98712 64964</p>
                                    <p>+91 85350 29872</p>
                                </div>
                            </div>
                            <div className="flex items-center">
                                <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                                <p className="ml-3">support@evebash.com</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div
                    className="mt-16 pt-8 border-t border-[var(--site-border)] flex flex-col md:flex-row justify-between items-center bg-[var(--site-bg)]"
                    style={isEventPage ? {
                        backgroundColor: "var(--event-template-primary)",
                        borderColor: "var(--event-template-border)",
                    } : undefined}
                >
                    <p className="text-sm text-[var(--site-muted)]">
                        &copy; {new Date().getFullYear()} EveBash. All rights reserved.
                    </p>
                    <p className="mt-2 text-sm text-[var(--site-muted)] md:mt-0">
                        Designed with <span className="text-rose-400">♥</span>
                    </p>
                </div>
            </div>
        </footer>
    );
}

import Link from "next/link";
import { Facebook, Instagram, Twitter, Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
    return (
        <footer className="bg-slate-50 text-slate-600 pt-16 pb-8 border-t border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Brand Section */}
                    <div className="space-y-6">
                        <Link href="/" className="inline-block">
                            <h3 className="font-serif text-2xl font-bold tracking-tight text-slate-800 hover:text-sky-600 transition-colors">
                                Gallery
                            </h3>
                        </Link>
                        <p className="text-slate-600 leading-relaxed font-light text-base">
                            Capturing the most precious moments of your life with elegance and style.
                            We believe every picture tells a story, and we are here to tell yours.
                        </p>
                        <div className="flex space-x-6 pt-4">
                            <a href="#" className="text-slate-500 hover:text-sky-600 transition-colors transform hover:-translate-y-1 duration-300">
                                <Instagram className="w-5 h-5" />
                            </a>
                            <a href="#" className="text-slate-500 hover:text-sky-600 transition-colors transform hover:-translate-y-1 duration-300">
                                <Facebook className="w-5 h-5" />
                            </a>
                            <a href="#" className="text-slate-500 hover:text-sky-600 transition-colors transform hover:-translate-y-1 duration-300">
                                <Twitter className="w-5 h-5" />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className="space-y-6 md:pl-12">
                        <h4 className="font-serif text-lg text-slate-800 font-semibold tracking-wide">Explore</h4>
                        <ul className="space-y-3 text-base">
                            <li>
                                <Link href="/" className="text-slate-600 hover:text-sky-600 transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-slate-300 mr-2 group-hover:bg-sky-500 transition-colors"></span>
                                    Home
                                </Link>
                            </li>
                            <li>
                                <Link href="/sample-galleries" className="text-slate-600 hover:text-sky-600 transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-slate-300 mr-2 group-hover:bg-sky-500 transition-colors"></span>
                                    Sample Galleries
                                </Link>
                            </li>
                            <li>
                                <Link href="/pricing" className="text-slate-600 hover:text-sky-600 transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-slate-300 mr-2 group-hover:bg-sky-500 transition-colors"></span>
                                    Pricing
                                </Link>
                            </li>
                            <li>
                                <Link href="/contact-us" className="text-slate-600 hover:text-sky-600 transition-colors flex items-center group">
                                    <span className="w-1 h-1 rounded-full bg-slate-300 mr-2 group-hover:bg-sky-500 transition-colors"></span>
                                    Contact Us
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-6">
                        <h4 className="font-serif text-lg text-slate-800 font-semibold tracking-wide">Contact Us</h4>
                        <div className="space-y-4 text-base">
                            <div className="flex items-start">
                                <MapPin className="w-4 h-4 text-sky-600 mt-1 shrink-0" />
                                <p className="ml-3">
                                    123 Kingsway Road,<br />
                                    Dehradun, Uttarakhand, India
                                </p>
                            </div>
                            <div className="flex items-center">
                                <Phone className="w-4 h-4 text-sky-600 shrink-0" />
                                <p className="ml-3">+91 987 654 3210</p>
                            </div>
                            <div className="flex items-center">
                                <Mail className="w-4 h-4 text-sky-600 shrink-0" />
                                <p className="ml-3">hello@weddingalbum.com</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Copyright */}
                <div className="mt-16 pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center bg-slate-50">
                    <p className="text-slate-500 text-sm">
                        &copy; {new Date().getFullYear()} Wedding Album. All rights reserved.
                    </p>
                    <p className="text-slate-500 text-sm mt-2 md:mt-0">
                        Designed with <span className="text-red-400">♥</span>
                    </p>
                </div>
            </div>
        </footer>
    );
}

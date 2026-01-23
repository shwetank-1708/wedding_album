"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { requestAccess } from "@/lib/firestore";
import { Heart, Lock, Clock, Sparkles } from "lucide-react";

export default function LoginPage() {
    const params = useParams();
    const slug = params?.slug as string;

    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [error, setError] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "requested">("idle");
    const { login } = useAuth();
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!name.trim() || !phone.trim()) {
            setError("Please enter both your name and phone number ✨");
            return;
        }

        setStatus("loading");

        try {
            // 1. Try to login
            const success = await login(name, phone);

            if (success) {
                // If successful, redirect to the tenant home
                // We use window.location.href or just router.push to the root of the tenant
                // Since this is inside /tenant/[slug], we want to go to /tenant/[slug]
                router.push(`/tenant/${slug}`);
            } else {
                // 2. If not allowed, automatically request access
                await requestAccess(name, phone);
                setStatus("requested");
            }
        } catch (err) {
            console.error(err);
            setError("Something went wrong. Please try again.");
            setStatus("idle");
        }
    };

    if (status === "requested") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-royal-cream px-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md border border-royal-maroon/10 text-center relative overflow-hidden"
                >
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-royal-maroon via-royal-gold to-royal-maroon" />
                    <Sparkles className="absolute top-4 right-4 text-royal-gold/30 w-8 h-8 animate-pulse" />

                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="w-20 h-20 bg-royal-maroon/5 rounded-full flex items-center justify-center mx-auto mb-6"
                    >
                        <Heart className="w-10 h-10 text-royal-maroon fill-current" />
                    </motion.div>

                    <h2 className="text-3xl font-serif text-royal-maroon mb-4">Request Sent!</h2>

                    <div className="space-y-4 text-gray-600 mb-8 font-light leading-relaxed">
                        <p>
                            Thank you, <span className="font-medium text-royal-maroon">{name}</span>!
                        </p>
                        <p>
                            Your request to view the album has been sent to the hosts.
                        </p>
                        <p className="text-sm italic opacity-80 border-t border-gray-100 pt-4 mt-4">
                            Please check back later — once approved, you'll be able to enter directly with your phone number.
                        </p>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        className="text-sm text-royal-maroon hover:text-royal-gold transition-colors font-medium flex items-center justify-center gap-2 mx-auto"
                    >
                        <Clock className="w-4 h-4" />
                        Check Status Again
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-royal-cream px-4 relative overflow-hidden">
            {/* Background Texture */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #800000 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="bg-white/90 backdrop-blur-sm p-8 md:p-12 rounded-2xl shadow-2xl w-full max-w-md border border-white/50 relative z-10"
            >
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-royal-maroon text-royal-gold mb-4 shadow-lg">
                        <Lock className="w-5 h-5" />
                    </div>
                    <h1 className="text-4xl font-serif text-royal-maroon mb-3 tracking-wide">Welcome</h1>
                    <p className="text-gray-500 font-light">Enter your details to access the memories.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1">
                        <label className="block text-xs uppercase tracking-widest font-semibold text-royal-maroon/70 ml-1">Your Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-royal-maroon/20 focus:border-royal-maroon outline-none transition-all duration-300 text-slate-900"
                            placeholder="e.g. Aditi Sharma"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="block text-xs uppercase tracking-widest font-semibold text-royal-maroon/70 ml-1">Phone Number</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white focus:ring-2 focus:ring-royal-maroon/20 focus:border-royal-maroon outline-none transition-all duration-300 text-slate-900"
                            placeholder="e.g. 9876543210"
                        />
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="text-red-500 text-sm text-center bg-red-50/50 p-3 rounded-lg border border-red-100"
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        type="submit"
                        disabled={status === "loading"}
                        className="w-full bg-gradient-to-r from-royal-maroon to-red-900 text-white py-4 rounded-xl font-medium tracking-wide shadow-lg shadow-royal-maroon/30 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-70 disabled:cursor-wait mt-4"
                    >
                        {status === "loading" ? (
                            <span className="flex items-center justify-center gap-2">
                                <motion.span
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                    className="block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                                />
                                Verifying...
                            </span>
                        ) : "Enter Album"}
                    </button>
                </form>

                <p className="text-center text-xs text-gray-400 mt-8 font-light">
                    Protected with ❤️
                </p>
            </motion.div>
        </div>
    );
}

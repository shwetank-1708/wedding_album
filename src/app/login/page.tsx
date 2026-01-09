"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { requestAccess } from "@/lib/firestore";
import { Heart, Lock, Clock, Sparkles } from "lucide-react";

export default function LoginPage() {
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [error, setError] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "requested">("idle");
    const [isSignUp, setIsSignUp] = useState(false); // Toggle state
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
            if (isSignUp) {
                // Sign Up Mode: Request Access
                await requestAccess(name, phone);
                setStatus("requested");
            } else {
                // Login Mode: Try to login
                const success = await login(name, phone);

                if (success) {
                    router.push("/");
                } else {
                    setError("Access denied. Please Sign Up to request access.");
                    setStatus("idle");
                }
            }
        } catch (err) {
            console.error(err);
            setError("Something went wrong. Please try again.");
            setStatus("idle");
        }
    };

    if (status === "requested") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 text-center relative overflow-hidden"
                >
                    {/* Decorative Background Elements */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-400 to-indigo-500" />

                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 15 }}
                        className="w-20 h-20 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-6"
                    >
                        <Heart className="w-10 h-10 text-sky-500 fill-current" />
                    </motion.div>

                    <h2 className="text-3xl font-serif text-slate-800 mb-4">Request Sent!</h2>

                    <div className="space-y-4 text-slate-600 mb-8 font-light leading-relaxed">
                        <p>
                            Thank you, <span className="font-medium text-slate-900">{name}</span>!
                        </p>
                        <p>
                            Your request to view the album has been sent to the <br />
                            <span className="font-serif text-lg text-sky-600 font-medium">Administrator</span>.
                        </p>
                        <p className="text-sm text-slate-400 pt-4 mt-4 border-t border-slate-100">
                            Please check back later — once approved, you'll be able to enter directly with your phone number.
                        </p>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        className="text-sm text-sky-600 hover:text-sky-800 transition-colors font-medium flex items-center justify-center gap-2 mx-auto"
                    >
                        <Clock className="w-4 h-4" />
                        Check Status Again
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 relative overflow-hidden">
            {/* Background Texture - Clean & Minimal */}
            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-40"></div>

            <motion.div
                key={isSignUp ? "signup" : "login"} // Re-animate on toggle
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="bg-white/80 backdrop-blur-xl p-8 md:p-12 rounded-3xl shadow-2xl w-full max-w-md border border-white/50 relative z-10"
            >
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-100 text-sky-600 mb-4 shadow-sm">
                        {isSignUp ? <Sparkles className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
                    </div>
                    <h1 className="text-3xl font-serif text-slate-800 mb-3 tracking-wide">
                        {isSignUp ? "Join Us" : "Welcome Back"}
                    </h1>
                    <p className="text-slate-600 font-light">
                        {isSignUp ? "Request access to the gallery." : "Enter your details to access."}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1">
                        <label className="block text-sm uppercase tracking-widest font-bold text-slate-600 ml-1">Your Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all duration-300"
                            placeholder="e.g. Aditi Sharma"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="block text-sm uppercase tracking-widest font-bold text-slate-600 ml-1">Phone Number</label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full px-4 py-3 bg-white rounded-xl border border-slate-200 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all duration-300"
                            placeholder="e.g. 9876543210"
                        />
                    </div>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg border border-red-100"
                            >
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        type="submit"
                        disabled={status === "loading"}
                        className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold tracking-wide shadow-lg hover:bg-sky-600 hover:shadow-sky-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 disabled:opacity-70 disabled:cursor-wait mt-4"
                    >
                        {status === "loading" ? (
                            <span className="flex items-center justify-center gap-2">
                                <motion.span
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                    className="block w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                                />
                                {isSignUp ? "Sending Request..." : "Verifying..."}
                            </span>
                        ) : (isSignUp ? "Request Access" : "Enter Gallery")}
                    </button>
                </form>

                {/* Toggle between Login and Sign Up */}
                <div className="mt-8 text-center pt-6 border-t border-slate-100">
                    <p className="text-slate-500 text-sm">
                        {isSignUp ? "Already include in the guest list?" : "Don't have access yet?"}
                        <button
                            onClick={() => {
                                setIsSignUp(!isSignUp);
                                setError("");
                            }}
                            className="ml-2 font-bold text-sky-600 hover:text-sky-800 transition-colors underline decoration-2 underline-offset-4"
                        >
                            {isSignUp ? "Login here" : "Sign Up"}
                        </button>
                    </p>
                </div>

                <p className="text-center text-sm text-slate-500 mt-6 font-light">
                    Protected with ❤️
                </p>
            </motion.div>
        </div>
    );
}

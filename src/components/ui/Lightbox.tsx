"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CldImage } from "next-cloudinary";

interface LightboxProps {
    isOpen: boolean;
    onClose: () => void;
    photo: {
        src: string;
        cloudinaryPublicId?: string;
        alt?: string;
        width?: number;
        height?: number;
    } | null;
    onNext?: () => void;
    onPrev?: () => void;
}

export function Lightbox({ isOpen, onClose, photo, onNext, onPrev }: LightboxProps) {
    // Handle Keyboard events
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowRight") onNext?.();
            if (e.key === "ArrowLeft") onPrev?.();
        };

        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden"; // Prevent scrolling
        }

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, onClose, onNext, onPrev]);

    if (!photo) return null;

    const useCloudinary = !!photo.cloudinaryPublicId || !photo.src.startsWith("http");

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
                >
                    {/* Background overlay to close on click */}
                    <div className="absolute inset-0 z-0 cursor-zoom-out" onClick={onClose} />

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all z-50 bg-black/20 backdrop-blur-md"
                        aria-label="Close lightbox"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>

                    {/* Navigation Buttons */}
                    {onPrev && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onPrev(); }}
                            className="absolute left-6 top-1/2 -translate-y-1/2 p-4 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all z-50 bg-black/20 backdrop-blur-md hidden md:block"
                            aria-label="Previous photo"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        </button>
                    )}

                    {onNext && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onNext(); }}
                            className="absolute right-6 top-1/2 -translate-y-1/2 p-4 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all z-50 bg-black/20 backdrop-blur-md hidden md:block"
                            aria-label="Next photo"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </button>
                    )}

                    {/* Mobile Swipe Simulation / Taps */}
                    <div className="absolute inset-0 z-10 md:hidden flex">
                        <div className="flex-1 h-full" onClick={(e) => { e.stopPropagation(); onPrev?.(); }} />
                        <div className="flex-1 h-full" onClick={(e) => { e.stopPropagation(); onNext?.(); }} />
                    </div>

                    {/* Image Container */}
                    <motion.div
                        key={photo.src} // Key by src to trigger animations on slide change
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="relative z-20 max-w-full max-h-[90vh] flex items-center justify-center cursor-default shadow-2xl"
                        onClick={(e) => e.stopPropagation()} // Prevent close on image click
                    >
                        {useCloudinary ? (
                            <CldImage
                                src={photo.cloudinaryPublicId || photo.src}
                                width={photo.width || 1200}
                                height={photo.height || 1200}
                                alt={photo.alt || "Event Photo"}
                                preserveTransformations
                                className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg"
                            />
                        ) : (
                            <img
                                src={photo.src}
                                alt={photo.alt || "Event Photo"}
                                className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg"
                            />
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

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
}

export function Lightbox({ isOpen, onClose, photo }: LightboxProps) {
    // Handle Escape key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "hidden"; // Prevent scrolling
        }

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            document.body.style.overflow = "unset";
        };
    }, [isOpen, onClose]);

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
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 cursor-zoom-out"
                    onClick={onClose}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50"
                        aria-label="Close lightbox"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>

                    {/* Image Container */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
                        className="relative max-w-full max-h-[90vh] flex items-center justify-center cursor-default"
                        onClick={(e) => e.stopPropagation()} // Prevent close on image click
                    >
                        {useCloudinary ? (
                            <CldImage
                                src={photo.cloudinaryPublicId || photo.src}
                                width={photo.width || 1200}
                                height={photo.height || 1200}
                                alt={photo.alt || "Event Photo"}
                                preserveTransformations
                                className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                            />
                        ) : (
                            <img
                                src={photo.src}
                                alt={photo.alt || "Event Photo"}
                                className="max-w-full max-h-[90vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                            />
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

"use client";

import React, { useState } from "react";
import { CldImage } from "next-cloudinary";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Photo {
    id: string;
    src: string;
    cloudinaryPublicId?: string;
    alt?: string;
    height?: number;
    width?: number;
    filename?: string;
}

interface MasonryGridProps {
    photos: Photo[];
    className?: string;
    eventSlug?: string;
}

import { Lightbox } from "./Lightbox";

export function MasonryGrid({ photos, className, eventSlug }: MasonryGridProps) {
    // Track which photo is currently "downloading" to show a spinner
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    // Track which photo is currently being viewed in the Lightbox
    const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

    const handleDownload = async (photo: Photo) => {
        setDownloadingId(photo.id);
        try {
            let downloadUrl = photo.src;
            // If it's a Cloudinary URL, add the attachment flag to force download
            if (downloadUrl.includes("cloudinary.com") && downloadUrl.includes("/upload/")) {
                downloadUrl = downloadUrl.replace("/upload/", "/upload/fl_attachment/");
            }

            // Create temporary link
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', photo.filename || 'wedding-photo');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Download failed", error);
        } finally {
            setDownloadingId(null);
        }
    };


    return (
        <div className={cn("container mx-auto px-4 py-8", className)}>
            <div className="columns-1 sm:columns-2 md:columns-3 gap-2 space-y-2">
                {photos.map((photo, index) => {
                    const useCloudinary = !!photo.cloudinaryPublicId || !photo.src.startsWith("http");
                    const isDownloading = downloadingId === photo.id;

                    return (
                        <motion.div
                            key={photo.id}
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-50px" }}
                            transition={{ duration: 0.6, delay: index * 0.05, ease: "easeOut" }}
                            onClick={() => setViewingPhoto(photo)}
                            className="break-inside-avoid overflow-hidden group relative mb-2 shadow-sm hover:shadow-xl transition-shadow duration-500 bg-stone-200 cursor-pointer"
                        >
                            <div className="relative w-full">
                                {useCloudinary ? (
                                    <CldImage
                                        src={photo.cloudinaryPublicId || photo.src}
                                        width={photo.width || 500}
                                        height={photo.height || 500}
                                        alt={photo.alt || "Event Photo"}
                                        crop="fill"
                                        gravity="auto"
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        className="w-full h-auto object-cover transform transition-all duration-700 group-hover:scale-105"
                                        placeholder="blur"
                                        blurDataURL="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNlN2U1ZTQiLz48L3N2Zz4="
                                    />
                                ) : (
                                    <img
                                        src={photo.src}
                                        alt={photo.alt || "Event Photo"}
                                        className="w-full h-auto object-cover transform transition-all duration-700 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                )}

                                {/* Overlay & Download Button */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-500">
                                    {eventSlug && photo.filename && (
                                        <div className="absolute top-4 right-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 z-10">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDownload(photo);
                                                }}
                                                disabled={isDownloading}
                                                className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 text-white hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                                                title="Download Original"
                                            >
                                                <span className="sr-only">Download</span>
                                                {isDownloading ? (
                                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                    </svg>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            {/* Lightbox with Navigation */}
            <Lightbox
                isOpen={!!viewingPhoto}
                photo={viewingPhoto}
                onClose={() => setViewingPhoto(null)}
                onNext={() => {
                    const currentIndex = photos.findIndex(p => p.id === viewingPhoto?.id);
                    if (currentIndex !== -1) {
                        const nextIndex = (currentIndex + 1) % photos.length;
                        setViewingPhoto(photos[nextIndex]);
                    }
                }}
                onPrev={() => {
                    const currentIndex = photos.findIndex(p => p.id === viewingPhoto?.id);
                    if (currentIndex !== -1) {
                        const prevIndex = (currentIndex - 1 + photos.length) % photos.length;
                        setViewingPhoto(photos[prevIndex]);
                    }
                }}
            />
        </div>
    );
}


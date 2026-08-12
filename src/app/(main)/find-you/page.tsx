"use client";

import React, { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import * as faceapi from "face-api.js";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { getApiUrl } from "@/lib/apiBase";

export default function FindYouPage() {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [matchedPhotos, setMatchedPhotos] = useState<any[]>([]);
    const [statusMessage, setStatusMessage] = useState("Loading AI Models...");
    const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setModelsLoaded(true);
        setStatusMessage("Ready to search!");
    }, []);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files?.length) return;

        const file = event.target.files[0];
        setUploading(true);
        setMatchedPhotos([]);
        setStatusMessage("Optimizing selfie & searching photos...");

        const imageUrl = URL.createObjectURL(file);
        setSelfieUrl(imageUrl);

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Selfie = reader.result as string;
            setProcessing(true);

            try {
                const response = await fetch(getApiUrl("/api/find-you"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        selfieBase64: base64Selfie,
                        eventIds: [], // Empty array = search all indexed events
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Failed to search: ${response.status}`);
                }

                const data = await response.json();

                if (data.error) {
                    setStatusMessage(data.error || "No face detected in selfie. Please try a clearer picture.");
                    return;
                }

                const mediaDomain = process.env.NEXT_PUBLIC_MEDIA_DOMAIN || "media.evebash.com";
                const matches = (data.matches || []).map((p: any) => {
                    const storageKey = p.storageKey || p.imageId || p.id;
                    return {
                        id: p.id || p.imageId,
                        src: p.previewUrl || p.thumbnailUrl || p.url || p.imageUrl || `https://${mediaDomain}/${storageKey}-preview.webp`,
                        width: p.width,
                        height: p.height,
                        alt: `Found in ${p.eventId || "event"}`
                    };
                });

                setMatchedPhotos(matches);

                if (matches.length === 0) {
                    setStatusMessage("No matching photos found in database. Try a clearer selfie!");
                } else {
                    setStatusMessage(`Found ${matches.length} photo${matches.length === 1 ? "" : "s"} of you! 🎉`);
                }
            } catch (error) {
                console.error("Matching error:", error);
                setStatusMessage("Something went wrong during matching.");
            } finally {
                setUploading(false);
                setProcessing(false);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <main className="min-h-screen bg-stone-50">
            <Navbar />

            <section className="pt-32 pb-20 px-4">
                <SectionHeader title="Find You" subtitle="AI-Powered Photo Search" />

                <div className="max-w-2xl mx-auto text-center mb-12">
                    <p className="text-stone-600 mb-8">
                        Upload a clear selfie, and our AI will magically find all your photos from the events.
                    </p>

                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-stone-100">
                        <div className="flex flex-col md:flex-row gap-4 justify-center">
                            {/* Option 1: Gallery Upload */}
                            <button
                                onClick={() => modelsLoaded && fileInputRef.current?.click()}
                                disabled={!modelsLoaded}
                                className={`
                                    flex-1 flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all
                                    ${modelsLoaded
                                        ? 'border-royal-gold/50 bg-royal-gold/5 hover:bg-royal-gold/10 hover:border-royal-gold text-royal-maroon'
                                        : 'border-stone-200 bg-stone-50 text-stone-600 cursor-not-allowed'}
                                `}
                            >
                                <span className="text-4xl mb-3">📁</span>
                                <span className="font-serif font-bold text-lg">Upload from Gallery</span>
                                <span className="text-xs opacity-70 mt-1">Select existing photo</span>
                            </button>

                            {/* Option 2: Camera Capture */}
                            <button
                                onClick={() => modelsLoaded && cameraInputRef.current?.click()}
                                disabled={!modelsLoaded}
                                className={`
                                    flex-1 flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all
                                    ${modelsLoaded
                                        ? 'border-royal-gold/50 bg-royal-gold/5 hover:bg-royal-gold/10 hover:border-royal-gold text-royal-maroon'
                                        : 'border-stone-200 bg-stone-50 text-stone-600 cursor-not-allowed'}
                                `}
                            >
                                <span className="text-4xl mb-3">📸</span>
                                <span className="font-serif font-bold text-lg">Take Selfie</span>
                                <span className="text-xs opacity-70 mt-1">Use camera directly</span>
                            </button>
                        </div>

                        {/* Status Message Area (moved out of the conditional rendering block above for clarity) */}
                        {!modelsLoaded && (
                            <p className="text-center text-stone-700 mt-4 animate-pulse">
                                Loading AI Models...
                            </p>
                        )}

                        {/* Hidden Inputs */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleUpload}
                        />
                        <input
                            ref={cameraInputRef}
                            type="file"
                            accept="image/*"
                            capture="user" // Forces camera on mobile
                            className="hidden"
                            onChange={handleUpload}
                        />

                        {/* Status / Progress */}
                        {(uploading || processing || statusMessage !== "AI Models Loaded. Ready.") && (
                            <div className="mt-6">
                                <p className="text-royal-maroon font-medium animate-pulse">
                                    {statusMessage}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Results */}
                {matchedPhotos.length > 0 && (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <SectionHeader title="Your Photos" subtitle={`We found ${matchedPhotos.length} matches`} />
                        <MasonryGrid photos={matchedPhotos} />
                    </div>
                )}
            </section>
        </main>
    );
}

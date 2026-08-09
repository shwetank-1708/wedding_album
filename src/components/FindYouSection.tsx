"use client";

import React, { useState, useRef } from "react";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { LightboxTheme } from "@/components/ui/Lightbox";
import { getApiUrl } from "@/lib/apiBase";
import { Camera, FolderOpen, Loader2, Search, Sparkles } from "lucide-react";

interface FindYouSectionProps {
    eventId: string;
    legacyId?: string;
    parentId?: string;
    eventSlug?: string;
    lightboxTheme?: LightboxTheme;
    subEventIds?: string[];
}

export function FindYouSection({ eventId, legacyId, parentId, eventSlug, lightboxTheme, subEventIds }: FindYouSectionProps) {
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [matchedPhotos, setMatchedPhotos] = useState<any[]>([]);
    const [statusMessage, setStatusMessage] = useState("");
    const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);
    const modelsLoaded = true; // No client-side models to load now

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;

        const file = e.target.files[0];
        setUploading(true);
        setMatchedPhotos([]);
        setHasSearched(false);
        setStatusMessage("Optimizing selfie & searching photos...");

        const imageUrl = URL.createObjectURL(file);
        setSelfieUrl(imageUrl);

        // Convert file to base64
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Selfie = reader.result as string;
            setProcessing(true);

            try {
                const eventIds = [eventId];
                if (parentId) eventIds.push(parentId);
                if (subEventIds && subEventIds.length > 0) eventIds.push(...subEventIds);
                if (legacyId) eventIds.push(legacyId);

                const response = await fetch(getApiUrl("/api/find-you"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        selfieBase64: base64Selfie,
                        eventIds: eventIds
                    })
                });

                if (!response.ok) {
                    throw new Error(`Failed to search: ${response.status}`);
                }

                const data = await response.json();

                if (data.error) {
                    setStatusMessage(data.error || "No face detected in selfie. Please try a clearer picture.");
                    setHasSearched(true);
                    return;
                }

                const matches = (data.matches || []).map((m: any) => {
                    const mediaDomain = process.env.NEXT_PUBLIC_MEDIA_DOMAIN || 'media.evebash.com';
                    const storageKey = m.storageKey || m.imageId || m.id;
                    return {
                        id: m.id || m.imageId,
                        src: m.url || m.imageUrl,
                        thumbnailUrl: m.thumbnailUrl || `https://${mediaDomain}/${storageKey}-thumbnail.webp`,
                        previewUrl: m.previewUrl || `https://${mediaDomain}/${storageKey}-preview.webp`,
                        width: m.width,
                        height: m.height,
                        alt: "Your photo",
                        storageKey: storageKey,
                        mediaType: m.mediaType || "photo",
                        filename: `${storageKey.split('/').pop() || 'photo'}.${m.format || 'jpg'}`
                    };
                });

                setMatchedPhotos(matches);
                setHasSearched(true);
                
                if (matches.length === 0) {
                    setStatusMessage("No matching photos found. Try a clearer selfie facing forward!");
                } else {
                    setStatusMessage(`Found ${matches.length} photo${matches.length === 1 ? "" : "s"} of you! 🎉`);
                }
            } catch (error) {
                console.error("Matching error:", error);
                setStatusMessage("Something went wrong. Please try again.");
            } finally {
                setUploading(false);
                setProcessing(false);
                if (fileInputRef.current) fileInputRef.current.value = "";
                if (cameraInputRef.current) cameraInputRef.current.value = "";
            }
        };
        
        reader.readAsDataURL(file);
    };

    const isBusy = uploading || processing;

    return (
        <div className="w-full">
            {/* Upload Card */}
            <div className="max-w-2xl mx-auto">
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/60 p-8 text-center">

                    {/* Selfie Preview */}
                    {selfieUrl && (
                        <div className="mb-6 flex justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <div className="relative">
                                <img
                                    src={selfieUrl}
                                    alt="Your selfie"
                                    className="w-24 h-24 rounded-full object-cover border-4 border-amber-400/60 shadow-xl"
                                />
                                {isBusy && (
                                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Description */}
                    {!selfieUrl && (
                        <div className="mb-8">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 flex items-center justify-center mx-auto mb-4 shadow-lg">
                                <Search className="w-8 h-8 text-white" />
                            </div>
                            <p className="text-stone-600 text-sm leading-relaxed max-w-sm mx-auto">
                                Upload a clear selfie and our AI will find all your photos from this event instantly.
                            </p>
                        </div>
                    )}

                    {/* Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            onClick={() => modelsLoaded && !isBusy && fileInputRef.current?.click()}
                            disabled={!modelsLoaded || isBusy}
                            className={`
                                flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 border-dashed 
                                font-bold text-sm transition-all duration-200
                                ${modelsLoaded && !isBusy
                                    ? "border-amber-400/60 bg-amber-50/50 hover:bg-amber-50 hover:border-amber-400 text-amber-800 cursor-pointer active:scale-95"
                                    : "border-stone-200 bg-stone-50 text-stone-400 cursor-not-allowed"}
                            `}
                        >
                            <FolderOpen className="w-5 h-5 flex-shrink-0" />
                            <span>Upload Photo</span>
                        </button>

                        <button
                            onClick={() => modelsLoaded && !isBusy && cameraInputRef.current?.click()}
                            disabled={!modelsLoaded || isBusy}
                            className={`
                                flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 border-dashed 
                                font-bold text-sm transition-all duration-200
                                ${modelsLoaded && !isBusy
                                    ? "border-rose-300/60 bg-rose-50/50 hover:bg-rose-50 hover:border-rose-400 text-rose-800 cursor-pointer active:scale-95"
                                    : "border-stone-200 bg-stone-50 text-stone-400 cursor-not-allowed"}
                            `}
                        >
                            <Camera className="w-5 h-5 flex-shrink-0" />
                            <span>Take Selfie</span>
                        </button>
                    </div>

                    {/* Hidden inputs */}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleUpload} />

                    {/* Status */}
                    <div className="mt-5 min-h-[28px]">
                        {!modelsLoaded && (
                            <p className="text-stone-500 text-sm flex items-center justify-center gap-2 animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading AI models...
                            </p>
                        )}
                        {modelsLoaded && isBusy && (
                            <p className="text-amber-700 text-sm font-medium flex items-center justify-center gap-2 animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {statusMessage}
                            </p>
                        )}
                        {modelsLoaded && !isBusy && hasSearched && (
                            <p className={`text-sm font-semibold flex items-center justify-center gap-2 ${matchedPhotos.length > 0 ? "text-green-700" : "text-rose-600"}`}>
                                <Sparkles className="w-4 h-4" />
                                {statusMessage}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Results Grid */}
            {matchedPhotos.length > 0 && (
                <div className="mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="text-center mb-8">
                        <p className="text-xs font-black uppercase tracking-widest text-stone-500 mb-2">Your Memories</p>
                        <h2 className="text-2xl font-serif italic text-stone-900">
                            Found {matchedPhotos.length} photo{matchedPhotos.length === 1 ? "" : "s"} of you
                        </h2>
                    </div>
                    <MasonryGrid
                        photos={matchedPhotos}
                        eventSlug={eventSlug}
                        lightboxTheme={lightboxTheme}
                    />
                </div>
            )}
        </div>
    );
}

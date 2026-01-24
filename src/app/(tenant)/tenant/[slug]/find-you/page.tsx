"use client";

import React, { useState, useEffect, useRef } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import * as faceapi from "face-api.js";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { getEventFaceEncodings, FaceRecord, getEventById, getSubEvents } from "@/lib/firestore";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function FindYouPage({ params }: { params: Promise<{ slug: string }> }) {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [matchedPhotos, setMatchedPhotos] = useState<any[]>([]);
    const [statusMessage, setStatusMessage] = useState("Loading AI Models...");
    const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
    const [searchScopeIds, setSearchScopeIds] = useState<string[]>([]);

    // Unwrap params
    const { slug } = React.use(params);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadModels = async () => {
            try {
                const MODEL_URL = "/models";
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                setModelsLoaded(true);
                setStatusMessage("AI Models Loaded. Ready.");
            } catch (error) {
                console.error("Error loading models:", error);
                setStatusMessage("Error loading AI models. Please check /public/models folder.");
            }
        };

        const fetchScope = async () => {
            // Fetch main event and sub-events to scope the search
            if (!slug) return;
            try {
                console.log("[FindYou] Fetching scope for:", slug);
                const mainEvent = await getEventById(slug);
                const subEvents = await getSubEvents(slug, mainEvent?.legacyId);

                const ids = [slug];
                if (mainEvent?.legacyId) ids.push(mainEvent.legacyId);
                subEvents.forEach(e => {
                    ids.push(e.id);
                    if (e.legacyId) ids.push(e.legacyId);
                });

                console.log("[FindYou] Search scope IDs:", ids);
                setSearchScopeIds(ids);
            } catch (error) {
                console.error("Error fetching event scope:", error);
                // Fallback to just slug if fetch fails
                setSearchScopeIds([slug]);
            }
        };

        loadModels();
        fetchScope();
    }, [slug]);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files?.length) return;

        const file = event.target.files[0];
        setUploading(true);
        setStatusMessage("Analyzing your selfie...");

        // Create a local URL for the selfie
        const imageUrl = URL.createObjectURL(file);
        setSelfieUrl(imageUrl);

        try {
            // 1. Detect face in selfie
            const selfieImage = await faceapi.fetchImage(imageUrl);
            const selfieDetection = await faceapi.detectSingleFace(selfieImage, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })).withFaceLandmarks().withFaceDescriptor();

            if (!selfieDetection) {
                setStatusMessage("No face detected in selfie. Please try again.");
                setUploading(false);
                return;
            }

            setProcessing(true);
            setStatusMessage("Searching database for matches...");

            // 2. Fetch faces for this specific event scope
            if (searchScopeIds.length === 0) {
                setStatusMessage("Initializing event data... Please wait.");
                setProcessing(false);
                return;
            }
            const indexedFaces = await getEventFaceEncodings(searchScopeIds);

            if (indexedFaces.length === 0) {
                setStatusMessage("No photos found in database. Please ask Admin to run the Indexer.");
                setProcessing(false);
                return;
            }

            // 3. Match faces
            const matches: FaceRecord[] = [];
            const threshold = 0.5; // Stricter threshold

            for (const face of indexedFaces) {
                const storedDescriptor = new Float32Array(face.descriptor);
                const distance = faceapi.euclideanDistance(selfieDetection.descriptor, storedDescriptor);

                if (distance < threshold) {
                    matches.push(face);
                }
            }

            // Deduplicate matches
            const uniqueMatches = Array.from(new Map(matches.map(item => [item.imageId, item])).values());

            setMatchedPhotos(uniqueMatches.map(p => ({
                id: p.imageId,
                src: p.imageUrl,
                width: p.width,
                height: p.height,
                alt: `Found in ${p.eventId}`,
                cloudinaryPublicId: p.imageId
            })));

            setStatusMessage(`Found ${uniqueMatches.length} photos of you!`);

        } catch (error) {
            console.error("Matching error:", error);
            setStatusMessage("Something went wrong during matching.");
        } finally {
            setUploading(false);
            setProcessing(false);
        }
    };

    return (
        <>
            {/* Simple Navigation Back */}
            <div className="absolute top-4 left-4 z-50">
                <Link href={`/tenant/${slug}`} className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-all text-stone-600">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Back to Event</span>
                </Link>
            </div>

            <section className="pt-32 pb-20 px-4">
                <SectionHeader title="Find You" subtitle="AI-Powered Photo Search" />

                <div className="max-w-2xl mx-auto text-center mb-12">
                    <p className="text-stone-600 mb-8">
                        Upload a clear selfie, and our AI will magically find all your photos from the event.
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
                                        : 'border-stone-200 bg-stone-50 text-stone-400 cursor-not-allowed'}
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
                                        : 'border-stone-200 bg-stone-50 text-stone-400 cursor-not-allowed'}
                                `}
                            >
                                <span className="text-4xl mb-3">📸</span>
                                <span className="font-serif font-bold text-lg">Take Selfie</span>
                                <span className="text-xs opacity-70 mt-1">Use camera directly</span>
                            </button>
                        </div>

                        {/* Status Message Area */}
                        {!modelsLoaded && (
                            <p className="text-center text-stone-500 mt-4 animate-pulse">
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
                            capture="user"
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
        </>
    );
}

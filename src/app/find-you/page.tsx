"use client";

import React, { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import * as faceapi from "face-api.js";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { getAllFaceEncodings, FaceRecord } from "@/lib/firestore";

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
        loadModels();
    }, []);

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

            // 2. Fetch all indexed faces from Firestore
            // This is much faster than processing images
            const indexedFaces = await getAllFaceEncodings();

            if (indexedFaces.length === 0) {
                setStatusMessage("No photos found in database. Please ask Admin to run the Indexer.");
                setProcessing(false);
                return;
            }

            // 3. Match faces
            const matches: FaceRecord[] = [];
            const threshold = 0.5; // Stricter threshold

            // Convert selfie descriptor to array if needed, but face-api handles Float32Array

            for (const face of indexedFaces) {
                // Firestore stores descriptor as number[]
                // We need to convert it back to Float32Array for face-api math
                const storedDescriptor = new Float32Array(face.descriptor);

                const distance = faceapi.euclideanDistance(selfieDetection.descriptor, storedDescriptor);

                if (distance < threshold) {
                    matches.push(face);
                }
            }

            // Deduplicate matches by imageId (if multiple faces in same image match same person - rare but possible)
            // or just show them. Actually, if I match 2 faces in one group photo, it's the same photo.
            const uniqueMatches = Array.from(new Map(matches.map(item => [item.imageId, item])).values());

            setMatchedPhotos(uniqueMatches.map(p => ({
                id: p.imageId, // Use the cloudinary ID
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

                        {/* Status Message Area (moved out of the conditional rendering block above for clarity) */}
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

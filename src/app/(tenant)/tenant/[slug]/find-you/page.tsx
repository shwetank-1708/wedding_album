"use client";

import React, { useState, useEffect, useRef } from "react";
import { RoyalNavbar } from "@/components/RoyalNavbar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import * as faceapi from "face-api.js";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { getAllFaceEncodings, FaceRecord, getEventById, getSubEvents, Event } from "@/lib/firestore";
import { useParams } from "next/navigation";

export default function FindYouPage() {
    const params = useParams();
    const slug = params?.slug as string;

    const [event, setEvent] = useState<Event | null>(null);
    const [subEvents, setSubEvents] = useState<Event[]>([]);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [matchedPhotos, setMatchedPhotos] = useState<any[]>([]);
    const [statusMessage, setStatusMessage] = useState("Loading AI Models...");
    const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (slug) {
            const fetchData = async () => {
                const fetchedEvent = await getEventById(slug);
                if (fetchedEvent) {
                    setEvent(fetchedEvent);
                    const fetchedSubEvents = await getSubEvents(fetchedEvent.id, fetchedEvent.legacyId);
                    setSubEvents(fetchedSubEvents);
                }
            };
            fetchData();
        }
    }, [slug]);

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
            // In a real multi-tenant app, we should filter by eventId here on the server side ideally
            // But for now we filter all
            const indexedFaces = await getAllFaceEncodings();

            if (indexedFaces.length === 0) {
                setStatusMessage("No photos found in database.");
                setProcessing(false);
                return;
            }

            // 3. Match faces
            const matches: FaceRecord[] = [];
            const threshold = 0.5; // Stricter threshold

            for (const face of indexedFaces) {
                // Determine if this face belongs to the current event (or sub-events)
                // This logic depends on face records having the correct eventId

                // Firestore stores descriptor as number[]
                // We need to convert it back to Float32Array for face-api math
                const storedDescriptor = new Float32Array(face.descriptor);

                const distance = faceapi.euclideanDistance(selfieDetection.descriptor, storedDescriptor);

                if (distance < threshold) {
                    matches.push(face);
                }
            }

            // Deduplicate matches by imageId
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

    if (!event) return <div className="min-h-screen bg-royal-cream flex items-center justify-center text-royal-maroon">Loading...</div>;

    // Sanitize for Client Component
    const serializedEvent = JSON.parse(JSON.stringify(event));
    const serializedSubEvents = JSON.parse(JSON.stringify(subEvents));

    return (
        <main className="min-h-screen bg-stone-50 font-sans">
            <RoyalNavbar event={serializedEvent} subEvents={serializedSubEvents} />

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

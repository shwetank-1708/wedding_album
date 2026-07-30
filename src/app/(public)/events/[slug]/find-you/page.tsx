"use client";

import React, { useState, useEffect, useRef } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import * as faceapi from "face-api.js";
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { getEventFaceEncodings, getEventById, getSubEvents, FaceRecord, Event } from "@/lib/database";
import { useSearchParams } from "next/navigation";
import { EventNavbar } from "@/components/EventNavbar";
import { getWebTemplateChrome } from "@/lib/webTemplateTheme";

type MatchedPhoto = {
    id: string;
    src: string;
    width?: number;
    height?: number;
    alt?: string;
};

export default function FindYouPage({ params }: { params: Promise<{ slug: string }> }) {
    const searchParams = useSearchParams();
    const isShared = searchParams.get("shared") === "true";

    const [event, setEvent] = useState<Event | null>(null);
    const [parentEvent, setParentEvent] = useState<Event | null>(null);
    const [subEvents, setSubEvents] = useState<Event[]>([]);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [matchedPhotos, setMatchedPhotos] = useState<MatchedPhoto[]>([]);
    const [statusMessage, setStatusMessage] = useState("Loading AI Models...");
    const [selfieUrl, setSelfieUrl] = useState<string | null>(null);

    // Unwrap params
    const { slug } = React.use(params);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        let active = true;

        async function loadEventNavData() {
            const eventData = await getEventById(slug);
            if (!active || !eventData) return;

            setEvent(eventData);

            const navRoot = eventData.parentId ? await getEventById(eventData.parentId) : eventData;
            if (!active) return;

            setParentEvent(eventData.parentId ? navRoot : null);

            if (navRoot) {
                const siblings = await getSubEvents(navRoot.id, navRoot.legacyId);
                if (!active) return;
                setSubEvents(siblings.filter((sub) => sub.id !== navRoot.id));
            }
        }

        void loadEventNavData();

        return () => {
            active = false;
        };
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

    const navEvent = parentEvent || event;
    const templateChrome = getWebTemplateChrome(navEvent?.templateId || event?.templateId);

    useEffect(() => {
        if (!navEvent?.templateId || typeof document === "undefined") return;

        const root = document.documentElement;
        root.dataset.eventTemplateChrome = "true";
        root.style.setProperty("--event-template-primary", templateChrome.background);
        root.style.setProperty("--event-template-text", templateChrome.text);
        root.style.setProperty("--event-template-muted", templateChrome.muted);
        root.style.setProperty("--event-template-accent", templateChrome.accent);
        root.style.setProperty("--event-template-border", templateChrome.border);

        return () => {
            delete root.dataset.eventTemplateChrome;
            root.style.removeProperty("--event-template-primary");
            root.style.removeProperty("--event-template-text");
            root.style.removeProperty("--event-template-muted");
            root.style.removeProperty("--event-template-accent");
            root.style.removeProperty("--event-template-border");
        };
    }, [navEvent?.templateId, templateChrome.accent, templateChrome.background, templateChrome.border, templateChrome.muted, templateChrome.text]);

    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files?.length) return;

        const file = event.target.files[0];
        setUploading(true);
        setMatchedPhotos([]);
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
            setStatusMessage("Searching this event's photos for matches...");

            // 2. Fetch face encodings ONLY for this specific event
            const eventData = await getEventById(slug);
            const eventIds = [slug];
            const legacyIds = eventData?.legacyId ? [eventData.legacyId] : [];
            // Also include parentId so guests see photos from all sub-events of the same wedding
            if (eventData?.parentId) eventIds.push(eventData.parentId);

            const indexedFaces = await getEventFaceEncodings(eventIds, legacyIds);

            if (indexedFaces.length === 0) {
                setStatusMessage("No indexed photos found for this event. Please ask the organizer to run the Face Indexer.");
                setProcessing(false);
                return;
            }

            // 3. Match faces
            const matches: FaceRecord[] = [];
            const threshold = 0.5;

            for (const face of indexedFaces) {
                const storedDescriptor = new Float32Array(face.descriptor);
                const distance = faceapi.euclideanDistance(selfieDetection.descriptor, storedDescriptor);

                if (distance < threshold) {
                    matches.push(face);
                }
            }

            // Deduplicate by imageId
            const uniqueMatches = Array.from(new Map(matches.map(item => [item.imageId, item])).values());

            setMatchedPhotos(uniqueMatches.map(p => ({
                id: p.imageId,
                src: p.imageUrl,
                width: p.width,
                height: p.height,
                alt: `Found in ${p.eventId}`
            })));

            if (uniqueMatches.length === 0) {
                setStatusMessage("No matching photos found in this event. Try a clearer selfie!");
            } else {
                setStatusMessage(`Found ${uniqueMatches.length} photo${uniqueMatches.length === 1 ? "" : "s"} of you!`);
            }

        } catch (error) {
            console.error("Matching error:", error);
            setStatusMessage("Something went wrong during matching.");
        } finally {
            setUploading(false);
            setProcessing(false);
        }
    };

    return (
        <main
            className="event-template-shell min-h-screen bg-stone-50 pb-20"
            style={{
                "--event-template-primary": templateChrome.background,
                "--event-template-text": templateChrome.text,
                "--event-template-muted": templateChrome.muted,
                "--event-template-accent": templateChrome.accent,
                "--event-template-border": templateChrome.border,
            } as React.CSSProperties}
        >
            {navEvent && (
                <EventNavbar
                    mainEventTitle={navEvent.title}
                    mainEventId={navEvent.id}
                    subEvents={subEvents}
                    isShared={isShared}
                    basePath={`/events/${navEvent.id}`}
                    activeGalleryId={navEvent.id}
                    activePage="find-you"
                    showFavouriteGallery
                    favouriteGalleryActive={false}
                    chromeBackgroundColor={templateChrome.background}
                    chromeTextColor={templateChrome.text}
                    chromeAccentColor={templateChrome.accent}
                    chromeBorderColor={templateChrome.border}
                />
            )}

            <section className="mx-auto max-w-6xl px-4 pt-32 pb-20 sm:px-6 lg:px-8">
                <SectionHeader title="Find You" subtitle="AI-Powered Photo Search" />

                <div className="max-w-2xl mx-auto text-center mb-12">
                    <p className="text-stone-600 mb-8">
                        Upload a clear selfie, and our AI will magically find all your photos from this event.
                    </p>

                    <div className="bg-white p-8 rounded-2xl shadow-xl border border-stone-100">
                        {/* Selfie preview */}
                        {selfieUrl && (
                            <div className="mb-6 flex justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={selfieUrl}
                                    alt="Your selfie"
                                    className="w-24 h-24 rounded-full object-cover border-4 border-royal-gold shadow-lg"
                                />
                            </div>
                        )}

                        <div className="flex flex-col md:flex-row gap-4 justify-center">
                            {/* Option 1: Gallery Upload */}
                            <button
                                onClick={() => modelsLoaded && fileInputRef.current?.click()}
                                disabled={!modelsLoaded || uploading || processing}
                                className={`
                                    flex-1 flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all
                                    ${modelsLoaded && !uploading && !processing
                                        ? 'border-royal-gold/50 bg-royal-gold/5 hover:bg-royal-gold/10 hover:border-royal-gold text-royal-maroon cursor-pointer'
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
                                disabled={!modelsLoaded || uploading || processing}
                                className={`
                                    flex-1 flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed transition-all
                                    ${modelsLoaded && !uploading && !processing
                                        ? 'border-royal-gold/50 bg-royal-gold/5 hover:bg-royal-gold/10 hover:border-royal-gold text-royal-maroon cursor-pointer'
                                        : 'border-stone-200 bg-stone-50 text-stone-400 cursor-not-allowed'}
                                `}
                            >
                                <span className="text-4xl mb-3">📸</span>
                                <span className="font-serif font-bold text-lg">Take Selfie</span>
                                <span className="text-xs opacity-70 mt-1">Use camera directly</span>
                            </button>
                        </div>

                        {/* Status Message */}
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
                            capture="user"
                            className="hidden"
                            onChange={handleUpload}
                        />

                        {/* Status / Progress */}
                        {(uploading || processing || (statusMessage !== "AI Models Loaded. Ready." && modelsLoaded)) && (
                            <div className="mt-6">
                                <p className={`font-medium ${uploading || processing ? "animate-pulse" : ""} ${matchedPhotos.length > 0 ? "text-green-700" : "text-royal-maroon"}`}>
                                    {statusMessage}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Results */}
                {matchedPhotos.length > 0 && (
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <SectionHeader title="Your Photos" subtitle={`We found ${matchedPhotos.length} match${matchedPhotos.length === 1 ? "" : "es"} in this event`} />
                        <MasonryGrid photos={matchedPhotos} />
                    </div>
                )}
            </section>
        </main>
    );
}

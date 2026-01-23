"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import * as faceapi from "face-api.js";
import { getAllPhotos, SimplePhoto } from "@/app/actions/photos";
import { saveFaceToIndex } from "@/lib/firestore";

export default function FaceIndexPage() {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [indexing, setIndexing] = useState(false);
    const [statusLogs, setStatusLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);

    // Load Models on Mount
    useEffect(() => {
        const loadModels = async () => {
            try {
                const MODEL_URL = "/models";
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), // Use the accurate model
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                setModelsLoaded(true);
                addLog("AI Models Loaded. Ready to Index.");
            } catch (error) {
                console.error("Error loading models:", error);
                addLog("Error: Could not load AI models. Check console.");
            }
        };
        loadModels();
    }, []);

    const addLog = (msg: string) => {
        setStatusLogs(prev => [msg, ...prev].slice(0, 50)); // Keep last 50 logs
    };

    const startIndexing = async () => {
        if (indexing) return;
        setIndexing(true);
        addLog("Starting Indexing Process...");

        try {
            // 1. Fetch all photos
            addLog("Fetching photo list from Cloudinary...");
            const allPhotos = await getAllPhotos();
            addLog(`Found ${allPhotos.length} photos in total.`);

            // 2. Process Loop
            let processed = 0;
            let facesFound = 0;
            const total = allPhotos.length;

            for (const photo of allPhotos) {
                // Safety break if user navigates away? 
                // We'll rely on the indexing state, though this loop won't stop immediately if unmounted.

                try {
                    // Use a smaller image for detection speed if possible, 
                    // but for ACCURACY (since this is run once by admin), we might want the full or slightly larger res.
                    // Let's use w_800 for a balance.
                    const scanUrl = photo.src.replace("/upload/", "/upload/w_800/");

                    // Fetch image as HTMLImageElement for face-api
                    const img = await faceapi.fetchImage(scanUrl);

                    // Detect all faces
                    // Using SSD MobileNet V1 with default or slightly lower confidence to catch harder faces
                    const detections = await faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
                        .withFaceLandmarks()
                        .withFaceDescriptors();

                    if (detections.length > 0) {
                        facesFound += detections.length;

                        // Save each face to Firestore
                        for (const detection of detections) {
                            await saveFaceToIndex({
                                imageId: photo.id,
                                descriptor: Array.from(detection.descriptor), // Convert Float32Array to number[]
                                eventId: "unknown", // getAllPhotos doesn't return eventId ID, only Name. We can fix this later or just store Name.
                                imageUrl: photo.src,
                                width: photo.width,
                                height: photo.height
                            });
                        }
                        addLog(`[${processed + 1}/${total}] Found ${detections.length} faces in ${photo.id}`);
                    } else {
                        // Optional: Log no faces found
                        // addLog(`[${processed + 1}/${total}] No faces in ${photo.id}`);
                    }

                } catch (e) {
                    addLog(`Error processing ${photo.id}: ${e}`);
                    console.error(e);
                }

                processed++;
                setProgress(Math.round((processed / total) * 100));

                // Small delay to prevent freezing UI completely
                await new Promise(r => setTimeout(r, 100));
            }

            addLog(`Indexing Complete! Found ${facesFound} faces across ${processed} photos.`);

        } catch (error) {
            console.error("Indexing Error:", error);
            addLog("Critical Error during indexing. Stopped.");
        } finally {
            setIndexing(false);
        }
    };

    return (
        <main className="min-h-screen bg-stone-50 pt-32 pb-20 px-4">
            <Navbar />
            <SectionHeader title="Admin: Index Faces" subtitle="Scan photos and save face data to DB" />

            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-xl font-bold font-serif text-royal-maroon">Face Indexer</h2>
                            <p className="text-stone-500">Run this once to populate the search database.</p>
                        </div>
                        <button
                            onClick={startIndexing}
                            disabled={!modelsLoaded || indexing}
                            className={`
                                px-6 py-3 rounded-lg font-semibold tracking-wide transition-colors
                                ${!modelsLoaded || indexing
                                    ? "bg-gray-300 cursor-not-allowed text-gray-500"
                                    : "bg-royal-gold text-royal-maroon hover:bg-yellow-500 shadow-md"}
                            `}
                        >
                            {indexing ? "Indexing..." : "Start Global Scan"}
                        </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
                        <div
                            className="bg-green-500 h-4 transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-right text-sm text-stone-500 mb-6">{progress}% Complete</p>

                    {/* Logs */}
                    <div className="bg-stone-900 text-green-400 font-mono text-sm p-4 rounded-lg h-96 overflow-y-auto border border-stone-800 shadow-inner">
                        {statusLogs.map((log, i) => (
                            <div key={i} className="mb-1 border-b border-white/5 pb-1 last:border-0">
                                <span className="text-stone-500 mr-2">{new Date().toLocaleTimeString()}</span>
                                {log}
                            </div>
                        ))}
                        {statusLogs.length === 0 && <p className="text-stone-600 italic">Waiting to start...</p>}
                    </div>
                </div>
            </div>
        </main>
    );
}

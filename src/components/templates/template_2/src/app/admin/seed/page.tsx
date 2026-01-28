"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import { syncCloudinaryToFirestore } from "@/app/actions/sync";
import { seedDatabase } from "@/lib/seed";

// These keys now correspond to FOLDERS in Cloudinary (e.g. wed_album/haldi)
const EVENTS = ["haldi", "mehendi", "wedding", "reception"];

export default function AdminPage() {
    // We don't need manual folder IDs anymore if we stick to the convention: "wed_album/{event_name}"

    // Status State
    const [status, setStatus] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});
    const [seedStatus, setSeedStatus] = useState("");
    const [seeding, setSeeding] = useState(false);

    const handleSync = async (event: string) => {
        setLoading(prev => ({ ...prev, [event]: true }));
        setStatus(prev => ({ ...prev, [event]: "Starting Sync..." }));

        try {
            // Call Server Action
            const result = await syncCloudinaryToFirestore(event);

            if (result.success) {
                setStatus(prev => ({ ...prev, [event]: `✅ Success! Synced ${result.count} photos.` }));
            } else {
                setStatus(prev => ({ ...prev, [event]: `❌ Error: ${result.message}` }));
            }
        } catch (err: any) {
            setStatus(prev => ({ ...prev, [event]: `❌ Failed: ${err.message}` }));
        } finally {
            setLoading(prev => ({ ...prev, [event]: false }));
        }
    };

    const handleSeedMetadata = async () => {
        setSeeding(true);
        setSeedStatus("Seeding metadata...");
        try {
            await seedDatabase();
            setSeedStatus("✅ Metadata seeded successfully!");
        } catch (error: any) {
            setSeedStatus("❌ Seeding failed: " + error.message);
        } finally {
            setSeeding(false);
        }
    };

    return (
        <div className="min-h-screen bg-royal-cream">
            <Navbar />
            <div className="pt-32 pb-20 max-w-4xl mx-auto p-4">
                <h1 className="text-3xl font-serif text-royal-maroon mb-8 text-center">
                    Admin Dashboard (Cloudinary Mode)
                </h1>

                <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-royal-gold">
                    <h2 className="text-xl font-bold text-royal-maroon mb-4">1. Initialize Event Data</h2>
                    <p className="text-sm text-gray-700 mb-4">
                        Click this first to create the Event pages (Haldi, Mehendi, etc.) in the database.
                        This does <strong>not</strong> touch the photos.
                    </p>
                    <button
                        onClick={handleSeedMetadata}
                        disabled={seeding}
                        className={`w-full py-3 rounded font-bold text-lg transition ${seeding
                            ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                            : "bg-royal-maroon text-white hover:bg-rose-900"
                            }`}
                    >
                        {seeding ? "Seeding..." : "Seed All Event Metadata"}
                    </button>
                    {seedStatus && (
                        <div className={`mt-3 p-2 rounded text-center font-mono border ${seedStatus.includes("failed")
                            ? "bg-red-50 border-red-200 text-red-700"
                            : "bg-green-50 border-green-200 text-green-700"
                            }`}>
                            {seedStatus}
                        </div>
                    )}
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-royal-gold">
                    <h2 className="text-xl font-bold text-royal-maroon mb-4">2. Sync Photos (REQUIRED)</h2>
                    <p className="text-sm text-gray-700 mb-4">
                        <span className="font-bold text-red-600">CRITICAL:</span> You MUST click "Sync Photos" below for images to appear in the gallery.
                        The website now reads from the database, not directly from Cloudinary.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {EVENTS.map((event) => (
                            <div key={event} className="bg-gray-50 p-4 rounded border border-gray-200">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="font-bold text-royal-maroon capitalize">{event}</h3>
                                    {status[event]?.includes("Success") && <span className="text-green-600 text-lg">✓</span>}
                                </div>
                                <button
                                    onClick={() => handleSync(event)}
                                    disabled={loading[event]}
                                    className={`w-full py-2 rounded font-medium transition text-sm ${loading[event]
                                        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                                        : "bg-royal-gold text-royal-maroon hover:bg-yellow-500"
                                        }`}
                                >
                                    {loading[event] ? "Syncing..." : "Sync Photos"}
                                </button>
                                {status[event] && (
                                    <div className="mt-2 text-xs text-gray-600 break-words">
                                        {status[event]}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md mb-8 border border-royal-gold">
                    <h2 className="text-xl font-bold text-royal-maroon mb-4">How to use Cloudinary</h2>
                    <ol className="list-decimal list-inside text-sm text-gray-700 space-y-2">
                        <li>Go to <a href="https://console.cloudinary.com/media_library/folders" target="_blank" className="text-blue-600 underline">Cloudinary Console</a>.</li>
                        <li>Create folders: <code>wed_album/haldi</code>, <code>wed_album/mehendi</code>, etc.</li>
                        <li>Upload photos. The app will show them automatically!</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}



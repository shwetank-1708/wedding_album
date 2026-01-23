"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";

export default function DebugPage() {
    const [envVars, setEnvVars] = useState<any>({});
    const [dbStatus, setDbStatus] = useState("Checking...");

    useEffect(() => {
        setEnvVars({
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
            msgSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
            cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
            cloudKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
        });

        if (db) {
            setDbStatus("✅ DB Object Initialized");
        } else {
            setDbStatus("❌ DB Object is NULL");
        }
    }, []);

    return (
        <div className="p-10 font-mono text-sm space-y-4">
            <h1 className="text-xl font-bold">Environment Debugger</h1>

            <div className="border p-4 rounded bg-gray-100">
                <h2 className="font-bold mb-2">Firebase Config</h2>
                <ul>
                    {Object.entries(envVars).map(([key, value]) => (
                        <li key={key}>
                            <strong>{key}:</strong> {value ? `✅ Loaded (${(value as string).slice(0, 5)}...)` : "❌ MISSING"}
                        </li>
                    ))}
                </ul>
            </div>

            <div className="border p-4 rounded bg-gray-100">
                <h2 className="font-bold mb-2">Internal Status</h2>
                <p>{dbStatus}</p>
            </div>
        </div>
    );
}

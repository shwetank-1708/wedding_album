"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, getCountFromServer } from "firebase/firestore";

export default function DebugDB() {
    const [logs, setLogs] = useState<string[]>([]);

    const log = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

    const checkDB = async () => {
        setLogs([]);
        log("Starting DB Check...");

        if (!db) {
            log("❌ DB Object is NULL!");
            return;
        }

        try {
            // 1. Simple Count Check (No Indexes needed usually)
            const photosCol = collection(db, "photos");
            const snapshot = await getCountFromServer(photosCol);
            log(`count(): Found ${snapshot.data().count} total photos in 'photos' collection.`);

            // 2. Fetch WITHOUT parameters (Raw check)
            const rawSnap = await getDocs(photosCol);
            log(`getDocs(all): Fetched ${rawSnap.size} documents raw.`);
            if (rawSnap.size > 0) {
                const first = rawSnap.docs[0].data();
                log(`Sample Doc [0]: ID=${rawSnap.docs[0].id}, eventId=${first.eventId}`);
            }

            // 3. Test the EXACT query used in the app
            log("Testing App Query: where(eventId == 'haldi') + orderBy(uploadedAt, desc)...");
            try {
                const q = query(photosCol, where("eventId", "==", "haldi"), orderBy("uploadedAt", "desc"));
                const qSnap = await getDocs(q);
                log(`✅ Query Success: Found ${qSnap.size} photos for 'haldi'.`);
            } catch (err: any) {
                log(`❌ Query FAILED: ${err.message}`);
                if (err.message.includes("index")) {
                    log("💡 TIP: You are missing a Composite Index. Check the console for a link to create it!");
                }
            }

        } catch (err: any) {
            log(`❌ Major Error: ${err.message}`);
        }
    };

    return (
        <div className="p-10 font-mono text-sm">
            <h1 className="text-xl font-bold mb-4">Database Debugger</h1>
            <button onClick={checkDB} className="bg-blue-600 text-white px-4 py-2 rounded mb-4">Run Check</button>
            <div className="bg-gray-100 p-4 rounded border h-96 overflow-auto whitespace-pre-wrap">
                {logs.join("\n")}
            </div>
        </div>
    );
}

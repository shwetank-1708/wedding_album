
import { initializeApp } from "firebase/app";
import { getFirestore, doc, deleteDoc, collection, getDocs, query, where } from "firebase/firestore";
import fs from "fs";
import path from "path";

// Load env
const envPath = path.resolve(".env.local");
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, "utf8");
    envConfig.split("\n").forEach((line) => {
        const parts = line.split("=");
        if (parts.length >= 2) {
            const key = parts[0].trim();
            const value = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
            process.env[key] = value;
        }
    });
}

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanup() {
    const uid = "3pExRQuLV7cV5PELyYHRfGrfaC53";
    const eventId = "sample-event-0d12";

    console.log(`Starting cleanup for UID: ${uid} and EventID: ${eventId}...`);

    try {
        // 1. Delete the user document
        console.log("Deleting user document...");
        const userRef = doc(db, "users", uid);
        await deleteDoc(userRef);
        console.log("User document deleted.");

        // 2. Delete the event document
        console.log("Deleting event document...");
        const eventRef = doc(db, "events", eventId);
        await deleteDoc(eventRef);
        console.log("Event document deleted.");

        // 3. Double check for any photos just in case
        console.log("Checking for orphaned photos...");
        const photosRef = collection(db, "photos");
        const photoQ = query(photosRef, where("eventId", "==", eventId));
        const photoSnap = await getDocs(photoQ);

        if (!photoSnap.empty) {
            console.log(`Deleting ${photoSnap.size} orphaned photos...`);
            for (const p of photoSnap.docs) {
                await deleteDoc(p.ref);
            }
            console.log("Photos deleted.");
        } else {
            console.log("No photos to delete.");
        }

        // 4. Check for guest logs
        console.log("Checking for guest logs...");
        const guestsRef = collection(db, "guests");
        const guestQ = query(guestsRef, where("eventId", "==", eventId));
        const guestSnap = await getDocs(guestQ);

        if (!guestSnap.empty) {
            console.log(`Deleting ${guestSnap.size} guest logs...`);
            for (const g of guestSnap.docs) {
                await deleteDoc(g.ref);
            }
            console.log("Guest logs deleted.");
        } else {
            console.log("No guest logs to delete.");
        }

        console.log("Cleanup finished successfully!");

    } catch (error) {
        console.error("Cleanup failed:", error);
    }
}

cleanup().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
});

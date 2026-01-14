"use server";

import { getCloudinaryImages } from "@/lib/cloudinary";
import { db } from "@/lib/firebase";
import { collection, writeBatch, doc, Timestamp, getDocs, query, where } from "firebase/firestore";

// This is a Server Action
/**
 * This is a Server Action that synchronizes images from Cloudinary to Firestore.
 * It now searches across multiple potential folder paths for maximum resilience.
 */
export async function syncCloudinaryToFirestore(eventId: string, userId?: string, legacyId?: string) {
    try {
        console.log(`Starting resilient sync for Event: ${eventId}, User: ${userId || 'none'}, Legacy: ${legacyId || 'none'}...`);

        if (!db) {
            throw new Error("Firebase Firestore 'db' is not initialized.");
        }

        // Generate list of potential folder names to check in Cloudinary
        const eventIds = legacyId && legacyId !== eventId ? [eventId, legacyId] : [eventId];
        const foldersToCheck: string[] = [];

        eventIds.forEach(id => {
            foldersToCheck.push(id); // root folder: wed_album/<id>
            if (userId) {
                foldersToCheck.push(`${userId}/${id}`); // user folder: wed_album/<userId>/<id>
            }
        });

        let allImages: any[] = [];

        // 1. Fetch images from Cloudinary from all potential folders
        for (const folderName of foldersToCheck) {
            let nextCursor: string | undefined = undefined;
            console.log(`Checking Cloudinary folder: 'wed_album/${folderName}'...`);

            do {
                const result = await getCloudinaryImages(folderName, nextCursor);
                if (result.resources.length > 0) {
                    allImages = [...allImages, ...result.resources];
                }
                nextCursor = result.next_cursor;
            } while (nextCursor);
        }

        if (allImages.length === 0) {
            return {
                success: false,
                message: `No images found in any checked Cloudinary folders: ${foldersToCheck.map(f => `'wed_album/${f}'`).join(', ')}`
            };
        }

        // Deduplicate images based on public_id (in case folders overlap)
        const uniqueItems = Array.from(new Map(allImages.map(img => [img.public_id, img])).values());

        console.log(`Found total ${uniqueItems.length} unique images for ${eventId}. Starting Firestore sync...`);

        // 2. Write to Firestore (server-to-firebase)
        const photosCol = collection(db, "photos");
        const BATCH_SIZE = 450;
        let totalSynced = 0;

        for (let i = 0; i < uniqueItems.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const chunk = uniqueItems.slice(i, i + BATCH_SIZE);

            for (const img of chunk) {
                const uniqueId = img.public_id.replace(/\//g, '_');
                const photoRef = doc(photosCol, uniqueId);
                const photoDate = img.created_at ? Timestamp.fromDate(new Date(img.created_at)) : Timestamp.now();

                batch.set(photoRef, {
                    id: uniqueId,
                    eventId: eventId, // Always sync to the CURRENT eventId
                    cloudinaryPublicId: img.public_id,
                    width: img.width,
                    height: img.height,
                    url: img.secure_url,
                    uploadedAt: photoDate,
                    tags: ["cloudinary-synced"]
                }, { merge: true });
            }

            await batch.commit();
            totalSynced += chunk.length;
        }

        return { success: true, count: totalSynced, message: `Successfully synced ${totalSynced} photos!` };

    } catch (error: any) {
        console.error("Sync Error:", error);
        return { success: false, message: error.message };
    }
}


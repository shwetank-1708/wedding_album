"use server";

import { getCloudinaryImages } from "@/lib/cloudinary";
import { db } from "@/lib/firebase";
import { collection, writeBatch, doc, Timestamp } from "firebase/firestore";

// This is a Server Action
export async function syncCloudinaryToFirestore(eventId: string) {
    try {
        console.log(`Starting sync for ${eventId}...`);

        if (!db) {
            throw new Error("Firebase Firestore 'db' is not initialized. Check your .env.local keys.");
        }

        // 1. Fetch images from Cloudinary (cloud-to-server) with Pagination
        // We assume folder naming convention: "wed_Album/<eventId>"
        let allImages: any[] = [];
        let nextCursor: string | undefined = undefined;

        do {
            console.log(`Fetching batch from Cloudinary... Cursor: ${nextCursor || 'Initial'}`);
            const result = await getCloudinaryImages(eventId, nextCursor);

            if (result.resources.length > 0) {
                allImages = [...allImages, ...result.resources];
            }

            nextCursor = result.next_cursor;
        } while (nextCursor);

        if (allImages.length === 0) {
            return { success: false, message: `No images found in Cloudinary folder 'wed_Album/${eventId}'` };
        }

        console.log(`Found total ${allImages.length} images in Cloudinary for ${eventId}. Starting Firestore sync...`);

        // 2. Write to Firestore (server-to-firebase)
        const photosCol = collection(db, "photos");

        // Firestore batch limit is 500. We process in chunks of 450 to be safe.
        const BATCH_SIZE = 450;
        let totalSynced = 0;

        for (let i = 0; i < allImages.length; i += BATCH_SIZE) {
            const batch = writeBatch(db);
            const chunk = allImages.slice(i, i + BATCH_SIZE);

            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(allImages.length / BATCH_SIZE)}...`);

            for (const img of chunk) {
                // ID Strategy: Use a sanitized version of the full public_id to ensure global uniqueness
                // "wed_album/haldi/IMG_9999" -> "wed_album_haldi_IMG_9999"
                // Firestore IDs cannot contain slashes.
                const uniqueId = img.public_id.replace(/\//g, '_');

                const photoRef = doc(photosCol, uniqueId); // doc(collection, id)

                // Parse Cloudinary timestamp or fallback to now
                const photoDate = img.created_at ? Timestamp.fromDate(new Date(img.created_at)) : Timestamp.now();

                batch.set(photoRef, {
                    id: uniqueId,
                    eventId: eventId,
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

        return { success: true, count: totalSynced, message: `Successfully synced ${totalSynced} photos from Cloudinary!` };

    } catch (error: any) {
        console.error("Sync Error:", error);
        return { success: false, message: error.message };
    }
}

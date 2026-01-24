"use server";

import { getCloudinaryImages } from "@/lib/cloudinary";
import { getEvents } from "@/lib/firestore";


export interface SimplePhoto {
    id: string;
    src: string;
    width: number;
    height: number;
    eventName: string;
    eventId: string;
}

export async function getAllPhotos(): Promise<SimplePhoto[]> {
    try {
        const events = await getEvents();
        const allPhotos: SimplePhoto[] = [];


        // Fetch from all events in parallel
        const promises = events.map(async (event) => {
            const folderName = event.id; // Use event ID as folder name (or add a field if needed)
            const result = await getCloudinaryImages(folderName);
            const images = result.resources || [];

            return images.map(img => ({
                id: img.public_id,
                src: img.secure_url,
                width: img.width,
                height: img.height,
                eventName: event.title,
                eventId: event.id
            }));
        });

        const results = await Promise.all(promises);

        // Flatten the array
        results.forEach(photos => {
            allPhotos.push(...photos);
        });

        return allPhotos;
    } catch (error) {
        console.error("Error fetching all photos:", error);
        return [];
    }
}

"use server";

function getBackendApiUrl() {
    return (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
}

export interface SimplePhoto {
    id: string;
    src: string;
    eventId: string;
    width: number;
    height: number;
}

export async function getAllPhotos(): Promise<SimplePhoto[]> {
    try {
        const apiBaseUrl = getBackendApiUrl();
        if (!apiBaseUrl) {
            console.error("[Photos] NEXT_PUBLIC_API_URL is not configured.");
            return [];
        }

        const response = await fetch(`${apiBaseUrl}/api/v1/media/all-photos`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
        });

        if (!response.ok) {
            console.error(`[Photos] Backend returned status ${response.status}`);
            return [];
        }

        const data = await response.json();
        return data.photos || [];
    } catch (error) {
        console.error("[Photos] Failed to fetch photos from backend:", error);
        return [];
    }
}

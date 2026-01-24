import { uploadToCloudinary } from "@/app/actions/upload";

/**
 * Converts a File object to a base64 string
 */
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
    });
}

/**
 * Uploads a file to Cloudinary via a Server Action
 * Returns the download URL and metadata.
 */
export async function uploadEventImage(file: File, eventId: string, userId?: string) {
    try {
        console.log(`[Cloudinary] Starting upload for: ${file.name} to event: ${eventId}`);

        const base64 = await fileToBase64(file);
        const folder = userId ? `${userId}/${eventId}` : eventId;

        const result = await uploadToCloudinary(base64, folder);

        if (!result.success) {
            throw new Error(result.error);
        }

        console.log(`[Cloudinary] Upload complete: ${result.url?.substring(0, 50)}...`);

        return {
            url: result.url as string,
            publicId: result.public_id as string,
            width: result.width as number,
            height: result.height as number,
            bytes: result.bytes as number,
            format: result.format as string
        };
    } catch (error: unknown) {
        console.error("[Cloudinary] Progress Error:", error);
        throw error;
    }
}

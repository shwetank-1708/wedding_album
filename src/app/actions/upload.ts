"use server";

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

export async function uploadToCloudinary(base64Image: string, folder: string) {
    try {
        console.log(`[Server Action] Received upload request. Payload size: ${Math.round(base64Image.length / 1024 / 1024 * 100) / 100} MB`);

        const result = await cloudinary.uploader.upload(base64Image, {
            folder: `wed_album/${folder}`,
            resource_type: 'auto',
            transformation: [
                { quality: 'auto', fetch_format: 'auto' },
                { width: 2500, height: 2500, crop: 'limit' }
            ]
        });

        console.log(`[Server Action] Cloudinary upload success: ${result.public_id}`);

        return {
            success: true,
            url: result.secure_url,
            public_id: result.public_id,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            format: result.format,
        };
    } catch (error: any) {
        console.error("[Server Action] Cloudinary Upload Error Detail:", error);
        return {
            success: false,
            error: error?.message || "Cloudinary upload failed",
        };
    }
}

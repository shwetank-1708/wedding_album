import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

export interface CloudinaryResource {
    public_id: string;
    format: string;
    width: number;
    height: number;
    created_at: string;
    bytes: number;
    url: string;
    secure_url: string;
}

export async function getCloudinaryImages(folderName: string, nextCursor?: string): Promise<{ resources: CloudinaryResource[], next_cursor?: string }> {
    try {
        // "wed_Album" is the root folder user created
        // Structure: wed_Album -> [haldi, mehendi, etc.]
        // Asset Folders require using the Search API, not the Admin API prefix method.

        const folderPath = `wed_album/${folderName}`;

        const expression = `folder:${folderPath} AND resource_type:image`;

        const search = cloudinary.search
            .expression(expression) // Exact folder match
            .sort_by('created_at', 'desc')
            .max_results(500);

        if (nextCursor) {
            search.next_cursor(nextCursor);
        }

        const result = await search.execute();

        // Search API returns resources in slightly different format, but compatible enough
        // We map it to be sure.
        const resources = result.resources.map((res: CloudinaryResource) => ({
            public_id: res.public_id,
            format: res.format,
            width: res.width,
            height: res.height,
            created_at: res.created_at,
            bytes: res.bytes,
            url: res.url,
            secure_url: res.secure_url
        })) as CloudinaryResource[];

        return {
            resources,
            next_cursor: result.next_cursor
        };
    } catch (error) {
        console.error("Cloudinary Search Error:", error);
        return { resources: [], next_cursor: undefined };
    }
}

export default cloudinary;

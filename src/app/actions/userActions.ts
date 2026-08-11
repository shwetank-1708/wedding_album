"use server";

import { uploadToBackblaze } from "./upload";

function getBackendApiUrl() {
    return (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
}

/**
 * Server Action to delete a user's account by requesting Railway backend admin control.
 */
export async function deleteUserCompletely(uid: string, requesterEmail: string) {
    try {
        console.log(`[Server Action] Request to delete user: ${uid} by ${requesterEmail}`);

        const apiBaseUrl = getBackendApiUrl();
        if (!apiBaseUrl) {
            return { success: false, error: "NEXT_PUBLIC_API_URL is not configured." };
        }

        const response = await fetch(`${apiBaseUrl}/api/admin/control`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                action: "delete_user",
                uid,
                requesterEmail,
            }),
            cache: "no-store",
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, error: payload.error || "Failed to delete user." };
        }

        return { success: true };
    } catch (error: any) {
        console.error("[Server Action] Error deleting user completely:", error);
        return { success: false, error: error.message || "An internal error occurred." };
    }
}

/**
 * Server Action to sync all users by requesting Railway backend admin control.
 */
export async function syncAllAuthUsers(requesterEmail: string) {
    try {
        console.log(`[Server Action] Request to sync all users by: ${requesterEmail}`);

        const apiBaseUrl = getBackendApiUrl();
        if (!apiBaseUrl) {
            return { success: false, error: "NEXT_PUBLIC_API_URL is not configured." };
        }

        const response = await fetch(`${apiBaseUrl}/api/admin/control`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                action: "sync_all_auth_users",
                requesterEmail,
            }),
            cache: "no-store",
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, error: payload.error || "Failed to sync users." };
        }

        return {
            success: true,
            count: payload.data?.count || 0,
            synced: payload.data?.synced || 0,
        };
    } catch (error: any) {
        console.error("[Server Action] Error syncing all users:", error);
        return { success: false, error: error.message || "Sync failed." };
    }
}

/**
 * Server Action to securely upload a base64 encoded profile image to Backblaze.
 */
export async function uploadProfileImageToBackblaze(base64Image: string, uid: string) {
    try {
        console.log(`[Server Action] Uploading profile image for UID: ${uid}`);

        if (!uid) {
            throw new Error("Unauthorized request. UID is missing.");
        }

        const uploadResponse = await uploadToBackblaze(base64Image, `profiles/${uid}`, {
            fileName: "profile_pic.jpg",
            contentType: "image/jpeg",
            resourceType: "image",
        });

        if (!uploadResponse.success || !uploadResponse.url) {
            throw new Error(uploadResponse.error || "Upload failed.");
        }

        console.log(`[Server Action] Profile image uploaded successfully: ${uploadResponse.url}`);
        return { success: true, url: uploadResponse.url };
    } catch (error: any) {
        console.error("[Server Action] Error uploading profile image to Backblaze:", error);
        return { success: false, error: error.message || "Upload failed." };
    }
}

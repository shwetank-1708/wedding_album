"use server";

function getBackendApiUrl() {
    return (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
}

type Requester = {
    uid?: string | null;
    email?: string | null;
};

export async function updateGuestStatusAction(
    logId: string,
    status: "pending" | "approved" | "rejected",
    requester: Requester
) {
    try {
        const apiBaseUrl = getBackendApiUrl();
        if (!apiBaseUrl) {
            return { success: false, error: "NEXT_PUBLIC_API_URL is not configured." };
        }

        const response = await fetch(`${apiBaseUrl}/api/v1/permissions/update-guest-status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logId, status, requester }),
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, error: data.error || "Failed to update guest status." };
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("[Permissions] Failed to update guest status:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update guest." };
    }
}

export async function deleteGuestAction(logId: string, requester: Requester) {
    try {
        const apiBaseUrl = getBackendApiUrl();
        if (!apiBaseUrl) {
            return { success: false, error: "NEXT_PUBLIC_API_URL is not configured." };
        }

        const response = await fetch(`${apiBaseUrl}/api/v1/permissions/delete-guest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logId, requester }),
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, error: data.error || "Failed to delete guest." };
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("[Permissions] Failed to delete guest:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to remove guest." };
    }
}

export async function updateGuestPermissionsAction(
    logId: string,
    permissions: Partial<{ canAdmin: boolean; canUpload: boolean; canComment: boolean }>,
    requester: Requester
) {
    try {
        const apiBaseUrl = getBackendApiUrl();
        if (!apiBaseUrl) {
            return { success: false, error: "NEXT_PUBLIC_API_URL is not configured." };
        }

        const response = await fetch(`${apiBaseUrl}/api/v1/permissions/update-guest-permissions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ logId, permissions, requester }),
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, error: data.error || "Failed to update permissions." };
        }

        return { success: true };
    } catch (error: unknown) {
        console.error("[Permissions] Failed to update guest permissions:", error);
        return { success: false, error: error instanceof Error ? error.message : "Failed to update permissions." };
    }
}

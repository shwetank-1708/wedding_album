"use server";

function getBackendApiUrl() {
    return (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
}

export interface LoginResult {
    success: boolean;
    user?: {
        name: string;
        phone: string;
        role: string;
    };
    error?: string;
    status: 'allowed' | 'denied' | 'needs_request';
}

export async function checkAndLogGuest(name: string, phone: string, slug: string): Promise<LoginResult> {
    try {
        const apiBaseUrl = getBackendApiUrl();
        if (!apiBaseUrl) {
            return { success: false, status: 'denied', error: 'NEXT_PUBLIC_API_URL is not configured.' };
        }

        const response = await fetch(`${apiBaseUrl}/api/v1/tenant-auth/check-and-log`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, phone, slug }),
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, status: 'denied', error: data.error || 'Access check failed' };
        }

        return data;
    } catch (error: any) {
        console.error("[ServerAction] Error in checkAndLogGuest:", error);
        return {
            success: false,
            status: 'denied',
            error: error.message
        };
    }
}

export async function requestGuestAccessAction(name: string, phone: string) {
    try {
        const apiBaseUrl = getBackendApiUrl();
        if (!apiBaseUrl) {
            return { success: false, error: 'NEXT_PUBLIC_API_URL is not configured.' };
        }

        const response = await fetch(`${apiBaseUrl}/api/v1/tenant-auth/request-access`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, phone }),
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, error: data.error || 'Failed to request access' };
        }

        return { success: true };
    } catch (error: any) {
        console.error("[ServerAction] Error in requestGuestAccess:", error);
        return { success: false, error: error.message };
    }
}

export async function getPendingRequestsAction() {
    try {
        const apiBaseUrl = getBackendApiUrl();
        if (!apiBaseUrl) {
            return { success: false, error: 'NEXT_PUBLIC_API_URL is not configured.', data: [] };
        }

        const response = await fetch(`${apiBaseUrl}/api/v1/tenant-auth/pending-requests`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, error: data.error || 'Failed to get requests', data: [] };
        }

        return { success: true, data: data.data || [] };
    } catch (error: any) {
        console.error("[ServerAction] Error getting requests:", error);
        return { success: false, error: error.message, data: [] };
    }
}

export async function approveRequestAction(name: string, phone: string) {
    try {
        const apiBaseUrl = getBackendApiUrl();
        if (!apiBaseUrl) {
            return { success: false, error: 'NEXT_PUBLIC_API_URL is not configured.' };
        }

        const response = await fetch(`${apiBaseUrl}/api/v1/tenant-auth/approve-request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, phone }),
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, error: data.error || 'Failed to approve request' };
        }

        return { success: true };
    } catch (error: any) {
        console.error("[ServerAction] Error approving request:", error);
        return { success: false, error: error.message };
    }
}

export async function denyRequestAction(phone: string) {
    try {
        const apiBaseUrl = getBackendApiUrl();
        if (!apiBaseUrl) {
            return { success: false, error: 'NEXT_PUBLIC_API_URL is not configured.' };
        }

        const response = await fetch(`${apiBaseUrl}/api/v1/tenant-auth/deny-request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone }),
            cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            return { success: false, error: data.error || 'Failed to deny request' };
        }

        return { success: true };
    } catch (error: any) {
        console.error("[ServerAction] Error denying request:", error);
        return { success: false, error: error.message };
    }
}

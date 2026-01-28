"use server";

import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

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
        console.log(`[ServerAction] Checking access for ${phone} on ${slug}`);

        // 1. Check allowed_users
        const allowedDoc = await adminDb.collection("allowed_users").doc(phone).get();

        if (allowedDoc.exists) {
            const allowedData = allowedDoc.data();
            console.log(`[ServerAction] User found in allowed_users:`, allowedData);

            // 2. Log the login
            // Use a combined ID or just random
            const logId = `${phone}_${slug}`;
            await adminDb.collection("guests").doc(logId).set({
                name: name || allowedData?.name,
                phone: phone,
                eventId: slug, // Assuming slug is the event ID or maps to it
                loginAt: Timestamp.now(),
                status: 'approved', // Auto-approved because they are in allowed_users
                source: 'server-action'
            }, { merge: true });

            return {
                success: true,
                status: 'allowed',
                user: {
                    name: allowedData?.name || name,
                    phone: phone,
                    role: allowedData?.role || 'guest'
                }
            };
        }

        // 3. If not allowed, check if they have a PENDING request?
        // Optional, but for now we just return needs_request
        return {
            success: false,
            status: 'needs_request'
        };

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
        await adminDb.collection("pending_requests").doc(phone).set({
            name,
            phone,
            requestedAt: Timestamp.now()
        });
        return { success: true };
    } catch (error: any) {
        console.error("[ServerAction] Error in requestGuestAccess:", error);
        return { success: false, error: error.message };
    }
}

export async function getPendingRequestsAction() {
    try {
        const snapshot = await adminDb.collection("pending_requests").orderBy("requestedAt", "desc").get();
        const requests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Serialize Timestamp
            requestedAt: doc.data().requestedAt?.toMillis() || Date.now()
        }));
        return { success: true, data: requests };
    } catch (error: any) {
        console.error("[ServerAction] Error getting requests:", error);
        return { success: false, error: error.message, data: [] };
    }
}

export async function approveRequestAction(name: string, phone: string) {
    try {
        // 1. Add to allowed_users
        await adminDb.collection("allowed_users").doc(phone).set({
            name,
            phone,
            role: "guest",
            addedAt: Timestamp.now()
        }, { merge: true });

        // 2. Remove from pending_requests
        await adminDb.collection("pending_requests").doc(phone).delete();

        return { success: true };
    } catch (error: any) {
        console.error("[ServerAction] Error approving request:", error);
        return { success: false, error: error.message };
    }
}

export async function denyRequestAction(phone: string) {
    try {
        await adminDb.collection("pending_requests").doc(phone).delete();
        return { success: true };
    } catch (error: any) {
        console.error("[ServerAction] Error denying request:", error);
        return { success: false, error: error.message };
    }
}

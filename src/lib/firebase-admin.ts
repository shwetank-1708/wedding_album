import "server-only";
import * as admin from "firebase-admin";

if (!admin.apps.length) {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
        }),
    });
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();

export function getAdminDb() {
    return adminDb;
}

export function getAdminAuth() {
    return adminAuth;
}

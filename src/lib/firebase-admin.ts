import * as admin from 'firebase-admin';

/**
 * Initializes the Firebase Admin SDK securely.
 * We use a dedicated function to ensure we only initialize once and handle missing ENV variables gracefully.
 */
function initializeAdmin() {
    if (admin.apps.length > 0) return admin.apps[0];

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        console.error("❌ Firebase Admin SDK Error: Missing environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY).");
        return null;
    }

    try {
        return admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
        });
    } catch (error) {
        console.error("❌ Firebase Admin SDK Token/Initialization Error:", error);
        return null;
    }
}

// Getters that verify initialization before returning the service
export const getAdminAuth = () => {
    const app = initializeAdmin();
    if (!app) throw new Error("Firebase Admin SDK not configured. Please check your .env.local variables.");
    return admin.auth(app);
};

export const getAdminDb = () => {
    const app = initializeAdmin();
    if (!app) throw new Error("Firebase Admin SDK not configured. Please check your .env.local variables.");
    return admin.firestore(app);
};

export const getAdminStorage = () => {
    const app = initializeAdmin();
    if (!app) throw new Error("Firebase Admin SDK not configured. Please check your .env.local variables.");
    return admin.storage(app);
};

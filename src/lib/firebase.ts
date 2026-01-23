/* eslint-disable @typescript-eslint/no-explicit-any */
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let app: any;
let auth: any;
let db: any;
let storage: any;
let googleProvider: any;

if (firebaseConfig.apiKey) {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();
} else {
    console.warn("Firebase config missing, services disabled.");
    // Mock Auth object to prevent useAuthState crash
    auth = {
        currentUser: null,
        onAuthStateChanged: (callback: any) => {
            callback(null);
            return () => { }; // Unsubscribe function
        },
        signOut: async () => { },
        app: null // Indicator that it's a mock
    };
    // Mock other services as null/safe defaults to allow import but fail on use
    app = null;
    db = null;
    storage = null;
    googleProvider = new GoogleAuthProvider();
}

const isFirebaseConfigured = !!firebaseConfig.apiKey;

export { app, auth, db, storage, googleProvider, isFirebaseConfigured };

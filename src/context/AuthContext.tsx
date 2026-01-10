"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getAllowedUser, logGuestLogin, createUserProfile } from "@/lib/firestore";
import { useRouter } from "next/navigation";

interface AuthContextType {
    user: { name: string; phone: string; role?: string; email?: string | null } | null;
    login: (email: string, password: string) => Promise<boolean>;
    signup: (email: string, password: string, name: string) => Promise<boolean>;
    loginWithGoogle: () => Promise<boolean>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<{ name: string; phone: string; role?: string; email?: string | null } | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Check local storage on mount
        const storedUser = localStorage.getItem("wedding_guest_user");
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse stored user", e);
                localStorage.removeItem("wedding_guest_user");
            }
        }
        setLoading(false);
    }, []);

    const login = async (email: string, password: string) => {
        try {
            console.log("Starting login flow for:", email);
            const { signInWithEmailAndPassword } = await import("firebase/auth");
            const { auth, isFirebaseConfigured } = await import("@/lib/firebase");

            if (!isFirebaseConfigured) {
                alert("Firebase configuration is missing! Please set up your .env.local file.");
                return false;
            }

            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log("Login successful:", user.uid);

            const name = user.displayName || user.email?.split("@")[0] || "Guest User";

            // Sync to Firestore on login to ensure they appear in the dashboard
            // even if their initial signup sync failed or was blocked by rules.
            console.log("Syncing profile to Firestore...");
            await createUserProfile(user.uid, name, user.email || "");
            console.log("Sync complete.");

            const userData = {
                name: name,
                phone: "",
                role: "user",
                email: user.email
            };
            setUser(userData);
            localStorage.setItem("wedding_guest_user", JSON.stringify(userData));
            return true;
        } catch (error: any) {
            console.error("Login Error:", error);
            if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found") {
                alert("Invalid email or password. Please try again.");
            } else {
                alert(`Login failed: ${error.message}`);
            }
            return false;
        }
    };

    const signup = async (email: string, password: string, name: string) => {
        try {
            console.log("Starting signup flow for:", email);
            const { createUserWithEmailAndPassword, updateProfile } = await import("firebase/auth");
            const { auth, isFirebaseConfigured } = await import("@/lib/firebase");

            if (!isFirebaseConfigured) {
                alert("Firebase configuration is missing! Please set up your .env.local file.");
                return false;
            }

            console.log("Creating user account...");
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            console.log("User account created successfully:", user.uid);

            // Update the display name in Firebase Auth
            console.log("Updating user profile name...");
            await updateProfile(user, { displayName: name });
            console.log("Profile name updated.");

            // Sync to Firestore
            console.log("Syncing user data to Firestore...");
            try {
                // We use a timeout or just log before/after to see if it hangs
                await createUserProfile(user.uid, name, user.email || "");
                console.log("Firestore sync complete.");
            } catch (fsError) {
                console.error("Firestore sync failed (but account was created):", fsError);
                // We might still want to allow the user in even if sync fails
            }

            const userData = {
                name: name,
                phone: "",
                role: "user",
                email: user.email
            };
            setUser(userData);
            localStorage.setItem("wedding_guest_user", JSON.stringify(userData));
            console.log("Signup flow complete, navigating...");
            return true;
        } catch (error: any) {
            console.error("Signup Error detail:", error);
            if (error.message) alert(`Signup failed: ${error.message}`);
            return false;
        }
    };

    const loginWithGoogle = async () => {
        try {
            const { signInWithPopup } = await import("firebase/auth");
            const { auth, googleProvider, isFirebaseConfigured } = await import("@/lib/firebase");

            if (!isFirebaseConfigured) {
                alert("Firebase configuration is missing! Please set up your .env.local file.");
                return false;
            }

            const result = await signInWithPopup(auth, googleProvider);
            const googleUser = result.user;

            // For now, treat any Google Login as an Admin or map it.
            // In a real app, you'd check if this email is in an 'admins' collection.
            // Let's assume the owner's email is the admin.
            const adminUser = {
                name: googleUser.displayName || "Admin",
                phone: "admin-google",
                role: "admin",
                email: googleUser.email
            };

            setUser(adminUser);
            localStorage.setItem("wedding_guest_user", JSON.stringify(adminUser));
            return true;
        } catch (error: any) {
            console.error("Google Login Error:", error);
            if (error.code) {
                console.error("Firebase Error Code:", error.code);
                alert(`Login failed: ${error.code}. Check console for details.`);
            } else {
                alert("Google Login failed. Please check your internet connection and Firebase Console settings.");
            }
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("wedding_guest_user");
        router.push("/login"); // Fixed recursion if already on login, but push is fine.
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, loginWithGoogle, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

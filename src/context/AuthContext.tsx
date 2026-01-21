"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getAllowedUser, logGuestLogin, createUserProfile, getUserProfile } from "@/lib/firestore";
import { useRouter } from "next/navigation";

interface AuthContextType {
    user: {
        uid: string;
        name: string;
        phone: string;
        role?: string;
        roleType?: 'primary' | 'event';
        assignedEvents?: string[];
        email?: string | null;
        delegatedBy?: string
    } | null;
    login: (email: string, password: string) => Promise<boolean>;
    signup: (email: string, password: string, name: string) => Promise<boolean>;
    loginWithGoogle: () => Promise<boolean>;
    resetPassword: (email: string) => Promise<boolean>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<{
        uid: string;
        name: string;
        phone: string;
        role?: string;
        roleType?: 'primary' | 'event';
        assignedEvents?: string[];
        email?: string | null;
        delegatedBy?: string
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        let unsubscribe: () => void;

        const initAuth = async () => {
            const { onAuthStateChanged } = await import("firebase/auth");
            const { auth } = await import("@/lib/firebase");
            const { getUserProfile, createUserProfile } = await import("@/lib/firestore");

            unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
                if (firebaseUser) {
                    console.log("[Auth] Live state changed: User is logged in", firebaseUser.uid);

                    // Always ensure a profile exists in Firestore (Handles recreation with new UID)
                    const name = firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Wedding User";
                    await createUserProfile(firebaseUser.uid, name, firebaseUser.email || "");

                    // Fetch fresh profile data
                    const profile = await getUserProfile(firebaseUser.uid) as any;

                    const userData = {
                        uid: firebaseUser.uid,
                        name: profile?.name || name,
                        phone: profile?.phone || "No Phone",
                        role: profile?.role || "admin",
                        roleType: profile?.roleType || (profile?.delegatedBy ? "event" : "primary"),
                        assignedEvents: profile?.assignedEvents || [],
                        email: firebaseUser.email,
                        delegatedBy: profile?.delegatedBy
                    };

                    setUser(userData);
                    localStorage.setItem("wedding_guest_user", JSON.stringify(userData));
                } else {
                    console.log("[Auth] Live state changed: No user found");
                    setUser(null);
                    localStorage.removeItem("wedding_guest_user");
                }
                setLoading(false);
            });
        };

        initAuth();

        return () => {
            if (unsubscribe) unsubscribe();
        };
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

            // 3. Sync to Firestore: Ensure profile exists even if UID changed (e.g. recreation)
            console.log("Syncing user data to Firestore on login...");
            await createUserProfile(user.uid, name, user.email || "");

            // 4. Fetch full profile to get the correct role
            const profile = await getUserProfile(user.uid) as any;

            const userData = {
                uid: userCredential.user.uid,
                name: profile ? profile.name : "Wedding User",
                phone: profile ? profile.phone : "No Phone",
                role: profile ? (profile.role || "admin") : "admin",
                roleType: profile ? (profile.roleType || "primary") : ("primary" as const),
                assignedEvents: profile ? profile.assignedEvents : [],
                email: userCredential.user.email,
                delegatedBy: profile ? profile.delegatedBy : undefined
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
                uid: user.uid,
                name: name,
                phone: "",
                role: "admin",
                roleType: "primary" as const,
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

            // EMERGENCY FIX: Force the owner(s) to ALWAYS be admin, updating Firestore if needed.
            // This ensures these primary emails always have Super Admin status.
            const superAdmins = [
                "shwetank.chauhan17@gmail.com",
                "shwetank.chauhan3@gmail.com",
                "code4sarthak@gmail.com"
            ];

            if (googleUser.email && superAdmins.includes(googleUser.email)) {
                const { updateUserRole } = await import("@/lib/firestore");
                console.log(`Detected Super Admin login (${googleUser.email}). Forcing admin role update...`);
                await updateUserRole(googleUser.uid, "admin");
            }

            // Sync to Firestore and ensure they have a role.
            // We default to 'admin' to preserve access for the project owner.
            await createUserProfile(googleUser.uid, googleUser.displayName || "Admin", googleUser.email || "", "admin");
            const profile = await getUserProfile(googleUser.uid) as any;

            const userData = {
                uid: result.user.uid,
                name: result.user.displayName || "Wedding Guest",
                phone: profile ? profile.phone : "No Phone",
                role: profile ? (profile.role || "admin") : "admin",
                roleType: profile ? (profile.roleType || "primary") : ("primary" as const),
                assignedEvents: profile ? (profile.assignedEvents || []) : [],
                email: result.user.email,
                delegatedBy: profile ? profile.delegatedBy : undefined
            };

            setUser(userData);
            localStorage.setItem("wedding_guest_user", JSON.stringify(userData));
            return true;
        } catch (error: any) {
            if (error.code === "auth/cancelled-popup-request" || error.code === "auth/popup-closed-by-user") {
                console.warn("Google Login popup closed or cancelled by user.");
                return false;
            }
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

    const resetPassword = async (email: string) => {
        try {
            const { sendPasswordResetEmail } = await import("firebase/auth");
            const { auth } = await import("@/lib/firebase");
            await sendPasswordResetEmail(auth, email);
            return true;
        } catch (error: any) {
            console.error("Reset Password Error:", error);
            if (error.code === "auth/user-not-found") {
                alert("No user found with this email address.");
            } else if (error.code === "auth/invalid-email") {
                alert("Please enter a valid email address.");
            } else {
                alert(`Error: ${error.message}`);
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
        <AuthContext.Provider value={{ user, login, signup, loginWithGoogle, resetPassword, logout, loading }}>
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

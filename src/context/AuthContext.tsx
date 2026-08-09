"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/apiBase";
import { supabase } from "@/lib/supabase";
import {
    createUserProfile,
    getAllowedUser,
    getUserProfile,
    logGuestLogin,
} from "@/lib/database";

type RoleType = "primary" | "event";

type AppUser = {
    uid: string;
    name: string;
    phone: string;
    role?: string;
    roleType?: RoleType;
    assignedEvents?: string[];
    profileImage?: string;
    email?: string | null;
    delegatedBy?: string;
    username?: string;
    isPrivate?: boolean;
    createdAt?: any;
    location?: string;
    gender?: string;
    relationshipStatus?: string;
    persona?: string | string[];
    discoverable?: boolean;
    notificationPreferences?: any;
    birthday?: string;
    anniversaryDate?: string;
    subscriptionDuration?: string;
    planStartDate?: string;
    planEndDate?: string;
    pendingPlanRole?: string;
    pendingSubscriptionDuration?: string;
    pendingPlanStartDate?: string;
    pendingPlanEndDate?: string;
};

interface AuthContextType {
    user: AppUser | null;
    login: (email: string, password: string) => Promise<{success: boolean, error?: string}>;
    signup: (email: string, password: string, name: string) => Promise<{success: boolean, error?: string, needsEmailVerification?: boolean}>;
    loginWithGoogle: () => Promise<boolean>;
    resetPassword: (email: string) => Promise<boolean>;
    loginWithPhoneSimple: (name: string, phone: string) => Promise<boolean>;
    authWithPhone: (name: string, phone: string, password: string) => Promise<{success: boolean, error?: string}>;
    authWithEmail: (name: string, email: string, password: string) => Promise<{success: boolean, error?: string}>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function normalizeUsername(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9_.]/g, "_");
}

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "object" && error && "message" in error) {
        const message = (error as { message?: unknown }).message;
        if (typeof message === "string" && message) return message;
    }
    return fallback;
}

function isEmailConfirmationError(error: unknown) {
    const message = getErrorMessage(error, "").toLowerCase();
    return message.includes("email not confirmed") || message.includes("not confirmed");
}

function needsEmailVerification(user: { email?: string | null; email_confirmed_at?: string | null }) {
    return Boolean(user.email && !user.email.endsWith("@phone-login.local") && !user.email_confirmed_at);
}

function buildUserData(uid: string, email: string | null, fallbackName: string, profile: Awaited<ReturnType<typeof getUserProfile>>): AppUser {
    const profileEmail = profile?.email || email;
    const name = profile?.name || fallbackName || profileEmail?.split("@")[0] || "Wedding User";
    return {
        uid,
        name,
        phone: profile?.phone || "No Phone",
        role: profile?.role || "user",
        roleType: profile?.roleType || (profile?.delegatedBy ? "event" : "primary"),
        assignedEvents: profile?.assignedEvents || [],
        profileImage: profile?.profileImage,
        email: profileEmail,
        delegatedBy: profile?.delegatedBy,
        username: profile?.username || normalizeUsername(name),
        isPrivate: profile?.isPrivate ?? false,
        createdAt: profile?.createdAt,
        location: profile?.location,
        gender: profile?.gender,
        relationshipStatus: profile?.relationshipStatus,
        persona: profile?.persona,
        discoverable: profile?.discoverable ?? true,
        notificationPreferences: profile?.notificationPreferences,
        birthday: profile?.birthday,
        anniversaryDate: profile?.anniversaryDate,
        subscriptionDuration: profile?.subscriptionDuration,
        planStartDate: profile?.planStartDate,
        planEndDate: profile?.planEndDate,
        pendingPlanRole: profile?.pendingPlanRole,
        pendingSubscriptionDuration: profile?.pendingSubscriptionDuration,
        pendingPlanStartDate: profile?.pendingPlanStartDate,
        pendingPlanEndDate: profile?.pendingPlanEndDate,
    };
}

function buildBasicUserData(uid: string, email: string | null, fallbackName: string): AppUser {
    const name = fallbackName || email?.split("@")[0] || "Wedding User";
    return {
        uid,
        name,
        phone: "No Phone",
        role: "user",
        roleType: "primary",
        assignedEvents: [],
        email,
        username: normalizeUsername(name),
    };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const activeHydrations = useRef(new Set<string>());
    const currentUserId = useRef<string | null>(null);
    const currentUserData = useRef<AppUser | null>(null);

    const applyPendingPlanChangeIfDue = useCallback(async () => {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        if (!accessToken) return;

        await fetch(getApiUrl("/api/subscription/apply-pending"), {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
    }, []);

    const syncUserSession = useCallback((userData: AppUser) => {
        currentUserId.current = userData.uid;
        currentUserData.current = userData;
        setUser(userData);
        localStorage.setItem("wedding_guest_user", JSON.stringify(userData));
    }, []);

    const hydrateSupabaseUser = useCallback(async (
        uid: string,
        email: string | null,
        fallbackName: string,
        options?: { phone?: string; role?: string; shouldSync?: () => boolean }
    ) => {
        await applyPendingPlanChangeIfDue().catch((error) => {
            console.error("[Auth] Pending plan check failed:", error);
        });

        let profile = await getUserProfile(uid);
        if (!profile) {
            await createUserProfile(uid, fallbackName, email || "", options?.phone || "", options?.role || "user");
            profile = await getUserProfile(uid);
        }
        if (options?.shouldSync && !options.shouldSync()) return;
        syncUserSession(buildUserData(uid, email, fallbackName, profile));
    }, [applyPendingPlanChangeIfDue, syncUserSession]);

    const hydrateSupabaseUserInBackground = useCallback((
        uid: string,
        email: string | null,
        fallbackName: string,
        options?: { phone?: string; role?: string; shouldSync?: () => boolean }
    ) => {
        if (activeHydrations.current.has(uid)) return;

        activeHydrations.current.add(uid);
        void hydrateSupabaseUser(uid, email, fallbackName, options)
            .catch((error) => {
                console.error("[Auth] Background profile hydration failed:", error);
            })
            .finally(() => {
                activeHydrations.current.delete(uid);
            });
    }, [hydrateSupabaseUser]);

    useEffect(() => {
        let isMounted = true;
        let profileChannel: ReturnType<typeof supabase.channel> | null = null;

        const subscribeToProfile = (uid: string, email: string | null, fallbackName: string) => {
            if (profileChannel) {
                supabase.removeChannel(profileChannel);
            }

            profileChannel = supabase
                .channel(`web-profile-${uid}`)
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
                    async () => {
                        if (!isMounted) return;
                        const profile = await getUserProfile(uid);
                        syncUserSession(buildUserData(uid, email, fallbackName, profile));
                    }
                )
                .subscribe();
        };

        const loadSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    if (needsEmailVerification(session.user)) {
                        await supabase.auth.signOut();
                        return;
                    }
                    const fallbackName =
                        session.user.user_metadata?.name ||
                        session.user.email?.split("@")[0] ||
                        "Wedding User";
                    if (currentUserData.current?.uid !== session.user.id) {
                        syncUserSession(buildBasicUserData(session.user.id, session.user.email || null, fallbackName));
                    }
                    setLoading(false);
                    hydrateSupabaseUserInBackground(session.user.id, session.user.email || null, fallbackName, {
                        shouldSync: () => isMounted && currentUserId.current === session.user.id,
                    });
                    subscribeToProfile(session.user.id, session.user.email || null, fallbackName);
                } else {
                    const storedUser = localStorage.getItem("wedding_guest_user");
                    if (storedUser) {
                        const parsed = JSON.parse(storedUser);
                        if (parsed?.uid?.startsWith("phone_")) {
                            currentUserId.current = parsed.uid;
                            currentUserData.current = parsed;
                            setUser(parsed);
                        } else {
                            currentUserId.current = null;
                            currentUserData.current = null;
                            localStorage.removeItem("wedding_guest_user");
                            setUser(null);
                        }
                    } else {
                        currentUserId.current = null;
                        currentUserData.current = null;
                        setUser(null);
                    }
                }
            } catch (error) {
                console.error("[Auth] Supabase session load failed:", error);
                currentUserId.current = null;
                currentUserData.current = null;
                setUser(null);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!isMounted) return;

            try {
                if (session?.user) {
                    if (needsEmailVerification(session.user)) {
                        await supabase.auth.signOut();
                        return;
                    }
                    const fallbackName =
                        session.user.user_metadata?.name ||
                        session.user.email?.split("@")[0] ||
                        "Wedding User";
                    if (currentUserData.current?.uid !== session.user.id) {
                        syncUserSession(buildBasicUserData(session.user.id, session.user.email || null, fallbackName));
                    }
                    setLoading(false);
                    hydrateSupabaseUserInBackground(session.user.id, session.user.email || null, fallbackName, {
                        shouldSync: () => isMounted && currentUserId.current === session.user.id,
                    });
                    subscribeToProfile(session.user.id, session.user.email || null, fallbackName);
                } else {
                    if (profileChannel) {
                        supabase.removeChannel(profileChannel);
                        profileChannel = null;
                    }
                    currentUserId.current = null;
                    currentUserData.current = null;
                    setUser(null);
                    localStorage.removeItem("wedding_guest_user");
                }
            } catch (error) {
                console.error("[Auth] onAuthStateChange error:", error);
            } finally {
                setLoading(false);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            if (profileChannel) {
                supabase.removeChannel(profileChannel);
            }
        };
    }, [hydrateSupabaseUserInBackground, syncUserSession]);

    const login = async (email: string, password: string): Promise<{success: boolean, error?: string}> => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (data.user && needsEmailVerification(data.user)) {
                await supabase.auth.signOut();
                return {
                    success: false,
                    error: "A confirmation link has been sent to your email. Please confirm your email before signing in.",
                };
            }
            if (data.user) {
                const fallbackName = data.user.user_metadata?.name || email.split("@")[0] || "Wedding User";
                syncUserSession(buildBasicUserData(data.user.id, data.user.email || email, fallbackName));
            }
            return { success: true };
        } catch (error: unknown) {
            console.error("Supabase login error:", error);
            if (isEmailConfirmationError(error)) {
                return {
                    success: false,
                    error: "A confirmation link has been sent to your email. Please confirm your email before signing in.",
                };
            }
            return { success: false, error: getErrorMessage(error, "Login failed") };
        }
    };

    const signup = async (email: string, password: string, name: string): Promise<{success: boolean, error?: string, needsEmailVerification?: boolean}> => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { name },
                },
            });
            if (error) throw error;
            if (data.user && data.session === null) {
                await supabase.auth.signOut();
                return { success: true, needsEmailVerification: true };
            }
            if (data.user) {
                await createUserProfile(data.user.id, name, data.user.email || email);
                const profile = await getUserProfile(data.user.id);
                syncUserSession(buildUserData(data.user.id, data.user.email || email, name, profile));
            }
            return { success: true };
        } catch (error: unknown) {
            console.error("Supabase signup error:", error);
            return { success: false, error: getErrorMessage(error, "Signup failed") };
        }
    };

    const loginWithGoogle = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/profile`,
                },
            });
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Supabase Google login error:", error);
            return false;
        }
    };

    const resetPassword = async (email: string) => {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Supabase reset password error:", error);
            return false;
        }
    };

    const loginWithPhoneSimple = async (name: string, phone: string) => {
        try {
            const phoneUid = `phone_${phone.replace(/\D/g, "")}`;
            const isMasterAdmin = phone === "8535029872";
            const allowedUser = await getAllowedUser(phone);

            if (!isMasterAdmin && !allowedUser) {
                return false;
            }

            const assignedRole = isMasterAdmin ? "admin" : (allowedUser?.role || "user");
            await createUserProfile(phoneUid, name || allowedUser?.name || "Guest", "", phone, assignedRole);

            const profile = await getUserProfile(phoneUid);
            const userData: AppUser = {
                uid: phoneUid,
                name: profile?.name || name || allowedUser?.name || "Guest",
                phone: profile?.phone || phone,
                role: profile?.role || assignedRole,
                roleType: profile?.roleType || (profile?.delegatedBy ? "event" : "primary"),
                assignedEvents: profile?.assignedEvents || [],
                profileImage: profile?.profileImage,
                email: null,
                delegatedBy: profile?.delegatedBy,
                username: profile?.username,
            };

            syncUserSession(userData);
            await logGuestLogin(userData.name, phone);
            return true;
        } catch (error) {
            console.error("Simple phone login error:", error);
            return false;
        }
    };

    const authWithEmailLogic = async (name: string, email: string, password: string, phone = "") => {
        const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });

        if (!loginError && loginData.user) {
            if (needsEmailVerification(loginData.user)) {
                await supabase.auth.signOut();
                return {
                    success: false,
                    error: "A confirmation link has been sent to your email. Please confirm your email before signing in.",
                };
            }
            const fallbackName = name || loginData.user.user_metadata?.name || loginData.user.email?.split("@")[0] || "Wedding User";
            syncUserSession(buildBasicUserData(loginData.user.id, loginData.user.email || email, fallbackName));
            hydrateSupabaseUserInBackground(loginData.user.id, loginData.user.email || email, fallbackName, {
                phone,
                role: "user",
                shouldSync: () => currentUserId.current === loginData.user.id,
            });
            return { success: true };
        }

        const { data: signupData, error: signupError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name },
            },
        });

        if (signupError || !signupData.user) {
            console.error("Supabase email auth error:", signupError || loginError);
            if (isEmailConfirmationError(signupError || loginError)) {
                return {
                    success: false,
                    error: "A confirmation link has been sent to your email. Please confirm your email before signing in.",
                };
            }
            return { success: false, error: signupError?.message || loginError?.message || "Auth failed" };
        }

        if (signupData.session === null && !email.endsWith("@phone-login.local")) {
            await supabase.auth.signOut();
            return { success: true, needsEmailVerification: true };
        }

        await createUserProfile(signupData.user.id, name, signupData.user.email || email, phone);
        const profile = await getUserProfile(signupData.user.id);
        syncUserSession(buildUserData(signupData.user.id, signupData.user.email || email, name, profile));
        return { success: true };
    };

    const authWithEmail = async (name: string, email: string, password: string) => {
        return authWithEmailLogic(name, email, password);
    };

    const authWithPhone = async (name: string, phone: string, password: string) => {
        const fakeEmail = `${phone.replace(/\D/g, "")}@phone-login.local`;
        return authWithEmailLogic(name, fakeEmail, password, phone);
    };

    const logout = async () => {
        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.error("Supabase logout error:", error);
        }
        currentUserId.current = null;
        setUser(null);
        localStorage.removeItem("wedding_guest_user");
        router.push("/login");
    };

    return (
        <AuthContext.Provider value={{ user, login, signup, loginWithGoogle, resetPassword, loginWithPhoneSimple, authWithPhone, authWithEmail, logout, loading }}>
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

"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getAllowedUser, logGuestLogin } from "@/lib/firestore";
import { useRouter } from "next/navigation";

interface AuthContextType {
    user: { name: string; phone: string; role?: string } | null;
    login: (name: string, phone: string) => Promise<boolean>;
    logout: () => void;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<{ name: string; phone: string; role?: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        // Check local storage on mount
        const storedUser = localStorage.getItem("wedding_guest_user");
        if (storedUser) {
            try {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setUser(JSON.parse(storedUser));
            } catch (e) {
                console.error("Failed to parse stored user", e);
                localStorage.removeItem("wedding_guest_user");
            }
        }
        setLoading(false);
    }, []);

    const login = async (name: string, phone: string) => {
        const allowedUser = await getAllowedUser(phone);
        if (allowedUser) {
            // Use the data from firestore which includes role
            const userData = {
                name: name || allowedUser.name,
                phone: (allowedUser.phone as string) || phone,
                role: allowedUser.role as string
            };
            setUser(userData);
            localStorage.setItem("wedding_guest_user", JSON.stringify(userData));
            await logGuestLogin(name, phone);
            return true;
        }
        return false;
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem("wedding_guest_user");
        router.push("/login");
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
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

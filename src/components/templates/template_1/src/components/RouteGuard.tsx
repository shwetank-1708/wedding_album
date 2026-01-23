"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RouteGuard({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!loading) {
            // Allow access to login and seed pages without user
            if (!user && pathname !== "/login" && pathname !== "/seed") {
                router.push("/login");
            } else if (user && pathname === "/login") {
                router.push("/");
            }
        }
    }, [user, loading, pathname, router]);

    if (loading) {
        return (
            <div className="h-screen flex items-center justify-center bg-royal-cream text-royal-maroon">
                {/* Simple loading spinner or text */}
                <div className="animate-pulse text-xl font-serif">Loading...</div>
            </div>
        );
    }

    // Optional: Hide Navbar on login page if we want? 
    // For now we just return children as is. 
    // Note: If we are on /login and have a navbar around us in layout, it will show.

    return <>{children}</>;
}

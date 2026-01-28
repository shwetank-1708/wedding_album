"use client";

import { useRouter, usePathname, useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface TenantGuardProps {
    children: React.ReactNode;
    slug?: string; // Optional now
}

export default function TenantGuard({ children, slug: propSlug }: TenantGuardProps) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams();

    // Prefer prop, fallback to param
    const slug = propSlug || (params?.slug as string);

    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Skip check if we are ALREADY on the login page
        // pathname example: /tenant/demo-event/login
        if (pathname?.endsWith("/login")) {
            setIsAuthorized(true);
            setIsLoading(false);
            return;
        }

        const storedSession = localStorage.getItem(`guest_session_${slug}`);

        if (storedSession) {
            try {
                const session = JSON.parse(storedSession);
                if (session && session.phone) {
                    setIsAuthorized(true);
                } else {
                    // Invalid session structure
                    localStorage.removeItem(`guest_session_${slug}`);
                    router.push(`/tenant/${slug}/login`);
                }
            } catch (e) {
                // Formatting error
                localStorage.removeItem(`guest_session_${slug}`);
                router.push(`/tenant/${slug}/login`);
            }
        } else {
            // No session found
            router.push(`/tenant/${slug}/login`);
        }

        setIsLoading(false);
    }, [slug, router, pathname]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] text-[#800000]">
                <div className="text-xl font-serif animate-pulse">Checking Access...</div>
            </div>
        );
    }

    // Don't render children if not authorized (and not on login page)
    // The router.push above handles the redirect, but return null avoids flashing
    if (!isAuthorized && !pathname?.endsWith("/login")) {
        return null;
    }

    return <>{children}</>;
}

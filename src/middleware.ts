import { NextRequest, NextResponse } from "next/server";

export const config = {
    matcher: [
        /*
         * Match all paths except for:
         * 1. /api routes
         * 2. /_next (Next.js internals)
         * 3. /_static (inside /public)
         * 4. all root files inside /public (e.g. /favicon.ico)
         */
        "/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)",
    ],
};

export default async function middleware(req: NextRequest) {
    const url = req.nextUrl;
    const hostname = req.headers.get("host");

    // Get the current domain (e.g. "localhost:3000" or "wedding-album.com")
    // You must set NEXT_PUBLIC_ROOT_DOMAIN in your .env
    // For local development, we'll assume "localhost:3000" if not set.
    // Get the current domain (e.g. "localhost:3000" or "wedding-album.com")
    // You must set NEXT_PUBLIC_ROOT_DOMAIN in your .env
    // For local development, we'll assume "localhost" if not set, handling ports dynamically.
    const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost";

    // Normalize hostname to remove port if present (for localhost testing)
    const hostnameNoPort = hostname ? hostname.split(':')[0] : null;

    // Check if we are on a custom subdomain
    // logic: if hostname is NOT the rootDomain (and not www.rootDomain)
    const isCustomDomain =
        hostnameNoPort &&
        hostnameNoPort !== rootDomain &&
        hostnameNoPort !== `www.${rootDomain}`;

    if (isCustomDomain && hostname) {
        // Extract the subdomain/slug
        // e.g. "alice.domain.com" -> "alice"
        const subdomain = hostname.split(".")[0];

        // Check if it's a known reserved subdomain (like 'app' or 'admin')
        // If you hosted your main app on "app.domain.com", you'd handle that here.
        // For now, we assume ANY subdomain is a tenant.

        // Rewrite the URL to the localized tenant dynamic route
        // The user sees "alice.domain.com", Next.js renders "/tenant/alice"
        const path = url.pathname;
        const searchParams = url.searchParams.toString();
        const queryString = searchParams.length > 0 ? `?${searchParams}` : "";

        // Rewrite to the (tenant) folder logic
        return NextResponse.rewrite(
            new URL(`/tenant/${subdomain}${path}${queryString}`, req.url)
        );
    }

    // If we are on the main domain, proceed as normal
    // Next.js will route to (main)/page.tsx because it's at the root and not rewritten
    return NextResponse.next();
}

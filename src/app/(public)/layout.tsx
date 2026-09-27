import type { Metadata } from "next";
import "../globals.css";

import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
    title: "EveBash | Premium Wedding Photography",
    description: "Capturing life's most beautiful moments.",
    icons: {
        icon: [
            { url: "/evebash-logo-gold.svg", type: "image/svg+xml" },
            { url: "/evebash-logo-gold.png", type: "image/png" },
        ],
        shortcut: "/evebash-logo-gold.svg",
        apple: "/evebash-logo-gold.png",
    },
};

export default function PublicLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
            <head>
                <link rel="icon" href="/evebash-logo-gold.svg" type="image/svg+xml" />
                <link rel="alternate icon" href="/evebash-logo-gold.png" type="image/png" />
                <link rel="apple-touch-icon" href="/evebash-logo-gold.png" />
            </head>
            <body className="antialiased font-sans">
                <AuthProvider>
                    <ThemeProvider>
                        {/* No global Navbar here */}
                        <main className="min-h-screen">
                            {children}
                        </main>
                        <Footer />
                    </ThemeProvider>
                </AuthProvider>
            </body>
        </html>
    );
}

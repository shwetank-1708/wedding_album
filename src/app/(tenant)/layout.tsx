import type { Metadata } from "next";
import "./tenant.css";
import { AuthProvider } from "@/context/AuthContext";
import TenantGuard from "@/components/TenantGuard";

export const metadata: Metadata = {
  title: "Wedding Album",
  description: "Our Wedding Celebration",
  icons: {
    icon: [
      { url: "/evebash-logo-gold.svg", type: "image/svg+xml" },
      { url: "/evebash-logo-gold.png", type: "image/png" },
    ],
    shortcut: "/evebash-logo-gold.svg",
    apple: "/evebash-logo-gold.png",
  },
};

export default function TenantLayout({
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
          <main className="min-h-screen">
            <TenantGuard>
              {children}
            </TenantGuard>
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}

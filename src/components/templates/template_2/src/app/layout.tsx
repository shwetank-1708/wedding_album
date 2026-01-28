import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google"; // [NEW] Use Inter
import "./globals.css";
import Navbar from "@/components/Navbar";

import { AuthProvider } from "@/context/AuthContext";
import RouteGuard from "@/components/RouteGuard";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({ // [CHANGED] Lato -> Inter
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Samarth & Jyoti | Wedding Album",
  description: "A digital memory of our special days.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${playfair.variable} ${inter.variable} antialiased bg-editorial-white text-editorial-black font-sans`}>
        <AuthProvider>
          <RouteGuard>
            <Navbar />
            <main className="min-h-screen">
              {children}
            </main>
          </RouteGuard>
        </AuthProvider>
      </body>
    </html>
  );
}

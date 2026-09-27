import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Semantic light theme colors
                primary: {
                    50: "#FFF7EB",
                    100: "#F7E8D4",
                    200: "#EBD0AC",
                    300: "#DEB57E",
                    400: "#CA9C68",
                    500: "#B88955",
                    600: "#906D4B",
                    700: "#594C3D",
                    800: "#2B2F2E",
                    900: "#13191F",
                },
                secondary: {
                    50: "#f8fafc",
                    100: "#f1f5f9",
                    200: "#e2e8f0",
                    300: "#cbd5e1",
                    400: "#94a3b8", // Slate 400
                    500: "#64748b",
                    600: "#475569", // Slate 600 - Body Text
                    700: "#334155",
                    800: "#1e293b", // Slate 800 - Headings
                    900: "#0f172a",
                },
                royal: {
                    maroon: "#594C3D",
                    gold: "#CA9C68",
                    cream: "#FFF7EB",
                    green: "#2B2F2E",
                },
                gold: {
                    100: "#F7E8D4",
                    200: "#EBD0AC",
                    300: "#DEB57E",
                    400: "#CA9C68",
                    500: "#B88955",
                    600: "#906D4B",
                    700: "#594C3D",
                },
            },
            fontFamily: {
                serif: ["var(--font-inter)", "sans-serif"],
                sans: ["var(--font-inter)", "sans-serif"],
                lato: ["var(--font-inter)", "sans-serif"],
                playfair: ["var(--font-inter)", "sans-serif"],
            },
            animation: {
                'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
            },
            keyframes: {
                fadeInUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                }
            }
        },
    },
    plugins: [],
};
export default config;

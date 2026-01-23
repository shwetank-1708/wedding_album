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
                    50: "#f0f9ff",
                    100: "#e0f2fe",
                    200: "#bae6fd",
                    300: "#7dd3fc",
                    400: "#38bdf8",
                    500: "#0ea5e9", // Sky 500
                    600: "#0284c7",
                    700: "#0369a1",
                    800: "#075985",
                    900: "#0c4a6e",
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
                    maroon: "#4A0E0E", // Deeper, browner maroon per reference
                    gold: "#D4AF37",
                    cream: "#FFFDD0",
                    green: "#005D4B",
                },
                gold: {
                    100: "#F9F1D8",
                    200: "#F0DEAA",
                    300: "#E6CB7D",
                    400: "#DDB853",
                    500: "#D4A52A", // Primary Gold
                    600: "#AA8422",
                    700: "#806319",
                },
            },
            fontFamily: {
                serif: ["var(--font-playfair)", "serif"],
                sans: ["var(--font-lato)", "sans-serif"],
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

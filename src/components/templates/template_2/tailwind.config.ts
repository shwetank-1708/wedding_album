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
                stone: {
                    50: "#fafaf9",
                    100: "#f5f5f4",
                    200: "#e7e5e4",
                    800: "#292524",
                    900: "#1c1917",
                },
            },
            fontFamily: {
                serif: ["var(--font-playfair)", "serif"],
                sans: ["var(--font-lato)", "sans-serif"],
            },
        },
    },
    plugins: [],
};
export default config;

"use client";

import React, { createContext, useContext, useEffect } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        localStorage.removeItem("app_theme");
        document.documentElement.classList.add("theme-dark");
        document.documentElement.classList.remove("theme-light");
    }, []);

    const setTheme = () => {
        document.documentElement.classList.add("theme-dark");
        document.documentElement.classList.remove("theme-light");
    };

    const toggleTheme = () => {
        setTheme();
    };

    return (
        <ThemeContext.Provider value={{ theme: "dark", toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}

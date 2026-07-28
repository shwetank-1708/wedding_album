"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>("dark");

    useEffect(() => {
        // Load theme from localStorage on mount
        const storedTheme = localStorage.getItem("app_theme") as Theme | "royal" | null;
        if (storedTheme === "light") {
            setThemeState("light");
            document.documentElement.classList.add("theme-light");
            document.documentElement.classList.remove("theme-dark");
        } else {
            setThemeState("dark");
            document.documentElement.classList.add("theme-dark");
            document.documentElement.classList.remove("theme-light");
        }
    }, []);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
        localStorage.setItem("app_theme", newTheme);
        if (newTheme === "light") {
            document.documentElement.classList.add("theme-light");
            document.documentElement.classList.remove("theme-dark");
        } else {
            document.documentElement.classList.add("theme-dark");
            document.documentElement.classList.remove("theme-light");
        }
    };

    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
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

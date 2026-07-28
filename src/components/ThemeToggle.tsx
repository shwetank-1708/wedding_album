"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
    const { theme, toggleTheme } = useTheme();
    const isLight = theme === "light";

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${isLight ? "dark" : "light"} theme`}
            title={`Switch to ${isLight ? "dark" : "light"} theme`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--site-border)] bg-[var(--site-card-muted)] text-[var(--site-text)] transition-colors hover:border-sky-400 hover:text-sky-400"
        >
            {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {!compact && <span className="sr-only">Toggle theme</span>}
        </button>
    );
}

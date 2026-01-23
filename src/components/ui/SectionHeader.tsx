import React from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    className?: string;
    dark?: boolean;
}

export function SectionHeader({ title, subtitle, className, dark = false }: SectionHeaderProps) {
    return (
        <div className={cn("text-center space-y-3 mb-12", className)}>
            <h2
                className={cn(
                    "font-serif text-3xl md:text-4xl lg:text-5xl font-bold",
                    dark ? "text-stone-100" : "text-stone-900"
                )}
            >
                {title}
            </h2>
            {subtitle && (
                <p
                    className={cn(
                        "text-sm uppercase tracking-widest font-semibold",
                        dark ? "text-gold-400" : "text-gold-600"
                    )}
                >
                    {subtitle}
                </p>
            )}
            <div className="flex items-center justify-center gap-2 mt-4">
                <span className="h-[1px] w-12 bg-gold-400/50" />
                <span className="w-2 h-2 rotate-45 border border-gold-500" />
                <span className="h-[1px] w-12 bg-gold-400/50" />
            </div>
        </div>
    );
}

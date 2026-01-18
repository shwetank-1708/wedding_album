"use client";

import React from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, LayoutDashboard, LogOut, User, LucideIcon, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Tooltip } from "./Tooltip";

interface Breadcrumb {
    label: string;
    onClick?: () => void;
}

interface DashboardHeaderProps {
    user: any;
    title?: string;
    breadcrumbs?: Breadcrumb[];
    onBack?: () => void;
    backHref?: string;
    logout?: () => void;
    onShare?: () => void;
    showChevron?: boolean;
    icon?: React.ElementType;
}

export function DashboardHeader({
    user,
    title,
    breadcrumbs,
    onBack,
    backHref,
    logout,
    onShare,
    showChevron = false,
    icon: Icon = LayoutDashboard
}: DashboardHeaderProps) {
    const router = useRouter();

    const handleBackClick = () => {
        if (onBack) {
            onBack();
        } else if (backHref) {
            router.push(backHref);
        } else {
            router.push("/dashboard");
        }
    };

    return (
        <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
                <div className="flex items-center space-x-6">
                    <Tooltip text="Navigate back">
                        <button
                            onClick={handleBackClick}
                            className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
                        >
                            {showChevron ? <ChevronLeft className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                        </button>
                    </Tooltip>

                    <nav className="flex items-center space-x-2 text-sm md:text-base font-bold tracking-tight">
                        {breadcrumbs ? (
                            breadcrumbs.map((crumb, idx) => (
                                <React.Fragment key={idx}>
                                    {idx > 0 && <ChevronRight className="w-4 h-4 text-stone-400 mx-1" />}
                                    {crumb.onClick ? (
                                        <Tooltip text={`Return to ${crumb.label}`}>
                                            <button
                                                onClick={crumb.onClick}
                                                className="text-stone-500 hover:text-slate-900 transition-colors cursor-pointer"
                                            >
                                                {crumb.label}
                                            </button>
                                        </Tooltip>
                                    ) : (
                                        <span className="text-slate-900">{crumb.label}</span>
                                    )}
                                </React.Fragment>
                            ))
                        ) : (
                            <span className="text-slate-900">{title}</span>
                        )}
                    </nav>
                </div>

                <div className="flex items-center space-x-4 text-slate-800">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold">{user?.name || "User"}</p>
                        <p className="text-xs text-slate-500 font-sans">{user?.email || ""}</p>
                    </div>

                    {onShare && (
                        <Tooltip text="Share this view">
                            <button
                                onClick={onShare}
                                className="p-2 hover:bg-stone-100 rounded-lg text-emerald-600 transition-colors border border-stone-100 shadow-sm"
                            >
                                <Share2 className="w-5 h-5" />
                            </button>
                        </Tooltip>
                    )}

                    {logout && (
                        <button
                            onClick={logout}
                            className="p-2 hover:bg-stone-100 rounded-full text-stone-500 transition-colors"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}

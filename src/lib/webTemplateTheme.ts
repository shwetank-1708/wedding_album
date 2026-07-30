import type { LightboxTheme } from "@/components/ui/Lightbox";

export const WEB_LIGHTBOX_THEMES: Record<string, LightboxTheme> = {
    royal: { background: "#02231c", panel: "rgba(2,35,28,0.82)", tile: "#021a15", text: "#fcfbf7", muted: "#a3b899", accent: "#cca43b", accentBg: "rgba(204,164,59,0.18)", border: "rgba(204,164,59,0.28)", radius: 18, useSerif: true },
    classic: { background: "#FAF9F6", panel: "#ffffff", tile: "#ffffff", text: "#1e293b", muted: "#64748b", accent: "#cca43b", accentBg: "rgba(204,164,59,0.08)", border: "rgba(30,41,59,0.12)", radius: 0, useSerif: true },
    hero: { background: "#000000", panel: "rgba(255,255,255,0.04)", tile: "#09090b", text: "#ffffff", muted: "#94a3b8", accent: "#cca43b", accentBg: "rgba(204,164,59,0.12)", border: "rgba(204,164,59,0.22)", radius: 12, useSerif: true },
    ethereal: { background: "#F8FAFC", panel: "#EEF2F6", tile: "#ffffff", text: "#1E293B", muted: "#64748B", accent: "#4A6984", accentBg: "#E2E8F0", border: "rgba(74,105,132,0.18)", radius: 2, useSerif: true },
    scrapbook: { background: "#151c1b", panel: "rgba(246,241,232,0.08)", tile: "#1d2826", text: "#f8f5f0", muted: "#aab8b1", accent: "#d9826b", accentBg: "rgba(217,130,107,0.18)", border: "rgba(217,130,107,0.28)", radius: 18 },
    neon: { background: "#070611", panel: "rgba(18,16,35,0.72)", tile: "rgba(17,16,32,0.82)", text: "#f8f7ff", muted: "#b9b1d9", accent: "#ff3df2", accentBg: "rgba(102,232,255,0.2)", border: "rgba(255,61,242,0.32)", radius: 20 },
    pastel: { background: "#fff7f4", panel: "rgba(255,255,255,0.78)", tile: "#fffdfb", text: "#4d4542", muted: "#9a8583", accent: "#c9768b", accentBg: "rgba(213,180,220,0.28)", border: "rgba(201,118,139,0.18)", radius: 24 },
    pop: { background: "#ffe84a", panel: "#fffdf3", tile: "#ffffff", text: "#231f20", muted: "#5b4b3d", accent: "#ef2b3a", accentBg: "rgba(239,43,58,0.14)", border: "rgba(35,31,32,0.18)", radius: 18 },
    golden_years: { background: "#1f1710", panel: "rgba(251,244,230,0.08)", tile: "#2a2117", text: "#fbf4e6", muted: "#d6c7ad", accent: "#c99a2e", accentBg: "rgba(201,154,46,0.16)", border: "rgba(201,154,46,0.26)", radius: 18, useSerif: true },
    vintage: { background: "#2a2018", panel: "rgba(255,247,237,0.08)", tile: "#3b2f24", text: "#fff7ed", muted: "#d6d3d1", accent: "#a16207", accentBg: "rgba(161,98,7,0.16)", border: "rgba(161,98,7,0.28)", radius: 14, useSerif: true },
    rose: { background: "#3b1019", panel: "rgba(255,241,242,0.08)", tile: "#4c1622", text: "#fff1f2", muted: "#fecdd3", accent: "#e11d48", accentBg: "rgba(225,29,72,0.14)", border: "rgba(225,29,72,0.26)", radius: 20, useSerif: true },
    minimal_love: { background: "#111827", panel: "rgba(255,255,255,0.06)", tile: "#1f2937", text: "#f9fafb", muted: "#cbd5e1", accent: "#f97316", accentBg: "rgba(249,115,22,0.16)", border: "rgba(249,115,22,0.25)", radius: 10 },
    diamond: { background: "#082f49", panel: "rgba(2,132,199,0.08)", tile: "#0c4a6e", text: "#f0f9ff", muted: "#7dd3fc", accent: "#0284c7", accentBg: "rgba(2,132,199,0.18)", border: "rgba(2,132,199,0.32)", radius: 15 },
    blush: { background: "#431407", panel: "rgba(255,237,213,0.08)", tile: "#4a1d0f", text: "#ffedd5", muted: "#fdba74", accent: "#ea580c", accentBg: "rgba(234,88,12,0.16)", border: "rgba(234,88,12,0.28)", radius: 22 },
    garden: { background: "#112217", panel: "rgba(240,253,244,0.08)", tile: "#183323", text: "#f0fdf4", muted: "#bbf7d0", accent: "#2E6F40", accentBg: "rgba(46,111,64,0.2)", border: "rgba(46,111,64,0.35)", radius: 20 },
    midnight_glam: { background: "#050505", panel: "rgba(59,130,246,0.08)", tile: "#0f172a", text: "#ffffff", muted: "#bfdbfe", accent: "#3b82f6", accentBg: "rgba(59,130,246,0.16)", border: "rgba(59,130,246,0.28)", radius: 16 },
    cinematic: { background: "#000000", panel: "rgba(239,68,68,0.08)", tile: "#111111", text: "#ffffff", muted: "#fecaca", accent: "#ef4444", accentBg: "rgba(239,68,68,0.16)", border: "rgba(239,68,68,0.3)", radius: 6 },
    modern_lounge: { background: "#101010", panel: "rgba(129,140,248,0.08)", tile: "#171717", text: "#ffffff", muted: "#c7d2fe", accent: "#818cf8", accentBg: "rgba(129,140,248,0.16)", border: "rgba(129,140,248,0.28)", radius: 16 },
    elegant_night: { background: "#111111", panel: "rgba(255,255,255,0.05)", tile: "#18181b", text: "#f5f5f5", muted: "#a3a3a3", accent: "#737373", accentBg: "rgba(115,115,115,0.18)", border: "rgba(255,255,255,0.12)", radius: 12 },
    polaroid: { background: "#1c1917", panel: "#292524", tile: "#fafaf9", text: "#fafaf9", muted: "#d6d3d1", accent: "#b45309", accentBg: "rgba(180,83,9,0.16)", border: "rgba(180,83,9,0.28)", radius: 2 },
    editorial: { background: "#171717", panel: "#fafafa", tile: "#ffffff", text: "#111827", muted: "#4b5563", accent: "#111827", accentBg: "rgba(17,24,39,0.08)", border: "rgba(17,24,39,0.14)", radius: 0 },
    museum: { background: "#0b1118", panel: "rgba(255,255,255,0.04)", tile: "#111827", text: "#f8fafc", muted: "#94a3b8", accent: "#9b7a44", accentBg: "rgba(155,122,68,0.16)", border: "rgba(155,122,68,0.28)", radius: 4, useSerif: true },
    brutalist: { background: "#111113", panel: "#18181b", tile: "#050505", text: "#f4f4f5", muted: "#a1a1aa", accent: "#a3e635", accentBg: "rgba(163,230,53,0.14)", border: "rgba(163,230,53,0.35)", radius: 0 },
    vibrant: { background: "#4c1d95", panel: "rgba(255,255,255,0.1)", tile: "#581c87", text: "#ffffff", muted: "#ddd6fe", accent: "#8b5cf6", accentBg: "rgba(139,92,246,0.18)", border: "rgba(139,92,246,0.32)", radius: 18 },
    zen: { background: "#1c1917", panel: "rgba(250,250,249,0.08)", tile: "#292524", text: "#fafaf9", muted: "#d6d3d1", accent: "#a8a29e", accentBg: "rgba(168,162,158,0.16)", border: "rgba(168,162,158,0.28)", radius: 20 },
    tech_sleek: { background: "#050b17", panel: "rgba(34,211,238,0.08)", tile: "#07111f", text: "#e0f2fe", muted: "#7dd3fc", accent: "#22d3ee", accentBg: "rgba(34,211,238,0.16)", border: "rgba(34,211,238,0.34)", radius: 14 },
    executive: { background: "#08111f", panel: "rgba(212,180,116,0.08)", tile: "#0f172a", text: "#f8fafc", muted: "#cbd5e1", accent: "#d4b474", accentBg: "rgba(212,180,116,0.16)", border: "rgba(212,180,116,0.28)", radius: 10 },
    cyber_tech: { background: "#020617", panel: "rgba(56,189,248,0.08)", tile: "#08111f", text: "#e0f2fe", muted: "#7dd3fc", accent: "#38bdf8", accentBg: "rgba(56,189,248,0.18)", border: "rgba(56,189,248,0.32)", radius: 8 },
    retro_arcade: { background: "#12061f", panel: "rgba(236,72,153,0.1)", tile: "#1e0b32", text: "#fdf2f8", muted: "#f9a8d4", accent: "#ec4899", accentBg: "rgba(236,72,153,0.18)", border: "rgba(236,72,153,0.32)", radius: 16 },
    academic_editorial: { background: "#f8f5ef", panel: "#fffdf8", tile: "#ffffff", text: "#1f2937", muted: "#6b7280", accent: "#92400e", accentBg: "rgba(146,64,14,0.1)", border: "rgba(146,64,14,0.2)", radius: 2, useSerif: true },
    neon_carnival: { background: "#090311", panel: "rgba(168,85,247,0.1)", tile: "#170921", text: "#faf5ff", muted: "#d8b4fe", accent: "#a855f7", accentBg: "rgba(168,85,247,0.18)", border: "rgba(168,85,247,0.32)", radius: 24 },
    bohemian: { background: "#2f241d", panel: "rgba(255,247,237,0.08)", tile: "#3f2f26", text: "#ffedd5", muted: "#d6d3d1", accent: "#fb923c", accentBg: "rgba(251,146,60,0.16)", border: "rgba(251,146,60,0.28)", radius: 22 },
};

export function getWebLightboxTheme(templateId?: string): LightboxTheme {
    return WEB_LIGHTBOX_THEMES[templateId || "hero"] || WEB_LIGHTBOX_THEMES.hero;
}

function getReadableTextColor(background: string) {
    const hex = background.replace("#", "");
    if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";

    const red = parseInt(hex.slice(0, 2), 16) / 255;
    const green = parseInt(hex.slice(2, 4), 16) / 255;
    const blue = parseInt(hex.slice(4, 6), 16) / 255;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

    return luminance > 0.72 ? "#0f172a" : "#ffffff";
}

export function getWebTemplateChrome(templateId?: string) {
    const theme = getWebLightboxTheme(templateId);
    const background = theme.background || "#000000";
    const text = getReadableTextColor(background);

    return {
        background,
        text,
        accent: theme.accent || text,
        border: theme.border || "rgba(255,255,255,0.16)",
        muted: theme.muted || text,
    };
}

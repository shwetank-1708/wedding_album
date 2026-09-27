import type { LightboxTheme } from "@/components/ui/Lightbox";

export const WEB_LIGHTBOX_THEMES: Record<string, LightboxTheme> = {
    royal: { background: "#02231c", panel: "rgba(2,35,28,0.82)", tile: "#021a15", text: "#fcfbf7", muted: "#a3b899", accent: "#ca9c69", accentBg: "rgba(202,156,105,0.18)", border: "rgba(202,156,105,0.28)", radius: 18, useSerif: true },
    classic: { background: "#F7F2EB", panel: "#ffffff", tile: "#ffffff", text: "#2C352E", muted: "#6E7B6C", accent: "#8B9A6E", accentBg: "rgba(139,154,110,0.12)", border: "#EAE2D6", radius: 0, useSerif: true },
    hero: { background: "#000000", panel: "rgba(255,255,255,0.04)", tile: "#09090b", text: "#ffffff", muted: "#94a3b8", accent: "#ca9c69", accentBg: "rgba(202,156,105,0.12)", border: "rgba(202,156,105,0.22)", radius: 12, useSerif: true },
    ethereal: { background: "#F8FAFC", panel: "#EEF2F6", tile: "#ffffff", text: "#1E293B", muted: "#64748B", accent: "#4A6984", accentBg: "#E2E8F0", border: "rgba(74,105,132,0.18)", radius: 2, useSerif: true },
    scrapbook: { background: "#151c1b", panel: "rgba(246,241,232,0.08)", tile: "#1d2826", text: "#f8f5f0", muted: "#aab8b1", accent: "#d9826b", accentBg: "rgba(217,130,107,0.18)", border: "rgba(217,130,107,0.28)", radius: 18 },
    neon: { background: "#070611", panel: "rgba(18,16,35,0.72)", tile: "rgba(17,16,32,0.82)", text: "#f8f7ff", muted: "#b9b1d9", accent: "#ff3df2", accentBg: "rgba(102,232,255,0.2)", border: "rgba(255,61,242,0.32)", radius: 20 },
    pastel: { background: "#fff7f4", panel: "rgba(255,255,255,0.78)", tile: "#fffdfb", text: "#4d4542", muted: "#9a8583", accent: "#c9768b", accentBg: "rgba(213,180,220,0.28)", border: "rgba(201,118,139,0.18)", radius: 24 },
    pop: { background: "#ffe84a", panel: "#fffdf3", tile: "#ffffff", text: "#231f20", muted: "#5b4b3d", accent: "#ef2b3a", accentBg: "rgba(239,43,58,0.14)", border: "rgba(35,31,32,0.18)", radius: 18 },
    golden_years: { background: "#160f09", panel: "rgba(36,26,16,0.85)", tile: "#241a10", text: "#faf5ea", muted: "#bdab97", accent: "#e5a93c", accentBg: "rgba(229,169,60,0.16)", border: "rgba(229,169,60,0.28)", radius: 14, useSerif: true },
    vintage: { background: "#2a2018", panel: "rgba(255,247,237,0.08)", tile: "#3b2f24", text: "#fff7ed", muted: "#d6d3d1", accent: "#a16207", accentBg: "rgba(161,98,7,0.16)", border: "rgba(161,98,7,0.28)", radius: 14, useSerif: true },
    rose: { background: "#280a14", panel: "rgba(59,22,34,0.85)", tile: "#3b1622", text: "#fceee9", muted: "#cfa89e", accent: "#d8a47f", accentBg: "rgba(216,164,127,0.16)", border: "rgba(216,164,127,0.3)", radius: 20, useSerif: true },
    minimal_love: { background: "#1f1d1d", panel: "rgba(40,36,34,0.85)", tile: "#282422", text: "#f8f5f0", muted: "#b8aea5", accent: "#ff5252", accentBg: "rgba(255,82,82,0.16)", border: "rgba(255,82,82,0.25)", radius: 8, useSerif: true },
    diamond: { background: "#082f49", panel: "rgba(2,132,199,0.08)", tile: "#0c4a6e", text: "#f0f9ff", muted: "#7dd3fc", accent: "#0284c7", accentBg: "rgba(2,132,199,0.18)", border: "rgba(2,132,199,0.32)", radius: 15 },
    blush: { background: "#230a12", panel: "rgba(54,18,31,0.85)", tile: "#36121f", text: "#f8e9e7", muted: "#c4a5a0", accent: "#d89c8a", accentBg: "rgba(216,156,138,0.16)", border: "rgba(216,156,138,0.3)", radius: 22, useSerif: true },
    garden: { background: "#3f4f40", panel: "rgba(47,60,48,0.88)", tile: "#344436", text: "#f0f5ef", muted: "#a1b39e", accent: "#7a9a6b", accentBg: "rgba(122,154,107,0.18)", border: "rgba(122,154,107,0.3)", radius: 20, useSerif: true },
    midnight_glam: { background: "#1A1035", panel: "rgba(58,32,96,0.88)", tile: "#3A2060", text: "#F4F0FD", muted: "#9689C9", accent: "#6B5BBF", accentBg: "rgba(107,91,191,0.18)", border: "rgba(168,158,223,0.3)", radius: 16, useSerif: true },
    cinematic: { background: "#0f0f12", panel: "rgba(28,28,32,0.92)", tile: "#1c1c20", text: "#ffffff", muted: "#a0a0aa", accent: "#e62b3a", accentBg: "rgba(230,43,58,0.16)", border: "rgba(230,43,58,0.3)", radius: 6, useSerif: true },
    modern_lounge: { background: "#0D1117", panel: "rgba(28,36,48,0.88)", tile: "#1C2430", text: "#A7B7C9", muted: "#798FAF", accent: "#3D5F8A", accentBg: "rgba(61,95,138,0.18)", border: "rgba(38,53,68,0.5)", radius: 16, useSerif: true },
    elegant_night: { background: "#111111", panel: "rgba(255,255,255,0.05)", tile: "#18181b", text: "#f5f5f5", muted: "#a3a3a3", accent: "#737373", accentBg: "rgba(115,115,115,0.18)", border: "rgba(255,255,255,0.12)", radius: 12 },
    polaroid: { background: "#f7efe1", panel: "rgba(255,250,240,0.96)", tile: "#fffaf0", text: "#3f2a1e", muted: "#806653", accent: "#b45309", accentBg: "rgba(180,83,9,0.14)", border: "rgba(180,83,9,0.28)", radius: 2, useSerif: true },
    editorial: { background: "#fafafa", panel: "#ffffff", tile: "#ffffff", text: "#111827", muted: "#374151", accent: "#111827", accentBg: "rgba(17,24,39,0.08)", border: "rgba(17,24,39,0.2)", radius: 0 },
    museum: { background: "#0D1117", panel: "rgba(28,36,48,0.88)", tile: "#121820", text: "#A7B7C9", muted: "#798FAF", accent: "#3D5F8A", accentBg: "rgba(61,95,138,0.18)", border: "rgba(38,53,68,0.5)", radius: 6, useSerif: true },
    brutalist: { background: "#171914", panel: "#272921", tile: "#3B3C32", text: "#E6DFD3", muted: "#988B71", accent: "#988B71", accentBg: "rgba(152,139,113,0.18)", border: "rgba(152,139,113,0.35)", radius: 0 },
    vibrant: { background: "#4c1d95", panel: "rgba(255,255,255,0.1)", tile: "#581c87", text: "#ffffff", muted: "#ddd6fe", accent: "#8b5cf6", accentBg: "rgba(139,92,246,0.18)", border: "rgba(139,92,246,0.32)", radius: 18 },
    zen: { background: "#1c1917", panel: "rgba(250,250,249,0.08)", tile: "#292524", text: "#fafaf9", muted: "#d6d3d1", accent: "#a8a29e", accentBg: "rgba(168,162,158,0.16)", border: "rgba(168,162,158,0.28)", radius: 20 },
    tech_sleek: { background: "#040c1a", panel: "rgba(10,24,43,0.92)", tile: "#0e233d", text: "#f0f8ff", muted: "#7ba4cc", accent: "#00a2ff", accentBg: "rgba(0,162,255,0.18)", border: "rgba(0,162,255,0.32)", radius: 14 },
    executive: { background: "#08111f", panel: "rgba(212,180,116,0.08)", tile: "#0f172a", text: "#f8fafc", muted: "#cbd5e1", accent: "#d4b474", accentBg: "rgba(212,180,116,0.16)", border: "rgba(212,180,116,0.28)", radius: 10 },
    cyber_tech: { background: "#08080a", panel: "#131318", tile: "#131318", text: "#ffffff", muted: "#9ca3af", accent: "#3af0d8", accentBg: "rgba(58, 240, 216, 0.16)", border: "rgba(58, 240, 216, 0.25)", radius: 12 },
    retro_arcade: { background: "#ffc200", panel: "#121212", tile: "#121212", text: "#121212", muted: "#374151", accent: "#121212", accentBg: "rgba(18, 18, 18, 0.12)", border: "rgba(18, 18, 18, 0.25)", radius: 12 },
    academic_editorial: { background: "#f8f5ef", panel: "#fffdf8", tile: "#ffffff", text: "#1f2937", muted: "#6b7280", accent: "#92400e", accentBg: "rgba(146,64,14,0.1)", border: "rgba(146,64,14,0.2)", radius: 2, useSerif: true },
    neon_carnival: { background: "#090311", panel: "rgba(168,85,247,0.1)", tile: "#170921", text: "#faf5ff", muted: "#d8b4fe", accent: "#a855f7", accentBg: "rgba(168,85,247,0.18)", border: "rgba(168,85,247,0.32)", radius: 24 },
    bohemian: { background: "#2f1b12", panel: "rgba(250,245,234,0.95)", tile: "#faf5ea", text: "#38241b", muted: "#7d6457", accent: "#73863a", accentBg: "rgba(115,134,58,0.16)", border: "rgba(115,134,58,0.3)", radius: 22, useSerif: true },
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

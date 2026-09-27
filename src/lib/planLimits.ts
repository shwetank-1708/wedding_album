export type PlanDetails = {
    name: string;
    storageBytes: number;
    storageLabel: string;
    eventLimit: number;
    eventLabel: string;
    accent: string;
    accentSoft: string;
};

const GB = 1024 * 1024 * 1024;

export function getPlanDetails(role?: string): PlanDetails {
    switch (role?.toLowerCase()) {
        case "admin":
            return {
                name: "Super Admin",
                storageBytes: Infinity,
                storageLabel: "Unlimited",
                eventLimit: Infinity,
                eventLabel: "Unlimited",
                accent: "#CA9C68",
                accentSoft: "rgba(202, 156, 104, 0.16)",
            };
        case "elite":
            return {
                name: "Elite Plan",
                storageBytes: 500 * GB,
                storageLabel: "500 GB",
                eventLimit: 500,
                eventLabel: "500",
                accent: "#CA9C68",
                accentSoft: "rgba(202, 156, 104, 0.16)",
            };
        case "pro":
            return {
                name: "200 GB Plan",
                storageBytes: 200 * GB,
                storageLabel: "200 GB",
                eventLimit: 200,
                eventLabel: "200",
                accent: "#a855f7",
                accentSoft: "rgba(168, 85, 247, 0.16)",
            };
        case "ultimate":
            return {
                name: "1 TB Plan",
                storageBytes: 1024 * GB,
                storageLabel: "1 TB",
                eventLimit: 1000,
                eventLabel: "1000",
                accent: "#f97316",
                accentSoft: "rgba(249, 115, 22, 0.16)",
            };
        case "premium":
            return {
                name: "Premium Plan",
                storageBytes: 100 * GB,
                storageLabel: "100 GB",
                eventLimit: 100,
                eventLabel: "100",
                accent: "#818cf8",
                accentSoft: "rgba(129, 140, 248, 0.16)",
            };
        case "standard":
            return {
                name: "Standard Plan",
                storageBytes: 50 * GB,
                storageLabel: "50 GB",
                eventLimit: 50,
                eventLabel: "50",
                accent: "#38bdf8",
                accentSoft: "rgba(56, 189, 248, 0.16)",
            };
        case "basic":
            return {
                name: "Basic Plan",
                storageBytes: 25 * GB,
                storageLabel: "25 GB",
                eventLimit: 25,
                eventLabel: "25",
                accent: "#22c55e",
                accentSoft: "rgba(34, 197, 94, 0.16)",
            };
        case "starter":
            return {
                name: "10 GB Plan",
                storageBytes: 10 * GB,
                storageLabel: "10 GB",
                eventLimit: 10,
                eventLabel: "10",
                accent: "#14b8a6",
                accentSoft: "rgba(20, 184, 166, 0.16)",
            };
        case "free":
        case "freemium":
        default:
            return {
                name: "Free Plan",
                storageBytes: 1 * GB,
                storageLabel: "1 GB",
                eventLimit: 1,
                eventLabel: "1",
                accent: "#94a3b8",
                accentSoft: "rgba(148, 163, 184, 0.16)",
            };
    }
}

export function getUsagePercent(current: number, limit: number) {
    if (limit === Infinity) return 0;
    if (limit <= 0) return current > 0 ? 100 : 0;
    return Math.min((current / limit) * 100, 100);
}

export function formatStorageSize(bytes: number) {
    if (bytes === 0) return "0 MB";

    const units = ["Bytes", "KB", "MB", "GB", "TB"];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, unitIndex);
    return `${parseFloat(value.toFixed(2))} ${units[unitIndex]}`;
}

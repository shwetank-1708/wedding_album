export function getApiBaseUrl() {
    return (process.env.NEXT_PUBLIC_API_URL || "https://api-staging.evebash.com").trim().replace(/\/+$/, "");
}

export function getApiUrl(path: string) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const baseUrl = getApiBaseUrl();
    return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

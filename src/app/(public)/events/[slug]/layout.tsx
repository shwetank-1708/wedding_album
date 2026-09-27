import React from "react";
import { EventRouteShell } from "./EventRouteShell";

export default async function EventLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
}>) {
    const { slug } = await params;
    return <EventRouteShell slug={slug}>{children}</EventRouteShell>;
}

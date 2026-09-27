"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EventNavbar } from "@/components/EventNavbar";
import {
    Event,
    Photo,
    getEventById,
    getEventPhotosPaginated,
    getFavouritePhotosForEvents,
    getSubEvents,
} from "@/lib/database";
import { downloadGalleryAsZip } from "@/lib/zipDownload";
import { getWebTemplateChrome } from "@/lib/webTemplateTheme";

interface EventRouteShellProps {
    children: React.ReactNode;
    slug: string;
}

export function EventRouteShell({ children, slug }: EventRouteShellProps) {
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();
    const isShared = searchParams.get("shared") === "true";
    const sharedQuery = isShared ? "?shared=true" : "";
    const [event, setEvent] = useState<Event | null>(null);
    const [mainEvent, setMainEvent] = useState<Event | null>(null);
    const [subEvents, setSubEvents] = useState<Event[]>([]);
    const [isZipping, setIsZipping] = useState(false);
    const [zipProgress, setZipProgress] = useState(0);

    useEffect(() => {
        let active = true;

        async function loadNavigation() {
            const currentEvent = await getEventById(slug);
            if (!active || !currentEvent) return;

            const rootEvent = currentEvent.parentId
                ? await getEventById(currentEvent.parentId)
                : currentEvent;
            if (!active || !rootEvent) return;

            const galleries = await getSubEvents(rootEvent.id, rootEvent.legacyId);
            if (!active) return;

            setEvent(currentEvent);
            setMainEvent(rootEvent);
            setSubEvents(galleries.filter((gallery) => gallery.id !== rootEvent.id));
        }

        void loadNavigation();
        return () => {
            active = false;
        };
    }, [slug]);

    const activePage = pathname.endsWith("/find-you")
        ? "find-you"
        : pathname.endsWith("/event-partners")
            ? "event-partners"
            : "gallery";
    const chrome = getWebTemplateChrome(mainEvent?.templateId || event?.templateId);

    useEffect(() => {
        if (!mainEvent && !event) return;

        const root = document.documentElement;
        root.dataset.eventTemplateChrome = "true";
        root.style.setProperty("--event-template-primary", chrome.background);
        root.style.setProperty("--event-template-text", chrome.text);
        root.style.setProperty("--event-template-muted", chrome.muted);
        root.style.setProperty("--event-template-accent", chrome.accent);
        root.style.setProperty("--event-template-border", chrome.border);

        return () => {
            delete root.dataset.eventTemplateChrome;
            root.style.removeProperty("--event-template-primary");
            root.style.removeProperty("--event-template-text");
            root.style.removeProperty("--event-template-muted");
            root.style.removeProperty("--event-template-accent");
            root.style.removeProperty("--event-template-border");
        };
    }, [chrome.accent, chrome.background, chrome.border, chrome.muted, chrome.text, event, mainEvent]);

    const loadDownloadMedia = useCallback(async (): Promise<Photo[]> => {
        if (!event || !mainEvent) return [];

        if (event.id === mainEvent.id) {
            const eventIds = [mainEvent.id, mainEvent.legacyId, ...subEvents.flatMap((gallery) => [gallery.id, gallery.legacyId])]
                .filter((id): id is string => Boolean(id));
            return getFavouritePhotosForEvents(Array.from(new Set(eventIds)));
        }

        const media: Photo[] = [];
        let page = 0;
        let hasMore = true;
        while (hasMore) {
            const result = await getEventPhotosPaginated(event.id, event.legacyId, page, 100);
            media.push(...result.photos);
            hasMore = result.hasMore;
            page += 1;
        }
        return media;
    }, [event, mainEvent, subEvents]);

    const handleDownloadZip = useCallback(async () => {
        if (!event) return;
        setIsZipping(true);
        setZipProgress(0);
        try {
            const media = await loadDownloadMedia();
            if (media.length === 0) {
                window.alert("No photos or videos to download in this gallery.");
                return;
            }
            await downloadGalleryAsZip(
                event.title || "Gallery",
                media.map((item) => ({
                    id: item.id,
                    url: item.url,
                    mediaType: item.mediaType,
                    resourceType: item.resourceType,
                })),
                (percent) => setZipProgress(percent),
            );
        } catch (error) {
            window.alert(error instanceof Error ? error.message : "Failed to generate zip file.");
        } finally {
            setIsZipping(false);
            setZipProgress(0);
        }
    }, [event, loadDownloadMedia]);

    const navigation = useMemo(() => {
        if (!event || !mainEvent) return null;
        return (
            <EventNavbar
                mainEventTitle={mainEvent.title}
                mainEventId={mainEvent.id}
                subEvents={subEvents}
                isShared={isShared}
                basePath={`/events/${mainEvent.id}`}
                activeGalleryId={activePage === "gallery" ? event.id : mainEvent.id}
                activePage={activePage}
                onSelectGallery={(gallery) => router.push(`/events/${gallery?.id || mainEvent.id}${sharedQuery}`)}
                onFindYou={() => router.push(`/events/${mainEvent.id}/find-you${sharedQuery}`)}
                onDownloadZip={handleDownloadZip}
                isZipping={isZipping}
                zipProgress={zipProgress}
                chromeBackgroundColor={chrome.background}
                chromeTextColor={chrome.text}
                chromeAccentColor={chrome.accent}
                chromeBorderColor={chrome.border}
            />
        );
    }, [activePage, chrome, event, handleDownloadZip, isShared, isZipping, mainEvent, router, sharedQuery, subEvents, zipProgress]);

    return (
        <div
            className="event-template-shell min-h-screen"
            style={{
                "--event-template-primary": chrome.background,
                "--event-template-text": chrome.text,
                "--event-template-muted": chrome.muted,
                "--event-template-accent": chrome.accent,
                "--event-template-border": chrome.border,
            } as React.CSSProperties}
        >
            {navigation}
            {children}
        </div>
    );
}

"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Briefcase, ChevronRight, MapPin, Star } from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";
import { EventNavbar } from "@/components/EventNavbar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Business, Event, getBusinessById, getEventById, getSubEvents } from "@/lib/database";
import { getWebTemplateChrome } from "@/lib/webTemplateTheme";

function getVendorLocation(business: Business) {
    return business.location?.address || "Location not listed";
}

function EventPartnersContent({ slug }: { slug: string }) {
    const searchParams = useSearchParams();
    const isShared = searchParams.get("shared") === "true";

    const [event, setEvent] = useState<Event | null>(null);
    const [parentEvent, setParentEvent] = useState<Event | null>(null);
    const [subEvents, setSubEvents] = useState<Event[]>([]);
    const [vendors, setVendors] = useState<Business[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        async function loadPartners() {
            setLoading(true);
            try {
                const eventData = await getEventById(slug);
                if (!active || !eventData) {
                    setEvent(null);
                    return;
                }

                setEvent(eventData);

                const navRoot = eventData.parentId ? await getEventById(eventData.parentId) : eventData;
                if (!active) return;

                setParentEvent(eventData.parentId ? navRoot : null);

                if (navRoot) {
                    const siblings = await getSubEvents(navRoot.id, navRoot.legacyId);
                    if (!active) return;
                    setSubEvents(siblings);
                }

                const partnerSource = navRoot || eventData;
                const vendorIds = partnerSource.vendors || [];
                const linkedVendors = vendorIds.length > 0
                    ? await Promise.all(vendorIds.map((vendorId) => getBusinessById(vendorId)))
                    : [];

                if (!active) return;
                setVendors(linkedVendors.filter(Boolean) as Business[]);
            } catch (error) {
                console.error("Error loading event partners:", error);
                if (active) {
                    setEvent(null);
                    setVendors([]);
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        loadPartners();

        return () => {
            active = false;
        };
    }, [slug]);

    const chromeTemplateId = (parentEvent || event)?.templateId || event?.templateId;

    useEffect(() => {
        if (!chromeTemplateId || typeof document === "undefined") return;

        const chrome = getWebTemplateChrome(chromeTemplateId);
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
    }, [chromeTemplateId]);

    if (loading) {
        return <LoadingScreen message="Loading event partners" />;
    }

    if (!event) {
        return (
            <main className="min-h-screen bg-stone-50 px-6 py-32 text-center">
                <h1 className="text-2xl font-black text-slate-900">Event not found</h1>
                <Link href="/gallery" className="mt-6 inline-flex rounded-full bg-slate-900 px-6 py-3 text-sm font-black uppercase tracking-widest text-white">
                    Back to Gallery
                </Link>
            </main>
        );
    }

    const navEvent = parentEvent || event;
    const templateChrome = getWebTemplateChrome(navEvent.templateId || event.templateId);

    return (
        <main
            className="event-template-shell min-h-screen bg-stone-50 pb-24"
            style={{
                "--event-template-primary": templateChrome.background,
                "--event-template-text": templateChrome.text,
                "--event-template-muted": templateChrome.muted,
                "--event-template-accent": templateChrome.accent,
                "--event-template-border": templateChrome.border,
            } as React.CSSProperties}
        >
            <EventNavbar
                mainEventTitle={navEvent.title}
                mainEventId={navEvent.id}
                subEvents={subEvents}
                isShared={isShared}
                basePath={`/events/${navEvent.id}`}
                activeGalleryId={navEvent.id}
                activePage="event-partners"
                showFavouriteGallery
                favouriteGalleryActive={false}
                chromeBackgroundColor={templateChrome.background}
                chromeTextColor={templateChrome.text}
                chromeAccentColor={templateChrome.accent}
                chromeBorderColor={templateChrome.border}
            />

            <section className="mx-auto max-w-6xl px-4 pt-32 sm:px-6 lg:px-8">
                <SectionHeader
                    title="The Dream Team"
                    subtitle={`The creative team and vendors behind this beautiful ${event.category?.toLowerCase() || "event"}.`}
                />

                {vendors.length === 0 ? (
                    <div className="mx-auto mt-12 max-w-2xl rounded-[2rem] border border-stone-200 bg-white p-10 text-center shadow-sm">
                        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 text-stone-500">
                            <Briefcase className="h-8 w-8" />
                        </div>
                        <h2 className="text-xl font-black text-slate-900">Vendor list coming soon</h2>
                        <p className="mt-3 text-sm font-semibold leading-6 text-stone-600">
                            Event partners linked by the host will appear here.
                        </p>
                    </div>
                ) : (
                    <div className="mt-12 grid gap-5 md:grid-cols-2">
                        {vendors.map((vendor) => (
                            <Link
                                key={vendor.id}
                                href={`/eb-network/${vendor.id}`}
                                className="group flex items-center gap-5 rounded-[1.5rem] border border-stone-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl"
                            >
                                <div
                                    className="h-20 w-20 shrink-0 rounded-2xl border border-stone-200 bg-stone-100 bg-cover bg-center"
                                    style={{
                                        backgroundImage: `url("${vendor.coverImage || "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?q=80&w=500&auto=format&fit=crop"}")`,
                                    }}
                                />
                                <div className="min-w-0 flex-1">
                                    <h3 className="truncate text-xl font-black text-slate-900">{vendor.name}</h3>
                                    <p className="mt-1 text-xs font-black uppercase tracking-widest text-amber-700">{vendor.type}</p>
                                    <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-stone-500">
                                        <span className="flex items-center gap-1">
                                            <MapPin className="h-3.5 w-3.5" />
                                            {getVendorLocation(vendor)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                            {vendor.rating || 0}
                                        </span>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 shrink-0 text-stone-400 transition-transform group-hover:translate-x-1 group-hover:text-slate-900" />
                            </Link>
                        ))}
                    </div>
                )}
            </section>
        </main>
    );
}

export default function EventPartnersPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = React.use(params);

    return (
        <Suspense fallback={<LoadingScreen message="Loading event partners" />}>
            <EventPartnersContent slug={slug} />
        </Suspense>
    );
}

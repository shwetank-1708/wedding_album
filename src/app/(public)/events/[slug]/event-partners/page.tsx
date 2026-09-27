"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, MapPin, Star, Users, Store } from "lucide-react";
import LoadingScreen from "@/components/LoadingScreen";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Business, Event, getBusinessById, getEventById } from "@/lib/database";

function getVendorLocation(business: Business) {
    return business.location?.address || "Location not listed";
}

function EventPartnersContent({ slug }: { slug: string }) {
    const [event, setEvent] = useState<Event | null>(null);
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

    return (
        <main className="min-h-screen bg-stone-50 pb-24">
            <section className="mx-auto max-w-6xl px-4 pt-32 sm:px-6 lg:px-8">
                <SectionHeader
                    title="The Dream Team"
                    subtitle={`The creative team and vendors behind this beautiful ${event.category?.toLowerCase() || "event"}.`}
                />

                {vendors.length === 0 ? (
                    <div className="mx-auto mt-12 max-w-3xl rounded-[2.5rem] border border-amber-400/20 bg-slate-950 p-8 text-center shadow-2xl sm:p-12 text-white">
                        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-amber-300">
                            <Users className="h-4 w-4 text-amber-400" />
                            <span>Event Partners · Phase 2</span>
                        </div>
                        <h2 className="font-playfair text-4xl font-black text-white sm:text-5xl">
                            Coming Soon
                        </h2>
                        <p className="mt-4 text-sm font-semibold leading-relaxed text-slate-300 sm:text-base">
                            The Event Partners directory is linked with EB Business & EB Network. In Phase 2, hosts will be able to feature verified photographers, caterers, planners, and venues directly on this page.
                        </p>
                        <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
                            {[
                                { title: "Verified Partners", desc: "Browse authenticated service providers linked by the host.", icon: Users },
                                { title: "EB Business Profiles", desc: "Discover full portfolios, ratings, and services.", icon: Store },
                                { title: "Direct Enquiries", desc: "Connect with event vendors for your future celebrations.", icon: Star },
                            ].map(({ title, desc, icon: Icon }) => (
                                <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-white">{title}</h3>
                                    <p className="mt-1 text-xs font-medium text-slate-400 leading-normal">{desc}</p>
                                </div>
                            ))}
                        </div>
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

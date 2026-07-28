
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { notFound } from "next/navigation";
import { getEventById, getEventPhotos } from "@/lib/database";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import React from "react";

import { getWebTemplateComponent } from "@/components/templateRegistry";
import { getWebLightboxTheme } from "@/lib/webTemplateTheme";

export default async function SubEventPage({ params }: { params: Promise<{ slug: string; eventId: string }> }) {
    const { slug, eventId } = await params;

    // 1. Get Events
    const mainEvent = await getEventById(slug);
    const subEvent = await getEventById(eventId);

    if (!mainEvent || !subEvent) return notFound();

    // 2. Get LIVE Photos for this sub-event
    const databasePhotos = await getEventPhotos(eventId);

    // 3. Transform for the Grid
    const photos = databasePhotos.map(p => {
        return {
            id: p.id,
            src: p.url || "",
            storageKey: p.storageKey,
            width: p.width || 800,
            height: p.height || 600,
            filename: p.storageKey.split('/').pop(),
            thumbnailUrl: p.thumbnailUrl,
            mediaType: p.mediaType,
            resourceType: p.resourceType
        };
    });

    const plainSubEvent = JSON.parse(JSON.stringify(subEvent));
    const templateId = mainEvent.templateId || 'hero';
    const basePath = `/tenant/${slug}`;

    // Common Gallery Block
    const galleryBlock = (
        <section className="py-20 px-4 w-full">
            {/* Back Button specifically for gallery view to make nav easier on mobile */}
            <div className="mb-12 flex justify-center">
                <Link href={basePath} className="inline-flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-full shadow-lg hover:bg-stone-800 hover:scale-105 transition-all text-sm font-medium tracking-widest uppercase">
                    <ArrowLeft className="w-4 h-4" />
                    Back to Event
                </Link>
            </div>

            <SectionHeader title="Gallery" subtitle={`${photos.length} Photos`} />

            {photos.length > 0 ? (
                <MasonryGrid
                    photos={photos}
                    eventSlug={slug}
                    lightboxTheme={getWebLightboxTheme(templateId)}
                    templateId={templateId}
                />
            ) : (
                <div className="text-center py-20 bg-black/5 rounded-2xl mx-4 border border-dashed border-black/20">
                    <p className="text-stone-700 mb-2 font-serif italic text-xl">No photos found in database.</p>
                    <p className="text-sm text-stone-600 font-mono uppercase tracking-widest">
                        Wait for photos to be uploaded.
                    </p>
                </div>
            )}
        </section>
    );

    const TemplateComponent = getWebTemplateComponent(templateId);
    return <TemplateComponent event={plainSubEvent}>{galleryBlock}</TemplateComponent>;
}

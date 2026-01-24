
import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { notFound } from "next/navigation";
import { getEventById, getEventPhotos } from "@/lib/firestore";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import React from "react";

export default async function SubEventPage({ params }: { params: Promise<{ slug: string; eventId: string }> }) {
    const { slug, eventId } = await params;

    // 1. Get Event (Sub-event) Details
    const event = await getEventById(eventId);
    if (!event) return notFound();

    // 2. Get LIVE Photos for this sub-event
    const firestorePhotos = await getEventPhotos(eventId);

    // 3. Transform for the Grid
    const photos = firestorePhotos.map(p => {
        return {
            id: p.id,
            src: p.url || "",
            cloudinaryPublicId: p.cloudinaryPublicId,
            width: p.width || 800,
            height: p.height || 600,
            filename: p.cloudinaryPublicId.split('/').pop()
        };
    });

    return (
        <>
            {/* Simple Navigation Back */}
            <div className="absolute top-4 left-4 z-50">
                <Link href={`/tenant/${slug}`} className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-all text-stone-600">
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Back to Event</span>
                </Link>
            </div>

            {/* Event Hero */}
            <div className="relative h-[60vh] w-full overflow-hidden flex items-end justify-center pb-20">
                <div className="absolute inset-0">
                    {event.coverImage && (
                        <img
                            src={event.coverImage}
                            alt={event.title}
                            className="w-full h-full object-cover"
                        />
                    )}
                    <div className="absolute inset-0 bg-black/40" />
                </div>

                <div className="relative z-10 text-center text-white p-4">
                    <p className="text-gold-400 tracking-[0.3em] text-sm uppercase font-semibold mb-2">
                        {event.description || "A Beautiful Celebration"}
                    </p>
                    <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight">
                        {event.title}
                    </h1>
                </div>
            </div>

            <section className="py-20 px-4">
                <SectionHeader title="Gallery" subtitle={`${photos.length} Photos`} />

                {photos.length > 0 ? (
                    <MasonryGrid photos={photos} eventSlug={slug} /> // Using main event slug for uploads/context if needed
                ) : (
                    <div className="text-center py-20 bg-gray-50 rounded-lg mx-4 border border-dashed border-gray-300">
                        <p className="text-stone-500 mb-2">No photos found in database.</p>
                        <p className="text-sm text-stone-400">
                            Wait for photos to be uploaded.
                        </p>
                    </div>
                )}
            </section>

            <footer className="bg-royal-maroon/90 text-royal-gold/70 py-12 text-center text-sm border-t border-royal-gold/30">
                <p>© {new Date().getFullYear()} Wedding Album.</p>
            </footer>
        </>
    );
}

import { MasonryGrid } from "@/components/ui/MasonryGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { notFound } from "next/navigation";
import { getEvent, getAllEvents } from "@/lib/events"; // NEW: Static Data
import { getEventPhotos } from "@/lib/firestore"; // Live Data
// import { getCloudinaryImages } from "@/lib/cloudinary"; // Live Data (Deprecated)
import Navbar from "@/components/Navbar";

export async function generateStaticParams() {
    const events = getAllEvents();
    return events.map((event) => ({ slug: event.id }));
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // 1. Get Event Details (Static)
    const event = getEvent(slug);
    if (!event) return notFound();

    // 2. Get LIVE Photos from Firestore (Database)
    // This requires the admin to have run the "Sync" action.
    const firestorePhotos = await getEventPhotos(slug);

    // 3. Transform for the Grid
    const photos = firestorePhotos.map(p => {
        return {
            id: p.id,
            src: p.url || "", // Fallback if url is missing
            cloudinaryPublicId: p.cloudinaryPublicId,
            width: p.width || 800,
            height: p.height || 600,
            filename: p.cloudinaryPublicId.split('/').pop()
        };
    });

    return (
        <main className="min-h-screen bg-stone-50">
            <Navbar />

            {/* Event Hero */}
            <div className="relative h-[60vh] w-full overflow-hidden flex items-end justify-center pb-20">
                <div className="absolute inset-0">
                    <img
                        src={event.coverImage}
                        alt={event.title}
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40" />
                </div>

                <div className="relative z-10 text-center text-white">
                    <p className="text-gold-400 tracking-[0.3em] text-sm uppercase font-semibold mb-2">
                        {event.description}
                    </p>
                    <h1 className="font-serif text-5xl md:text-7xl font-bold tracking-tight">
                        {event.title}
                    </h1>
                </div>
            </div>

            <section className="py-20">
                <SectionHeader title="Gallery" subtitle={`${photos.length} Photos`} />

                {photos.length > 0 ? (
                    // Pass the event slug so the button knows which folder (if we had download logic)
                    <MasonryGrid photos={photos} eventSlug={slug} />
                ) : (
                    <div className="text-center py-20 bg-gray-50 rounded-lg mx-4 border border-dashed border-gray-300">
                        <p className="text-stone-500 mb-2">No photos found in database.</p>
                        <p className="text-sm text-stone-400">
                            Please go to the <strong>Admin Dashboard</strong> and click <strong>Sync Photos</strong> for {slug}.
                        </p>
                    </div>
                )}
            </section>

            <footer className="bg-stone-900 text-stone-400 py-12 text-center text-sm">
                <p>© 2026 Wedding Album.</p>
            </footer>
        </main>
    );
}

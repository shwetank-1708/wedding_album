import { RoyalNavbar } from "@/components/RoyalNavbar";
import { getEventById, getSubEvents, serializeFirestoreData } from "@/lib/firestore";
import { notFound } from "next/navigation";

export default async function TenantLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    // Fetch Event Data for Navbar
    const event = await getEventById(slug);

    if (!event) {
        return notFound();
    }

    const subEvents = await getSubEvents(event.id, event.legacyId);

    // Filter out circular references just in case
    const validSubEvents = subEvents.filter(e => e.id !== event.id);

    // Serialize data to avoid "Only plain objects" error with Firestore Timestamps
    const serializedEvent = serializeFirestoreData(event);
    const serializedSubEvents = serializeFirestoreData(validSubEvents);

    return (
        <div className="bg-royal-cream text-royal-maroon font-sans min-h-screen disable-scroll-x">
            {/* Global Royal Navbar */}
            <RoyalNavbar
                event={serializedEvent}
                subEvents={serializedSubEvents}
                basePath={`/tenant/${slug}`}
            />
            {/* Main Content Area */}
            {/* Padding top to account for fixed navbar */}
            <div className="pt-20">
                {children}
            </div>
        </div>
    );
}

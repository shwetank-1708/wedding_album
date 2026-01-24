
import EventHome from "@/components/templates/template_1/src/components/EventHome";
import { TemplateClassic } from "@/components/TemplateClassic";
// import { TemplateRoyal } from "@/components/TemplateRoyal"; // DEPRECATED
import { notFound } from "next/navigation";
import { getSubEvents, getEventById } from "@/lib/firestore";

export default async function TenantPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // Fetch event data (using ID/Slug)
    // In our schema design, the subdomain/slug maps to the Event ID
    const event = await getEventById(slug);

    if (!event) {
        return notFound();
    }

    // Dynamic Template Switching
    const templateId = event.templateId || 'hero';

    // Fetch sub-events for the template
    const subEventsData = await getSubEvents(event.id, event.legacyId);

    // Serialize for Client Component (removes Firestore Timestamps warnings)
    const plainEvent = JSON.parse(JSON.stringify(event));
    const plainSubEvents = JSON.parse(JSON.stringify(subEventsData));

    const basePath = `/tenant/${slug}`;

    switch (templateId) {
        case 'royal':
        case 'hero': // Defaulting hero to royal for now as per user request
        default:
            return <EventHome event={plainEvent} subEvents={plainSubEvents} basePath={basePath} />;
        case 'classic':
            return <TemplateClassic event={plainEvent} />;
    }
}

import { getEventById } from "@/lib/firestore";
import { TemplateHero } from "@/components/TemplateHero";
import { TemplateClassic } from "@/components/TemplateClassic";
import { TemplateRoyal } from "@/components/TemplateRoyal";
import { notFound } from "next/navigation";

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

    switch (templateId) {
        case 'royal':
            return <TemplateRoyal event={event} />;
        case 'classic':
            return <TemplateClassic event={event} />;
        case 'hero':
        default:
            return <TemplateHero event={event} />;
    }
}

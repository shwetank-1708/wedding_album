export interface EventData {
    id: string;
    title: string;
    description: string;
    date: string;
    coverImage: string;
    cloudinaryFolder?: string; // Optional override for folder name
}

export const events: Record<string, EventData> = {
    haldi: {
        id: "haldi",
        title: "The Haldi",
        description: "Yellow & Bright",
        date: "2025-12-10",
        coverImage: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767693211/Copy_of_7C0A9962_dgd1nf.jpg",
        cloudinaryFolder: "haldi", // User confirmed lowercase 'haldi'
    },
    mehendi: {
        id: "mehendi",
        title: "Mehandi Madness",
        description: "Hands of Love",
        date: "2025-12-11",
        coverImage: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767692471/7C0A0649_kkwbbu.jpg",
        cloudinaryFolder: "mehendi",
    },
    wedding: {
        id: "wedding",
        title: "The Wedding",
        description: "A Tale of Forever",
        date: "2025-12-12",
        coverImage: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767693967/uwup3wbhxti5mm7kz8ta.jpg",
        cloudinaryFolder: "wedding",
    },
    reception: {
        id: "reception",
        title: "The Reception",
        description: "Party all Night",
        date: "2025-12-13",
        coverImage: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767695303/VIS_5708_adzodb.jpg",
        cloudinaryFolder: "reception",
    }
};

export function getEvent(slug: string): EventData | null {
    return events[slug] || null;
}

export function getAllEvents(): EventData[] {
    return Object.values(events);
}

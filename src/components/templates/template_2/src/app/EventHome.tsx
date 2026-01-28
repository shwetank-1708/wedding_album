
import Link from "next/link";
import Image from "next/image";
import { Event } from "@/lib/firestore";
import clsx from "clsx";

interface EventHomeProps {
    event: Event;
    subEvents: Event[];
    basePath?: string;
}

export default function EventHome({ event, subEvents, basePath = `/tenant/${event.id}` }: EventHomeProps) {
    // Prioritize cover image, fallback to dummy
    const heroImage = event.coverImage || "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767722218/0D2A5838_2_cgepes.jpg";

    return (
        <div className="flex flex-col min-h-screen font-sans bg-editorial-white text-editorial-black overflow-x-hidden">

            <main className="flex-grow">
                {/* Hero Section: Split Screen */}
                <section className="relative min-h-screen flex flex-col lg:flex-row">
                    {/* Left: Image (Stays fixed on desktop if desired, currently static split) */}
                    <div className="w-full lg:w-1/2 h-[50vh] lg:h-screen relative bg-editorial-gray">
                        <Image
                            src={heroImage}
                            alt={event.title}
                            fill
                            className="object-cover grayscale hover:grayscale-0 transition-all duration-700 ease-in-out"
                            priority
                        />
                        <div className="absolute inset-0 bg-editorial-black/10 mix-blend-multiply"></div>
                    </div>

                    {/* Right: Typography Content */}
                    <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 py-16 lg:px-20 bg-editorial-white z-10">
                        <div className="space-y-2 mb-12">
                            <p className="text-xs font-bold tracking-[0.4em] uppercase text-editorial-accent">
                                The Wedding Of
                            </p>
                        </div>

                        <h1 className="text-6xl md:text-8xl lg:text-9xl font-serif text-editorial-black leading-[0.9] tracking-tighter mb-8">
                            {event.title.split(' ').map((word, i) => (
                                <span key={i} className="block">{word}</span>
                            ))}
                        </h1>

                        <div className="flex items-center gap-6 mt-8">
                            <div className="h-[1px] w-12 bg-editorial-black"></div>
                            <p className="text-xl md:text-2xl font-light italic text-editorial-accent">
                                {event.date || "October 26, 2026"}
                            </p>
                        </div>

                        <div className="mt-16">
                            <p className="max-w-md text-sm leading-relaxed text-gray-500 mb-8 uppercase tracking-wide">
                                {event.description || "Join us for an evening of celebration, love, and laughter as we begin our new chapter together."}
                            </p>
                            <Link href="#events" className="inline-block group">
                                <span className="inline-block border-b border-editorial-black pb-1 text-sm font-bold uppercase tracking-widest hover:text-gray-500 hover:border-gray-500 transition-colors">
                                    View Details
                                </span>
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Sub-Events List (Editorial Style) */}
                <section id="events" className="py-24 px-6 md:px-12 max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
                        <div className="md:col-span-4 self-start sticky top-24">
                            <h2 className="text-4xl md:text-5xl font-serif mb-4">The Itinerary</h2>
                            <p className="text-gray-500 text-sm">A timeline of our celebrations.</p>
                        </div>

                        <div className="md:col-span-8 space-y-16">
                            {subEvents.length > 0 ? (
                                subEvents.map((subEvent, index) => (
                                    <Link key={subEvent.id} href={`${basePath}/events/${subEvent.id}`} className="block group">
                                        <div className="flex flex-col md:flex-row gap-8 items-start border-t border-gray-200 pt-8">
                                            {/* SubEvent Date/Time */}
                                            <div className="hidden md:block w-32 pt-2 flex-shrink-0">
                                                <span className="text-xs font-bold tracking-widest uppercase">
                                                    {index + 1 < 10 ? `0${index + 1}` : index + 1}
                                                </span>
                                            </div>

                                            {/* Content */}
                                            <div className="flex-grow">
                                                <h3 className="text-3xl font-serif mb-2 group-hover:italic transition-all">{subEvent.title}</h3>
                                                <p className="text-gray-500 mb-4 text-sm max-w-md">{subEvent.description || "Details to follow."}</p>
                                                <span className="text-xs uppercase font-bold tracking-widest underline decoration-transparent group-hover:decoration-black transition-all">
                                                    See Location &rarr;
                                                </span>
                                            </div>

                                            {/* Image Thumbnail */}
                                            <div className="w-full md:w-48 aspect-[3/4] relative grayscale group-hover:grayscale-0 transition-all duration-500">
                                                <Image
                                                    src={subEvent.coverImage || "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767724606/7C0A9948_1_cwl7g6.jpg"}
                                                    alt={subEvent.title}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                        </div>
                                    </Link>
                                ))
                            ) : (
                                <div className="py-10 border-t border-gray-200">
                                    <p className="text-gray-400 italic">No events scheduled yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                <footer className="py-20 px-6 border-t border-gray-100 mt-12 bg-white flex flex-col items-center justify-center text-center">
                    <h2 className="text-4xl lg:text-7xl font-serif mb-6">{event.title}</h2>
                    <p className="text-xs uppercase tracking-[0.3em] text-gray-400">
                        {new Date().getFullYear()} &bull; Wedding Album
                    </p>
                </footer>
            </main>
        </div>
    );
}

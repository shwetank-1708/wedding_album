import Link from "next/link";
import Image from "next/image";
import { Event, getSubEvents } from "@/lib/firestore";
import { RoyalNavbar } from "./RoyalNavbar";

interface TemplateRoyalProps {
    event: Event;
}

export async function TemplateRoyal({ event }: TemplateRoyalProps) {
    // Fetch sub-events (ceremonies) dynamically
    const subEvents = await getSubEvents(event.id, event.legacyId);

    // Filter and map sub-events to match the expected structure
    // We prioritize sub-events that have images and titles
    const displayEvents = subEvents.length > 0 ? subEvents : [];

    // Sanitize for Client Component (Serializes Timestamps to plain objects)
    const serializedEvent = JSON.parse(JSON.stringify(event));
    const serializedSubEvents = JSON.parse(JSON.stringify(displayEvents));

    return (
        <div className="flex flex-col min-h-screen font-sans bg-royal-cream text-royal-maroon disable-scroll-x overflow-x-hidden">
            <RoyalNavbar event={serializedEvent} subEvents={serializedSubEvents} />

            <main className="pt-20">
                {/* Full Screen Hero Section */}
                <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
                    {/* Background Image */}
                    <div className="absolute inset-0 z-0">
                        <Image
                            src={event.coverImage || "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767722218/0D2A5838_2_cgepes.jpg"}
                            alt={event.title}
                            fill
                            className="object-cover object-[50%_35%]"
                            priority
                        />
                        <div className="absolute inset-0 bg-black/30 mix-blend-multiply"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-royal-maroon/90 via-transparent to-black/40"></div>
                    </div>

                    {/* Hero Content */}
                    <div className="relative z-10 text-center space-y-4 px-4 mt-20 animate-fade-in-up max-w-4xl mx-auto">
                        <div className="inline-block border-t-2 border-b-2 border-royal-gold/60 py-2 px-8 mb-6 bg-black/20 backdrop-blur-sm rounded-full">
                            <p className="text-sm md:text-lg text-royal-gold tracking-[0.3em] font-serif uppercase">
                                The Royal Union
                            </p>
                        </div>

                        <h1 className="text-5xl md:text-8xl lg:text-9xl font-serif text-white drop-shadow-2xl tracking-wide">
                            {event.title}
                        </h1>

                        <p className="text-lg md:text-2xl text-royal-cream/90 font-light tracking-widest italic mt-6">
                            {event.date || "Wedding Celebration"} &bull; {event.description || "Dehradun, India"}
                        </p>

                        <div className="mt-12">
                            <Link href="#events" className="inline-block">
                                <span className="inline-block px-8 py-3 bg-transparent border border-royal-gold text-royal-gold hover:bg-royal-gold hover:text-royal-maroon transition-all duration-300 uppercase tracking-widest text-sm font-semibold rounded-sm cursor-pointer">
                                    View Ceremonies
                                </span>
                            </Link>
                        </div>
                    </div>

                    {/* Scroll Down Indicator */}
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
                        <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    </div>
                </section>

                {/* Decorative Divider */}
                <div className="h-4 bg-gradient-to-r from-royal-maroon via-royal-gold to-royal-maroon"></div>

                {/* Events Grid Section */}
                <section id="events" className="relative py-24 px-4 md:px-12 max-w-7xl mx-auto w-full bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]">
                    <div className="text-center mb-20 space-y-4">
                        <h2 className="text-4xl md:text-6xl font-serif text-royal-maroon">Our Celebrations</h2>
                        <div className="flex items-center justify-center gap-4">
                            <div className="h-[1px] w-20 bg-royal-gold"></div>
                            <span className="text-royal-gold text-2xl">✦</span>
                            <div className="h-[1px] w-20 bg-royal-gold"></div>
                        </div>
                        <p className="text-royal-maroon/80 italic text-lg max-w-2xl mx-auto font-light">
                            &quot;Join us as we embark on this beautiful journey of love, accompanied by the blessings of our elders and the warmth of our friends.&quot;
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full justify-center justify-items-center">
                        {displayEvents.length > 0 ? (
                            displayEvents.map((subEvent) => (
                                <Link key={subEvent.id} href={`/events/${subEvent.id}`} className="group relative w-full aspect-[2/3] transition-transform duration-500 hover:-translate-y-2 hover:drop-shadow-2xl max-w-sm">
                                    {/* Mughal Arch Card */}
                                    <div
                                        className="relative w-full h-full overflow-hidden bg-royal-maroon border-[8px] border-royal-maroon box-border transition-colors duration-500 hover:border-royal-maroon-dark"
                                        style={{ borderRadius: "50% 50% 0 0 / 33.33% 33.33% 0 0" }}
                                    >
                                        {/* Background Image */}
                                        {subEvent.coverImage && (
                                            <Image
                                                src={subEvent.coverImage}
                                                alt={subEvent.title}
                                                fill
                                                className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                                            />
                                        )}

                                        {/* Thin Golden Inside Border */}
                                        <div
                                            className="absolute inset-[3px] border border-royal-gold/80 z-10 pointer-events-none"
                                            style={{ borderRadius: "50% 50% 0 0 / 33.33% 33.33% 0 0" }}
                                        ></div>

                                        {/* Overlay Gradient */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-royal-maroon via-royal-maroon/20 to-transparent opacity-90"></div>

                                        {/* Text Content */}
                                        <div className="absolute bottom-6 left-0 right-0 text-center z-20 px-4">
                                            <h3 className="text-2xl md:text-3xl font-serif text-royal-gold mb-1 drop-shadow-md">{subEvent.title}</h3>
                                            <div className="w-16 h-[1px] bg-royal-gold/60 mx-auto mb-2"></div>
                                            <span className="text-xs uppercase tracking-widest text-royal-cream/80 border border-royal-gold/30 px-3 py-1 rounded-full">
                                                View Details
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="col-span-full py-10 flex flex-col items-center justify-center text-center">
                                <div className="mb-4 text-royal-maroon/20">
                                    <svg className="w-16 h-16 opacity-50" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" /></svg>
                                </div>
                                <p className="text-royal-maroon/60 italic text-lg max-w-md mx-auto">
                                    No ceremonies have been added yet. Visit your dashboard to add events to this gallery.
                                </p>
                            </div>
                        )}
                    </div>
                </section>

                <footer className="py-12 text-center text-royal-maroon/40 text-sm uppercase tracking-widest bg-royal-gold/10">
                    {event.title} — {new Date().getFullYear()}
                </footer>
            </main>
        </div>
    );
}

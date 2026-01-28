import Link from "next/link";
import Image from "next/image";

const events = [
  { name: "Haldi", slug: "haldi", img: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767724606/7C0A9948_1_cwl7g6.jpg" },
  { name: "Mehendi", slug: "mehendi", img: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767692471/7C0A0649_kkwbbu.jpg" },
  { name: "Wedding", slug: "wedding", img: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767692961/0D2A5755_1_cipyfz.jpg" },
  { name: "Reception", slug: "reception", img: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767724545/VIS_5683_1_fx794l.jpg" },
];

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen font-sans bg-royal-cream text-royal-maroon disable-scroll-x">
      {/* Full Screen Hero Section */}
      <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="https://res.cloudinary.com/dkphvdlwk/image/upload/v1767722218/0D2A5838_2_cgepes.jpg"
            alt="Royal Couple"
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
            Samarth <span className="text-royal-gold mx-2 text-6xl md:text-8xl">&</span> Jyoti
          </h1>

          <p className="text-lg md:text-2xl text-royal-cream/90 font-light tracking-widest italic mt-6">
            November 18th, 2024 &bull; Dehradun, India
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
            "Join us as we embark on this beautiful journey of love, accompanied by the blessings of our elders and the warmth of our friends."
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full justify-center justify-items-center">
          {events.map((event) => (
            <Link key={event.slug} href={`/events/${event.slug}`} className="group relative w-full aspect-[2/3] transition-transform duration-500 hover:-translate-y-2 hover:drop-shadow-2xl max-w-sm">
              {/* Mughal Arch Shape Wrapper */}
              {/* Mughal Arch Card */}
              <div
                className="relative w-full h-full overflow-hidden bg-royal-maroon border-[8px] border-royal-maroon box-border transition-colors duration-500 hover:border-royal-maroon-dark"
                style={{ borderRadius: "50% 50% 0 0 / 33.33% 33.33% 0 0" }}
              >
                {/* Background Image */}
                <Image
                  src={event.img}
                  alt={event.name}
                  fill
                  className="object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                />

                {/* Thin Golden Inside Border */}
                <div
                  className="absolute inset-[3px] border border-royal-gold/80 z-10 pointer-events-none"
                  style={{ borderRadius: "50% 50% 0 0 / 33.33% 33.33% 0 0" }}
                ></div>

                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-royal-maroon via-royal-maroon/20 to-transparent opacity-90"></div>

                {/* Text Content */}
                <div className="absolute bottom-6 left-0 right-0 text-center z-20 px-4">
                  <h3 className="text-2xl md:text-3xl font-serif text-royal-gold mb-1 drop-shadow-md">{event.name}</h3>
                  <div className="w-16 h-[1px] bg-royal-gold/60 mx-auto mb-2"></div>
                  <span className="text-xs uppercase tracking-widest text-royal-cream/80 border border-royal-gold/30 px-3 py-1 rounded-full">
                    View Details
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

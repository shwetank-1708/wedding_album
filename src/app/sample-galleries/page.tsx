import Link from "next/link";
import Image from "next/image";

const albums = [
    {
        name: "Samarth & Jyoti Wedding",
        slug: "samarth-jyoti-wedding", // Keeping slug consistent with folder/routing for now if needed, or we can change this if we want to break legacy links
        category: "Wedding",
        year: "2024",
        coverImg: "https://res.cloudinary.com/dkphvdlwk/image/upload/v1767722218/0D2A5838_2_cgepes.jpg"
    },
    // We can add more placeholder albums here if needed to show "Sample Galleries" nature
];

export default function SampleGalleries() {
    return (
        <div className="min-h-screen bg-slate-50 py-24 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-20 space-y-4">
                    <h1 className="text-4xl md:text-5xl font-serif text-slate-800">Sample Galleries</h1>
                    <p className="text-slate-600 text-lg max-w-2xl mx-auto font-light">
                        Browse through our portfolio of beautiful stories.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                    {albums.map((album) => (
                        <Link key={album.slug} href={`/sample-galleries/${album.slug}`} className="group block bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1">
                            <div className="relative w-full aspect-[4/3] overflow-hidden">
                                <Image
                                    src={album.coverImg}
                                    alt={album.name}
                                    fill
                                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300"></div>
                            </div>

                            <div className="p-8">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-sky-600 text-sm font-bold uppercase tracking-widest">{album.category}</span>
                                    <span className="text-slate-500 text-sm font-serif italic">{album.year}</span>
                                </div>
                                <h3 className="text-2xl font-serif text-slate-800 mb-2 group-hover:text-sky-600 transition-colors">{album.name}</h3>
                                <div className="flex items-center text-slate-600 text-base font-medium mt-4 group-hover:translate-x-2 transition-transform duration-300">
                                    View Album <span className="ml-2">&rarr;</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

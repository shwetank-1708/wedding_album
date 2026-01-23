import { Navigation } from "@/components/ui/Navigation";
import { UploadCard } from "@/components/ui/UploadCard";

export default function FindMePage() {
    return (
        <main className="min-h-screen relative flex flex-col">
            <Navigation />

            {/* Background with overlay */}
            <div className="absolute inset-0 -z-10">
                <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1549417229-aa67d3263c09?w=1600&auto=format&fit=crop')] bg-cover bg-center" />
                <div className="absolute inset-0 bg-stone-900/80 backdrop-blur-sm" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center">
                <div className="space-y-4 mb-10 text-stone-100">
                    <p className="text-gold-400 tracking-[0.3em] text-sm uppercase font-semibold">
                        AI Photo Search
                    </p>
                    <h1 className="font-serif text-4xl md:text-5xl font-bold">
                        Find Your Photos
                    </h1>
                    <p className="text-stone-300 max-w-md mx-auto">
                        Upload a clear selfie, and our AI will magically find all your photos from the wedding events.
                    </p>
                </div>

                <UploadCard />
            </div>
        </main>
    );
}

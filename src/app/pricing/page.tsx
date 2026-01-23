import Link from "next/link";
import { Check } from "lucide-react";

const packages = [
    {
        name: "Essential",
        price: "₹50,000",
        description: "Perfect for intimate gatherings and small events.",
        features: [
            "4 Hours of Coverage",
            "1 Photographer",
            "200+ Edited High-Res Images",
            "Online Private Gallery",
            "Delivery within 2 Weeks"
        ],
        recommended: false
    },
    {
        name: "Premium",
        price: "₹1,20,000",
        description: "Our most popular package for full wedding days.",
        features: [
            "8 Hours of Coverage",
            "2 Photographers",
            "500+ Edited High-Res Images",
            "Cinematic Highlight Reels",
            "Printed Photo Album (20 pages)",
            "Drone Coverage (if venue permits)",
            "Delivery within 4 Weeks"
        ],
        recommended: true
    },
    {
        name: "Royal",
        price: "₹2,50,000",
        description: "The ultimate luxury experience for grand celebrations.",
        features: [
            "Full Day Coverage (12 Hours)",
            "3 Photographers + 2 Videographers",
            "Unlimited Edited Images",
            "Full Feature Wedding Film (20-30 mins)",
            "Premium Leather Album (40 pages)",
            "Pre-Wedding Shoot Included",
            "Same Day Edit Slideshow",
            "Priority Delivery (2 Weeks)"
        ],
        recommended: false
    }
];

export default function Pricing() {
    return (
        <div className="min-h-screen bg-slate-50 py-24 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16 space-y-4">
                    <h1 className="text-4xl md:text-5xl font-serif text-slate-800">Investment</h1>
                    <p className="text-slate-500 text-lg max-w-2xl mx-auto font-light">
                        Investing in memories is investing in your family's history. Simple, transparent pricing for every occasion.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {packages.map((pkg) => (
                        <div
                            key={pkg.name}
                            className={`relative bg-white rounded-2xl shadow-xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl flex flex-col ${pkg.recommended ? 'ring-2 ring-sky-500' : 'border border-slate-100'}`}
                        >
                            {pkg.recommended && (
                                <div className="bg-sky-500 text-white text-xs font-bold py-1 text-center uppercase tracking-widest">
                                    Most Popular
                                </div>
                            )}

                            <div className="p-8 flex-1 flex flex-col">
                                <h3 className="text-2xl font-serif font-bold text-slate-800 mb-2">{pkg.name}</h3>
                                <div className="flex items-baseline mb-4">
                                    <span className="text-4xl font-bold text-slate-900">{pkg.price}</span>
                                    <span className="ml-1 text-slate-400 font-light">/ event</span>
                                </div>
                                <p className="text-slate-500 font-light text-sm mb-6 min-h-[40px]">{pkg.description}</p>

                                <div className="w-full h-px bg-slate-100 mb-6"></div>

                                <ul className="space-y-4 mb-8 flex-1">
                                    {pkg.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start group">
                                            <div className={`p-1 rounded-full mr-3 shrink-0 ${pkg.recommended ? 'bg-sky-100 text-sky-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <Check className="w-3 h-3" />
                                            </div>
                                            <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Link href="/contact-us" className="block w-full mt-auto">
                                    <div className={`w-full py-4 text-center rounded-lg uppercase tracking-widest text-sm font-bold transition-all duration-300 ${pkg.recommended ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-md hover:shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'}`}>
                                        Choose {pkg.name}
                                    </div>
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-20 text-center bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-2xl font-serif text-slate-800 mb-3">Need something specific?</h3>
                    <p className="text-slate-500 mb-8 max-w-2xl mx-auto">
                        We understand that every event is unique. If you don't see a package that fits your needs, let's create a custom one just for you.
                    </p>
                    <Link href="/contact-us" className="inline-block">
                        <span className="text-sky-600 font-semibold border-b-2 border-transparent hover:border-sky-600 transition-all duration-300">
                            Contact Us for Custom Quote &rarr;
                        </span>
                    </Link>
                </div>
            </div>
        </div>
    );
}

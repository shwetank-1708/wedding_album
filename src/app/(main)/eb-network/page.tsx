"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Business,
  getBusinessTypeColor,
  getTopRatedBusinesses,
  toggleShortlistBusiness,
} from "@/lib/database";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Filter,
  Heart,
  Loader2,
  MapPin,
  Phone,
  Search,
  Share2,
  Star,
  Store,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { name: "All", matchers: ["All"] },
  { name: "Weddings", matchers: ["Wedding", "Weddings"] },
  { name: "Birthday", matchers: ["Birthday", "Birthdays"] },
  { name: "Corporate", matchers: ["Corporate"] },
  { name: "Sports", matchers: ["Sports"] },
  { name: "Venue", matchers: ["Venue"] },
  { name: "Photo", matchers: ["Photography", "Videography", "Photo", "Video"] },
  { name: "Food", matchers: ["Catering", "Food Stalls", "Food"] },
  { name: "Decor", matchers: ["Decor", "Lighting"] },
  { name: "Fashion", matchers: ["Apparel", "Makeup"] },
];

const CITY_OPTIONS = ["All Cities", "Near Me", "Dehradun", "Delhi", "Chennai"];
const SORT_OPTIONS = ["Rating", "Distance", "Name"];
const DISTANCE_OPTIONS = [5, 10, 20, 50, 100];
const DEFAULT_BUSINESS_COVER = "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800";

export default function MarketplaceComingSoonPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-24 text-white sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center justify-center text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-indigo-200">
          <Store className="h-4 w-4" />
          EB Network
        </div>
        <h1 className="max-w-3xl font-playfair text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
          Coming Soon
        </h1>
        <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-slate-300 sm:text-lg">
          EB Network will be a curated marketplace to discover trusted photographers, venues, decorators,
          makeup artists, caterers, planners, and event partners for your celebrations.
        </p>
        <div className="mt-10 grid w-full gap-4 text-left sm:grid-cols-3">
          {[
            { title: "Trusted Vendors", desc: "Explore event professionals across key categories.", icon: Briefcase },
            { title: "Smart Discovery", desc: "Find partners by service, location, and event need.", icon: Search },
            { title: "Event Ready", desc: "Shortlist and connect with vendors for your occasion.", icon: Heart },
          ].map(({ title, desc, icon: Icon }) => (
            <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-200">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-sm font-black uppercase tracking-widest text-white">{title}</h2>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getVendorLocation(business: Business) {
  return business.location?.address || "Local";
}

function getExperienceLabel(experience?: number) {
  return experience ? `${experience}+ Yrs Exp` : "Established";
}

// Preserved for the next EB Network rollout. Do not delete; this is the original full implementation.
export function LegacyMarketplacePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [vendors, setVendors] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("All Cities");
  const [sortBy, setSortBy] = useState("Rating");
  const [maxDistance, setMaxDistance] = useState(100);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [shortlistedIds, setShortlistedIds] = useState<Set<string>>(new Set());

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const businesses = await getTopRatedBusinesses(50);
      setVendors(businesses);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setSelectedLocation("Near Me");
        setDetecting(false);
      },
      () => setDetecting(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30 * 60 * 1000 }
    );
  };

  const handleShortlist = async (businessId: string) => {
    if (!user?.uid) return;
    setShortlistedIds(prev => {
      const next = new Set(prev);
      if (next.has(businessId)) next.delete(businessId);
      else next.add(businessId);
      return next;
    });
    await toggleShortlistBusiness(user.uid, businessId);
  };

  const filteredVendors = useMemo(() => {
    const category = CATEGORIES.find(item => item.name === selectedCategory);
    const matchers = category?.matchers || [selectedCategory];
    const query = search.trim().toLowerCase();

    const list = vendors.filter((vendor) => {
      const matchesCategory = selectedCategory === "All"
        || matchers.includes(vendor.type)
        || vendor.tags?.some(tag => matchers.includes(tag));

      const locationLabel = getVendorLocation(vendor);
      const matchesLocation = selectedLocation === "All Cities"
        || (selectedLocation === "Near Me" && !!userCoords)
        || locationLabel.toLowerCase().includes(selectedLocation.toLowerCase());

      let withinDistance = true;
      if (selectedLocation === "Near Me" && userCoords) {
        const distance = getDistance(userCoords.lat, userCoords.lng, vendor.location.latitude, vendor.location.longitude);
        withinDistance = distance <= maxDistance;
      }

      const matchesSearch = !query
        || vendor.name.toLowerCase().includes(query)
        || vendor.type.toLowerCase().includes(query)
        || locationLabel.toLowerCase().includes(query);

      return matchesCategory && matchesLocation && matchesSearch && withinDistance;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "Name") return a.name.localeCompare(b.name);
      if (sortBy === "Distance" && userCoords) {
        return getDistance(userCoords.lat, userCoords.lng, a.location.latitude, a.location.longitude)
          - getDistance(userCoords.lat, userCoords.lng, b.location.latitude, b.location.longitude);
      }
      return (b.rating || 0) - (a.rating || 0);
    });
  }, [vendors, selectedCategory, search, selectedLocation, userCoords, maxDistance, sortBy]);

  const featuredVendors = filteredVendors.slice(0, 3);
  const openVendorPage = (vendorId: string) => {
    router.push(`/eb-network/${vendorId}`);
  };

  return (
    <div className="min-h-screen bg-[#050505] pb-20 text-white">
      <header className="bg-gradient-to-br from-[#101010] to-[#050505] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-400/20 bg-indigo-400/10 text-indigo-300"
            aria-label="Shortlist"
          >
            <Heart className="h-5 w-5" />
          </button>
          <div className="text-center">
            <h1 className="text-3xl font-black tracking-tight">EB Network</h1>
            <p className="mt-1 text-sm font-bold text-slate-400">Elite Deals. Every Event.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowFilterModal(true)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-400/20 bg-indigo-400/10 text-indigo-300"
            aria-label="Filters"
          >
            <Filter className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 sm:px-6 lg:px-8">
        <section className="rounded-[1.5rem] border border-[#1f2937] bg-[#101010] p-3">
          <div className="flex items-center gap-3 rounded-[1.25rem] border border-[#1f2937] bg-[#050505] px-4 py-4">
            <Search className="h-5 w-5 text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search photographers, venues..."
              className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500"
            />
          </div>
        </section>

        <section className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((category) => {
            const active = selectedCategory === category.name;
            return (
              <button
                key={category.name}
                type="button"
                onClick={() => setSelectedCategory(category.name)}
                className={`shrink-0 rounded-2xl border px-4 py-3 text-sm font-black transition-colors ${
                  active
                    ? "border-indigo-300 bg-indigo-300 text-slate-950"
                    : "border-[#1f2937] bg-[#101010] text-slate-400 hover:border-indigo-400/50"
                }`}
              >
                {category.name}
              </button>
            );
          })}
        </section>

        <section
          onClick={() => router.push("/eb-business")}
          className="group relative cursor-pointer overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 to-indigo-900 p-8 shadow-2xl shadow-indigo-950/20"
        >
          <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 text-white/15 sm:block">
            <Briefcase className="h-24 w-24" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <div className="mb-4 inline-block rounded-lg bg-white/15 px-3 py-1 text-xs font-black uppercase tracking-widest text-indigo-100">
              For Owners
            </div>
            <h2 className="text-3xl font-black">Promote Your Business</h2>
            <p className="mt-2 max-w-lg font-semibold leading-7 text-indigo-100">
              Reach thousands of event organizers and grow your brand today.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-[#1e1b4b] px-5 py-3 text-sm font-black text-white">
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-300" />
          </div>
        ) : (
          <>
            {featuredVendors.length > 0 && (
              <section className="space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black text-white">Featured Vendors</h2>
                  <button type="button" onClick={() => setSelectedCategory("All")} className="text-sm font-black text-indigo-300">
                    View All
                  </button>
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  {featuredVendors.map((vendor) => (
                    <VendorCard
                      key={vendor.id}
                      vendor={vendor}
                      shortlisted={shortlistedIds.has(vendor.id)}
                      onShortlist={() => handleShortlist(vendor.id)}
                      onOpen={() => openVendorPage(vendor.id)}
                      featured
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-5">
              <h2 className="text-2xl font-black text-white">{selectedCategory === "All" ? "Explore All" : `Best ${selectedCategory}`}</h2>
              {filteredVendors.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-[#1f2937] p-12 text-center">
                  <Search className="mx-auto mb-4 h-10 w-10 text-slate-600" />
                  <p className="text-lg font-black">No vendors found</p>
                  <p className="mt-2 text-sm font-semibold text-slate-400">Try changing the category, location, or search text.</p>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {filteredVendors.map((vendor) => (
                    <VendorListCard
                      key={vendor.id}
                      vendor={vendor}
                      shortlisted={shortlistedIds.has(vendor.id)}
                      onShortlist={() => handleShortlist(vendor.id)}
                      onOpen={() => openVendorPage(vendor.id)}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <AnimatePresence>
        {showFilterModal && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-2xl rounded-[2rem] border border-[#1f2937] bg-[#101010] p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-2xl font-black text-white">Sort & Filter</h3>
                <button type="button" onClick={() => setShowFilterModal(false)} className="rounded-full bg-[#050505] p-2 text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-widest text-indigo-300">Select City</p>
                    <button type="button" onClick={detectLocation} className="flex items-center gap-2 rounded-full bg-indigo-400/10 px-3 py-2 text-xs font-black text-indigo-300">
                      {detecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                      <span>{detecting ? "Detecting..." : "Near Me"}</span>
                    </button>
                  </div>
                  <ChipGroup options={CITY_OPTIONS} value={selectedLocation} onChange={setSelectedLocation} />
                </div>

                {selectedLocation === "Near Me" && (
                  <div>
                    <p className="mb-3 text-xs font-black uppercase tracking-widest text-indigo-300">Distance Radius</p>
                    <ChipGroup options={DISTANCE_OPTIONS.map(item => `${item}km`)} value={`${maxDistance}km`} onChange={(value) => setMaxDistance(Number(value.replace("km", "")))} />
                  </div>
                )}

                <div>
                  <p className="mb-3 text-xs font-black uppercase tracking-widest text-indigo-300">Sort By</p>
                  <ChipGroup options={SORT_OPTIONS} value={sortBy} onChange={setSortBy} />
                </div>

                <button type="button" onClick={() => setShowFilterModal(false)} className="w-full rounded-2xl bg-indigo-400 px-5 py-4 text-sm font-black text-slate-950">
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

function ChipGroup({ options, value, onChange }: { options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-full border px-4 py-2 text-sm font-black ${
            value === option
              ? "border-indigo-300 bg-indigo-300 text-slate-950"
              : "border-[#1f2937] bg-[#050505] text-slate-300"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function VendorCard({ vendor, shortlisted, onShortlist, onOpen, featured = false }: {
  vendor: Business;
  shortlisted: boolean;
  onShortlist: () => void;
  onOpen: () => void;
  featured?: boolean;
}) {
  const typeColors = getBusinessTypeColor(vendor.type);
  const image = vendor.coverImage || DEFAULT_BUSINESS_COVER;
  return (
    <article onClick={onOpen} className="cursor-pointer overflow-hidden rounded-[1.75rem] border border-[#1f2937] bg-[#101010] shadow-xl shadow-black/10">
      <div className={`${featured ? "h-56" : "h-44"} relative bg-[#050505]`}>
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 blur-xl" />
        <img src={image} alt={vendor.name} className="relative h-full w-full object-contain" />
        <button type="button" onClick={(event) => { event.stopPropagation(); onShortlist(); }} className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-950/70 text-white backdrop-blur">
          <Heart className={`h-5 w-5 ${shortlisted ? "fill-rose-500 text-rose-500" : ""}`} />
        </button>
        <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full border border-white/15 bg-slate-950/70 px-3 py-1 text-sm font-black backdrop-blur">
          <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
          <span>{vendor.rating || 0}</span>
        </div>
      </div>
      <div className="space-y-3 p-5">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-lg font-black text-white">{vendor.name}</h3>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-400" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border px-3 py-1 text-xs font-black uppercase" style={{ backgroundColor: typeColors.bg, borderColor: typeColors.border, color: typeColors.text }}>
            {vendor.type}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-xs font-bold text-slate-400">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{getVendorLocation(vendor)}</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-[#1f2937] px-3 py-1 text-xs font-black text-slate-300">{getExperienceLabel(vendor.experience)}</span>
          <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }} className="rounded-full bg-indigo-400 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-950">
            Details
          </button>
        </div>
      </div>
    </article>
  );
}

function VendorListCard(props: {
  vendor: Business;
  shortlisted: boolean;
  onShortlist: () => void;
  onOpen: () => void;
}) {
  const { vendor, shortlisted, onShortlist, onOpen } = props;
  const typeColors = getBusinessTypeColor(vendor.type);
  const image = vendor.coverImage || DEFAULT_BUSINESS_COVER;
  return (
    <article onClick={onOpen} className="flex cursor-pointer flex-col overflow-hidden rounded-[1.75rem] border border-[#1f2937] bg-[#101010] sm:flex-row">
      <div className="relative h-48 bg-[#050505] sm:h-auto sm:w-44">
        <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 blur-xl" />
        <img src={image} alt={vendor.name} className="relative h-full w-full object-contain" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-5">
        <div>
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-xl font-black text-white">{vendor.name}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border px-3 py-1 text-xs font-black uppercase" style={{ backgroundColor: typeColors.bg, borderColor: typeColors.border, color: typeColors.text }}>
                  {vendor.type}
                </span>
                <CheckCircle2 className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            <button type="button" onClick={(event) => { event.stopPropagation(); onShortlist(); }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#1f2937] bg-[#050505] text-white">
              <Heart className={`h-5 w-5 ${shortlisted ? "fill-rose-500 text-rose-500" : ""}`} />
            </button>
          </div>
          <div className="flex flex-wrap gap-3 text-sm font-bold text-slate-400">
            <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{getVendorLocation(vendor)}</span>
            <span className="flex items-center gap-1"><Calendar className="h-4 w-4 text-amber-300" />{getExperienceLabel(vendor.experience)}</span>
            <span className="flex items-center gap-1"><Star className="h-4 w-4 fill-amber-300 text-amber-300" />{vendor.rating || 0}</span>
          </div>
        </div>
        <button type="button" onClick={(event) => { event.stopPropagation(); onOpen(); }} className="flex w-fit items-center gap-2 rounded-full border border-indigo-400/30 px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-300">
          <span>View Details</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

function VendorDetailModal({ vendor, shortlisted, onClose, onShortlist }: {
  vendor: Business;
  shortlisted: boolean;
  onClose: () => void;
  onShortlist: () => void;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("About");
  const typeColors = getBusinessTypeColor(vendor.type);
  const galleryImages = vendor.coverImages && vendor.coverImages.length > 0 ? vendor.coverImages : [vendor.coverImage || DEFAULT_BUSINESS_COVER];

  const handleShare = async () => {
    const text = `Check out ${vendor.name} on EB Network`;
    if (navigator.share) {
      await navigator.share({ title: vendor.name, text });
    } else {
      await navigator.clipboard?.writeText(text);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }} className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-[#1f2937] bg-[#101010] shadow-2xl">
        <div className="relative h-80 bg-[#050505]">
          <img src={galleryImages[0]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 blur-xl" />
          <img src={galleryImages[0]} alt={vendor.name} className="relative h-full w-full object-contain" />
          <div className="absolute left-5 right-5 top-5 flex justify-between">
            <button type="button" onClick={onClose} className="rounded-full bg-slate-950/70 p-3 text-white backdrop-blur">
              <X className="h-5 w-5" />
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={handleShare} className="rounded-full bg-slate-950/70 p-3 text-white backdrop-blur">
                <Share2 className="h-5 w-5" />
              </button>
              <button type="button" onClick={onShortlist} className="rounded-full bg-slate-950/70 p-3 text-white backdrop-blur">
                <Heart className={`h-5 w-5 ${shortlisted ? "fill-rose-500 text-rose-500" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <div>
            <h2 className="text-3xl font-black text-white">{vendor.name}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border px-3 py-1 text-xs font-black uppercase" style={{ backgroundColor: typeColors.bg, borderColor: typeColors.border, color: typeColors.text }}>
                {vendor.type}
              </span>
              {vendor.vendorCode && (
                <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs font-black text-sky-300">
                  Code: {vendor.vendorCode}
                </span>
              )}
              <span className="flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1 text-xs font-black text-amber-300">
                <Star className="h-3.5 w-3.5 fill-amber-300" />
                {vendor.rating || 0}
              </span>
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm font-bold text-slate-400">
              <MapPin className="h-4 w-4" />
              {getVendorLocation(vendor)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Highlight title="Experience" value={getExperienceLabel(vendor.experience)} />
            <Highlight title="Events" value={`${vendor.eventsHosted || 0}`} />
            <Highlight title="Shortlists" value={`${vendor.shortlistCount || 0}`} />
          </div>

          <div className="flex overflow-x-auto rounded-2xl border border-[#1f2937] bg-[#050505] p-1">
            {["About", "Portfolio", "Announcements", "Reviews"].map((tab) => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`min-w-0 flex-1 rounded-xl px-4 py-3 text-sm font-black ${activeTab === tab ? "bg-indigo-400 text-slate-950" : "text-slate-400"}`}>
                {tab}
              </button>
            ))}
          </div>

          {activeTab === "About" && (
            <div className="space-y-5">
              <section>
                <h3 className="mb-2 text-xl font-black text-white">About</h3>
                <p className="leading-7 text-slate-300">
                  {vendor.description || `Experience the exceptional services of ${vendor.name}. With a focus on quality and client satisfaction, they bring your vision to life with professional expertise in ${vendor.type.toLowerCase()}.`}
                </p>
              </section>
              {vendor.services && vendor.services.length > 0 && (
                <section>
                  <h3 className="mb-3 text-xl font-black text-white">Services Offered</h3>
                  <div className="flex flex-wrap gap-2">
                    {vendor.services.map((service) => (
                      <span key={service} className="rounded-full bg-indigo-400/10 px-3 py-1 text-sm font-bold text-indigo-200">{service}</span>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === "Portfolio" && (
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-black text-white">Portfolio</h3>
                <span className="text-sm font-black text-indigo-300">{vendor.portfolioEvents?.length || 0} Events</span>
              </div>
              {vendor.portfolioEvents && vendor.portfolioEvents.length > 0 ? (
                <div className="space-y-5">
                  {vendor.portfolioEvents.map((portfolio) => (
                    <button
                      key={portfolio.id}
                      type="button"
                      onClick={() => router.push(`/eb-network/${vendor.id}/portfolio/${portfolio.id}?returnTo=${encodeURIComponent("/eb-network")}`)}
                      className="block w-full overflow-hidden rounded-[1.5rem] border border-[#1f2937] bg-[#050505] text-left"
                    >
                      <div className="relative h-56 bg-black">
                        <img src={portfolio.coverImage || DEFAULT_BUSINESS_COVER} alt={portfolio.name} className="h-full w-full object-cover" />
                        <div className="absolute left-4 top-4 rounded-lg border border-amber-300/30 bg-black/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">
                          {portfolio.type}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-black p-4">
                          <h4 className="truncate text-lg font-bold" style={{ color: "#ffffff" }}>{portfolio.name}</h4>
                          <p className="mt-2 flex items-center gap-2 text-xs font-bold text-[#94a3b8]">
                            <Calendar className="h-3.5 w-3.5 text-[#facc15]" />
                            {new Date(portfolio.date).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between px-4 py-3 text-sm font-bold text-slate-400">
                        <span>{portfolio.media?.length || 0} images</span>
                        <span className="text-indigo-300">Open gallery</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyDetail title="No portfolio events yet" />
              )}
            </section>
          )}

          {activeTab === "Announcements" && (
            <section>
                <h3 className="mb-4 text-xl font-black text-white">Announcements ({vendor.announcements?.length || 0})</h3>
              {vendor.announcements && vendor.announcements.length > 0 ? (
                <div className="space-y-3">
                  {vendor.announcements.map((announcement, index) => (
                    <div key={`${announcement}-${index}`} className="rounded-2xl border border-[#1f2937] bg-[#050505] p-4">
                      <p className="text-sm font-bold text-slate-300">{announcement}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyDetail title="No announcements yet" />
              )}
            </section>
          )}

          {activeTab === "Reviews" && (
            <section>
              <h3 className="mb-4 text-xl font-black text-white">What Clients Say</h3>
              <EmptyDetail title="Reviews are not available on web yet" />
            </section>
          )}

          <div className="sticky bottom-0 -mx-6 -mb-6 grid gap-3 border-t border-[#1f2937] bg-[#101010]/95 p-6 sm:grid-cols-2">
            <a href={`tel:${vendor.ownerPhone}`} className="flex items-center justify-center gap-2 rounded-2xl border border-[#1f2937] px-5 py-4 font-black text-white">
              <Phone className="h-5 w-5" />
              <span>Call Directly</span>
            </a>
            <a href={`mailto:${vendor.ownerEmail}`} className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-4 font-black text-slate-950">
              <Store className="h-5 w-5" />
              <span>Contact Now</span>
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Highlight({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#1f2937] bg-[#050505] p-4">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{title}</p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function EmptyDetail({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#1f2937] p-8 text-center text-slate-400">
      <p className="font-black text-white">{title}</p>
    </div>
  );
}

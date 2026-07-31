"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Business,
  createBusiness,
  generateShortId,
  getBusinessTypeColor,
  getUserBusinesses,
  getUserTotalStorage,
  updateBusiness,
} from "@/lib/database";
import { formatStorageSize } from "@/lib/planLimits";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  LocateFixed,
  Plus,
  Server,
  Store,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { uploadEventImage } from "@/lib/storage";

const BUSINESS_TYPES = [
  "Anchors", "Apparel", "Catering", "Decor", "Event Planner",
  "Food Stalls", "Gifts", "Invitations", "Lighting", "Makeup",
  "Music & DJ", "Photography", "Security", "Staff", "Travel",
  "Trophies", "Venue", "Videography",
];

const BENEFITS = [
  { title: "Reach Event Organizers", desc: "Connect with people planning sports tournaments, corporate meets, weddings, and celebrations.", icon: Users },
  { title: "Smart Analytics", desc: "Track your profile views, enquiries, shortlists, rating, and growth from one place.", icon: BarChart3 },
  { title: "Premium Portfolio", desc: "Showcase your work to a diverse audience with high-resolution business galleries.", icon: ImageIcon },
];

const DEFAULT_BUSINESS_COVER = "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=800";

export default function BizHubComingSoonPage() {
  return (
    <main className="min-h-screen bg-[#050505] px-4 py-24 text-white sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center justify-center text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-indigo-200">
          <Store className="h-4 w-4" />
          EB Business
        </div>
        <h1 className="max-w-3xl font-playfair text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
          Coming Soon
        </h1>
        <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-slate-300 sm:text-lg">
          EB Business will help event vendors and service providers create a polished business profile,
          showcase portfolios, receive enquiries, and connect with people planning memorable celebrations.
        </p>
        <div className="mt-10 grid w-full gap-4 text-left sm:grid-cols-3">
          {[
            { title: "Business Profiles", desc: "Create a premium listing for your event service.", icon: Store },
            { title: "Portfolio Showcase", desc: "Present your best work through elegant galleries.", icon: ImageIcon },
            { title: "Growth Tools", desc: "Track enquiries, visibility, and audience interest.", icon: BarChart3 },
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

function getBusinessLimit(role?: string | null) {
  if (role === "premium" || role === "elite" || role === "admin") return Infinity;
  if (role === "standard") return 5;
  return 1;
}

// Preserved for the next EB Business rollout. Do not delete; this is the original full implementation.
export function LegacyBizHubPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [fetching, setFetching] = useState(true);
  const [storageUsed, setStorageUsed] = useState(0);
  const [showListingForm, setShowListingForm] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [locating, setLocating] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [description, setDescription] = useState("");
  const [startedDate, setStartedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eventsHosted, setEventsHosted] = useState("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");

  useEffect(() => {
    if (!user) return;
    setOwnerName(user.name || "");
    setOwnerEmail(user.email || "");
    setOwnerPhone(user.phone || "");
  }, [user]);

  const fetchBusinesses = async () => {
    if (!user) return;
    setFetching(true);
    try {
      const identifiers = [user.uid];
      if (user.email) identifiers.push(user.email);
      if (user.phone) identifiers.push(user.phone);
      const [userBusinesses, storage] = await Promise.all([
        getUserBusinesses(user.uid),
        getUserTotalStorage(identifiers),
      ]);
      setBusinesses(userBusinesses);
      setStorageUsed(storage);
    } catch (error) {
      console.error("Error fetching businesses:", error);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!loading && user) {
      fetchBusinesses();
    }
  }, [loading, user]);

  const resetForm = () => {
    setName("");
    setOwnerName(user?.name || "");
    setOwnerEmail(user?.email || "");
    setOwnerPhone(user?.phone || "");
    setBusinessType("");
    setDescription("");
    setStartedDate(new Date().toISOString().slice(0, 10));
    setEventsHosted("");
    setLocation(null);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview("");
    setMessage("");
  };

  const handleCoverSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessageType("error");
      setMessage("Please select an image file.");
      return;
    }

    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setMessage("");
  };

  const removeCoverSelection = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview("");
  };

  const handleGetLocation = async () => {
    if (!navigator.geolocation) {
      setMessageType("error");
      setMessage("Location is not available in this browser.");
      return;
    }

    setLocating(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address: `${position.coords.latitude.toFixed(4)}°, ${position.coords.longitude.toFixed(4)}°`,
        };
        setLocation(coords);
        setLocating(false);
      },
      (error) => {
        setMessageType("error");
        setMessage(error.message || "Could not fetch your location. Please check location permission.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 30 * 60 * 1000 }
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    if (!name.trim() || !ownerName.trim() || !ownerEmail.trim() || !ownerPhone.trim() || !businessType) {
      setMessageType("error");
      setMessage("Please fill in all basic fields.");
      return;
    }

    const maxBusinesses = getBusinessLimit(user.role);
    if (businesses.length >= maxBusinesses) {
      setMessageType("error");
      setMessage("You have reached your business listing limit for this plan.");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const start = new Date(startedDate);
      const experience = Number.isNaN(start.getTime())
        ? 0
        : Math.max(0, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25)));
      let coverImage = DEFAULT_BUSINESS_COVER;

      if (coverFile) {
        setMessageType("success");
        setMessage("Uploading business cover...");
        const upload = await uploadEventImage(coverFile, `business-cover-${Date.now()}`, user.uid);
        coverImage = upload.url;
      }

      const result = await createBusiness({
        name: name.trim(),
        ownerName: ownerName.trim(),
        ownerEmail: ownerEmail.trim(),
        ownerPhone: ownerPhone.trim(),
        type: businessType,
        tags: [],
        location: location || { latitude: 0, longitude: 0 },
        description: description.trim(),
        startedDate: start,
        experience,
        eventsHosted: Number.parseInt(eventsHosted, 10) || 0,
        rating: 0,
        coverImage,
        coverImages: [coverImage],
        createdBy: user.uid,
        status: "created",
        shortId: generateShortId(),
      });

      if (!result) throw new Error("Failed to create business.");

      setMessageType("success");
      setMessage("Your business has been created.");
      await fetchBusinesses();
      setTimeout(() => {
        setShowListingForm(false);
        resetForm();
      }, 1000);
    } catch (error) {
      console.error("Error creating business:", error);
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Failed to create business.");
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (business: Business) => {
    const nextStatus = business.status === "published" ? "created" : "published";
    setBusinesses(prev => prev.map(item => item.id === business.id ? { ...item, status: nextStatus } : item));
    const success = await updateBusiness(business.id, { status: nextStatus });
    if (!success) {
      setBusinesses(prev => prev.map(item => item.id === business.id ? { ...item, status: business.status } : item));
    }
  };

  const maxBusinesses = getBusinessLimit(user?.role);
  const businessPercent = maxBusinesses === Infinity ? 0 : Math.min(100, Math.round((businesses.length / maxBusinesses) * 100));
  const activePlanName = useMemo(() => {
    const role = user?.role || "free";
    if (role === "free" || role === "freemium") return "Freemium";
    return role.charAt(0).toUpperCase() + role.slice(1);
  }, [user?.role]);

  if (loading || fetching) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-[#818cf8]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="grid grid-cols-[3rem_1fr_3rem] items-center gap-4 py-2">
          <button
            type="button"
            onClick={() => setShowQuotaModal(true)}
            aria-label="Plan Details"
            title="Plan Details"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-400/20 bg-indigo-400/10 text-[#818cf8] transition-colors hover:border-indigo-300/50 hover:bg-indigo-400/15"
          >
            <Server className="h-5 w-5" />
          </button>

          <div className="min-w-0 text-center">
            <h1 className="font-playfair text-3xl font-black tracking-tight text-white sm:text-4xl">Create Your Business on EveBash</h1>
            <p className="mt-1 text-sm font-bold text-slate-400 sm:text-base">Create, manage, and grow your business presence.</p>
          </div>

          <button
            type="button"
            onClick={() => setShowListingForm(true)}
            aria-label="Create Business"
            title="Create Business"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-indigo-400/20 bg-indigo-400/10 text-[#818cf8] transition-colors hover:border-indigo-300/50 hover:bg-indigo-400/15"
          >
            <Plus className="h-7 w-7" />
          </button>
        </header>

        {businesses.length > 0 ? (
          <section className="space-y-5">
            <h2 className="text-2xl font-black text-white">Your EB Business Profiles</h2>
            <div className="space-y-4">
              {businesses.map((business) => {
                const typeColors = getBusinessTypeColor(business.type);
                return (
                  <article
                    key={business.id}
                    onClick={() => router.push(`/eb-business/${business.id}`)}
                    className="group flex cursor-pointer items-center gap-4 rounded-[1.25rem] border border-slate-800 bg-slate-900/80 p-3 transition-colors hover:border-indigo-400/30 hover:bg-slate-900"
                  >
                    <div className="relative h-32 w-40 shrink-0 overflow-hidden rounded-2xl bg-slate-950 sm:h-36 sm:w-48">
                      <img src={business.coverImage || DEFAULT_BUSINESS_COVER} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 blur-xl" />
                      <img src={business.coverImage || DEFAULT_BUSINESS_COVER} alt={business.name} className="relative h-full w-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-black text-white sm:text-xl">{business.name}</h3>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-lg border px-3 py-1 text-[11px] font-black uppercase tracking-wider"
                          style={{ backgroundColor: typeColors.bg, borderColor: typeColors.border, color: typeColors.text }}
                        >
                          {business.type}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#cbd5e1]">
                          <span className={`h-2 w-2 rounded-full ${business.status === "published" ? "bg-emerald-400" : "bg-amber-400"}`} />
                          {business.status}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            togglePublish(business);
                          }}
                          className="rounded-full bg-indigo-400 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#101010]"
                        >
                          {business.status === "published" ? "Unpublish Listing" : "Publish to EB Network"}
                        </button>
                      </div>
                    </div>
                    <ChevronRight className="hidden h-5 w-5 shrink-0 text-[#475569] transition-colors group-hover:text-[#818cf8] sm:block" />
                  </article>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="overflow-hidden rounded-b-[2.5rem] border border-slate-800 bg-gradient-to-br from-[#101010] to-[#050505] p-8 shadow-2xl shadow-black/20 sm:p-10">
            <div className="max-w-2xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-400/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-[#a5b4fc]">
                <Store className="h-4 w-4" />
                Partner Hub
              </div>
              <h2 className="text-4xl font-black text-white">Grow Your Business</h2>
              <p className="mt-3 text-base font-semibold leading-7 text-[#94a3b8]">
                Connect with event organizers, showcase your premium portfolio, and track your growth with elite analytics.
              </p>
              <button
                type="button"
                onClick={() => setShowListingForm(true)}
                className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-4 text-base font-black text-white shadow-lg shadow-indigo-950/30 sm:w-auto sm:px-7"
              >
                <span>List New Business</span>
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        <section className="space-y-5">
          <h2 className="text-2xl font-black text-white">Why Partner With Us?</h2>
          <div className="grid gap-3">
            {BENEFITS.map(({ title, desc, icon: Icon }) => (
              <div key={title} className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-400/10 text-[#a5b4fc]">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-black text-white">{title}</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {showQuotaModal && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} className="w-full max-w-lg rounded-[2rem] border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-400/10 text-[#818cf8]">
                    <Server className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white">Storage & Quota</h3>
                    <p className="text-sm font-semibold text-slate-400">Your current plan usage</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowQuotaModal(false)} className="rounded-full bg-slate-800 p-2 text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-5 text-sm font-bold text-slate-300">
                Active plan: <span className="text-[#a5b4fc]">{activePlanName}</span>
              </p>
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex justify-between text-sm font-black">
                    <span>Storage</span>
                    <span>{formatStorageSize(storageUsed)} / 5 GB</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-indigo-400" style={{ width: `${Math.min((storageUsed / (5 * 1024 * 1024 * 1024)) * 100, 100)}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex justify-between text-sm font-black">
                    <span>Businesses</span>
                    <span>{businesses.length} / {maxBusinesses === Infinity ? "∞" : maxBusinesses}</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-indigo-400" style={{ width: `${businessPercent}%` }} />
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => router.push("/profile")} className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-5 py-3 text-sm font-black text-[#101010]">
                <span>Manage Plan</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showListingForm && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.96 }} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-slate-800 bg-slate-900 shadow-2xl">
              <form onSubmit={handleSubmit} className="space-y-5 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-black text-white">Business Details</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-400">Create your partner profile.</p>
                  </div>
                  <button type="button" onClick={() => { setShowListingForm(false); resetForm(); }} className="rounded-full bg-slate-800 p-2 text-slate-400">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid gap-4">
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#a5b4fc]">Business Name *</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Royal Photography" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#a5b4fc]">Owner Name *</span>
                    <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="e.g. John Doe" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400 placeholder:text-[#475569]" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#a5b4fc]">Email *</span>
                    <input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="email@example.com" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400 placeholder:text-[#475569]" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#a5b4fc]">Phone *</span>
                    <input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="+91..." className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400 placeholder:text-[#475569]" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#a5b4fc]">Business Type *</span>
                    <button type="button" onClick={() => setShowCategoryPicker(true)} className="flex w-full items-center justify-between rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-left text-white">
                    <span className={businessType ? "" : "text-[#475569]"}>{businessType || "Select Category"}</span>
                      <ChevronDown className="h-4 w-4 text-[#a5b4fc]" />
                    </button>
                  </label>

                  <div className="block">
                    <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#a5b4fc]">Business Cover Image</span>
                    <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
                    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="relative flex aspect-[16/9] w-full items-center justify-center overflow-hidden text-[#94a3b8]"
                      >
                        {coverPreview ? (
                          <>
                            <img src={coverPreview} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30 blur-xl" />
                            <img src={coverPreview} alt="Selected business cover" className="relative h-full w-full object-contain" />
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <ImageIcon className="h-9 w-9 text-[#818cf8]" />
                            <span className="text-sm font-black">Add a cover image for your business</span>
                          </div>
                        )}
                      </button>
                      <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-4 py-3">
                        <p className="min-w-0 truncate text-xs font-semibold text-[#94a3b8]">
                          {coverFile ? coverFile.name : "Optional. Used as the business thumbnail."}
                        </p>
                        <div className="flex shrink-0 gap-2">
                          {coverPreview && (
                            <button type="button" onClick={removeCoverSelection} className="rounded-full border border-rose-400/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-300">
                              Remove
                            </button>
                          )}
                          <button type="button" onClick={() => coverInputRef.current?.click()} className="rounded-full border border-indigo-400/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#a5b4fc]">
                            {coverPreview ? "Change" : "Add"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#a5b4fc]">Business Experience</span>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#a5b4fc]">Started</span>
                      <input type="date" value={startedDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setStartedDate(e.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#a5b4fc]">Events Done</span>
                      <input type="number" min="0" value={eventsHosted} onChange={(e) => setEventsHosted(e.target.value)} placeholder="Events Done" className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400 placeholder:text-[#475569]" />
                    </label>
                  </div>
                </div>

                <label className="block">
                  <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#a5b4fc]">About Business</span>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description of your services..." className="min-h-28 w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-indigo-400" />
                </label>

                <div>
                  <span className="mb-2 block text-xs font-black uppercase tracking-widest text-[#a5b4fc]">Pinpoint Location (Optional)</span>
                  <button type="button" onClick={handleGetLocation} disabled={locating} className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black ${location ? "border-indigo-400 bg-indigo-400 text-[#101010]" : "border-slate-800 bg-slate-950 text-[#a5b4fc]"}`}>
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : location ? <Check className="h-4 w-4" /> : <LocateFixed className="h-4 w-4" />}
                    <span>{location ? `Captured: ${location.address}` : "Use Current GPS"}</span>
                  </button>
                </div>

                {message && (
                  <div className={`rounded-2xl border p-4 text-center text-sm font-bold ${messageType === "error" ? "border-rose-500/30 bg-rose-950/40 text-rose-300" : "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"}`}>
                    {message}
                  </div>
                )}

                <button type="submit" disabled={saving} className="flex w-full items-center justify-center rounded-2xl bg-indigo-400 px-5 py-4 text-sm font-black text-[#101010] disabled:opacity-70">
                  {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Business"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCategoryPicker && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="w-full max-w-md rounded-[2rem] border border-slate-800 bg-slate-900 p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-black text-white">Select Category</h3>
                <button type="button" onClick={() => setShowCategoryPicker(false)} className="rounded-full bg-slate-800 p-2 text-slate-400">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {BUSINESS_TYPES.map((item) => (
                  <button key={item} type="button" onClick={() => { setBusinessType(item); setShowCategoryPicker(false); }} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-black ${businessType === item ? "border-indigo-400 bg-indigo-400/10 text-[#a5b4fc]" : "border-slate-800 bg-slate-950 text-[#cbd5e1]"}`}>
                    <span>{item}</span>
                    {businessType === item && <Check className="h-4 w-4 text-[#818cf8]" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

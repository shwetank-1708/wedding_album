"use client";

import React, { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    AlertCircle,
    BarChart3,
    Calendar,
    Camera,
    CheckCircle2,
    Gift,
    Heart,
    Loader2,
    Lock,
    LogOut,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Sparkles,
    Upload,
    User,
    Users,
    X,
    XCircle,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { uploadProfileImageToBackblaze } from "@/app/actions/userActions";
import {
    getApprovedSharedEventsForUser,
    getUserEventCount,
    getUserPhotosCount,
    getUserTotalStorage,
    isValidUsername,
    isUsernameUnique,
    updateUserPrivacy,
    updateUserProfile,
    updateUserProfileImage,
} from "@/lib/database";
import { supabase } from "@/lib/supabase";
import { getPlanDetails } from "@/lib/planLimits";
import { getSubscriptionStatus } from "@/lib/subscriptionStatus";
import { cn } from "@/lib/utils";

const personaOptions = ["Guest", "Host / Organizer", "Vendor / Business"];
const genderOptions = ["Male", "Female", "Other", "Prefer not to say"];
const relationshipOptions = ["Single", "Engaged", "Married", "Prefer not to say"];

function formatBytes(bytes: number) {
    if (!bytes) return "0 KB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatJoinedDate(value: any) {
    if (!value) return "Not available";
    const date = typeof value?.toDate === "function"
        ? value.toDate()
        : value?.seconds
            ? new Date(value.seconds * 1000)
            : new Date(value);

    if (Number.isNaN(date.getTime())) return "Not available";
    return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatPlanDate(value?: string | null) {
    if (!value) return "Not set";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "Not set";

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

function getPersonasArray(value: any): string[] {
    if (!value) return ["Guest"];
    let raw: any[] = [];

    if (Array.isArray(value)) {
        raw = value;
    } else if (typeof value === "string" && value.trim().startsWith("[")) {
        try {
            const parsed = JSON.parse(value);
            raw = Array.isArray(parsed) ? parsed : [value];
        } catch {
            raw = [value];
        }
    } else if (typeof value === "string" && value.includes(",")) {
        raw = value.split(",");
    } else {
        raw = [value];
    }

    const normalized = raw.map((item: any) => String(item).trim()).filter(Boolean);
    const mapped = normalized.map((item: string) => {
        const clean = item.toLowerCase();
        if (clean.includes("host") || clean.includes("organizer")) return "Host / Organizer";
        if (clean.includes("vendor") || clean.includes("business")) return "Vendor / Business";
        return "Guest";
    });

    return Array.from(new Set(mapped.length ? mapped : ["Guest"]));
}

function InfoRow({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-4 border-b border-slate-800 px-1 py-4 last:border-b-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-300 ring-1 ring-yellow-400/20">
                <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
                <div className="mt-1 text-sm font-bold text-slate-100">{children}</div>
            </div>
        </div>
    );
}

function VerificationBadge({ verified, missing, missingText }: { verified: boolean; missing: boolean; missingText: string }) {
    if (missing) {
        return (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-amber-200">
                <AlertCircle className="h-3 w-3" />
                {missingText}
            </span>
        );
    }

    return (
        <span className={cn(
            "mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em]",
            verified
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                : "border-rose-400/25 bg-rose-400/10 text-rose-200"
        )}>
            {verified ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {verified ? "Verified" : "Not verified"}
        </span>
    );
}

export default function ProfilePage() {
    const { user, loading: authLoading, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [storageUsed, setStorageUsed] = useState(0);
    const [photosCount, setPhotosCount] = useState(0);
    const [eventCount, setEventCount] = useState(0);
    const [joinedCount, setJoinedCount] = useState(0);
    const [loadingStats, setLoadingStats] = useState(true);
    const [profileImage, setProfileImage] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [removingImage, setRemovingImage] = useState(false);
    const [isPrivate, setIsPrivate] = useState(false);
    const [updatingPrivacy, setUpdatingPrivacy] = useState(false);

    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");
    const [saveError, setSaveError] = useState("");
    const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
    const [verification, setVerification] = useState({ email: false, phone: false });
    const [form, setForm] = useState({
        name: "",
        email: "",
        username: "",
        phone: "",
        location: "",
        gender: "",
        relationshipStatus: "",
        birthday: "",
        anniversaryDate: "",
        persona: ["Guest"],
    });
    const subscriptionStatus = user
        ? getSubscriptionStatus({
            role: user.role,
            planStartDate: user.planStartDate,
            planEndDate: user.planEndDate,
        })
        : null;
    const activePlan = getPlanDetails(user?.role);
    const pendingPlan = getPlanDetails(user?.pendingPlanRole);
    const hasPendingPlanChange = Boolean(user?.pendingPlanRole && user?.pendingPlanStartDate);

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [authLoading, router, user]);

    useEffect(() => {
        if (!user) return;
        setProfileImage(user.profileImage || null);
        setIsPrivate(Boolean(user.isPrivate));
        setForm({
            name: user.name || "",
            email: user.email || "",
            username: user.username || "",
            phone: user.phone && user.phone !== "No Phone" ? user.phone : "",
            location: user.location || "",
            gender: user.gender || "",
            relationshipStatus: user.relationshipStatus || "",
            birthday: user.birthday || "",
            anniversaryDate: user.anniversaryDate || "",
            persona: getPersonasArray(user.persona),
        });
    }, [user]);

    useEffect(() => {
        if (!user) return;

        const loadVerificationStatus = async () => {
            const { data } = await supabase.auth.getUser();
            const authUser = data.user;
            const authEmail = authUser?.email?.toLowerCase();
            const profileEmail = user.email?.toLowerCase();
            setVerification({
                email: Boolean(authUser?.email_confirmed_at && authEmail && authEmail === profileEmail),
                phone: Boolean((authUser as any)?.phone_confirmed_at && (authUser as any)?.phone && (authUser as any).phone === user.phone),
            });
        };

        void loadVerificationStatus();
    }, [user]);

    useEffect(() => {
        if (!user) return;

        const loadStats = async () => {
            setLoadingStats(true);
            try {
                const identifiers = [user.uid, user.email, user.phone].filter(Boolean) as string[];
                const [storage, photos, hosted, joined] = await Promise.all([
                    getUserTotalStorage(identifiers),
                    getUserPhotosCount(user.uid),
                    getUserEventCount(user.uid),
                    getApprovedSharedEventsForUser(identifiers),
                ]);
                setStorageUsed(storage);
                setPhotosCount(photos);
                setEventCount(hosted);
                setJoinedCount(joined.length);
            } finally {
                setLoadingStats(false);
            }
        };

        void loadStats();
    }, [user]);

    useEffect(() => {
        if (!isEditing || !user) return;
        const normalized = form.username.trim().toLowerCase();

        if (normalized === (user.username || "").toLowerCase()) {
            setUsernameStatus("idle");
            return;
        }
        if (!isValidUsername(normalized)) {
            setUsernameStatus(normalized ? "invalid" : "idle");
            return;
        }

        setUsernameStatus("checking");
        const timer = window.setTimeout(async () => {
            const unique = await isUsernameUnique(normalized, user.uid);
            setUsernameStatus(unique ? "available" : "taken");
        }, 500);

        return () => window.clearTimeout(timer);
    }, [form.username, isEditing, user]);

    const updateForm = (field: keyof typeof form, value: string | string[]) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !user?.uid) return;
        if (!file.type.startsWith("image/")) {
            setSaveError("Please select an image file.");
            return;
        }

        setUploading(true);
        setSaveError("");
        try {
            const reader = new FileReader();
            reader.onload = async () => {
                const result = await uploadProfileImageToBackblaze(reader.result as string, user.uid);
                if (result.success && result.url) {
                    await updateUserProfileImage(user.uid, result.url);
                    setProfileImage(result.url);
                    setSaveMessage("Profile photo updated.");
                    window.setTimeout(() => setSaveMessage(""), 2500);
                } else {
                    setSaveError("Failed to upload profile photo.");
                }
                setUploading(false);
            };
            reader.onerror = () => {
                setSaveError("Failed to read selected image.");
                setUploading(false);
            };
            reader.readAsDataURL(file);
        } catch {
            setSaveError("Failed to upload profile photo.");
            setUploading(false);
        } finally {
            event.target.value = "";
        }
    };

    const handleRemoveProfileImage = async () => {
        if (!user?.uid || !profileImage || removingImage) return;
        if (!window.confirm("Remove your profile photo?")) return;

        setRemovingImage(true);
        setSaveError("");
        setSaveMessage("");

        try {
            const { data } = await supabase.auth.getSession();
            const accessToken = data.session?.access_token;
            if (!accessToken) {
                setSaveError("Please sign in again before removing your profile photo.");
                return;
            }

            const response = await fetch("/api/media/profile-image", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            });

            const result = await response.json().catch(() => ({}));
            if (!response.ok) {
                setSaveError(result.error || "Failed to remove profile photo.");
                return;
            }

            setProfileImage(null);
            setSaveMessage("Profile photo removed.");
            window.setTimeout(() => setSaveMessage(""), 2500);
        } catch {
            setSaveError("Failed to remove profile photo.");
        } finally {
            setRemovingImage(false);
        }
    };

    const handleSave = async (event: FormEvent) => {
        event.preventDefault();
        if (!user) return;

        const username = form.username.trim().toLowerCase();
        const email = form.email.trim().toLowerCase();
        if (!form.name.trim()) {
            setSaveError("Full name cannot be empty.");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setSaveError("Please enter a valid email address.");
            return;
        }
        if (!isValidUsername(username) || usernameStatus === "taken" || usernameStatus === "checking") {
            setSaveError("Please choose a valid and available username.");
            return;
        }

        setSaving(true);
        setSaveError("");
        setSaveMessage("");
        const ok = await updateUserProfile(user.uid, {
            name: form.name.trim(),
            email,
            username,
            phone: form.phone.trim(),
            location: form.location.trim(),
            gender: form.gender,
            relationshipStatus: form.relationshipStatus,
            birthday: form.birthday.trim(),
            anniversaryDate: form.anniversaryDate.trim(),
            persona: form.persona,
        });
        setSaving(false);

        if (ok) {
            setIsEditing(false);
            setSaveMessage("Profile updated successfully.");
            window.setTimeout(() => setSaveMessage(""), 2500);
        } else {
            setSaveError("Failed to update profile. Please try again.");
        }
    };

    const togglePersona = (persona: string) => {
        const selected = form.persona.includes(persona);
        if (selected && form.persona.length === 1) return;
        updateForm("persona", selected ? form.persona.filter((item) => item !== persona) : [...form.persona, persona]);
    };

    const togglePrivacy = async () => {
        if (!user?.uid || updatingPrivacy) return;
        const next = !isPrivate;
        setUpdatingPrivacy(true);
        const ok = await updateUserPrivacy(user.uid, next);
        if (ok) setIsPrivate(next);
        setUpdatingPrivacy(false);
    };

    if (authLoading || !user) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
                <Loader2 className="h-8 w-8 animate-spin text-yellow-300" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <Navbar />
            <main className="mx-auto max-w-6xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
                <section className="overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900">
                    <div className="bg-gradient-to-b from-slate-800 to-slate-950 px-6 py-8 sm:px-8">
                        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-5">
                                <div
                                    className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[1.5rem] border border-slate-700 bg-slate-950 text-slate-500 ring-4 ring-slate-900"
                                    aria-label="Profile photo"
                                >
                                    {profileImage ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={profileImage} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <User className="h-9 w-9" />
                                    )}
                                </div>
                                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} />
                                <div>
                                    <p className="text-sm font-black text-yellow-300">@{user.username || "set_username"}</p>
                                    <h1 className="mt-1 text-3xl font-black tracking-tight text-white">{user.name}</h1>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-300">
                                            {activePlan.name}
                                        </span>
                                        {getPersonasArray(user.persona).map((persona) => (
                                            <span key={persona} className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300">
                                                {persona}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-yellow-300"
                            >
                                <Pencil className="h-4 w-4" />
                                Edit Profile
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_360px]">
                        <div className="space-y-6">
                            <section>
                                <div className="mb-3 flex items-center justify-between">
                                    <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Your Activity</h2>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {[
                                        { label: "Photos Added", value: loadingStats ? "..." : photosCount, icon: Upload },
                                        { label: "Event Hosted", value: loadingStats ? "..." : eventCount, icon: Camera },
                                        { label: "Event Joined", value: loadingStats ? "..." : joinedCount, icon: Users },
                                    ].map((item) => (
                                        <div key={item.label} className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                                            <item.icon className="h-5 w-5 text-yellow-300" />
                                            <p className="mt-4 text-2xl font-black text-white">{item.value}</p>
                                            <p className="mt-1 text-xs font-bold text-slate-500">{item.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                                <div className="mb-2 flex items-center justify-between">
                                    <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-400">Account Info</h2>
                                    <button type="button" onClick={() => setIsEditing(true)} className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-1.5 text-xs font-black text-slate-950">
                                        <Pencil className="h-3 w-3" />
                                        Edit
                                    </button>
                                </div>
                                <InfoRow icon={User} label="Full Name">{user.name || "Not set"}</InfoRow>
                                <InfoRow icon={User} label="Username">@{user.username || "Not set"}</InfoRow>
                                <InfoRow icon={Mail} label="Email Address">
                                    <div>{user.email || "Not provided"}</div>
                                    <VerificationBadge
                                        verified={verification.email}
                                        missing={!user.email}
                                        missingText="Email needs to be entered"
                                    />
                                </InfoRow>
                                <InfoRow icon={Phone} label="Phone Number">
                                    <div>{user.phone && user.phone !== "No Phone" ? user.phone : "Not provided"}</div>
                                    <VerificationBadge
                                        verified={verification.phone}
                                        missing={!user.phone || user.phone === "No Phone"}
                                        missingText="Phone number needs to be entered"
                                    />
                                </InfoRow>
                                <InfoRow icon={MapPin} label="Location">{user.location || "Not set"}</InfoRow>
                                <InfoRow icon={User} label="Gender">{user.gender || "Not specified"}</InfoRow>
                                <InfoRow icon={Heart} label="Relationship Status">{user.relationshipStatus || "Not specified"}</InfoRow>
                                <InfoRow icon={Gift} label="Birthday">{user.birthday || "Not specified"}</InfoRow>
                                <InfoRow icon={Sparkles} label="Anniversary / Milestone Date">{user.anniversaryDate || "Not specified"}</InfoRow>
                                <InfoRow icon={Calendar} label="Joined EveBash">{formatJoinedDate(user.createdAt)}</InfoRow>
                            </section>
                        </div>

                        <aside className="space-y-6">
                            <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-300">
                                        <BarChart3 className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="font-black text-white">Usage & Plan</h2>
                                        <p className="text-xs font-bold text-slate-500">View limits and upgrade</p>
                                    </div>
                                </div>
                                <div className="mt-5 space-y-3">
                                    <div className="rounded-2xl bg-slate-900 p-4">
                                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Storage Used</p>
                                        <p className="mt-1 text-xl font-black text-white">{formatBytes(storageUsed)}</p>
                                    </div>
                                    <div className="rounded-2xl bg-slate-900 p-4">
                                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Active Plan</p>
                                        <p className="mt-1 text-xl font-black text-emerald-300">{activePlan.name}</p>
                                        <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                            {activePlan.storageLabel} storage
                                        </p>
                                    </div>
                                    {subscriptionStatus?.message && (
                                        <div className={cn(
                                            "rounded-2xl border p-4",
                                            subscriptionStatus.tone === "danger"
                                                ? "border-rose-400/25 bg-rose-400/10 text-rose-100"
                                                : "border-amber-400/25 bg-amber-400/10 text-amber-100"
                                        )}>
                                            <p className="text-[11px] font-black uppercase tracking-[0.16em]">
                                                {subscriptionStatus.label}
                                            </p>
                                            <p className="mt-1 text-sm font-semibold leading-6">
                                                {subscriptionStatus.message}
                                            </p>
                                        </div>
                                    )}
                                    {hasPendingPlanChange && (
                                        <div className="rounded-2xl border border-sky-400/25 bg-sky-400/10 p-4 text-sky-100">
                                            <p className="text-[11px] font-black uppercase tracking-[0.16em]">Scheduled Change</p>
                                            <p className="mt-1 text-sm font-black text-white">{pendingPlan.name}</p>
                                            <p className="mt-1 text-xs font-semibold leading-5">
                                                {pendingPlan.storageLabel} storage starts {formatPlanDate(user?.pendingPlanStartDate)}.
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <button type="button" onClick={() => router.push("/pricing")} className="mt-5 w-full rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-sm font-black text-yellow-300">
                                    Upgrade Plan
                                </button>
                            </section>

                            <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-300">
                                            <Lock className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h2 className="font-black text-white">Profile Privacy</h2>
                                            <p className="text-xs font-bold text-slate-500">{isPrivate ? "Private profile" : "Public profile"}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={togglePrivacy}
                                        disabled={updatingPrivacy}
                                        className={cn("relative h-7 w-12 rounded-full transition", isPrivate ? "bg-yellow-400" : "bg-slate-700")}
                                        aria-label="Toggle profile privacy"
                                    >
                                        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white transition", isPrivate ? "left-6" : "left-1")} />
                                    </button>
                                </div>
                            </section>

                            <section className="rounded-3xl border border-slate-800 bg-slate-950 p-5">
                                <h2 className="font-black text-white">App Preferences</h2>
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    {[
                                        { id: "royal", label: "Royal Cream" },
                                        { id: "light", label: "Modern Light" },
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setTheme(item.id as any)}
                                            className={cn(
                                                "rounded-2xl border p-4 text-left text-xs font-black transition",
                                                theme === item.id ? "border-yellow-400 bg-yellow-400 text-slate-950" : "border-slate-800 bg-slate-900 text-slate-300"
                                            )}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            <button type="button" onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm font-black text-rose-300">
                                <LogOut className="h-4 w-4" />
                                Sign Out
                            </button>
                        </aside>
                    </div>
                </section>

                {(saveMessage || saveError) && (
                    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-bold shadow-2xl">
                        <span className={saveError ? "text-rose-300" : "text-emerald-300"}>{saveError || saveMessage}</span>
                    </div>
                )}
            </main>

            {isEditing && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm" onMouseDown={() => !saving && setIsEditing(false)}>
                    <form
                        onSubmit={handleSave}
                        onMouseDown={(event) => event.stopPropagation()}
                        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-slate-800 bg-slate-950 p-6 shadow-2xl sm:p-8"
                    >
                        <div className="mb-6 flex items-center justify-between gap-4">
                            <h2 className="text-2xl font-black text-white">Edit Profile</h2>
                            <button type="button" onClick={() => !saving && !removingImage && setIsEditing(false)} className="flex h-10 w-10 items-center justify-center self-end rounded-full bg-slate-900 text-slate-300 sm:self-auto">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mb-8 flex flex-col items-center rounded-3xl border border-slate-800 bg-slate-900/50 p-5">
                            <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-slate-700 bg-slate-950 text-slate-500">
                                {profileImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={profileImage} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <User className="h-10 w-10" />
                                )}
                            </div>
                            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => !uploading && fileInputRef.current?.click()}
                                    disabled={uploading || removingImage || saving}
                                    className="inline-flex items-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs font-black text-sky-300 transition hover:bg-sky-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                                    Change Profile Photo
                                </button>
                                {profileImage ? (
                                    <button
                                        type="button"
                                        onClick={handleRemoveProfileImage}
                                        disabled={removingImage || uploading || saving}
                                        className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-black text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {removingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                        Remove Profile Photo
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            {[
                                { field: "name", label: "Full Name", placeholder: "Enter full name", required: true },
                                { field: "email", label: "Email Address", placeholder: "name@example.com", required: true },
                                { field: "username", label: "Username", placeholder: "username", required: true },
                                { field: "phone", label: "Phone Number", placeholder: "e.g. +91 98765 43210" },
                                { field: "location", label: "Location", placeholder: "e.g. Mumbai, Maharashtra" },
                                { field: "birthday", label: "Birthday", placeholder: "e.g. October 24" },
                                { field: "anniversaryDate", label: "Anniversary / Milestone Date", placeholder: "e.g. December 18, 2026" },
                            ].map(({ field, label, placeholder, required }) => (
                                <label key={field} className="block">
                                    <span className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                                        {label}
                                        {required && <span className="ml-1 text-yellow-300">*</span>}
                                    </span>
                                    <input
                                        value={form[field as keyof typeof form] as string}
                                        onChange={(event) => updateForm(field as keyof typeof form, field === "username" ? event.target.value.replace(/\s+/g, "").toLowerCase() : field === "email" ? event.target.value.trim().toLowerCase() : event.target.value)}
                                        placeholder={placeholder}
                                        type={field === "email" ? "email" : "text"}
                                        required={Boolean(required)}
                                        className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-yellow-400"
                                    />
                                    {field === "username" && usernameStatus !== "idle" && (
                                        <span className={cn("mt-2 flex items-center gap-1 text-xs font-bold", usernameStatus === "available" ? "text-emerald-300" : usernameStatus === "checking" ? "text-slate-400" : "text-rose-300")}>
                                            {usernameStatus === "checking" && <Loader2 className="h-3 w-3 animate-spin" />}
                                            {usernameStatus === "available" && <CheckCircle2 className="h-3 w-3" />}
                                            {(usernameStatus === "taken" || usernameStatus === "invalid") && <XCircle className="h-3 w-3" />}
                                            {usernameStatus === "checking" && "Checking availability..."}
                                            {usernameStatus === "available" && "Username is available"}
                                            {usernameStatus === "taken" && "Username is already taken"}
                                            {usernameStatus === "invalid" && "Use 3-30 lowercase letters/numbers. Dots/underscores allowed only inside, not repeated."}
                                        </span>
                                    )}
                                </label>
                            ))}
                        </div>

                        <div className="mt-6 grid gap-6 sm:grid-cols-2">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Gender</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {genderOptions.map((item) => (
                                        <button key={item} type="button" onClick={() => updateForm("gender", item)} className={cn("rounded-full border px-3 py-2 text-xs font-black", form.gender === item ? "border-yellow-400 bg-yellow-400 text-slate-950" : "border-slate-800 bg-slate-900 text-slate-300")}>
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">Relationship Status</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {relationshipOptions.map((item) => (
                                        <button key={item} type="button" onClick={() => updateForm("relationshipStatus", item)} className={cn("rounded-full border px-3 py-2 text-xs font-black", form.relationshipStatus === item ? "border-yellow-400 bg-yellow-400 text-slate-950" : "border-slate-800 bg-slate-900 text-slate-300")}>
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mt-6">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">I am a...</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {personaOptions.map((item) => (
                                    <button key={item} type="button" onClick={() => togglePersona(item)} className={cn("rounded-full border px-3 py-2 text-xs font-black", form.persona.includes(item) ? "border-yellow-400 bg-yellow-400 text-slate-950" : "border-slate-800 bg-slate-900 text-slate-300")}>
                                        {item}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {saveError && (
                            <p className="mt-5 flex items-center gap-2 text-sm font-bold text-rose-300">
                                <AlertCircle className="h-4 w-4" />
                                {saveError}
                            </p>
                        )}

                        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => !saving && setIsEditing(false)} className="rounded-2xl border border-slate-800 px-6 py-3 text-sm font-black text-slate-300">
                                Cancel
                            </button>
                            <button type="submit" disabled={saving || usernameStatus === "checking" || usernameStatus === "taken" || usernameStatus === "invalid"} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-yellow-400 px-6 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-60">
                                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}

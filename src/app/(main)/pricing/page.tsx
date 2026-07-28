"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Info } from "lucide-react";
import { getPlanDetails } from "@/lib/planLimits";
import { pricingPlanToFeatures, PricingPlan } from "@/lib/pricingPlans";
import type { RazorpayBillingDuration } from "@/lib/razorpayPricing";
import { supabase } from "@/lib/supabase";

type BillingCycle = "monthly" | "threeMonths" | "sixMonths" | "yearly";

const billingCycles: { key: BillingCycle; label: string; period: string }[] = [
    { key: "monthly", label: "Monthly", period: "/ month" },
    { key: "threeMonths", label: "3 Months", period: "/ 3 months" },
    { key: "sixMonths", label: "6 Months", period: "/ 6 months" },
    { key: "yearly", label: "Yearly", period: "/ year" },
];

type CheckoutMessage = {
    type: "success" | "error" | "info";
    text: string;
};

type CurrentSubscription = {
    role: string | null;
    subscriptionDuration: string | null;
    planStartDate: string | null;
    planEndDate: string | null;
    pendingPlanRole: string | null;
    pendingSubscriptionDuration: string | null;
    pendingPlanStartDate: string | null;
    pendingPlanEndDate: string | null;
};

type RazorpaySuccessResponse = {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
};

type RazorpayFailureResponse = {
    error?: {
        code?: string;
        description?: string;
        reason?: string;
    };
};

type RazorpayOptions = {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpaySuccessResponse) => void;
    modal?: {
        ondismiss?: () => void;
    };
    theme?: {
        color?: string;
    };
};

type RazorpayCheckout = {
    open: () => void;
    on: (event: "payment.failed", callback: (response: RazorpayFailureResponse) => void) => void;
};

declare global {
    interface Window {
        Razorpay?: new (options: RazorpayOptions) => RazorpayCheckout;
    }
}

const formatPrice = (amount: number) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(amount);

const cycleDurationsInMonths: Record<BillingCycle, number> = {
    monthly: 1,
    threeMonths: 3,
    sixMonths: 6,
    yearly: 12,
};

const durationLabels: Record<BillingCycle, string> = {
    monthly: "monthly",
    threeMonths: "3 month",
    sixMonths: "6 month",
    yearly: "yearly",
};

function toDateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number) {
    const nextDate = new Date(date);
    nextDate.setMonth(nextDate.getMonth() + months);
    return nextDate;
}

function addDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
}

function parseDateOnly(value?: string | null) {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
}

function isCurrentSubscriptionActive(subscription: CurrentSubscription | null) {
    const endDate = parseDateOnly(subscription?.planEndDate);
    if (!endDate) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate >= today;
}

function formatDate(date: Date | string | null | undefined) {
    if (!date) return "Not set";
    const parsedDate = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
    if (Number.isNaN(parsedDate.getTime())) return "Not set";

    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    }).format(parsedDate);
}

const planVisuals: Record<string, {
    badge: string | null;
    badgeColor: string;
    description: string;
    accentClass: string;
    btnClass: string;
    checkClass: string;
}> = {
    free: {
        badge: null,
        badgeColor: "",
        description: "Get started and explore the platform at no cost.",
        accentClass: "border border-slate-100",
        btnClass: "bg-slate-800 text-white hover:bg-slate-900",
        checkClass: "bg-slate-100 text-slate-600",
    },
    starter: {
        badge: null,
        badgeColor: "",
        description: "For small personal galleries.",
        accentClass: "border border-teal-100",
        btnClass: "bg-teal-600 text-white hover:bg-teal-700",
        checkClass: "bg-teal-50 text-teal-500",
    },
    basic: {
        badge: null,
        badgeColor: "",
        description: "For individuals and small events.",
        accentClass: "border border-teal-100",
        btnClass: "bg-teal-600 text-white hover:bg-teal-700",
        checkClass: "bg-teal-50 text-teal-500",
    },
    standard: {
        badge: null,
        badgeColor: "",
        description: "Best for frequent users and families.",
        accentClass: "border border-sky-100",
        btnClass: "bg-sky-600 text-white hover:bg-sky-700",
        checkClass: "bg-sky-50 text-sky-500",
    },
    premium: {
        badge: "Most Popular",
        badgeColor: "bg-sky-600",
        description: "For professional photographers.",
        accentClass: "ring-2 ring-sky-500",
        btnClass: "bg-sky-600 text-white hover:bg-sky-700 shadow-lg shadow-sky-200",
        checkClass: "bg-sky-100 text-sky-600",
    },
    pro: {
        badge: null,
        badgeColor: "",
        description: "For growing professional teams.",
        accentClass: "border border-purple-100",
        btnClass: "bg-purple-600 text-white hover:bg-purple-700",
        checkClass: "bg-purple-50 text-purple-500",
    },
    elite: {
        badge: null,
        badgeColor: "bg-purple-600",
        description: "For studios and heavy users.",
        accentClass: "ring-2 ring-purple-400",
        btnClass: "bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200",
        checkClass: "bg-purple-100 text-purple-600",
    },
    ultimate: {
        badge: "Best Value",
        badgeColor: "bg-orange-600",
        description: "For large studios and high-volume workflows.",
        accentClass: "ring-2 ring-orange-400",
        btnClass: "bg-orange-600 text-white hover:bg-orange-700 shadow-lg shadow-orange-200",
        checkClass: "bg-orange-100 text-orange-600",
    },
};

function getPlanPrice(plan: PricingPlan, billingCycle: BillingCycle) {
    if (billingCycle === "monthly") return plan.monthlyPrice;
    if (billingCycle === "threeMonths") return plan.threeMonthPrice;
    if (billingCycle === "sixMonths") return plan.sixMonthPrice;
    return plan.discountedYearlyPrice;
}

function getPlanActualPrice(plan: PricingPlan, billingCycle: BillingCycle) {
    if (billingCycle === "monthly") return plan.monthlyActualPrice;
    if (billingCycle === "threeMonths") return plan.threeMonthActualPrice;
    if (billingCycle === "sixMonths") return plan.sixMonthActualPrice;
    return plan.yearlyActualPrice;
}

function loadRazorpayScript() {
    return new Promise<boolean>((resolve) => {
        if (typeof window === "undefined") {
            resolve(false);
            return;
        }

        if (window.Razorpay) {
            resolve(true);
            return;
        }

        const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
        if (existingScript) {
            existingScript.addEventListener("load", () => resolve(true), { once: true });
            existingScript.addEventListener("error", () => resolve(false), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

export default function Pricing() {
    const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
    const [plans, setPlans] = useState<PricingPlan[]>([]);
    const [pricingStatus, setPricingStatus] = useState<"loading" | "ready" | "unavailable">("loading");
    const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
    const [checkoutMessage, setCheckoutMessage] = useState<CheckoutMessage | null>(null);
    const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
    const [confirmPlan, setConfirmPlan] = useState<PricingPlan | null>(null);
    const selectedCycle = billingCycles.find((cycle) => cycle.key === billingCycle) || billingCycles[0];
    const newPlanStartDate = new Date();
    const newPlanEndDate = addMonths(newPlanStartDate, cycleDurationsInMonths[billingCycle]);
    const isDowngradePlan = (plan: PricingPlan) => {
        if (!currentSubscription?.role || !isCurrentSubscriptionActive(currentSubscription)) return false;
        if (currentSubscription.role.toLowerCase() === "admin") return false;
        const currentPlan = getPlanDetails(currentSubscription.role);
        const selectedPlan = getPlanDetails(plan.id);
        return selectedPlan.storageBytes < currentPlan.storageBytes;
    };
    const confirmPlanIsDowngrade = confirmPlan ? isDowngradePlan(confirmPlan) : false;
    const scheduledPlanStartDate = confirmPlanIsDowngrade
        ? addDays(parseDateOnly(currentSubscription?.planEndDate) || new Date(), 1)
        : newPlanStartDate;
    const scheduledPlanEndDate = addMonths(scheduledPlanStartDate, cycleDurationsInMonths[billingCycle]);

    const getPlanDisplayName = (planId: string | null | undefined) => {
        if (!planId) return "Free plan";
        const plan = plans.find((item) => item.id === planId);
        if (!plan) return `${planId.charAt(0).toUpperCase()}${planId.slice(1)} plan`;
        return `${plan.name} (${plan.storageLabel})`;
    };

    useEffect(() => {
        let isMounted = true;

        async function loadPricingPlans() {
            try {
                const response = await fetch("/api/pricing-plans", { cache: "no-store" });
                const result = await response.json().catch(() => ({}));
                if (!isMounted) return;
                if (result.source !== "supabase" || !Array.isArray(result.plans)) {
                    setPricingStatus("unavailable");
                    setPlans([]);
                    return;
                }

                const activePlans = result.plans.filter((plan: PricingPlan) => plan.active);
                setPlans(activePlans);
                setPricingStatus(activePlans.length > 0 ? "ready" : "unavailable");
            } catch {
                if (!isMounted) return;
                setPlans([]);
                setPricingStatus("unavailable");
            }
        }

        loadPricingPlans();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        async function loadCurrentSubscription() {
            const { data: authData } = await supabase.auth.getUser();
            const user = authData.user;
            if (!user) return;

            const { data } = await supabase
                .from("profiles")
                .select("role, subscription_duration, plan_start_date, plan_end_date, pending_plan_role, pending_subscription_duration, pending_plan_start_date, pending_plan_end_date")
                .eq("id", user.id)
                .maybeSingle();

            if (!isMounted || !data) return;

            setCurrentSubscription({
                role: data.role || null,
                subscriptionDuration: data.subscription_duration || null,
                planStartDate: data.plan_start_date || null,
                planEndDate: data.plan_end_date || null,
                pendingPlanRole: data.pending_plan_role || null,
                pendingSubscriptionDuration: data.pending_subscription_duration || null,
                pendingPlanStartDate: data.pending_plan_start_date || null,
                pendingPlanEndDate: data.pending_plan_end_date || null,
            });
        }

        loadCurrentSubscription();

        return () => {
            isMounted = false;
        };
    }, []);

    function openCheckoutConfirmation(plan: PricingPlan) {
        setCheckoutMessage(null);
        setConfirmPlan(plan);
    }

    async function handleCheckout(plan: PricingPlan) {
        setCheckoutMessage(null);
        setCheckoutPlanId(plan.id);

        try {
            const isScriptLoaded = await loadRazorpayScript();
            if (!isScriptLoaded || !window.Razorpay) {
                setCheckoutMessage({
                    type: "error",
                    text: "Payment checkout could not be loaded. Please check your connection and try again.",
                });
                return;
            }

            const orderResponse = await fetch("/api/create-order", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    planId: plan.id,
                    duration: billingCycle as RazorpayBillingDuration,
                }),
            });
            const orderResult = await orderResponse.json().catch(() => ({}));

            if (!orderResponse.ok) {
                setCheckoutMessage({
                    type: "error",
                    text: orderResult.error || "Unable to start checkout. Please try again.",
                });
                return;
            }

            const key = orderResult.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
            if (!key) {
                setCheckoutMessage({
                    type: "error",
                    text: "Payment checkout is not configured yet.",
                });
                return;
            }

            let paymentCompleted = false;
            const checkout = new window.Razorpay({
                key,
                amount: Number(orderResult.amount),
                currency: orderResult.currency || "INR",
                name: "EveBash",
                description: `${plan.name} Plan - ${selectedCycle.label}`,
                order_id: orderResult.order_id,
                handler: async (paymentResponse) => {
                    paymentCompleted = true;
                    setCheckoutPlanId(plan.id);
                    const { data: sessionData } = await supabase.auth.getSession();
                    const accessToken = sessionData.session?.access_token;

                    if (!accessToken) {
                        setCheckoutMessage({
                            type: "error",
                            text: "Payment was received, but you are not signed in. Please contact support to activate your plan.",
                        });
                        setCheckoutPlanId(null);
                        return;
                    }

                    const verifyResponse = await fetch("/api/verify-payment", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify({
                            ...paymentResponse,
                            planId: plan.id,
                            duration: billingCycle as RazorpayBillingDuration,
                        }),
                    });
                    const verifyResult = await verifyResponse.json().catch(() => ({}));

                    if (!verifyResponse.ok || !verifyResult.success) {
                        setCheckoutMessage({
                            type: "error",
                            text: verifyResult.error || "Payment verification failed. Please contact support before retrying.",
                        });
                        setCheckoutPlanId(null);
                        return;
                    }

                    if (verifyResult.change_type === "downgrade_scheduled") {
                        setCheckoutMessage({
                            type: "success",
                            text: `Payment verified. Your downgrade to ${plan.name} is scheduled for ${formatDate(verifyResult.pending_plan_start_date)}.`,
                        });
                        setCurrentSubscription((current) => ({
                            role: current?.role || verifyResult.plan_id || null,
                            subscriptionDuration: current?.subscriptionDuration || null,
                            planStartDate: current?.planStartDate || null,
                            planEndDate: current?.planEndDate || null,
                            pendingPlanRole: verifyResult.pending_plan_role || plan.id,
                            pendingSubscriptionDuration: verifyResult.pending_subscription_duration || durationLabels[billingCycle],
                            pendingPlanStartDate: verifyResult.pending_plan_start_date || null,
                            pendingPlanEndDate: verifyResult.pending_plan_end_date || null,
                        }));
                    } else {
                        setCheckoutMessage({
                            type: "success",
                            text: "Payment verified successfully. Your plan is active now.",
                        });
                        setCurrentSubscription({
                            role: verifyResult.plan_id || plan.id,
                            subscriptionDuration: verifyResult.subscription_duration || durationLabels[billingCycle],
                            planStartDate: verifyResult.plan_start_date || toDateOnly(new Date()),
                            planEndDate: verifyResult.plan_end_date || toDateOnly(addMonths(new Date(), cycleDurationsInMonths[billingCycle])),
                            pendingPlanRole: null,
                            pendingSubscriptionDuration: null,
                            pendingPlanStartDate: null,
                            pendingPlanEndDate: null,
                        });
                    }
                    setCheckoutPlanId(null);
                },
                modal: {
                    ondismiss: () => {
                        if (paymentCompleted) return;
                        setCheckoutMessage({
                            type: "info",
                            text: "Checkout was closed before payment was completed.",
                        });
                        setCheckoutPlanId(null);
                    },
                },
                theme: {
                    color: "#0f172a",
                },
            });

            checkout.on("payment.failed", (response) => {
                setCheckoutMessage({
                    type: "error",
                    text: response.error?.description || "Payment failed. Please try again.",
                });
                setCheckoutPlanId(null);
            });

            checkout.open();
        } catch {
            setCheckoutMessage({
                type: "error",
                text: "Something went wrong while starting checkout. Please try again.",
            });
        } finally {
            setCheckoutPlanId((current) => (current === plan.id ? null : current));
        }
    }

    return (
        <div className="min-h-screen bg-[var(--site-bg)] px-4 py-24 text-[var(--site-text)]">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <div className="text-center mb-16 space-y-4">
                    <h1 className="font-serif text-4xl text-[var(--site-text)] md:text-5xl">Simple, Transparent Pricing</h1>
                    <p className="mx-auto max-w-2xl text-lg font-light text-[var(--site-subtle)]">
                        From free to enterprise — find the plan that fits your story.
                    </p>
                </div>

                <div className="mb-10 flex justify-center">
                    <div className="inline-grid grid-cols-2 gap-2 rounded-2xl border border-[var(--site-border)] bg-[var(--site-card)] p-2 shadow-sm sm:grid-cols-4">
                        {billingCycles.map((cycle) => {
                            const isActive = billingCycle === cycle.key;
                            return (
                                <button
                                    key={cycle.key}
                                    type="button"
                                    onClick={() => setBillingCycle(cycle.key)}
                                    className={`rounded-xl px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-all ${
                                        isActive
                                            ? "bg-sky-600 text-white shadow-lg shadow-sky-500/20"
                                            : "text-[var(--site-muted)] hover:bg-[var(--site-card-muted)] hover:text-[var(--site-text)]"
                                    }`}
                                >
                                    {cycle.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {checkoutMessage && pricingStatus === "ready" && (
                    <div
                        className={`mx-auto mb-8 max-w-2xl rounded-2xl border px-5 py-4 text-center text-sm font-medium ${
                            checkoutMessage.type === "success"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : checkoutMessage.type === "info"
                                    ? "border-sky-200 bg-sky-50 text-sky-800"
                                    : "border-rose-200 bg-rose-50 text-rose-800"
                        }`}
                    >
                        {checkoutMessage.text}
                    </div>
                )}

                {pricingStatus === "loading" && (
                    <div className="rounded-2xl border border-[var(--site-border)] bg-[var(--site-card)] p-10 text-center shadow-sm">
                        <p className="text-sm font-bold uppercase tracking-widest text-[var(--site-muted)]">Loading Pricing</p>
                        <p className="mt-3 text-[var(--site-subtle)]">Fetching the latest plans.</p>
                    </div>
                )}

                {pricingStatus === "unavailable" && (
                    <div className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center shadow-sm">
                        <p className="text-sm font-bold uppercase tracking-widest text-amber-700">Pricing Unavailable</p>
                        <h2 className="mt-3 font-serif text-2xl text-slate-900">Pricing is temporarily unavailable.</h2>
                        <p className="mt-3 text-sm leading-6 text-slate-700">
                            We could not load the latest pricing plans right now. Please try again shortly or contact support.
                        </p>
                        <Link href="/contact-us" className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-800">
                            Contact Support
                        </Link>
                    </div>
                )}

                {/* Pricing Cards */}
                {pricingStatus === "ready" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                    {plans.map((plan) => {
                        const visual = planVisuals[plan.id] || planVisuals.starter;
                        const price = getPlanPrice(plan, billingCycle);
                        const actualPrice = getPlanActualPrice(plan, billingCycle);
                        const savings = Math.max(actualPrice - price, 0);
                        const cta = plan.id === "free" ? "Get Started" : `Choose ${plan.name}`;
                        const ctaHref = plan.id === "free" ? "/login" : "/contact-us";
                        const isCheckingOut = checkoutPlanId === plan.id;

                        return (
                        <div
                            key={plan.id}
                            className={`relative flex flex-col overflow-hidden rounded-2xl bg-[var(--site-card)] shadow-xl transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${visual.accentClass}`}
                        >
                            {/* Badge */}
                            {visual.badge && (
                                <div className={`${visual.badgeColor} text-white text-xs font-bold py-1.5 text-center uppercase tracking-widest`}>
                                    {visual.badge}
                                </div>
                            )}

                            <div className="p-6 flex-1 flex flex-col">
                                <h3 className="mb-2 font-serif text-xl font-bold text-[var(--site-text)]">{plan.name}</h3>

                                {actualPrice > price && (
                                    <div className="mb-1 flex items-center gap-2">
                                        <span className="text-sm font-bold text-[var(--site-muted)] line-through">{formatPrice(actualPrice)}</span>
                                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                            Save {formatPrice(savings)}
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-baseline mb-0.5">
                                    <span className="text-3xl font-bold text-[var(--site-text)]">{formatPrice(price)}</span>
                                </div>
                                <span className="mb-2 text-xs font-light text-[var(--site-muted)]">
                                    {price === 0 ? "forever" : selectedCycle.period}
                                </span>
                                <p className="mb-4 min-h-[32px] text-xs font-light text-[var(--site-subtle)]">{visual.description}</p>

                                <div className="mb-4 h-px w-full bg-[var(--site-border)]" />

                                <ul className="space-y-2.5 mb-6 flex-1">
                                    {pricingPlanToFeatures(plan).map((feature, idx) => (
                                        <li key={idx} className="flex items-start group">
                                            <div className={`p-1 rounded-full mr-2 shrink-0 mt-px ${visual.checkClass}`}>
                                                <Check className="w-2.5 h-2.5" />
                                            </div>
                                            <span className="text-xs leading-snug text-[var(--site-muted)] transition-colors group-hover:text-[var(--site-text)]">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {plan.id === "free" ? (
                                    <Link href={ctaHref} className="block w-full mt-auto">
                                        <div className={`w-full py-3 text-center rounded-xl uppercase tracking-widest text-xs font-bold transition-all duration-300 active:scale-95 ${visual.btnClass}`}>
                                            {cta}
                                        </div>
                                    </Link>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => openCheckoutConfirmation(plan)}
                                        disabled={isCheckingOut}
                                        className={`w-full py-3 text-center rounded-xl uppercase tracking-widest text-xs font-bold transition-all duration-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-70 ${visual.btnClass}`}
                                    >
                                        {isCheckingOut ? "Starting Checkout..." : cta}
                                    </button>
                                )}
                            </div>
                        </div>
                        );
                    })}
                </div>
                )}

                {/* Fair Usage Policy Note */}
                {pricingStatus === "ready" && (
                <div className="mt-10 flex items-start justify-center gap-2 text-center">
                    <Info className="mt-px h-4 w-4 shrink-0 text-[var(--site-muted)]" />
                    <p className="max-w-xl text-xs leading-relaxed text-[var(--site-muted)]">
                        <span className="font-semibold text-[var(--site-subtle)]">Fair Usage Policy:</span> Bandwidth usage beyond fair limits may incur additional charges.
                        Extra Storage: ₹5/GB &bull; Extra Bandwidth: ₹7–₹10/GB.
                    </p>
                </div>
                )}

                {confirmPlan && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
                        <div className="w-full max-w-lg rounded-2xl border border-[var(--site-border)] bg-[var(--site-card)] p-6 shadow-2xl">
                            <div className="space-y-2">
                                <p className="text-xs font-black uppercase tracking-widest text-sky-600">
                                    {confirmPlanIsDowngrade ? "Schedule Plan Downgrade" : "Confirm Plan Change"}
                                </p>
                                <h2 className="font-serif text-2xl font-bold text-[var(--site-text)]">
                                    {confirmPlanIsDowngrade ? "Switch" : "Upgrade"} to {confirmPlan.name} ({confirmPlan.storageLabel})
                                </h2>
                                <p className="text-sm leading-6 text-[var(--site-subtle)]">
                                    {confirmPlanIsDowngrade
                                        ? `Your current plan stays active until ${formatDate(currentSubscription?.planEndDate)}. The lower plan starts in your next billing cycle.`
                                        : `Your new ${durationLabels[billingCycle]} plan will start immediately after successful payment.`}
                                </p>
                            </div>

                            <div className="mt-6 grid gap-3 text-sm">
                                <div className="rounded-xl border border-[var(--site-border)] bg-[var(--site-card-muted)] p-4">
                                    <p className="text-[11px] font-black uppercase tracking-widest text-[var(--site-muted)]">Current Plan</p>
                                    <p className="mt-1 font-semibold text-[var(--site-text)]">{getPlanDisplayName(currentSubscription?.role)}</p>
                                    <p className="mt-1 text-[var(--site-subtle)]">
                                        Active until {formatDate(currentSubscription?.planEndDate)}
                                    </p>
                                </div>

                                <div className={`rounded-xl border p-4 ${
                                    confirmPlanIsDowngrade
                                        ? "border-amber-200 bg-amber-50"
                                        : "border-emerald-200 bg-emerald-50"
                                }`}>
                                    <p className={`text-[11px] font-black uppercase tracking-widest ${
                                        confirmPlanIsDowngrade ? "text-amber-700" : "text-emerald-700"
                                    }`}>
                                        {confirmPlanIsDowngrade ? "Scheduled Plan" : "New Plan After Payment"}
                                    </p>
                                    <p className="mt-1 font-semibold text-slate-900">{confirmPlan.name} ({confirmPlan.storageLabel})</p>
                                    <p className="mt-1 text-slate-700">
                                        Starts {formatDate(scheduledPlanStartDate)} and ends {formatDate(scheduledPlanEndDate)}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                                {confirmPlanIsDowngrade
                                    ? "Downgrades are scheduled for the next billing cycle so your current paid storage is not reduced early."
                                    : "Your current plan period will be replaced by this new plan period. The upgraded storage and limits will apply immediately after payment verification."}
                            </div>

                            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => setConfirmPlan(null)}
                                    className="rounded-xl border border-[var(--site-border)] px-5 py-3 text-xs font-bold uppercase tracking-widest text-[var(--site-subtle)] transition-colors hover:bg-[var(--site-card-muted)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const plan = confirmPlan;
                                        setConfirmPlan(null);
                                        handleCheckout(plan);
                                    }}
                                    className="rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-slate-800"
                                >
                                    Continue to Payment
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Custom Plan CTA */}
                <div className="mt-14 rounded-2xl border border-[var(--site-border)] bg-[var(--site-card)] p-10 text-center shadow-sm">
                    <h3 className="mb-3 font-serif text-2xl text-[var(--site-text)]">Need a custom plan?</h3>
                    <p className="mx-auto mb-8 max-w-2xl text-[var(--site-subtle)]">
                        Running a large studio or enterprise operation? Let&apos;s build a plan tailored to your exact needs.
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

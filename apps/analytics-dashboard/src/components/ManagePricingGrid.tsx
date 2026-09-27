import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CircleOff,
  RotateCcw,
  Save,
  Search,
  ToggleLeft,
  ToggleRight,
  Layers,
  CheckCircle2,
  Sparkles,
  CreditCard,
  AlertTriangle,
  Loader2,
  X,
  Package
} from 'lucide-react';
import { runAdminAction } from '../lib/adminApi';
import { directUpdatePricingPlans } from '../lib/analytics';

type PlanDraft = {
  id: string;
  name: string;
  storageGb: number;
  storageLabel: string;
  events: number;
  imageUpload: boolean;
  videoUpload: boolean;
  videoLimitMb?: number;
  monthlyActualPrice: number;
  monthlyPrice: number;
  threeMonthActualPrice: number;
  threeMonthPrice: number;
  sixMonthActualPrice: number;
  sixMonthPrice: number;
  discountedYearlyPrice: number;
  yearlyActualPrice: number;
  active: boolean;
  displayOrder: number;
};

const defaultPlans: PlanDraft[] = [
  {
    id: 'free',
    name: 'Free Plan',
    storageGb: 1,
    storageLabel: '1 GB',
    events: 1,
    imageUpload: true,
    videoUpload: true,
    videoLimitMb: 200,
    monthlyActualPrice: 0,
    monthlyPrice: 0,
    threeMonthActualPrice: 0,
    threeMonthPrice: 0,
    sixMonthActualPrice: 0,
    sixMonthPrice: 0,
    discountedYearlyPrice: 0,
    yearlyActualPrice: 0,
    active: true,
    displayOrder: 1,
  },
  {
    id: 'starter',
    name: 'Starter',
    storageGb: 10,
    storageLabel: '10 GB',
    events: 10,
    imageUpload: true,
    videoUpload: true,
    monthlyActualPrice: 150,
    monthlyPrice: 150,
    threeMonthActualPrice: 450,
    threeMonthPrice: 400,
    sixMonthActualPrice: 900,
    sixMonthPrice: 700,
    discountedYearlyPrice: 1000,
    yearlyActualPrice: 1200,
    active: true,
    displayOrder: 2,
  },
  {
    id: 'basic',
    name: 'Basic',
    storageGb: 25,
    storageLabel: '25 GB',
    events: 25,
    imageUpload: true,
    videoUpload: true,
    monthlyActualPrice: 300,
    monthlyPrice: 300,
    threeMonthActualPrice: 900,
    threeMonthPrice: 800,
    sixMonthActualPrice: 1800,
    sixMonthPrice: 1400,
    discountedYearlyPrice: 2000,
    yearlyActualPrice: 2400,
    active: true,
    displayOrder: 3,
  },
  {
    id: 'standard',
    name: 'Standard',
    storageGb: 50,
    storageLabel: '50 GB',
    events: 50,
    imageUpload: true,
    videoUpload: true,
    monthlyActualPrice: 450,
    monthlyPrice: 450,
    threeMonthActualPrice: 1350,
    threeMonthPrice: 1200,
    sixMonthActualPrice: 2700,
    sixMonthPrice: 2100,
    discountedYearlyPrice: 3000,
    yearlyActualPrice: 3600,
    active: true,
    displayOrder: 4,
  },
  {
    id: 'premium',
    name: 'Premium',
    storageGb: 100,
    storageLabel: '100 GB',
    events: 100,
    imageUpload: true,
    videoUpload: true,
    monthlyActualPrice: 750,
    monthlyPrice: 750,
    threeMonthActualPrice: 2250,
    threeMonthPrice: 2000,
    sixMonthActualPrice: 4500,
    sixMonthPrice: 3500,
    discountedYearlyPrice: 5000,
    yearlyActualPrice: 6000,
    active: true,
    displayOrder: 5,
  },
  {
    id: 'pro',
    name: 'Pro',
    storageGb: 200,
    storageLabel: '200 GB',
    events: 200,
    imageUpload: true,
    videoUpload: true,
    monthlyActualPrice: 1200,
    monthlyPrice: 1200,
    threeMonthActualPrice: 3600,
    threeMonthPrice: 3200,
    sixMonthActualPrice: 7200,
    sixMonthPrice: 5600,
    discountedYearlyPrice: 8000,
    yearlyActualPrice: 9600,
    active: true,
    displayOrder: 6,
  },
  {
    id: 'elite',
    name: 'Elite',
    storageGb: 500,
    storageLabel: '500 GB',
    events: 500,
    imageUpload: true,
    videoUpload: true,
    monthlyActualPrice: 2200,
    monthlyPrice: 2200,
    threeMonthActualPrice: 6600,
    threeMonthPrice: 6000,
    sixMonthActualPrice: 13200,
    sixMonthPrice: 10500,
    discountedYearlyPrice: 15000,
    yearlyActualPrice: 18000,
    active: true,
    displayOrder: 7,
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    storageGb: 1024,
    storageLabel: '1 TB',
    events: 1024,
    imageUpload: true,
    videoUpload: true,
    monthlyActualPrice: 3750,
    monthlyPrice: 3750,
    threeMonthActualPrice: 11250,
    threeMonthPrice: 10000,
    sixMonthActualPrice: 22500,
    sixMonthPrice: 17500,
    discountedYearlyPrice: 25000,
    yearlyActualPrice: 30000,
    active: true,
    displayOrder: 8,
  },
];

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const numberInputClass =
  'w-24 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-right text-xs font-mono font-medium text-slate-100 outline-none transition-all focus:border-indigo-500/60 focus:bg-slate-900 focus:ring-1 focus:ring-indigo-500/30';

const textInputClass =
  'w-36 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-xs font-semibold text-white outline-none transition-all focus:border-indigo-500/60 focus:bg-slate-900 focus:ring-1 focus:ring-indigo-500/30';

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function getApiBaseUrl() {
  const env = (import.meta as any).env;
  return (
    env.VITE_API_BASE_URL ||
    env.VITE_NEXT_PUBLIC_SITE_URL ||
    'http://localhost:8080'
  ).replace(/\/$/, '');
}

function normalizePlan(raw: Partial<PlanDraft>, index: number): PlanDraft {
  return {
    id: String(raw.id || defaultPlans[index]?.id || `plan-${index + 1}`),
    name: String(raw.name || defaultPlans[index]?.name || 'Plan'),
    storageGb: Number(raw.storageGb ?? defaultPlans[index]?.storageGb ?? 0),
    storageLabel: String(raw.storageLabel || defaultPlans[index]?.storageLabel || '0 GB'),
    events: Number(raw.events ?? defaultPlans[index]?.events ?? 0),
    imageUpload: Boolean(raw.imageUpload ?? true),
    videoUpload: Boolean(raw.videoUpload ?? true),
    videoLimitMb: raw.videoLimitMb === null || raw.videoLimitMb === undefined ? undefined : Number(raw.videoLimitMb),
    monthlyActualPrice: Number(raw.monthlyActualPrice ?? raw.monthlyPrice ?? 0),
    monthlyPrice: Number(raw.monthlyPrice ?? 0),
    threeMonthActualPrice: Number(raw.threeMonthActualPrice ?? raw.threeMonthPrice ?? 0),
    threeMonthPrice: Number(raw.threeMonthPrice ?? 0),
    sixMonthActualPrice: Number(raw.sixMonthActualPrice ?? raw.sixMonthPrice ?? 0),
    sixMonthPrice: Number(raw.sixMonthPrice ?? 0),
    discountedYearlyPrice: Number(raw.discountedYearlyPrice ?? 0),
    yearlyActualPrice: Number(raw.yearlyActualPrice ?? (raw as { yearlyPrice?: number }).yearlyPrice ?? 0),
    active: Boolean(raw.active ?? true),
    displayOrder: Number(raw.displayOrder ?? index + 1),
  };
}

export const ManagePricingGrid: React.FC = () => {
  const [plans, setPlans] = useState<PlanDraft[]>(defaultPlans);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'idle' | 'saved' | 'reset' | 'loading' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [pricingTableReady, setPricingTableReady] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadPlans() {
      setStatus('loading');
      setMessage('');
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/v1/pricing-plans`, { cache: 'no-store' });
        const result = await response.json().catch(() => ({}));
        const nextPlans = Array.isArray(result.plans)
          ? result.plans.map((plan: Partial<PlanDraft>, index: number) => normalizePlan(plan, index))
          : defaultPlans;

        if (!isMounted) return;
        setPlans(nextPlans);
        setStatus('idle');
        setPricingTableReady(result.source !== 'default' || !result.error);
        if (result.source === 'default' && result.error) {
          setMessage(`Using default pricing until Supabase pricing table is ready: ${result.error}`);
        }
      } catch (error) {
        if (!isMounted) return;
        setPlans(defaultPlans);
        setPricingTableReady(false);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Could not load pricing plans.');
      }
    }

    loadPlans();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredPlans = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();
    if (!cleanSearch) return plans;
    return plans.filter((plan) =>
      [plan.name, plan.storageLabel, plan.id].some((value) => value.toLowerCase().includes(cleanSearch))
    );
  }, [plans, search]);

  const totals = useMemo(() => {
    return plans.reduce(
      (acc, plan) => {
        if (plan.active) acc.active += 1;
        acc.monthly += plan.monthlyPrice;
        acc.yearly += plan.discountedYearlyPrice;
        return acc;
      },
      { active: 0, monthly: 0, yearly: 0 }
    );
  }, [plans]);

  const updatePlan = <K extends keyof PlanDraft>(planId: string, key: K, value: PlanDraft[K]) => {
    setStatus('idle');
    setPlans((current) => current.map((plan) => (plan.id === planId ? { ...plan, [key]: value } : plan)));
  };

  const resetPlans = () => {
    setPlans(defaultPlans);
    setStatus('reset');
    setMessage('Draft pricing reset to current defaults. Save to publish these values.');
  };

  const saveDraft = async () => {
    if (!pricingTableReady) {
      setStatus('error');
      setMessage('Pricing table is not ready yet. Apply supabase/migrations/20260710000000_add_pricing_plans.sql in Supabase, then refresh this dashboard.');
      return;
    }

    setStatus('loading');
    setMessage('Saving pricing changes...');
    let result: { success: boolean; error?: string } = { success: false };
    try {
      result = await directUpdatePricingPlans(plans);
    } catch (err: any) {
      try {
        result = await runAdminAction('updatePricingPlans', { plans });
      } catch {
        result = { success: false, error: err?.message || 'Could not save pricing plans.' };
      }
    }

    if (!result.success) {
      setStatus('error');
      setMessage(result.error || 'Could not save pricing plans.');
      return;
    }

    setStatus('saved');
    setMessage('Pricing saved. The public pricing page will use these values now.');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Quick Analytics Cards Matching UserGrid Glassmorphism Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Plans Configured */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-indigo-500/10 blur-2xl transition-all duration-500 group-hover:bg-indigo-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Total Plans
            </span>
            <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-2.5 text-indigo-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-indigo-500/40 group-hover:bg-indigo-500/20">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-white transition-colors group-hover:text-indigo-300">
            {plans.length}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>{totals.active} active tiers</span>
            </div>
            <span className="rounded border border-indigo-500/25 bg-indigo-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-300">
              Configured
            </span>
          </div>
        </div>

        {/* Card 2: Active Plans Coverage */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl transition-all duration-500 group-hover:bg-emerald-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Active Coverage
            </span>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2.5 text-emerald-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-emerald-500/40 group-hover:bg-emerald-500/20">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-emerald-400 transition-colors group-hover:text-emerald-300">
            {plans.length > 0 ? Math.round((totals.active / plans.length) * 100) : 0}%
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>{plans.length - totals.active} paused</span>
            </div>
            <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              Public Availability
            </span>
          </div>
        </div>

        {/* Card 3: Monthly Stack Potential */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-xl hover:shadow-sky-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-sky-500/10 blur-2xl transition-all duration-500 group-hover:bg-sky-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Monthly Stack
            </span>
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-2.5 text-sky-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-sky-500/40 group-hover:bg-sky-500/20">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-white transition-colors group-hover:text-sky-300">
            {currency.format(totals.monthly)}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span>Sum of all active plans</span>
            </div>
            <span className="rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-sky-300">
              Per Month
            </span>
          </div>
        </div>

        {/* Card 4: Discounted Yearly Stack */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-purple-500/10 blur-2xl transition-all duration-500 group-hover:bg-purple-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Discounted Yearly Stack
            </span>
            <div className="rounded-xl border border-purple-500/25 bg-purple-500/10 p-2.5 text-purple-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-purple-500/40 group-hover:bg-purple-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight text-purple-400 transition-colors group-hover:text-purple-300">
            {currency.format(totals.yearly)}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-400" />
              <span>Prepaid annual pool</span>
            </div>
            <span className="rounded border border-purple-500/25 bg-purple-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-purple-300">
              Annual Rate
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Card Container */}
      <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
        {/* Controls Toolbar: Search & Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Manage Pricing Matrix</h3>
            <p className="text-slate-400 text-xs mt-1">
              Configure storage capacities, allowances, features, and billing cycles published to users ({filteredPlans.length} plans)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search plans by name or storage..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 w-full sm:w-60 placeholder-slate-600 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Reset Draft Button */}
            <button
              type="button"
              onClick={resetPlans}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Reset draft pricing to defaults"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Reset Draft</span>
            </button>

            {/* Save Pricing Button */}
            <button
              type="button"
              onClick={saveDraft}
              disabled={!pricingTableReady || status === 'loading'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-indigo-500/40 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-white text-xs font-bold transition-all shadow-md shadow-indigo-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{status === 'loading' ? 'Saving...' : 'Save Pricing'}</span>
            </button>
          </div>
        </div>

        {/* Status Message Banner */}
        {(status !== 'idle' || message) && (
          <div
            className={`mb-6 flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold ${
              status === 'error'
                ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
            }`}
          >
            {status === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{message || (status === 'saved' ? 'Pricing saved successfully.' : 'Loading pricing plans...')}</span>
          </div>
        )}

        {/* Modern Table matching UserGrid architecture */}
        <div className="bg-[#0f172a]/40 border border-slate-800/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          <div className="overflow-x-auto [scrollbar-gutter:stable]">
            <table className="w-full text-left border-collapse border-spacing-0">
              <thead>
                <tr className="bg-[#0f1422] text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-700 select-none">
                  {/* Sr. No. (Sticky Left-0) */}
                  <th
                    scope="col"
                    className="sticky left-0 z-20 bg-[#0f1422] py-3.5 px-2 text-center w-12 min-w-[48px] max-w-[48px] border-r border-slate-700"
                  >
                    Sr.
                  </th>

                  {/* Plan Name & ID (Sticky Left-[48px]) */}
                  <th
                    scope="col"
                    className="sticky left-[48px] z-20 bg-[#0f1422] py-3.5 px-4 min-w-[190px] border-r border-slate-700 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.5)]"
                  >
                    Plan Name & ID
                  </th>

                  {/* Status */}
                  <th scope="col" className="py-3.5 px-3 min-w-[110px] border-r border-slate-700">
                    Status
                  </th>

                  {/* Storage */}
                  <th scope="col" className="py-3.5 px-3 min-w-[130px] border-r border-slate-700">
                    Storage
                  </th>

                  {/* Events */}
                  <th scope="col" className="py-3.5 px-3 min-w-[100px] border-r border-slate-700">
                    Events
                  </th>

                  {/* Image Upload */}
                  <th scope="col" className="py-3.5 px-3 min-w-[110px] border-r border-slate-700">
                    Image Upload
                  </th>

                  {/* Video Upload */}
                  <th scope="col" className="py-3.5 px-3 min-w-[150px] border-r border-slate-700">
                    Video Upload
                  </th>

                  {/* Monthly Pricing */}
                  <th scope="col" className="py-3.5 px-3 min-w-[125px] border-r border-slate-700 text-right">
                    Monthly Actual (₹)
                  </th>
                  <th scope="col" className="py-3.5 px-3 min-w-[125px] border-r border-slate-700 text-right">
                    Monthly Selling (₹)
                  </th>

                  {/* 3 Months Pricing */}
                  <th scope="col" className="py-3.5 px-3 min-w-[125px] border-r border-slate-700 text-right">
                    3M Actual (₹)
                  </th>
                  <th scope="col" className="py-3.5 px-3 min-w-[125px] border-r border-slate-700 text-right">
                    3M Selling (₹)
                  </th>

                  {/* 6 Months Pricing */}
                  <th scope="col" className="py-3.5 px-3 min-w-[125px] border-r border-slate-700 text-right">
                    6M Actual (₹)
                  </th>
                  <th scope="col" className="py-3.5 px-3 min-w-[125px] border-r border-slate-700 text-right">
                    6M Selling (₹)
                  </th>

                  {/* Yearly Pricing */}
                  <th scope="col" className="py-3.5 px-3 min-w-[125px] border-r border-slate-700 text-right">
                    Yearly Actual (₹)
                  </th>
                  <th scope="col" className="py-3.5 px-3 min-w-[125px] text-right">
                    Yearly Selling (₹)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredPlans.map((plan, idx) => (
                  <tr
                    key={plan.id}
                    className={`group transition-colors ${
                      idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0c1322]'
                    } hover:bg-[#1e293b]`}
                  >
                    {/* Sr. No. (Sticky Left-0) */}
                    <td
                      className={`sticky left-0 z-10 ${
                        idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0c1322]'
                      } group-hover:bg-[#1e293b] transition-colors py-3 px-2 whitespace-nowrap w-12 min-w-[48px] max-w-[48px] text-center font-mono text-[11px] font-semibold text-slate-400 border-b border-slate-700 border-r border-slate-700/80`}
                    >
                      {idx + 1}
                    </td>

                    {/* Plan Name & ID (Sticky Left-[48px]) */}
                    <td
                      className={`sticky left-[48px] z-10 ${
                        idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0c1322]'
                      } group-hover:bg-[#1e293b] transition-colors py-3 px-4 whitespace-nowrap min-w-[190px] border-b border-slate-700 border-r border-slate-700 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.5)]`}
                    >
                      <div className="flex flex-col gap-1">
                        <input
                          value={plan.name}
                          onChange={(event) => updatePlan(plan.id, 'name', event.target.value)}
                          className={textInputClass}
                          placeholder="Plan name"
                        />
                        <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">
                          ID: {plan.id}
                        </span>
                      </div>
                    </td>

                    {/* Status Toggle */}
                    <td className="py-3 px-3 min-w-[110px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                      <button
                        type="button"
                        onClick={() => updatePlan(plan.id, 'active', !plan.active)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                          plan.active
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                            : 'border-slate-700 bg-slate-900 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {plan.active ? <ToggleRight className="h-3.5 w-3.5 text-emerald-400" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                        <span>{plan.active ? 'Active' : 'Paused'}</span>
                      </button>
                    </td>

                    {/* Storage Capacity */}
                    <td className="py-3 px-3 min-w-[130px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                      <div className="flex flex-col gap-1">
                        <input
                          value={plan.storageLabel}
                          onChange={(event) => updatePlan(plan.id, 'storageLabel', event.target.value)}
                          className="w-24 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1.5 text-xs font-semibold text-white outline-none transition-all focus:border-indigo-500/60 focus:bg-slate-900 focus:ring-1 focus:ring-indigo-500/30"
                          placeholder="e.g. 10 GB"
                        />
                        <span className="text-[10px] text-slate-500 font-mono">
                          {plan.storageGb} GB capacity
                        </span>
                      </div>
                    </td>

                    {/* Events Allowed */}
                    <td className="py-3 px-3 min-w-[100px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                      <input
                        type="number"
                        min={0}
                        value={plan.events}
                        onChange={(event) => updatePlan(plan.id, 'events', toNumber(event.target.value))}
                        className={numberInputClass}
                      />
                    </td>

                    {/* Image Upload Toggle */}
                    <td className="py-3 px-3 min-w-[110px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                      <button
                        type="button"
                        onClick={() => updatePlan(plan.id, 'imageUpload', !plan.imageUpload)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                          plan.imageUpload
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20'
                        }`}
                      >
                        {plan.imageUpload ? <Check className="h-3.5 w-3.5" /> : <CircleOff className="h-3.5 w-3.5" />}
                        <span>{plan.imageUpload ? 'Allowed' : 'Blocked'}</span>
                      </button>
                    </td>

                    {/* Video Upload Toggle */}
                    <td className="py-3 px-3 min-w-[150px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updatePlan(plan.id, 'videoUpload', !plan.videoUpload)}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                            plan.videoUpload
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20'
                          }`}
                        >
                          {plan.videoUpload ? <Check className="h-3.5 w-3.5" /> : <CircleOff className="h-3.5 w-3.5" />}
                          <span>{plan.videoUpload ? 'Allowed' : 'Blocked'}</span>
                        </button>
                        {plan.videoLimitMb ? (
                          <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                            {plan.videoLimitMb} MB
                          </span>
                        ) : null}
                      </div>
                    </td>

                    {/* Monthly Actual Price */}
                    <td className="py-3 px-3 min-w-[125px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80 text-right">
                      <input
                        type="number"
                        min={0}
                        value={plan.monthlyActualPrice}
                        onChange={(event) => updatePlan(plan.id, 'monthlyActualPrice', toNumber(event.target.value))}
                        className={numberInputClass}
                      />
                    </td>

                    {/* Monthly Selling Price */}
                    <td className="py-3 px-3 min-w-[125px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80 text-right">
                      <input
                        type="number"
                        min={0}
                        value={plan.monthlyPrice}
                        onChange={(event) => updatePlan(plan.id, 'monthlyPrice', toNumber(event.target.value))}
                        className={numberInputClass}
                      />
                    </td>

                    {/* 3M Actual Price */}
                    <td className="py-3 px-3 min-w-[125px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80 text-right">
                      <input
                        type="number"
                        min={0}
                        value={plan.threeMonthActualPrice}
                        onChange={(event) => updatePlan(plan.id, 'threeMonthActualPrice', toNumber(event.target.value))}
                        className={numberInputClass}
                      />
                    </td>

                    {/* 3M Selling Price */}
                    <td className="py-3 px-3 min-w-[125px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80 text-right">
                      <input
                        type="number"
                        min={0}
                        value={plan.threeMonthPrice}
                        onChange={(event) => updatePlan(plan.id, 'threeMonthPrice', toNumber(event.target.value))}
                        className={numberInputClass}
                      />
                    </td>

                    {/* 6M Actual Price */}
                    <td className="py-3 px-3 min-w-[125px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80 text-right">
                      <input
                        type="number"
                        min={0}
                        value={plan.sixMonthActualPrice}
                        onChange={(event) => updatePlan(plan.id, 'sixMonthActualPrice', toNumber(event.target.value))}
                        className={numberInputClass}
                      />
                    </td>

                    {/* 6M Selling Price */}
                    <td className="py-3 px-3 min-w-[125px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80 text-right">
                      <input
                        type="number"
                        min={0}
                        value={plan.sixMonthPrice}
                        onChange={(event) => updatePlan(plan.id, 'sixMonthPrice', toNumber(event.target.value))}
                        className={numberInputClass}
                      />
                    </td>

                    {/* Yearly Actual Price */}
                    <td className="py-3 px-3 min-w-[125px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80 text-right">
                      <input
                        type="number"
                        min={0}
                        value={plan.yearlyActualPrice}
                        onChange={(event) => updatePlan(plan.id, 'yearlyActualPrice', toNumber(event.target.value))}
                        className={numberInputClass}
                      />
                    </td>

                    {/* Yearly Selling Price */}
                    <td className="py-3 px-3 min-w-[125px] whitespace-nowrap border-b border-slate-700 text-right">
                      <input
                        type="number"
                        min={0}
                        value={plan.discountedYearlyPrice}
                        onChange={(event) => updatePlan(plan.id, 'discountedYearlyPrice', toNumber(event.target.value))}
                        className={numberInputClass}
                      />
                    </td>
                  </tr>
                ))}

                {filteredPlans.length === 0 && (
                  <tr>
                    <td
                      colSpan={15}
                      className="py-12 text-center text-slate-500 bg-slate-900/10 border-b border-slate-700"
                    >
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Package className="w-8 h-8 text-slate-600" />
                        <p className="text-base font-semibold text-slate-300">No pricing plans found</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          No plans match your current search query. Try clearing the search filter.
                        </p>
                        {search && (
                          <button
                            type="button"
                            onClick={() => setSearch('')}
                            className="mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                          >
                            Clear search filter
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

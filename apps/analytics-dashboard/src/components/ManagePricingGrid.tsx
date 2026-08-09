import React, { useEffect, useMemo, useState } from 'react';
import { Check, CircleOff, RotateCcw, Save, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { runAdminAction } from '../lib/adminApi';

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
  'w-24 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-right text-sm font-semibold text-slate-100 outline-none transition-colors focus:border-cyan-500/60';

const textInputClass =
  'w-36 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-slate-100 outline-none transition-colors focus:border-cyan-500/60';

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
        const response = await fetch(`${getApiBaseUrl()}/api/pricing-plans`, { cache: 'no-store' });
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
    const result = await runAdminAction('updatePricingPlans', { plans });

    if (!result.success) {
      setStatus('error');
      setMessage(result.error || 'Could not save pricing plans.');
      return;
    }

    setStatus('saved');
    setMessage('Pricing saved. The public pricing page will use these values now.');
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="rounded-3xl border border-slate-800 bg-[#111827]/80 p-6 shadow-xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">Pricing Control</p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-white">Manage Pricing</h3>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search plans"
                className="w-64 rounded-xl border border-slate-800 bg-slate-950/70 py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-cyan-500/60"
              />
            </div>

            <button
              type="button"
              onClick={resetPlans}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-2.5 text-sm font-bold text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-900"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Draft
            </button>

            <button
              type="button"
              onClick={saveDraft}
              disabled={!pricingTableReady || status === 'loading'}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-sm font-black text-cyan-200 transition-colors hover:bg-cyan-500/20"
            >
              <Save className="h-4 w-4" />
              Save Pricing
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active Plans</p>
            <p className="mt-2 text-2xl font-black text-white">{totals.active}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Monthly Stack</p>
            <p className="mt-2 text-2xl font-black text-emerald-300">{currency.format(totals.monthly)}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Discounted Yearly Stack</p>
            <p className="mt-2 text-2xl font-black text-cyan-300">{currency.format(totals.yearly)}</p>
          </div>
        </div>

        {(status !== 'idle' || message) && (
          <div
            className={`mt-5 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold ${
              status === 'error'
                ? 'border-rose-500/20 bg-rose-500/10 text-rose-200'
                : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            <Check className="h-4 w-4" />
            {message || (status === 'saved' ? 'Pricing saved.' : 'Loading pricing plans...')}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-800 bg-[#111827]/80 p-6 shadow-xl">
        <div className="overflow-x-auto rounded-2xl border border-slate-800/70">
          <table className="w-full min-w-[1680px] text-left text-sm">
            <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Plan</th>
                <th className="px-4 py-4">Storage</th>
                <th className="px-4 py-4">Events</th>
                <th className="px-4 py-4">Image Upload</th>
                <th className="px-4 py-4">Video Upload</th>
                <th className="px-4 py-4 text-right">Monthly Actual</th>
                <th className="px-4 py-4 text-right">Monthly Discounted</th>
                <th className="px-4 py-4 text-right">3 Months Actual</th>
                <th className="px-4 py-4 text-right">3 Months Discounted</th>
                <th className="px-4 py-4 text-right">6 Months Actual</th>
                <th className="px-4 py-4 text-right">6 Months Discounted</th>
                <th className="px-4 py-4 text-right">Yearly Actual</th>
                <th className="px-4 py-4 text-right">Yearly Discounted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredPlans.map((plan) => (
                <tr key={plan.id} className="text-slate-300 transition-colors hover:bg-slate-900/30">
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => updatePlan(plan.id, 'active', !plan.active)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${
                        plan.active
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : 'border-slate-700 bg-slate-900 text-slate-500'
                      }`}
                    >
                      {plan.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                      {plan.active ? 'Active' : 'Paused'}
                    </button>
                  </td>

                  <td className="px-4 py-4">
                    <input
                      value={plan.name}
                      onChange={(event) => updatePlan(plan.id, 'name', event.target.value)}
                      className={textInputClass}
                    />
                    <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-slate-600">{plan.id}</p>
                  </td>

                  <td className="px-4 py-4">
                    <input
                      value={plan.storageLabel}
                      onChange={(event) => updatePlan(plan.id, 'storageLabel', event.target.value)}
                      className="w-24 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm font-semibold text-slate-100 outline-none transition-colors focus:border-cyan-500/60"
                    />
                  </td>

                  <td className="px-4 py-4">
                    <input
                      type="number"
                      min={0}
                      value={plan.events}
                      onChange={(event) => updatePlan(plan.id, 'events', toNumber(event.target.value))}
                      className={numberInputClass}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => updatePlan(plan.id, 'imageUpload', !plan.imageUpload)}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black ${
                        plan.imageUpload ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
                      }`}
                    >
                      {plan.imageUpload ? <Check className="h-4 w-4" /> : <CircleOff className="h-4 w-4" />}
                      {plan.imageUpload ? 'Yes' : 'No'}
                    </button>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updatePlan(plan.id, 'videoUpload', !plan.videoUpload)}
                        className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-black ${
                          plan.videoUpload ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
                        }`}
                      >
                        {plan.videoUpload ? <Check className="h-4 w-4" /> : <CircleOff className="h-4 w-4" />}
                        {plan.videoUpload ? 'Yes' : 'No'}
                      </button>
                      {plan.videoLimitMb ? (
                        <span className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-amber-200">
                          {plan.videoLimitMb} MB
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <input
                      type="number"
                      min={0}
                      value={plan.monthlyActualPrice}
                      onChange={(event) => updatePlan(plan.id, 'monthlyActualPrice', toNumber(event.target.value))}
                      className={numberInputClass}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <input
                      type="number"
                      min={0}
                      value={plan.monthlyPrice}
                      onChange={(event) => updatePlan(plan.id, 'monthlyPrice', toNumber(event.target.value))}
                      className={numberInputClass}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <input
                      type="number"
                      min={0}
                      value={plan.threeMonthActualPrice}
                      onChange={(event) => updatePlan(plan.id, 'threeMonthActualPrice', toNumber(event.target.value))}
                      className={numberInputClass}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <input
                      type="number"
                      min={0}
                      value={plan.threeMonthPrice}
                      onChange={(event) => updatePlan(plan.id, 'threeMonthPrice', toNumber(event.target.value))}
                      className={numberInputClass}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <input
                      type="number"
                      min={0}
                      value={plan.sixMonthActualPrice}
                      onChange={(event) => updatePlan(plan.id, 'sixMonthActualPrice', toNumber(event.target.value))}
                      className={numberInputClass}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <input
                      type="number"
                      min={0}
                      value={plan.sixMonthPrice}
                      onChange={(event) => updatePlan(plan.id, 'sixMonthPrice', toNumber(event.target.value))}
                      className={numberInputClass}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <input
                      type="number"
                      min={0}
                      value={plan.yearlyActualPrice}
                      onChange={(event) => updatePlan(plan.id, 'yearlyActualPrice', toNumber(event.target.value))}
                      className={numberInputClass}
                    />
                  </td>

                  <td className="px-4 py-4">
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
                  <td colSpan={14} className="px-4 py-12 text-center text-sm font-bold text-slate-500">
                    No plans found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

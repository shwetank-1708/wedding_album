import React, { useState, useMemo } from 'react';
import type { UserProfile } from '../lib/analytics';
import {
  Search,
  Filter,
  Clock,
  Users,
  Layers,
  TrendingUp,
  Calendar,
  HardDrive,
  CheckCircle2,
  X
} from 'lucide-react';

interface Props {
  users: UserProfile[];
}

interface SubscriptionUnitStats {
  storageKey: string;
  storageName: string;
  durationKey: string;
  durationName: string;
  current: number;
  total: number;
  thisWeek: number;
  thisMonth: number;
  last6Months: number;
  lastYear: number;
}

const getSubscriptionDuration = (user: UserProfile) => {
  const role = user.role || 'free';
  const cleanRole = (role || 'free').toLowerCase();
  if (cleanRole === 'user' || cleanRole === 'free' || cleanRole === 'admin') {
    return '-';
  }

  const normalized = String(user.subscriptionDuration || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'quarterly' || normalized === '3_month' || normalized === '3_months') return '3 Month';
  if (normalized === 'half_yearly' || normalized === '6_month' || normalized === '6_months') return '6 Month';
  if (normalized === 'yearly' || normalized === 'annual') return 'Yearly';
  return '1 Month';
};

const getStoragePlan = (role: string) => {
  const cleanRole = (role || 'free').toLowerCase();
  if (cleanRole === 'admin') return "1 TB";
  if (cleanRole === 'ultimate') return "1 TB";
  if (cleanRole === 'elite') return "500 GB";
  if (cleanRole === 'pro') return "200 GB";
  if (cleanRole === 'premium') return "100 GB";
  if (cleanRole === 'standard') return "50 GB";
  if (cleanRole === 'basic') return "25 GB";
  if (cleanRole === 'starter') return "10 GB";
  return "Free Plan";
};

export const PlanDetailsGrid: React.FC<Props> = ({ users }) => {
  const [search, setSearch] = useState('');
  const [storageFilter, setStorageFilter] = useState('all');
  const [durationFilter, setDurationFilter] = useState('all');

  const storageTiers = ["Free Plan", "10 GB", "25 GB", "50 GB", "100 GB", "200 GB", "500 GB", "1 TB"];
  const durationTiers = ["1 Month", "3 Month", "6 Month", "Yearly"];

  const unitsData = useMemo(() => {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const parseDate = (d?: string) => {
      if (!d) return null;
      const parsed = new Date(d);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    const matrix: SubscriptionUnitStats[] = [];

    // 1. Add the single Free Plan unit (no duration associated with it)
    const freeUsers = users.filter(user => {
      const uStorage = getStoragePlan(user.role || 'free');
      return uStorage === "Free Plan";
    });

    let freeThisWeek = 0;
    let freeThisMonth = 0;
    let freeLast6Months = 0;
    let freeLastYear = 0;

    freeUsers.forEach(u => {
      const created = parseDate(u.createdAt);
      if (created) {
        if (created >= oneWeekAgo) freeThisWeek++;
        if (created >= oneMonthAgo) freeThisMonth++;
        if (created >= sixMonthsAgo) freeLast6Months++;
        if (created >= oneYearAgo) freeLastYear++;
      }
    });

    matrix.push({
      storageKey: "Free Plan",
      storageName: "Free Plan (1 GB)",
      durationKey: "-",
      durationName: "-",
      current: freeUsers.length,
      total: freeUsers.length,
      thisWeek: freeThisWeek,
      thisMonth: freeThisMonth,
      last6Months: freeLast6Months,
      lastYear: freeLastYear
    });

    // 2. Add the paid plans (6 storage tiers * 4 durations = 24 units)
    const paidStorageTiers = ["10 GB", "25 GB", "50 GB", "100 GB", "200 GB", "500 GB", "1 TB"];
    
    paidStorageTiers.forEach(st => {
      durationTiers.forEach(dt => {
        const unitUsers = users.filter(user => {
          const uStorage = getStoragePlan(user.role || 'free');
          const uDuration = getSubscriptionDuration(user);
          return uStorage === st && uDuration === dt;
        });

        let thisWeek = 0;
        let thisMonth = 0;
        let last6Months = 0;
        let lastYear = 0;

        unitUsers.forEach(u => {
          const created = parseDate(u.createdAt);
          if (created) {
            if (created >= oneWeekAgo) thisWeek++;
            if (created >= oneMonthAgo) thisMonth++;
            if (created >= sixMonthsAgo) last6Months++;
            if (created >= oneYearAgo) lastYear++;
          }
        });

        matrix.push({
          storageKey: st,
          storageName: `${st} Plan`,
          durationKey: dt,
          durationName: `${dt} Billing`,
          current: unitUsers.length,
          total: unitUsers.length,
          thisWeek,
          thisMonth,
          last6Months,
          lastYear
        });
      });
    });

    return matrix;
  }, [users]);

  const filteredUnits = useMemo(() => {
    return unitsData.filter(unit => {
      const matchesSearch = 
        unit.storageName.toLowerCase().includes(search.toLowerCase()) ||
        unit.durationName.toLowerCase().includes(search.toLowerCase());

      const matchesStorage = 
        storageFilter === 'all' || 
        unit.storageKey.toLowerCase() === storageFilter.toLowerCase();

      const matchesDuration = 
        durationFilter === 'all' || 
        unit.durationKey.toLowerCase() === durationFilter.toLowerCase();

      return matchesSearch && matchesStorage && matchesDuration;
    });
  }, [unitsData, search, storageFilter, durationFilter]);

  // Sort units so active subscriptions bubble to the top
  const sortedUnits = useMemo(() => {
    return [...filteredUnits].sort((a, b) => b.current - a.current);
  }, [filteredUnits]);

  // Compute aggregated sums for filtered results
  const aggregateStats = useMemo(() => {
    return filteredUnits.reduce((acc, unit) => {
      acc.current += unit.current;
      acc.total += unit.total;
      acc.thisWeek += unit.thisWeek;
      acc.thisMonth += unit.thisMonth;
      acc.last6Months += unit.last6Months;
      acc.lastYear += unit.lastYear;
      return acc;
    }, { current: 0, total: 0, thisWeek: 0, thisMonth: 0, last6Months: 0, lastYear: 0 });
  }, [filteredUnits]);

  const hasActiveFilters = search !== '' || storageFilter !== 'all' || durationFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStorageFilter('all');
    setDurationFilter('all');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Quick Analytics Cards Matching UserGrid Glassmorphism Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Active Subscriptions */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-indigo-500/10 blur-2xl transition-all duration-500 group-hover:bg-indigo-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Active Subscribers
            </span>
            <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-2.5 text-indigo-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-indigo-500/40 group-hover:bg-indigo-500/20">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-white transition-colors group-hover:text-indigo-300">
            {aggregateStats.current.toLocaleString()}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Current in Filter</span>
            </div>
            <span className="rounded border border-indigo-500/25 bg-indigo-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-300">
              {filteredUnits.length} units listed
            </span>
          </div>
        </div>

        {/* Card 2: Total Subscribers Ever */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-xl hover:shadow-sky-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-sky-500/10 blur-2xl transition-all duration-500 group-hover:bg-sky-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              All-Time Subscribers
            </span>
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-2.5 text-sky-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-sky-500/40 group-hover:bg-sky-500/20">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-white transition-colors group-hover:text-sky-300">
            {aggregateStats.total.toLocaleString()}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span>Cumulative Total</span>
            </div>
            <span className="rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-sky-300">
              {storageTiers.length} storage tiers
            </span>
          </div>
        </div>

        {/* Card 3: Velocity (Weekly / Monthly Growth) */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl transition-all duration-500 group-hover:bg-emerald-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Monthly Growth
            </span>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2.5 text-emerald-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-emerald-500/40 group-hover:bg-emerald-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-emerald-400 transition-colors group-hover:text-emerald-300">
            +{aggregateStats.thisMonth.toLocaleString()}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>This Week: +{aggregateStats.thisWeek.toLocaleString()}</span>
            </div>
            <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">
              Last 30 Days
            </span>
          </div>
        </div>

        {/* Card 4: Long-Term Growth (6M / 1Y) */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-purple-500/10 blur-2xl transition-all duration-500 group-hover:bg-purple-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              6-Month Retention
            </span>
            <div className="rounded-xl border border-purple-500/25 bg-purple-500/10 p-2.5 text-purple-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-purple-500/40 group-hover:bg-purple-500/20">
              <Calendar className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-purple-400 transition-colors group-hover:text-purple-300">
            +{aggregateStats.last6Months.toLocaleString()}
          </h3>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-400" />
              <span>1 Year: +{aggregateStats.lastYear.toLocaleString()}</span>
            </div>
            <span className="rounded border border-purple-500/25 bg-purple-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-purple-300">
              Long-term
            </span>
          </div>
        </div>
      </div>

      {/* Main Table Card Container */}
      <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
        {/* Controls Toolbar: Search & Tier Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Subscription Units Breakdown</h3>
            <p className="text-slate-400 text-xs mt-1">
              Analyzing subscriber distribution across unique storage and billing cycle dimensions ({filteredUnits.length} units listed)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search plan sizes or billing..."
                value={search}
                onChange={e => setSearch(e.target.value)}
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

            {/* Storage Filter */}
            <div className="relative flex items-center">
              <Filter className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
              <select
                value={storageFilter}
                onChange={e => setStorageFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer placeholder-slate-600 transition-colors"
              >
                <option value="all">All Storage Tiers</option>
                {storageTiers.map((tier, idx) => (
                  <option key={idx} value={tier}>{tier}</option>
                ))}
              </select>
            </div>

            {/* Duration Filter */}
            <div className="relative flex items-center">
              <Clock className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
              <select
                value={durationFilter}
                onChange={e => setDurationFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer placeholder-slate-600 transition-colors"
              >
                <option value="all">All Durations</option>
                {durationTiers.map((dur, idx) => (
                  <option key={idx} value={dur}>{dur}</option>
                ))}
              </select>
            </div>

            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Reset all filters"
              >
                <X className="w-3.5 h-3.5 text-rose-400" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

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

                  {/* Storage Plan (Sticky Left-[48px]) */}
                  <th
                    scope="col"
                    className="sticky left-[48px] z-20 bg-[#0f1422] py-3.5 px-4 min-w-[200px] border-r border-slate-700 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.5)]"
                  >
                    Storage Plan
                  </th>

                  {/* Billing Cycle */}
                  <th scope="col" className="py-3.5 px-4 min-w-[130px] border-r border-slate-700">
                    Billing Cycle
                  </th>

                  {/* Current Active */}
                  <th scope="col" className="py-3.5 px-4 min-w-[130px] border-r border-slate-700">
                    Current Active
                  </th>

                  {/* Total Subs */}
                  <th scope="col" className="py-3.5 px-4 min-w-[110px] border-r border-slate-700">
                    Total Subs
                  </th>

                  {/* This Week */}
                  <th scope="col" className="py-3.5 px-4 min-w-[110px] border-r border-slate-700">
                    This Week
                  </th>

                  {/* This Month */}
                  <th scope="col" className="py-3.5 px-4 min-w-[110px] border-r border-slate-700">
                    This Month
                  </th>

                  {/* Last 6 Months */}
                  <th scope="col" className="py-3.5 px-4 min-w-[120px] border-r border-slate-700">
                    Last 6 Months
                  </th>

                  {/* Last Year */}
                  <th scope="col" className="py-3.5 px-4 min-w-[110px] border-r border-slate-700">
                    Last Year
                  </th>

                  {/* Share of Active */}
                  <th scope="col" className="py-3.5 px-4 min-w-[120px] text-right">
                    Active Share
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {sortedUnits.map((unit, idx) => {
                  const isActive = unit.current > 0;
                  const activeShare = aggregateStats.current > 0
                    ? ((unit.current / aggregateStats.current) * 100).toFixed(1)
                    : '0.0';

                  return (
                    <tr
                      key={idx}
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

                      {/* Storage Plan (Sticky Left-[48px]) */}
                      <td
                        className={`sticky left-[48px] z-10 ${
                          idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0c1322]'
                        } group-hover:bg-[#1e293b] transition-colors py-3 px-4 whitespace-nowrap min-w-[200px] border-b border-slate-700 border-r border-slate-700 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.5)]`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <div
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isActive ? 'bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]' : 'bg-slate-700'
                            }`}
                          />
                          <span
                            className={`font-semibold text-xs ${
                              isActive ? 'text-white' : 'text-slate-400'
                            }`}
                          >
                            {unit.storageName}
                          </span>
                        </div>
                      </td>

                      {/* Billing Cycle */}
                      <td className="py-3 px-4 min-w-[130px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                            unit.durationKey === '-'
                              ? 'bg-slate-800/60 text-slate-400 border border-slate-700/60'
                              : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/25'
                          }`}
                        >
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{unit.durationKey}</span>
                        </span>
                      </td>

                      {/* Current Active */}
                      <td className="py-3 px-4 min-w-[130px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 text-xs font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{unit.current.toLocaleString()}</span>
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-500">0</span>
                        )}
                      </td>

                      {/* Total Subs */}
                      <td className="py-3 px-4 min-w-[110px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        <span className={`text-xs font-semibold ${isActive ? 'text-slate-200' : 'text-slate-500'}`}>
                          {unit.total.toLocaleString()}
                        </span>
                      </td>

                      {/* This Week */}
                      <td className="py-3 px-4 min-w-[110px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        {unit.thisWeek > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold">
                            +{unit.thisWeek}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </td>

                      {/* This Month */}
                      <td className="py-3 px-4 min-w-[110px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        {unit.thisMonth > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-300 text-xs font-semibold">
                            +{unit.thisMonth}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </td>

                      {/* Last 6 Months */}
                      <td className="py-3 px-4 min-w-[120px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        {unit.last6Months > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold">
                            +{unit.last6Months}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </td>

                      {/* Last Year */}
                      <td className="py-3 px-4 min-w-[110px] whitespace-nowrap border-b border-slate-700 border-r border-slate-700/80">
                        {unit.lastYear > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold">
                            +{unit.lastYear}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </td>

                      {/* Share of Active */}
                      <td className="py-3 px-4 min-w-[120px] whitespace-nowrap border-b border-slate-700 text-right">
                        <span className={`font-mono text-xs ${isActive ? 'text-slate-300 font-semibold' : 'text-slate-600'}`}>
                          {activeShare}%
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {sortedUnits.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-12 text-center text-slate-500 bg-slate-900/10 border-b border-slate-700"
                    >
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <HardDrive className="w-8 h-8 text-slate-600" />
                        <p className="text-base font-semibold text-slate-300">No subscription units found</p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          No plans match your current search or tier filters. Try resetting the filters.
                        </p>
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="mt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                          >
                            Reset filters
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

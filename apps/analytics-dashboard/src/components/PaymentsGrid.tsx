import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { runAdminAction } from '../lib/adminApi';
import type { UserProfile, Event, Photo } from '../lib/analytics';
import { UserDetailPage } from './UserDetailPage';
import {
  Search,
  Filter,
  CreditCard,
  Banknote,
  CheckCircle2,
  XCircle,
  AlertCircle,
  PlusCircle,
  RefreshCw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Trash2,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

export interface PaymentRecord {
  id: string;
  user_id: string;
  amount: number | string;
  currency: string;
  status: 'captured' | 'failed' | 'refunded' | 'manual_offline';
  plan_id: string;
  billing_duration?: string | null;
  payment_gateway: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  failure_reason?: string | null;
  notes?: string | null;
  created_at: string;
}

interface PaymentsGridProps {
  users: UserProfile[];
  events?: Event[];
  photos?: Photo[];
  onPlanChange?: (userId: string, role: string) => Promise<void> | void;
  onDurationChange?: (userId: string, duration: string) => Promise<void> | void;
  onPlanDatesChange?: (userId: string, startDate: string, endDate: string) => Promise<void> | void;
  onDeleteEvent?: (eventId: string) => Promise<void> | void;
  onToggleSampleGallery?: (eventId: string, isSample: boolean) => Promise<void> | void;
}

const planTiers = [
  { role: 'starter', label: 'Starter Plan (10 GB)' },
  { role: 'basic', label: 'Basic Plan (25 GB)' },
  { role: 'standard', label: 'Standard Plan (50 GB)' },
  { role: 'premium', label: 'Premium Plan (100 GB)' },
  { role: 'pro', label: 'Pro Plan (200 GB)' },
  { role: 'elite', label: 'Elite Plan (500 GB)' },
  { role: 'ultimate', label: 'Ultimate Plan (1 TB)' },
  { role: 'custom', label: 'Custom Plan' },
];

export const PaymentsGrid: React.FC<PaymentsGridProps> = ({
  users,
  events,
  photos,
  onPlanChange,
  onDurationChange,
  onPlanDatesChange,
  onDeleteEvent,
  onToggleSampleGallery,
}) => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [gatewayFilter, setGatewayFilter] = useState<string>('all');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Detail view state
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Clipboard copy state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Record Payment Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalUserId, setModalUserId] = useState('');
  const [modalAmount, setModalAmount] = useState('');
  const [modalPlanId, setModalPlanId] = useState('starter');
  const [modalBillingDuration, setModalBillingDuration] = useState('yearly');
  const [modalPaymentGateway, setModalPaymentGateway] = useState('manual_upi');
  const [modalNotes, setModalNotes] = useState('');
  const [modalUpdateRole, setModalUpdateRole] = useState(true);
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Fetch payments
  useEffect(() => {
    let active = true;
    async function fetchPayments() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('payments')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data && active) {
          setPayments(data as PaymentRecord[]);
        }
      } catch (err) {
        console.error('Failed to load payments:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    fetchPayments();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  // Index users by ID for quick lookup
  const userMap = useMemo(() => {
    const map = new Map<string, UserProfile>();
    users.forEach(u => {
      if (u.id) map.set(u.id.toLowerCase().trim(), u);
    });
    return map;
  }, [users]);

  const copyToClipboard = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // High-level financial KPIs
  const kpiStats = useMemo(() => {
    const validPayments = payments.filter(p => p.status === 'captured' || p.status === 'manual_offline');
    const totalCollectedInr = validPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const razorpayCount = validPayments.filter(p => p.payment_gateway === 'razorpay').length;
    const manualCount = validPayments.filter(p => p.payment_gateway !== 'razorpay').length;
    const failedCount = payments.filter(p => p.status === 'failed').length;
    const avgTransactionInr = validPayments.length > 0 ? totalCollectedInr / validPayments.length : 0;

    return {
      totalCollectedInr,
      totalCount: validPayments.length,
      razorpayCount,
      manualCount,
      failedCount,
      avgTransactionInr,
    };
  }, [payments]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    const q = search.toLowerCase().trim();
    return payments.filter(p => {
      const user = userMap.get((p.user_id || '').toLowerCase().trim());
      const userName = (user?.name || '').toLowerCase();
      const userEmail = (user?.email || '').toLowerCase();
      const paymentId = (p.razorpay_payment_id || '').toLowerCase();
      const orderId = (p.razorpay_order_id || '').toLowerCase();
      const notes = (p.notes || '').toLowerCase();
      const failureReason = (p.failure_reason || '').toLowerCase();
      const plan = (p.plan_id || '').toLowerCase();

      const matchesSearch =
        !q ||
        userName.includes(q) ||
        userEmail.includes(q) ||
        p.user_id.toLowerCase().includes(q) ||
        paymentId.includes(q) ||
        orderId.includes(q) ||
        notes.includes(q) ||
        failureReason.includes(q) ||
        plan.includes(q);

      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesPlan = planFilter === 'all' || (p.plan_id || '').toLowerCase() === planFilter.toLowerCase();
      const matchesGateway = gatewayFilter === 'all' || p.payment_gateway === gatewayFilter;

      return matchesSearch && matchesStatus && matchesPlan && matchesGateway;
    });
  }, [payments, search, statusFilter, planFilter, gatewayFilter, userMap]);

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, currentPage, pageSize]);

  // Record Offline Payment Handler
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalUserId) {
      alert('Please select a customer');
      return;
    }
    const amt = parseFloat(modalAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await runAdminAction('recordPayment', {
        uid: modalUserId,
        amount: amt,
        planId: modalPlanId,
        billingDuration: modalBillingDuration,
        paymentGateway: modalPaymentGateway,
        notes: modalNotes,
        updateRole: modalUpdateRole,
      });

      if (res.success) {
        setShowModal(false);
        setModalAmount('');
        setModalNotes('');
        setRefreshKey(k => k + 1);
        if (modalUpdateRole && onPlanChange) {
          await onPlanChange(modalUserId, modalPlanId);
        }
      } else {
        alert(res.error || 'Failed to record payment');
      }
    } catch (err: any) {
      alert(err.message || 'Error recording payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Delete Payment Handler
  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Are you sure you want to delete this payment record? This cannot be undone.')) return;
    try {
      const res = await runAdminAction('deletePayment', { paymentId });
      if (res.success) {
        setRefreshKey(k => k + 1);
      } else {
        alert(res.error || 'Failed to delete payment');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting payment');
    }
  };

  // Detail View Drilldown
  const detailUser = useMemo(() => {
    if (!selectedUserId) return null;
    return users.find(u => u.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  if (detailUser) {
    return (
      <UserDetailPage
        user={detailUser}
        events={events}
        photos={photos}
        initialTab="cost"
        onBack={() => setSelectedUserId(null)}
        onPlanChange={onPlanChange}
        onDurationChange={onDurationChange}
        onPlanDatesChange={onPlanDatesChange}
        onDeleteEvent={onDeleteEvent}
        onToggleSampleGallery={onToggleSampleGallery}
      />
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Quick Analytics KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Revenue Collected */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-emerald-500/10 blur-2xl transition-all duration-500 group-hover:bg-emerald-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Total Revenue Collected
            </span>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-2.5 text-emerald-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-emerald-500/40 group-hover:bg-emerald-500/20">
              <Banknote className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-white font-mono group-hover:text-emerald-300 transition-colors">
            ₹{kpiStats.totalCollectedInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>{kpiStats.totalCount} successful payments</span>
          </div>
        </div>

        {/* Card 2: Payment Channels Breakdown */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-sky-500/40 hover:shadow-xl hover:shadow-sky-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-sky-500/10 blur-2xl transition-all duration-500 group-hover:bg-sky-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Payment Channels
            </span>
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 p-2.5 text-sky-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-sky-500/40 group-hover:bg-sky-500/20">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-white font-mono group-hover:text-sky-300 transition-colors">
            {kpiStats.razorpayCount} <span className="text-sm font-sans font-medium text-slate-500">online</span>
          </h3>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
            <span>{kpiStats.manualCount} manual offline / UPI transfers</span>
          </div>
        </div>

        {/* Card 3: Average Transaction Size */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-500/40 hover:shadow-xl hover:shadow-amber-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-amber-500/10 blur-2xl transition-all duration-500 group-hover:bg-amber-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Average Ticket Size
            </span>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-2.5 text-amber-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-amber-500/40 group-hover:bg-amber-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-white font-mono group-hover:text-amber-300 transition-colors">
            ₹{kpiStats.avgTransactionInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </h3>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            <span>Per completed transaction</span>
          </div>
        </div>

        {/* Card 4: Checkout Drop-offs & Failures */}
        <div className="group relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-[#0c1322]/90 p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-rose-500/40 hover:shadow-xl hover:shadow-rose-500/5">
          <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-rose-500/10 blur-2xl transition-all duration-500 group-hover:bg-rose-500/20" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors group-hover:text-slate-300">
              Failed Checkouts
            </span>
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-2.5 text-rose-400 shadow-inner transition-all duration-300 group-hover:scale-110 group-hover:border-rose-500/40 group-hover:bg-rose-500/20">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <h3 className="mt-2 text-3xl font-black tracking-tight text-white font-mono group-hover:text-rose-300 transition-colors">
            {kpiStats.failedCount}
          </h3>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-400" />
            <span>Identified customer drop-offs</span>
          </div>
        </div>
      </div>

      {/* 2. Main Payments Table Card */}
      <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        {/* Table Header and Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h4 className="text-lg font-bold text-white flex items-center gap-2.5">
              <span>Customer Payment Ledger</span>
              <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                {filteredPayments.length} records
              </span>
            </h4>
            <p className="text-slate-400 text-xs mt-0.5">
              Historical online Razorpay transactions, bank transfers, and manual offline receipts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search user, ID, notes..."
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 w-full sm:w-60 placeholder-slate-600 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="relative flex items-center">
              <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-3 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={e => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-7 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="captured">Paid (Captured)</option>
                <option value="manual_offline">Manual Offline</option>
                <option value="failed">Failed Checkouts</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>

            {/* Plan Filter */}
            <select
              value={planFilter}
              onChange={e => {
                setPlanFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer"
            >
              <option value="all">All Plans</option>
              {planTiers.map(p => (
                <option key={p.role} value={p.role}>{p.label}</option>
              ))}
            </select>

            {/* Gateway Filter */}
            <select
              value={gatewayFilter}
              onChange={e => {
                setGatewayFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 appearance-none cursor-pointer"
            >
              <option value="all">All Gateways</option>
              <option value="razorpay">Razorpay</option>
              <option value="manual_upi">Manual UPI</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="admin_override">Admin Override</option>
            </select>

            {/* Action Buttons */}
            <button
              type="button"
              onClick={() => {
                setModalUserId(users[0]?.id || '');
                setShowModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm shadow-emerald-950"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Record Offline Payment</span>
            </button>

            <button
              type="button"
              onClick={() => setRefreshKey(k => k + 1)}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-600 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* Payments Table */}
        <div className="overflow-x-auto border border-slate-800/60 rounded-2xl">
          <table className="w-full min-w-[1300px] text-left text-xs text-slate-400 border-separate border-spacing-0">
            <thead className="text-[11px] text-slate-500 uppercase bg-slate-900">
              <tr>
                <th scope="col" className="sticky left-0 z-20 bg-slate-900 py-3 px-3 whitespace-nowrap w-12 text-center border-b border-slate-800 border-r border-slate-700/80">
                  Sr.
                </th>
                  <th scope="col" className="sticky left-[48px] z-20 bg-slate-900 py-3 px-3 whitespace-nowrap min-w-[240px] max-w-[240px] border-b border-slate-800 border-r border-slate-700 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.5)]">
                    Customer Account
                  </th>
                  <th scope="col" className="py-3 px-3 whitespace-nowrap min-w-[120px] border-b border-slate-800">
                    Amount
                  </th>
                  <th scope="col" className="py-3 px-3 whitespace-nowrap min-w-[130px] border-b border-slate-800">
                    Status
                  </th>
                  <th scope="col" className="py-3 px-3 whitespace-nowrap min-w-[170px] border-b border-slate-800">
                    Plan Tier & Duration
                  </th>
                  <th scope="col" className="py-3 px-3 whitespace-nowrap min-w-[120px] border-b border-slate-800">
                    Gateway
                  </th>
                  <th scope="col" className="py-3 px-3 whitespace-nowrap min-w-[180px] border-b border-slate-800">
                    Transaction / Order ID
                  </th>
                  <th scope="col" className="py-3 px-3 whitespace-nowrap min-w-[200px] border-b border-slate-800">
                    Reference / Error Reason
                  </th>
                  <th scope="col" className="py-3 px-3 whitespace-nowrap min-w-[150px] border-b border-slate-800">
                    Payment Date
                  </th>
                  <th scope="col" className="py-3 px-3 whitespace-nowrap w-24 text-right border-b border-slate-800 pr-4">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedPayments.map((p, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const user = userMap.get((p.user_id || '').toLowerCase().trim());
                  const userName = user?.name || 'Unknown User';
                  const userEmail = user?.email || p.user_id;

                  const isCaptured = p.status === 'captured';
                  const isManual = p.status === 'manual_offline';
                  const isFailed = p.status === 'failed';
                  const isRefunded = p.status === 'refunded';

                  const rowBg = idx % 2 === 0 ? 'bg-[#111827]' : 'bg-[#0c1322]';

                  return (
                    <tr key={p.id} className={`group transition-colors ${rowBg} hover:bg-slate-800/50`}>
                      {/* 1. Sr. No. (Fixed) */}
                      <td className={`sticky left-0 z-10 ${rowBg} group-hover:bg-[#1e293b] transition-colors py-2.5 px-3 whitespace-nowrap text-center font-mono text-slate-400 border-b border-slate-700/80 border-r border-slate-700/80`}>
                        {globalIdx}
                      </td>

                      {/* 2. Customer Account (Fixed) */}
                      <td className={`sticky left-[48px] z-10 ${rowBg} group-hover:bg-[#1e293b] transition-colors py-2.5 px-3 whitespace-nowrap min-w-[240px] max-w-[240px] border-b border-slate-700/80 border-r border-slate-700 shadow-[4px_0_10px_-2px_rgba(0,0,0,0.5)]`}>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => setSelectedUserId(p.user_id)}
                            className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0 hover:scale-105 transition-transform cursor-pointer"
                            title="Inspect user details"
                          >
                            {userName[0]?.toUpperCase() || 'U'}
                          </button>
                          <div className="truncate flex-1">
                            <button
                              type="button"
                              onClick={() => setSelectedUserId(p.user_id)}
                              className="font-semibold text-white hover:text-indigo-400 transition-colors truncate block text-left text-xs cursor-pointer"
                              title={userName}
                            >
                              {userName}
                            </button>
                            <span className="text-[11px] text-slate-400 font-mono truncate block" title={userEmail}>
                              {userEmail}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Amount */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-sm border-b border-slate-800">
                        {isFailed ? (
                          <span className="text-slate-500 line-through">₹{Number(p.amount || 0).toFixed(2)}</span>
                        ) : (
                          <span className="text-emerald-400">₹{Number(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        )}
                      </td>

                      {/* 4. Status Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap border-b border-slate-800">
                        {isCaptured && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                            <CheckCircle2 className="w-3 h-3" /> Paid (Online)
                          </span>
                        )}
                        {isManual && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/25">
                            <Banknote className="w-3 h-3" /> Manual Offline
                          </span>
                        )}
                        {isFailed && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/25" title={p.failure_reason || 'Checkout dropped off'}>
                            <XCircle className="w-3 h-3" /> Failed
                          </span>
                        )}
                        {isRefunded && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                            <AlertCircle className="w-3 h-3" /> Refunded
                          </span>
                        )}
                      </td>

                      {/* 5. Plan Tier & Duration */}
                      <td className="py-2.5 px-3 whitespace-nowrap border-b border-slate-800">
                        <span className="font-semibold text-white capitalize">{p.plan_id || '—'}</span>
                        {p.billing_duration && (
                          <span className="text-slate-400 text-[11px] block capitalize">
                            Cycle: {p.billing_duration.replace('_', ' ')}
                          </span>
                        )}
                      </td>

                      {/* 6. Gateway */}
                      <td className="py-2.5 px-3 whitespace-nowrap capitalize text-slate-300 font-mono text-[11px] border-b border-slate-800">
                        {p.payment_gateway?.replace(/_/g, ' ') || 'Razorpay'}
                      </td>

                      {/* 7. Transaction / Order IDs */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] border-b border-slate-800">
                        {p.razorpay_payment_id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="truncate max-w-[120px] text-slate-300" title={p.razorpay_payment_id}>
                              {p.razorpay_payment_id}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(p.razorpay_payment_id!, `pay-${p.id}`)}
                              className="text-slate-500 hover:text-white"
                              title="Copy Payment ID"
                            >
                              {copiedField === `pay-${p.id}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : p.razorpay_order_id ? (
                          <span className="text-slate-400 truncate max-w-[120px] block" title={p.razorpay_order_id}>
                            Order: {p.razorpay_order_id}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* 8. Reference / Error Reason */}
                      <td className="py-2.5 px-3 max-w-[220px] truncate border-b border-slate-800 text-[11px]" title={p.failure_reason || p.notes || ''}>
                        {p.failure_reason ? (
                          <span className="text-rose-400 font-medium">{p.failure_reason}</span>
                        ) : p.notes ? (
                          <span className="text-slate-300">{p.notes}</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* 9. Payment Date */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-400 border-b border-slate-800">
                        {p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        }) : '—'}
                      </td>

                      {/* 10. Actions */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-right border-b border-slate-800 pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedUserId(p.user_id)}
                            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
                            title="Open user detail"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(p.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Delete transaction record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredPayments.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-slate-500 bg-[#0f1422]/60 border-b border-slate-800">
                      <CreditCard className="w-10 h-10 mx-auto mb-3 text-slate-600 opacity-60" />
                      <h5 className="text-base font-bold text-slate-300">No Payment Records Found</h5>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                        {search || statusFilter !== 'all' || planFilter !== 'all' || gatewayFilter !== 'all'
                          ? 'Try clearing your search filters to view all historical records.'
                          : 'Transactions will appear here automatically when users complete online checkouts or when you click "Record Offline Payment" above.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        {/* Pagination Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>
              {filteredPayments.length > 0 ? (
                <>
                  Showing <strong className="text-white">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
                  <strong className="text-white">{Math.min(currentPage * pageSize, filteredPayments.length)}</strong> of{' '}
                  <strong className="text-white">{filteredPayments.length}</strong> payments
                </>
              ) : (
                <>Showing <strong className="text-white">0</strong> of <strong className="text-white">0</strong> payments</>
              )}
            </span>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Per page:</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="px-3 py-1 font-mono text-xs text-slate-300 font-bold">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Record Offline Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-400" />
                <span>Record Customer Payment</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Customer / Account*</label>
                <select
                  required
                  value={modalUserId}
                  onChange={e => setModalUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} ({u.email || u.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Payment Amount (INR ₹)*</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="e.g. 25000"
                  value={modalAmount}
                  onChange={e => setModalAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Plan</label>
                  <select
                    value={modalPlanId}
                    onChange={e => setModalPlanId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  >
                    {planTiers.map(p => (
                      <option key={p.role} value={p.role}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Duration</label>
                  <select
                    value={modalBillingDuration}
                    onChange={e => setModalBillingDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly (3 Mo)</option>
                    <option value="half_yearly">Half Yearly (6 Mo)</option>
                    <option value="yearly">Yearly (12 Mo)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Payment Method / Gateway</label>
                <select
                  value={modalPaymentGateway}
                  onChange={e => setModalPaymentGateway(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="manual_upi">Direct UPI (GPay / PhonePe / Paytm)</option>
                  <option value="bank_transfer">Bank Transfer (IMPS / NEFT / RTGS)</option>
                  <option value="cash">Cash in hand</option>
                  <option value="cheque">Cheque</option>
                  <option value="razorpay_offline">Razorpay (Offline invoice)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Reference / UTR / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. PhonePe UTR 4829103948..."
                  value={modalNotes}
                  onChange={e => setModalNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={modalUpdateRole}
                    onChange={e => setModalUpdateRole(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                  />
                  <span>Also update user's plan and expiry date to this tier</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-900 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {submittingPayment ? 'Recording...' : 'Save Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

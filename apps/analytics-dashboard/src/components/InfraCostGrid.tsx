import React, { useState, useMemo, useEffect } from 'react';
import type { DashboardStats, UserProfile, Event, GuestLog, Photo } from '../lib/analytics';
import {
  DollarSign,
  HardDrive,
  Database,
  ShieldCheck,
  HelpCircle,
  Cloud,
  Sliders,
  TrendingUp,
  Activity,
  Globe,
  Info,
  Server,
  Sparkles,
  Search,
  Trash2,
  Cpu,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { runAdminAction, type AdminActionResult } from '../lib/adminApi';
import { supabase } from '../lib/supabase';

interface Props {
  stats: DashboardStats | null;
  users: UserProfile[];
  events: Event[];
  guests: GuestLog[];
  photos: Photo[];
}

type BackblazeUsage = {
  bucketName?: string;
  fileCount?: number;
  totalBytes?: number;
  totalGb?: number;
  timestamp?: string;
  error?: string;
  code?: string;
};

type BackblazeOrphanScan = Pick<
  AdminActionResult,
  'totalFiles' | 'orphanFiles' | 'orphanBytes' | 'referencedFiles' | 'deletedFiles' | 'deletedBytes'
>;

const formatSize = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const sizeIndex = Math.min(Math.max(0, i), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2)) + ' ' + sizes[sizeIndex];
};

const formatDecimalSize = (bytes: number | null | undefined) => {
  if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) return '0 B';
  if (bytes === 0) return '0 B';
  const k = 1000;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const sizeIndex = Math.min(Math.max(0, i), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, sizeIndex)).toFixed(2)) + ' ' + sizes[sizeIndex];
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat().format(num);
};

export const InfraCostGrid: React.FC<Props> = ({ stats, users, events, guests, photos }) => {
  const [activeSubTab, setActiveSubTab] = useState<'total' | 'supabase' | 'backblaze' | 'cloudflare' | 'modal' | 'railway'>('total');
  const [costChartMode, setCostChartMode] = useState<'actual' | 'simulated'>('actual');
  const [modalLogs, setModalLogs] = useState<any[]>([]);
  
  // Interactive Simulator States
  const [supabaseTier, setSupabaseTier] = useState<'free' | 'pro'>('free');
  
  // Live API Sync States
  const [liveBillingTier, setLiveBillingTier] = useState<string | null>(null);
  const [loadingBilling, setLoadingBilling] = useState<boolean>(false);

  // Cloudflare Live API States
  const [liveCfPlan, setLiveCfPlan] = useState<string | null>(null);
  const [liveCfTransformations, setLiveCfTransformations] = useState<number | null>(null);
  const [liveCfStoredImages, setLiveCfStoredImages] = useState<number | null>(null);
  const [liveCfSubscriptions, setLiveCfSubscriptions] = useState<any[]>([]);
  const [liveB2Usage, setLiveB2Usage] = useState<BackblazeUsage | null>(null);
  const [orphanScan, setOrphanScan] = useState<BackblazeOrphanScan | null>(null);
  const [orphanActionLoading, setOrphanActionLoading] = useState<'scan' | 'delete' | null>(null);
  const [orphanActionError, setOrphanActionError] = useState('');
  const [billingRefreshKey, setBillingRefreshKey] = useState(0);

  // Railway Live API States
  const [liveRailwayData, setLiveRailwayData] = useState<{
    projectName: string;
    cpuDollars: number;
    memoryDollars: number;
    networkDollars: number;
    totalEstimatedDollars: number;
    invoiceDollars: number | null;
    error?: string;
  } | null>(null);

  // Exchange Rate State (USD to INR)
  const [usdToInrRateInput, setUsdToInrRateInput] = useState<string>('100');
  const usdToInrRate = useMemo(() => {
    const parsed = parseFloat(usdToInrRateInput);
    return isNaN(parsed) || parsed <= 0 ? 100 : parsed;
  }, [usdToInrRateInput]);

  // Timeframe Filter States
  const [timeFilter, setTimeFilter] = useState<'1d' | '1w' | '1m' | '1y' | 'custom'>('1m');

  // Pagination States
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10;

  // Reset page when logs change
  useEffect(() => {
    setCurrentPage(1);
  }, [modalLogs.length]);

  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return modalLogs.slice(startIndex, startIndex + itemsPerPage);
  }, [modalLogs, currentPage]);

  const totalPages = Math.ceil(modalLogs.length / itemsPerPage);

  const pageNumbers = useMemo(() => {
    const range: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);
    
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }, [currentPage, totalPages]);

  // Format local timestamps (YYYY-MM-DDTHH:MM)
  const defaultCustomStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 3); // Default to 3 days ago for custom start
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  }, []);

  const defaultCustomEnd = useMemo(() => {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  }, []);

  const [customStart, setCustomStart] = useState<string>(defaultCustomStart);
  const [customEnd, setCustomEnd] = useState<string>(defaultCustomEnd);

  // Dynamic Timeframe Scaling Factor & Label
  const { timeframeFactor, timeframeSuffix, timeframeLabel } = useMemo(() => {
    if (timeFilter === '1d') {
      return { timeframeFactor: 1 / 30, timeframeSuffix: '/ day', timeframeLabel: 'Running Day' };
    }
    if (timeFilter === '1w') {
      return { timeframeFactor: 7 / 30, timeframeSuffix: '/ wk', timeframeLabel: 'Running Week' };
    }
    if (timeFilter === '1m') {
      return { timeframeFactor: 1, timeframeSuffix: '/ mo', timeframeLabel: 'Running Month' };
    }
    if (timeFilter === '1y') {
      return { timeframeFactor: 12, timeframeSuffix: '/ yr', timeframeLabel: 'Running Year' };
    }
    if (timeFilter === 'custom') {
      const s = new Date(customStart).getTime();
      const e = new Date(customEnd).getTime();
      const diffDays = Math.max(0.0416, (e - s) / (1000 * 60 * 60 * 24)); // At least 1 hr
      const factor = diffDays / 30;
      const suffix = diffDays < 1 ? `/ ${Math.round(diffDays * 24)}h` : `/ ${Math.round(diffDays)}d`;
      return { timeframeFactor: factor, timeframeSuffix: suffix, timeframeLabel: 'Custom Period' };
    }
    return { timeframeFactor: 1, timeframeSuffix: '/ mo', timeframeLabel: 'Running Month' };
  }, [timeFilter, customStart, customEnd]);

  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = now;
    
    if (timeFilter === '1d') {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      start = startOfDay;
    } else if (timeFilter === '1w') {
      const startOfWeek = new Date();
      startOfWeek.setHours(0, 0, 0, 0);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - (day === 0 ? 6 : day - 1);
      startOfWeek.setDate(diff);
      start = startOfWeek;
    } else if (timeFilter === '1m') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      start = startOfMonth;
    } else if (timeFilter === '1y') {
      const startOfYear = new Date();
      startOfYear.setMonth(0, 1);
      startOfYear.setHours(0, 0, 0, 0);
      start = startOfYear;
    } else { // 'custom'
      start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
      end = customEnd ? new Date(customEnd) : now;
    }
    
    return { start, end };
  }, [timeFilter, customStart, customEnd]);

  useEffect(() => {
    const fetchBilling = async () => {
      setLoadingBilling(true);
      try {
        const origin = window.location.origin;
        const apiBase = origin.includes('5173') ? 'http://localhost:3000' : '';
        
        // Fetch Supabase billing — isolated so failure doesn't block other fetches
        try {
          const res = await fetch(`${apiBase}/api/admin/supabase-billing`);
          if (res.ok) {
            const data = await res.json();
            if (data?.billing_tier?.id) {
              setLiveBillingTier(data.billing_tier.id);
              if (data.billing_tier.id === 'pro' || data.billing_tier.id === 'free') {
                setSupabaseTier(data.billing_tier.id);
              }
            }
          }
        } catch (err) {
          console.warn('[InfraCost] Supabase billing API unavailable (is Next.js running?):', err);
        }

        // Fetch Cloudflare billing — isolated so failure doesn't block other fetches
        try {
          const cfRes = await fetch(`${apiBase}/api/admin/cloudflare-billing`);
          if (cfRes.ok) {
            const cfData = await cfRes.json();
            if (cfData.zonePlan) {
              setLiveCfPlan(cfData.zonePlan);
            }
            if (typeof cfData.uniqueTransformations === 'number') {
              setLiveCfTransformations(cfData.uniqueTransformations);
            }
            if (typeof cfData.storedImages === 'number') {
              setLiveCfStoredImages(cfData.storedImages);
            }
            if (Array.isArray(cfData.subscriptions)) {
              setLiveCfSubscriptions(cfData.subscriptions);
            }
          }
        } catch (err) {
          console.warn('[InfraCost] Cloudflare billing API unavailable:', err);
        }

        // Fetch Backblaze B2 bucket usage — isolated so failure doesn't block other fetches
        try {
          const b2Res = await fetch(`${apiBase}/api/admin/backblaze-usage`);
          const b2Data = await b2Res.json().catch(() => null);
          if (b2Res.ok && b2Data) {
            setLiveB2Usage(b2Data);
            if (typeof b2Data.totalGb === 'number') {
              setSimulatedStorageGB(Math.max(50, Math.ceil(b2Data.totalGb)));
            }
          } else {
            setLiveB2Usage({
              bucketName: b2Data?.bucketName || 'EveBash',
              error: b2Data?.error || `Backblaze usage API returned status ${b2Res.status}`,
              code: b2Data?.code,
            });
          }
        } catch (err) {
          console.warn('[InfraCost] Backblaze usage API unavailable:', err);
        }

        // Fetch Railway billing — calls Railway GraphQL API directly (no Next.js needed)
        try {
          const railwayToken = import.meta.env.VITE_RAILWAY_API_TOKEN;
          const railwayProjectId = import.meta.env.VITE_RAILWAY_PROJECT_ID;

          if (railwayToken && railwayProjectId) {
            // Use Vite proxy /railway-gql → https://backboard.railway.app/graphql/v2 (avoids CORS)
            const RAILWAY_GQL = '/railway-gql';

            // Get project name
            let projectName = 'divine-optimism';
            try {
              const nameRes = await fetch(RAILWAY_GQL, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${railwayToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: `{ project(id: "${railwayProjectId}") { name } }` }),
              });
              if (nameRes.ok) {
                const nameData = await nameRes.json();
                projectName = nameData.data?.project?.name || projectName;
              }
            } catch (_) {}

            // Get usage metrics
            const usageRes = await fetch(RAILWAY_GQL, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${railwayToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: `{
                  usage(
                    projectId: "${railwayProjectId}",
                    measurements: [CPU_USAGE, MEMORY_USAGE_GB, NETWORK_TX_GB],
                    startDate: "${dateRange.start.toISOString()}",
                    endDate: "${dateRange.end.toISOString()}"
                  ) { measurement value }
                }`,
              }),
            });

            if (usageRes.ok) {
              const usageData = await usageRes.json();
              const items: { measurement: string; value: number }[] = usageData.data?.usage || [];

              let cpuVcpuMin = 0, memGbMin = 0, networkTxGb = 0;
              for (const item of items) {
                const v = Number(item.value) || 0;
                if (item.measurement === 'CPU_USAGE')       cpuVcpuMin  = v;
                if (item.measurement === 'MEMORY_USAGE_GB') memGbMin    = v;
                if (item.measurement === 'NETWORK_TX_GB')   networkTxGb = v;
              }

              // Convert minutes to seconds (as Railway API aggregation values are in vCPU-minutes and GB-minutes)
              const cpuVcpuSec = cpuVcpuMin * 60;
              const memGbSec = memGbMin * 60;

              const cpuDollars     = cpuVcpuSec  * 0.00000772;
              const memoryDollars  = memGbSec    * 0.00000386;
              const networkDollars = networkTxGb * 0.05;
              const totalEstimatedDollars = cpuDollars + memoryDollars + networkDollars;

              setLiveRailwayData({
                projectName,
                cpuDollars,
                memoryDollars,
                networkDollars,
                totalEstimatedDollars,
                invoiceDollars: null,
              });
            }
          } else {
            setLiveRailwayData({
              projectName: 'EveBash',
              cpuDollars: 0, memoryDollars: 0, networkDollars: 0,
              totalEstimatedDollars: 0, invoiceDollars: null,
              error: 'VITE_RAILWAY_API_TOKEN or VITE_RAILWAY_PROJECT_ID not set in dashboard .env',
            });
          }
        } catch (err) {
          console.warn('[InfraCost] Railway direct API call failed:', err);
        }
      } catch (err: any) {
        console.error('Failed to fetch live billing data:', err);
      } finally {
        setLoadingBilling(false);
      }
    };

    fetchBilling();
  }, [photos.length, billingRefreshKey, dateRange]);

  // Fetch Modal logs for the selected range when dateRange or billingRefreshKey changes
  useEffect(() => {
    const fetchModalLogs = async () => {
      try {
        const { data: logs, error: logsErr } = await supabase
          .from('modal_cost_logs')
          .select('*')
          .gte('created_at', dateRange.start.toISOString())
          .lte('created_at', dateRange.end.toISOString())
          .order('created_at', { ascending: false });
        
        if (logsErr) {
          console.error('[Modal] modal_cost_logs fetch error:', logsErr);
        } else if (logs) {
          setModalLogs(logs);
        }
      } catch (err) {
        console.error('Failed to fetch modal logs:', err);
      }
    };
    
    fetchModalLogs();
  }, [dateRange.start.toISOString(), dateRange.end.toISOString(), billingRefreshKey]);
  
  
  // Extract and default simulated storage
  const totalStorage = useMemo(() => {
    return photos.reduce((sum, p) => sum + (Number(p.size) || 0), 0);
  }, [photos]);
  const totalStorageGB = totalStorage / (1024 * 1024 * 1024);
  const liveB2Bytes = typeof liveB2Usage?.totalBytes === 'number' ? liveB2Usage.totalBytes : null;
  const actualB2StorageBytes = liveB2Bytes ?? totalStorage;
  const actualB2StorageGB = actualB2StorageBytes / (1024 * 1024 * 1024);
  const actualB2StorageDecimalGB = actualB2StorageBytes / 1000000000;
  const b2StorageSource = liveB2Bytes !== null ? 'Backblaze live bucket' : 'Database media fallback';
  const defaultSimStorage = Math.max(50, Math.ceil(totalStorageGB));
  const [simulatedStorageGB, setSimulatedStorageGB] = useState<number>(defaultSimStorage);
  
  // Simulated request rate for Cloudflare Workers
  const [simulatedDailyRequests, setSimulatedDailyRequests] = useState<number>(50000);



  // Simulated Railway Usage
  const [simulatedRailwayRAM, setSimulatedRailwayRAM] = useState<number>(0.5); // GB
  const [simulatedRailwayCPU, setSimulatedRailwayCPU] = useState<number>(0.05); // vCPU
  const [simulatedRailwayEgress, setSimulatedRailwayEgress] = useState<number>(5); // GB


  // --- Cost Calculations ---

  // Database Footprint Stats
  const dbStats = useMemo(() => {
    const profilesCount = stats?.totalUsers ?? users.length;
    const eventsCount = stats?.totalEvents ?? events.length;
    const guestsCount = stats?.totalGuests ?? guests.length;
    const photosCount = photos.length;
    const totalRows = profilesCount + eventsCount + guestsCount + photosCount;
    // Estimate size based on 1.2 KB average row size (including indexes)
    const estimatedSizeBytes = totalRows * 1228.8; 
    return { profilesCount, eventsCount, guestsCount, photosCount, totalRows, estimatedSizeBytes };
  }, [stats, users, events, guests, photos]);

  // Supabase Table overage calculations
  const supabaseDbCostMonth = useMemo(() => {
    const dbSizeGB = dbStats.estimatedSizeBytes / (1024 * 1024 * 1024);
    const limitGB = supabaseTier === 'free' ? 0.5 : 8.0;
    const dbOverageGB = Math.max(0, dbSizeGB - limitGB);
    return dbOverageGB * 0.125;
  }, [dbStats, supabaseTier]);
  
  const supabaseDbCostYear = supabaseDbCostMonth * 12;

  const supabaseMauCostMonth = useMemo(() => {
    const actualMAUs = stats?.mau || users.length;
    const limitMAUs = supabaseTier === 'free' ? 50000 : 100000;
    const mauOverage = Math.max(0, actualMAUs - limitMAUs);
    return mauOverage * 0.00325;
  }, [stats, users, supabaseTier]);

  const supabaseMauCostYear = supabaseMauCostMonth * 12;

  const supabaseEgressCostMonth = useMemo(() => {
    const limitEgressGB = supabaseTier === 'free' ? 2 : 50;
    const actualEgressGB = 0.05; // Bypass via Cloudflare Bandwidth Alliance
    const egressOverageGB = Math.max(0, actualEgressGB - limitEgressGB);
    return egressOverageGB * 0.09;
  }, [supabaseTier]);

  const supabaseEgressCostYear = supabaseEgressCostMonth * 12;

  const supabaseComputeCostMonth = supabaseTier === 'pro' ? 25.00 : 0.00;
  const supabaseComputeCostYear = supabaseComputeCostMonth * 12;

  // 1. Supabase Costs (Total actual or configured tier cost)
  const supabaseTierCost = supabaseDbCostMonth + supabaseMauCostMonth + supabaseEgressCostMonth + supabaseComputeCostMonth;

  // 2. Backblaze B2 Costs (Storage, Class B, Class C, Egress)
  
  // Storage Cost: $0.006/GB (First 10GB Free)
  const b2StorageCostMonth = Math.max(0, actualB2StorageDecimalGB - 10) * 0.006;
  const b2StorageCostYear = b2StorageCostMonth * 12;

  // Class B (downloads/metadata): 2,500/day = 75,000/month Free. Overage is $0.004 per 10k requests.
  // We assume ~20 requests per uploaded media resource monthly.
  const b2ClassBCallsMonth = photos.length * 20;
  const b2ClassBOverage = Math.max(0, b2ClassBCallsMonth - 75000);
  const b2ClassBCostMonth = (b2ClassBOverage / 10000) * 0.004;
  const b2ClassBCostYear = b2ClassBCostMonth * 12;

  // Class C (uploads/creation): 2,500/day = 75,000/month Free. Overage is $0.004 per 1k requests.
  // We assume ~1.5 request per uploaded media resource.
  const b2ClassCCallsMonth = Math.ceil(photos.length * 1.5);
  const b2ClassCOverage = Math.max(0, b2ClassCCallsMonth - 75000);
  const b2ClassCCostMonth = (b2ClassCOverage / 1000) * 0.004;
  const b2ClassCCostYear = b2ClassCCostMonth * 12;

  // Egress Cost: $0.00 (Due to Cloudflare Bandwidth Alliance)
  const b2EgressCostMonth = 0.00;

  // Total Actual B2 Cost
  const actualB2Cost = b2StorageCostMonth + b2ClassBCostMonth + b2ClassCCostMonth + b2EgressCostMonth;

  // B2 Simulated Costs (scaled based on simulatedStorageGB)
  const simStorageCostMonth = Math.max(0, simulatedStorageGB - 10) * 0.006;
  
  // Scale media count proportionally to simulated storage size
  const simMediaCount = Math.ceil(photos.length * (simulatedStorageGB / Math.max(1, actualB2StorageGB || 1)));
  
  const simClassBCallsMonth = simMediaCount * 20;
  const simClassBOverage = Math.max(0, simClassBCallsMonth - 75000);
  const simClassBCostMonth = (simClassBOverage / 10000) * 0.004;

  const simClassCCallsMonth = Math.ceil(simMediaCount * 1.5);
  const simClassCOverage = Math.max(0, simClassCCallsMonth - 75000);
  const simClassCCostMonth = (simClassCOverage / 1000) * 0.004;

  const simulatedB2Cost = simStorageCostMonth + simClassBCostMonth + simClassCCostMonth;

  // 3. Cloudflare Costs
  const registrarCost = 0.00; // Domain registered externally via Hostinger
  const monthlyRequests = simulatedDailyRequests * 30;

  // Actual Image Resizing/Transformations: Calculated dynamically from live API values
  const actualCfImageCostMonth = useMemo(() => {
    let cost = 0;
    
    // 1. Remote Image Resizing transformations cost (first 5,000 free, then $0.50 per 1,000 unique transformations)
    if (liveCfTransformations !== null) {
      const overageTransformations = Math.max(0, liveCfTransformations - 5000);
      cost += (overageTransformations / 1000) * 0.50;
    }
    
    // 2. Cloudflare Images storage cost (if using Cloudflare Images product)
    if (liveCfStoredImages !== null && liveCfStoredImages > 0) {
      cost += 5.00; // Base $5.00/mo subscription (includes 10,000 stored images)
      const overageImages = Math.max(0, liveCfStoredImages - 10000);
      cost += (overageImages / 10000) * 1.00;
    }
    
    return cost;
  }, [liveCfTransformations, liveCfStoredImages]);

  // Simulated Image Resizing/Transformations: Set to $0.00 as transformations are pre-generated on B2 via backend
  const simCfImageCostMonth = 0;
  
  // Workers Paid Tier starts at $5/mo (first 10M requests free, then $0.50/M requests)
  // Free tier allows up to 100k requests/day (3M requests/mo)
  const workersCost = useMemo(() => {
    if (monthlyRequests <= 3000000) {
      return 0.00; // Free plan
    }
    if (monthlyRequests <= 10000000) {
      return 5.00; // Paid Plan base (includes 10M requests)
    }
    const extraRequests = monthlyRequests - 10000000;
    const extraMillions = Math.ceil(extraRequests / 1000000);
    return 5.00 + (extraMillions * 0.50);
  }, [monthlyRequests]);

  // Actual subscription costs fetched live (e.g. Pro Plan, image resizing subscription bases, paid workers/KV bases)
  const liveCfSubscriptionCost = useMemo(() => {
    let subscriptionSum = 0;
    let hasZonePlanInSubscriptions = false;

    if (Array.isArray(liveCfSubscriptions) && liveCfSubscriptions.length > 0) {
      subscriptionSum = liveCfSubscriptions.reduce((sum, sub) => {
        if (sub.state === 'active' || sub.state === 'paid') {
          const freqMultiplier = sub.frequency === 'yearly' ? 1 / 12 : 1;
          
          // Check if this subscription is for a zone plan
          const ratePlanId = (sub.rate_plan?.id || '').toLowerCase();
          if (ratePlanId.includes('pro') || ratePlanId.includes('business')) {
            hasZonePlanInSubscriptions = true;
          }
          
          return sum + ((sub.price || 0) * freqMultiplier);
        }
        return sum;
      }, 0);
    }

    // Fallback: If zone plan is active but not represented in the subscription list, add its default cost
    if (!hasZonePlanInSubscriptions) {
      const normalizedPlan = (liveCfPlan || '').toLowerCase();
      if (normalizedPlan.includes('pro')) {
        subscriptionSum += 25.00; // $25.00 Pro Plan (₹2,500/mo)
      } else if (normalizedPlan.includes('business')) {
        subscriptionSum += 200.00; // $200.00 Business Plan (₹20,000/mo)
      }
    }

    return subscriptionSum;
  }, [liveCfSubscriptions, liveCfPlan]);

  const actualCloudflareCost = registrarCost + actualCfImageCostMonth + liveCfSubscriptionCost;
  const simulatedCloudflareCost = registrarCost + workersCost + simCfImageCostMonth;

  // 3b. Modal.com actual costs
  const actualModalCostInfo = useMemo(() => {
    let totalUsd = 0;
    modalLogs.forEach(log => {
      const duration = Number(log.execution_time_seconds) || 0;
      const cpu = Number(log.cpu_cores) || 1.0;
      const mem = Number(log.memory_gb) || 1.0;
      totalUsd += duration * ((cpu * 0.0000131) + (mem * 0.00000222));
    });
    return {
      usd: totalUsd,
      inr: totalUsd * usdToInrRate
    };
  }, [modalLogs, usdToInrRate]);

  const actualModalCost = actualModalCostInfo.usd;

  // Modal.com metrics breakdown
  const modalStats = useMemo(() => {
    let photosCount = 0;
    let selfiesCount = 0;
    let batchesCount = 0;
    let totalFaces = 0;
    let totalDuration = 0;

    modalLogs.forEach(log => {
      const fn = log.function_name || 'process_single_photo';
      if (fn === 'process_single_photo') {
        photosCount++;
      } else if (fn === 'find_matching_photos') {
        selfiesCount++;
      } else if (fn === 'process_media_batch') {
        batchesCount++;
      }

      totalFaces += Number(log.faces_detected) || 0;
      totalDuration += Number(log.execution_time_seconds) || 0;
    });

    return {
      photosCount,
      selfiesCount,
      batchesCount,
      totalFaces,
      avgDuration: modalLogs.length > 0 ? totalDuration / modalLogs.length : 0,
    };
  }, [modalLogs]);

  // 3c. Railway.app actual/simulated costs
  // Railway bills per SECOND: CPU @ $0.00000772/vCPU/sec, RAM @ $0.00000386/GB/sec, Egress @ $0.05/GB
  // 30 days = 2,592,000 seconds/month
  const railwaySecondsPerMonth = 2592000; // 30 days * 24 hours * 3600 seconds
  const railwayRamCostMonth = simulatedRailwayRAM * 0.00000386 * railwaySecondsPerMonth;
  const railwayCpuCostMonth = simulatedRailwayCPU * 0.00000772 * railwaySecondsPerMonth;
  const railwayEgressCostMonth = simulatedRailwayEgress * 0.05;
  const simulatedRailwayCost = railwayRamCostMonth + railwayCpuCostMonth + railwayEgressCostMonth;

  // If live Railway data is available, prefer the real invoice/estimated total
  const hasLiveRailway = liveRailwayData && !liveRailwayData.error && liveRailwayData.totalEstimatedDollars > 0;
  const actualRailwayCost = hasLiveRailway
    ? (liveRailwayData.invoiceDollars ?? liveRailwayData.totalEstimatedDollars)
    : simulatedRailwayCost;

  // 4. Combined Totals
  const actualTotalCost = supabaseTierCost + actualB2Cost + actualCloudflareCost + actualModalCost + actualRailwayCost;
  const simulatedTotalCost = supabaseTierCost + simulatedB2Cost + simulatedCloudflareCost + actualModalCost + actualRailwayCost;

  // Media breakdown stats
  const mediaBreakdown = useMemo(() => {
    let photoCount = 0;
    let photoSize = 0;
    let videoCount = 0;
    let videoSize = 0;

    photos.forEach(p => {
      if (p.mediaType === 'video') {
        videoCount++;
        videoSize += p.size;
      } else {
        photoCount++;
        photoSize += p.size;
      }
    });

    return { photoCount, photoSize, videoCount, videoSize };
  }, [photos]);

  const handleScanBackblazeOrphans = async () => {
    setOrphanActionLoading('scan');
    setOrphanActionError('');
    try {
      const result = await runAdminAction('scanBackblazeOrphans');
      if (!result.success) {
        setOrphanActionError(result.error || 'Could not scan Backblaze orphan files.');
        return;
      }
      setOrphanScan(result);
    } catch (error: any) {
      setOrphanActionError(error?.message || 'Could not scan Backblaze orphan files.');
    } finally {
      setOrphanActionLoading(null);
    }
  };

  const handleDeleteBackblazeOrphans = async () => {
    const typed = window.prompt('This deletes Backblaze files not referenced by the database. Type DELETE to continue.');
    if (typed !== 'DELETE') return;

    setOrphanActionLoading('delete');
    setOrphanActionError('');
    try {
      const result = await runAdminAction('deleteBackblazeOrphans', {
        confirm: 'DELETE_ORPHAN_B2_FILES',
      });
      if (!result.success) {
        setOrphanActionError(result.error || 'Could not delete Backblaze orphan files.');
        return;
      }
      setOrphanScan(result);
      setBillingRefreshKey(key => key + 1);
    } catch (error: any) {
      setOrphanActionError(error?.message || 'Could not delete Backblaze orphan files.');
    } finally {
      setOrphanActionLoading(null);
    }
  };

  // Shared Helper: Render Timeframe & Exchange Rate Filter Bar
  const renderFilterBar = (activeBgClass: string, textThemeClass: string) => {
    return (
      <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-3">
          <Sliders className={`w-5 h-5 ${textThemeClass}`} />
          <div>
            <h4 className="text-sm font-bold text-white">Timeframe & Exchange Rate</h4>
            <p className="text-[10px] text-slate-400">Filter cost calculations, adjust exchange rate conversions.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* USD to INR Rate Setter */}
          <div className="flex items-center space-x-1.5 bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1">
            <span className="text-[9px] font-bold text-slate-500 uppercase">Rate ($1 = ₹):</span>
            <input
              type="text"
              inputMode="decimal"
              value={usdToInrRateInput}
              onChange={e => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setUsdToInrRateInput(val);
                }
              }}
              className="bg-transparent text-white text-[10px] border-0 outline-none focus:ring-0 w-12 text-center font-bold"
            />
          </div>

          {/* Presets */}
          <div className="bg-slate-900/60 p-1 border border-slate-800 rounded-xl flex gap-1">
            {(['1d', '1w', '1m', 'custom'] as const).map(preset => {
              const labelMap: Record<string, string> = {
                '1d': 'Running Day',
                '1w': 'Running Week',
                '1m': 'Running Month',
                'custom': 'Custom'
              };
              const isActive = timeFilter === preset;
              return (
                <button
                  key={preset}
                  onClick={() => setTimeFilter(preset)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-150 cursor-pointer ${
                    isActive
                      ? `${activeBgClass} text-white`
                      : 'text-slate-450 hover:text-slate-200'
                  }`}
                >
                  {labelMap[preset]}
                </button>
              );
            })}
          </div>

          {/* Custom Date Time Pickers */}
          {timeFilter === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 animate-fadeIn">
              <div className="flex items-center space-x-1.5 bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Start:</span>
                <input
                  type="datetime-local"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  onClick={e => (e.target as any).showPicker?.()}
                  style={{ colorScheme: 'dark' }}
                  className="bg-transparent text-white text-[10px] border-0 outline-none focus:ring-0 cursor-pointer w-[155px]"
                />
              </div>
              <div className="flex items-center space-x-1.5 bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase">End:</span>
                <input
                  type="datetime-local"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  onClick={e => (e.target as any).showPicker?.()}
                  style={{ colorScheme: 'dark' }}
                  className="bg-transparent text-white text-[10px] border-0 outline-none focus:ring-0 cursor-pointer w-[155px]"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Navigation Subtabs
  const tabs = [
    { id: 'total', label: 'Total Cost', icon: DollarSign },
    { id: 'supabase', label: 'Supabase', icon: Database },
    { id: 'backblaze', label: 'Backblaze B2', icon: HardDrive },
    { id: 'cloudflare', label: 'Cloudflare', icon: Cloud },
    { id: 'modal', label: 'Modal.com (AI)', icon: Cpu },
    { id: 'railway', label: 'Railway (App)', icon: Server },
  ];

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Title & Description */}
      <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-white">Platform Infrastructure Cost</h3>
          <p className="text-slate-400 text-xs mt-1">
            Analyze combined monthly upkeep expense and view specific infrastructure pricing calculators.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <div className="px-3.5 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-xs font-semibold flex items-center">
            <Sliders className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
            Configurable Simulation
          </div>
        </div>
      </div>

      {/* Pill Capsule Sub-tab Switcher */}
      <div className="bg-slate-900/40 p-1 border border-slate-800 rounded-2xl flex flex-wrap gap-1 w-fit max-w-full">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB PANEL 1: TOTAL COST OVERVIEW */}
      {activeSubTab === 'total' && (
        <div className="space-y-8">
          {/* Timeframe & Exchange Rate Filters */}
          <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fadeIn">
            <div className="flex items-center space-x-3">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <div>
                <h4 className="text-sm font-bold text-white">Timeframe & Exchange Rate</h4>
                <p className="text-[10px] text-slate-400">Filter cost calculations, adjust exchange rate conversions.</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* USD to INR Rate Setter */}
              <div className="flex items-center space-x-1.5 bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1">
                <span className="text-[9px] font-bold text-slate-500 uppercase">Rate ($1 = ₹):</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={usdToInrRateInput}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setUsdToInrRateInput(val);
                    }
                  }}
                  className="bg-transparent text-white text-[10px] border-0 outline-none focus:ring-0 w-12 text-center font-bold"
                />
              </div>

              {/* Presets */}
              <div className="bg-slate-900/60 p-1 border border-slate-800 rounded-xl flex gap-1 flex-wrap">
                {(['1d', '1w', '1m', '1y', 'custom'] as const).map(preset => {
                  const labelMap: Record<string, string> = {
                    '1d': 'Running Day',
                    '1w': 'Running Week',
                    '1m': 'Running Month',
                    '1y': 'Running Year',
                    'custom': 'Custom'
                  };
                  const isActive = timeFilter === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setTimeFilter(preset)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-150 cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {labelMap[preset]}
                    </button>
                  );
                })}
              </div>

              {/* Custom Date Time Pickers */}
              {timeFilter === 'custom' && (
                <div className="flex flex-wrap items-center gap-2 animate-fadeIn">
                  <div className="flex items-center space-x-1.5 bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Start:</span>
                    <input
                      type="datetime-local"
                      value={customStart}
                      onChange={e => setCustomStart(e.target.value)}
                      onClick={e => (e.target as any).showPicker?.()}
                      style={{ colorScheme: 'dark' }}
                      className="bg-transparent text-white text-[10px] border-0 outline-none focus:ring-0 cursor-pointer w-[155px]"
                    />
                  </div>
                  <div className="flex items-center space-x-1.5 bg-slate-900/60 border border-slate-800 rounded-xl px-2.5 py-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">End:</span>
                    <input
                      type="datetime-local"
                      value={customEnd}
                      onChange={e => setCustomEnd(e.target.value)}
                      onClick={e => (e.target as any).showPicker?.()}
                      style={{ colorScheme: 'dark' }}
                      className="bg-transparent text-white text-[10px] border-0 outline-none focus:ring-0 cursor-pointer w-[155px]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main cost summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Supabase summary */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-lg group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Supabase Estimate ({timeframeLabel})</p>
                  <h3 className="text-2xl font-black text-white mt-1 group-hover:text-emerald-400 transition-colors">
                    ${(supabaseTierCost * timeframeFactor).toFixed(2)} <span className="text-xs font-medium text-slate-500">{timeframeSuffix}</span>
                  </h3>
                </div>
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                  <Database className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <span className="text-[10px] text-slate-500">Tier: {supabaseTier.toUpperCase()}</span>
                <button
                  onClick={() => setActiveSubTab('supabase')}
                  className="text-[10px] text-indigo-400 hover:underline font-bold"
                >
                  Configure &rarr;
                </button>
              </div>
            </div>

            {/* Backblaze B2 summary */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-lg group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Backblaze B2 Storage ({timeframeLabel})</p>
                  <h3 className="text-2xl font-black text-white mt-1 group-hover:text-sky-400 transition-colors">
                    ${(actualB2Cost * timeframeFactor).toFixed(4)} <span className="text-xs font-medium text-slate-500">{timeframeSuffix}</span>
                  </h3>
                </div>
                <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
                  <HardDrive className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <span className="text-[10px] text-slate-500">Actual: {actualB2StorageDecimalGB.toFixed(3)} GB (Free &lt; 10GB) • Sim: {simulatedStorageGB} GB (${(simulatedB2Cost * timeframeFactor).toFixed(4)})</span>
                <button
                  onClick={() => setActiveSubTab('backblaze')}
                  className="text-[10px] text-indigo-400 hover:underline font-bold shrink-0 ml-2"
                >
                  Simulate Storage &rarr;
                </button>
              </div>
            </div>

            {/* Cloudflare summary */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-lg group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Cloudflare Edge & DNS ({timeframeLabel})</p>
                  <h3 className="text-2xl font-black text-white mt-1 group-hover:text-amber-400 transition-colors">
                    ${(actualCloudflareCost * timeframeFactor).toFixed(2)} <span className="text-xs font-medium text-slate-500">{timeframeSuffix}</span>
                  </h3>
                </div>
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                  <Cloud className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <span className="text-[10px] text-slate-500">Workers: ${(workersCost * timeframeFactor).toFixed(2)} | CDN Caching: Free</span>
                <button
                  onClick={() => setActiveSubTab('cloudflare')}
                  className="text-[10px] text-indigo-400 hover:underline font-bold"
                >
                  Adjust requests &rarr;
                </button>
              </div>
            </div>

            {/* Modal.com summary */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-lg group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Modal.com AI ({timeframeLabel})</p>
                  <h3 className="text-2xl font-black text-white mt-1 group-hover:text-indigo-400 transition-colors">
                    ₹{(actualModalCostInfo.inr * timeframeFactor).toFixed(2)} <span className="text-xs font-semibold text-slate-500">(${(actualModalCostInfo.usd * timeframeFactor).toFixed(4)})</span>
                  </h3>
                </div>
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                  <Cpu className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                <span className="text-[10px] text-slate-500">Invocations: {modalLogs.length}</span>
                <button
                  onClick={() => setActiveSubTab('modal')}
                  className="text-[10px] text-indigo-400 hover:underline font-bold"
                >
                  Configure &rarr;
                </button>
              </div>
            </div>

            {/* Railway summary */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-lg group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Railway App Server ({timeframeLabel})</p>
                  <h3 className="text-2xl font-black text-white mt-1 group-hover:text-fuchsia-400 transition-colors">
                    ${(actualRailwayCost * timeframeFactor).toFixed(2)} <span className="text-xs font-semibold text-slate-500">{timeframeSuffix}</span>
                  </h3>
                </div>
                <div className="p-2 bg-fuchsia-500/10 rounded-lg text-fuchsia-400">
                  <Server className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-center justify-between mt-4">
                {hasLiveRailway ? (
                  <span className="px-2 py-0.5 text-[9px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Live Sync Active
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500">Simulated | RAM: {simulatedRailwayRAM}GB CPU: {simulatedRailwayCPU}vCPU</span>
                )}
                <button
                  onClick={() => setActiveSubTab('railway')}
                  className="text-[10px] text-indigo-400 hover:underline font-bold"
                >
                  {hasLiveRailway ? 'Details →' : 'Configure →'}
                </button>
              </div>
            </div>

            {/* Combined upkeep */}
            <div className="bg-[#111827]/80 border border-indigo-950 rounded-2xl p-5 shadow-lg bg-gradient-to-br from-[#111827]/90 to-indigo-950/20 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-indigo-400 text-[10px] font-black uppercase tracking-wider">Actual Platform Upkeep ({timeframeLabel})</p>
                  <h3 className="text-2xl font-black text-white mt-1 group-hover:text-indigo-400 transition-colors">
                    ${(actualTotalCost * timeframeFactor).toFixed(4)} <span className="text-xs font-medium text-slate-500">{timeframeSuffix}</span>
                  </h3>
                </div>
                <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[9px] text-slate-500 mt-5">
                Simulated scaling upkeep ({simulatedStorageGB}GB B2): <span className="text-slate-350 font-bold">${(simulatedTotalCost * timeframeFactor).toFixed(4)}{timeframeSuffix}</span>
              </p>
            </div>
          </div>

          {/* Cost Allocation breakdown visual chart - Pie / Donut Chart */}
          <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h4 className="text-md font-bold text-white flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-indigo-400" />
                  Infrastructure Cost Distribution Share ({costChartMode === 'actual' ? 'Actual Live' : 'Simulated Scaling'} • {timeframeLabel})
                </h4>
                <p className="text-slate-400 text-xs mt-0.5">
                  Visual pie chart breakdown of operational expenses across cloud nodes for {timeframeLabel.toLowerCase()}.
                </p>
              </div>

              {/* View Mode Toggle: Actual vs Simulated */}
              <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setCostChartMode('actual')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    costChartMode === 'actual'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Actual Live (${(actualTotalCost * timeframeFactor).toFixed(4)}{timeframeSuffix})
                </button>
                <button
                  type="button"
                  onClick={() => setCostChartMode('simulated')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    costChartMode === 'simulated'
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Simulated Scaling (${(simulatedTotalCost * timeframeFactor).toFixed(4)}{timeframeSuffix})
                </button>
              </div>
            </div>

            {(() => {
              const baseTotal = costChartMode === 'actual' ? actualTotalCost : simulatedTotalCost;
              const baseB2Cost = costChartMode === 'actual' ? actualB2Cost : simulatedB2Cost;
              const baseCloudflareCost = costChartMode === 'actual' ? actualCloudflareCost : simulatedCloudflareCost;

              const currentTotal = baseTotal * timeframeFactor;
              const currentB2Cost = baseB2Cost * timeframeFactor;
              const currentCloudflareCost = baseCloudflareCost * timeframeFactor;
              const currentSupabaseCost = supabaseTierCost * timeframeFactor;
              const currentModalCost = actualModalCost * timeframeFactor;
              const currentRailwayCost = actualRailwayCost * timeframeFactor;

              return currentTotal > 0 ? (
                <div className="flex flex-col lg:flex-row items-center justify-between gap-8 pt-2">
                  {/* Donut / Pie Chart SVG */}
                  <div className="relative flex items-center justify-center shrink-0 w-60 h-60">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 180 180">
                      {/* Background Track Circle */}
                      <circle
                        cx="90"
                        cy="90"
                        r="70"
                        fill="transparent"
                        stroke="#1e293b"
                        strokeWidth="20"
                      />
                      {(() => {
                        const items = [
                          { label: 'Supabase DB', cost: currentSupabaseCost, color: '#10b981' },
                          { label: 'Backblaze B2', cost: currentB2Cost, color: '#0ea5e9' },
                          { label: 'Cloudflare Edge', cost: currentCloudflareCost, color: '#f59e0b' },
                          { label: 'Modal.com (AI)', cost: currentModalCost, color: '#6366f1' },
                          { label: 'Railway (App)', cost: currentRailwayCost, color: '#d946ef' },
                        ];
                        const circumference = 2 * Math.PI * 70; // ~439.82
                        let accumulatedPercent = 0;

                        return items.map((item, idx) => {
                          if (item.cost <= 0) return null;
                          const percentage = (item.cost / currentTotal) * 100;
                          const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
                          const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                          accumulatedPercent += percentage;

                          return (
                            <circle
                              key={idx}
                              cx="90"
                              cy="90"
                              r="70"
                              fill="transparent"
                              stroke={item.color}
                              strokeWidth="22"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              className="transition-all duration-300 hover:opacity-80"
                            >
                              <title>{`${item.label}: $${item.cost.toFixed(4)} (${percentage.toFixed(1)}%)`}</title>
                            </circle>
                          );
                        });
                      })()}
                    </svg>

                    {/* Donut Center Total Text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {costChartMode === 'actual' ? 'Actual Upkeep' : 'Simulated Upkeep'}
                      </span>
                      <span className="text-xl font-black text-white mt-0.5">
                        ${currentTotal.toFixed(4)}
                      </span>
                      <span className="text-xs font-bold text-emerald-400 mt-0.5">
                        ₹{(currentTotal * usdToInrRate).toFixed(2)}{timeframeSuffix}
                      </span>
                    </div>
                  </div>

                  {/* Service Cards Grid on Right */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 w-full">
                    {/* Supabase DB */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex items-start space-x-3">
                      <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0 mt-1 shadow-sm shadow-emerald-500/50" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-300 truncate">Supabase DB</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            {((currentSupabaseCost / currentTotal) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-base font-black text-white mt-1">${currentSupabaseCost.toFixed(2)} <span className="text-xs font-normal text-slate-400">{timeframeSuffix}</span></p>
                        <p className="text-[10px] text-slate-500 mt-0.5">₹{(currentSupabaseCost * usdToInrRate).toFixed(0)}{timeframeSuffix}</p>
                      </div>
                    </div>

                    {/* Backblaze B2 */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex items-start space-x-3">
                      <span className="w-3.5 h-3.5 rounded-full bg-sky-500 shrink-0 mt-1 shadow-sm shadow-sky-500/50" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-300 truncate">Backblaze B2</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400">
                            {((currentB2Cost / currentTotal) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-base font-black text-white mt-1">${currentB2Cost.toFixed(4)} <span className="text-xs font-normal text-slate-400">{timeframeSuffix}</span></p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {costChartMode === 'actual' && actualB2StorageDecimalGB <= 10
                            ? 'First 10GB Free'
                            : `₹${(currentB2Cost * usdToInrRate).toFixed(2)}${timeframeSuffix}`}
                        </p>
                      </div>
                    </div>

                    {/* Cloudflare */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex items-start space-x-3">
                      <span className="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0 mt-1 shadow-sm shadow-amber-500/50" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-300 truncate">Cloudflare Edge</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                            {((currentCloudflareCost / currentTotal) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-base font-black text-white mt-1">${currentCloudflareCost.toFixed(2)} <span className="text-xs font-normal text-slate-400">{timeframeSuffix}</span></p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Free Egress Alliance</p>
                      </div>
                    </div>

                    {/* Modal.com AI */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex items-start space-x-3">
                      <span className="w-3.5 h-3.5 rounded-full bg-indigo-500 shrink-0 mt-1 shadow-sm shadow-indigo-500/50" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-300 truncate">Modal.com (AI)</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            {((currentModalCost / currentTotal) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-base font-black text-white mt-1">${currentModalCost.toFixed(4)} <span className="text-xs font-normal text-slate-400">{timeframeSuffix}</span></p>
                        <p className="text-[10px] text-slate-500 mt-0.5">₹{(currentModalCost * usdToInrRate).toFixed(2)}{timeframeSuffix} ({modalLogs.length} runs)</p>
                      </div>
                    </div>

                    {/* Railway */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex items-start space-x-3">
                      <span className="w-3.5 h-3.5 rounded-full bg-fuchsia-500 shrink-0 mt-1 shadow-sm shadow-fuchsia-500/50" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-300 truncate">Railway (App)</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400">
                            {((currentRailwayCost / currentTotal) * 100).toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-base font-black text-white mt-1">${currentRailwayCost.toFixed(4)} <span className="text-xs font-normal text-slate-400">{timeframeSuffix}</span></p>
                        <p className="text-[10px] text-slate-500 mt-0.5">₹{(currentRailwayCost * usdToInrRate).toFixed(2)}{timeframeSuffix} (Per-sec compute)</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No active platform expenses generated.
                </div>
              );
            })()}
          </div>

          {/* Individual & Total Infra Cost Ledger Table */}
          <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h4 className="text-md font-bold text-white mb-1.5 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-indigo-400" />
              Infrastructure Ledger & Billing Breakdown
            </h4>
            <p className="text-slate-400 text-xs mb-6">
              Individual and consolidated platform costing comparison between actual usage and simulated limits.
            </p>

            <div className="overflow-x-auto border border-slate-800/60 rounded-2xl">
              <table className="w-full text-left text-xs text-slate-400">
                <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/30 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Cloud Provider</th>
                    <th className="py-3 px-4">Included Usage & Baseline</th>
                    <th className="py-3 px-4">Actual Cost (Month)</th>
                    <th className="py-3 px-4">Simulated Cost (Month)</th>
                    <th className="py-3 px-4">Cost Trend (Projected Year)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-350">
                  {/* Supabase Row */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Supabase (Postgres & Auth)</td>
                    <td className="py-4 px-4">
                      {liveBillingTier ? `Live: ${liveBillingTier.toUpperCase()}` : `Config: ${supabaseTier.toUpperCase()}`} Plan (DB, Auth MAUs)
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-emerald-450">${supabaseTierCost.toFixed(2)}</td>
                    <td className="py-4 px-4 font-mono text-slate-450">${supabaseTierCost.toFixed(2)}</td>
                    <td className="py-4 px-4 font-mono text-slate-400">${(supabaseTierCost * 12).toFixed(2)} / yr</td>
                  </tr>

                  {/* Backblaze B2 Row */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Backblaze B2 (Object Storage)</td>
                    <td className="py-4 px-4">
                      10 GB Free baseline storage & Class B/C APIs
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-sky-400">${actualB2Cost.toFixed(4)}</td>
                    <td className="py-4 px-4 font-mono text-slate-400">${simulatedB2Cost.toFixed(4)}</td>
                    <td className="py-4 px-4 font-mono text-slate-400">${(actualB2Cost * 12).toFixed(4)} / yr</td>
                  </tr>

                  {/* Cloudflare Edge Row */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Cloudflare (CDN, DNS & Workers)</td>
                    <td className="py-4 px-4">
                      Domain Registry wholesale, 5k Image Resizing free/mo
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-amber-400">${actualCloudflareCost.toFixed(2)}</td>
                    <td className="py-4 px-4 font-mono text-slate-400">${simulatedCloudflareCost.toFixed(2)}</td>
                    <td className="py-4 px-4 font-mono text-slate-400">${(actualCloudflareCost * 12).toFixed(2)} / yr</td>
                  </tr>

                  {/* Modal.com Row */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Modal.com (AI Face-Indexing)</td>
                    <td className="py-4 px-4">
                      $30.00 (₹3,000) Monthly Free Tier Included
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-indigo-400">${actualModalCost.toFixed(4)}</td>
                    <td className="py-4 px-4 font-mono text-slate-400">${actualModalCost.toFixed(4)}</td>
                    <td className="py-4 px-4 font-mono text-slate-400">${(actualModalCost * 12).toFixed(4)} / yr</td>
                  </tr>

                  {/* Railway Row */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Railway (App Server)</td>
                    <td className="py-4 px-4">
                      Node.js Edge Deployment (Simulated Cost)
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-indigo-400">${actualRailwayCost.toFixed(2)}</td>
                    <td className="py-4 px-4 font-mono text-slate-400">${simulatedRailwayCost.toFixed(2)}</td>
                    <td className="py-4 px-4 font-mono text-slate-400">${(actualRailwayCost * 12).toFixed(2)} / yr</td>
                  </tr>

                  {/* Consolidated Total Row */}
                  <tr className="bg-slate-900/40 font-black border-t-2 border-slate-800">
                    <td className="py-4 px-4 text-white uppercase tracking-wider text-[10px]">Consolidated Upkeep</td>
                    <td className="py-4 px-4 text-indigo-400">Total Infrastructure Footprint</td>
                    <td className="py-4 px-4 font-mono font-black text-indigo-400 text-sm">${actualTotalCost.toFixed(4)}</td>
                    <td className="py-4 px-4 font-mono font-black text-slate-200 text-sm">${simulatedTotalCost.toFixed(4)}</td>
                    <td className="py-4 px-4 font-mono text-indigo-400">${(actualTotalCost * 12).toFixed(4)} / yr</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Integration Status Table */}
          <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h4 className="text-md font-bold text-white mb-1">Service Cost API Integration Status</h4>
            <p className="text-slate-400 text-xs mb-5">
              Current sync capabilities for real-time external billing APIs.
            </p>

            <div className="overflow-x-auto border border-slate-800/60 rounded-2xl">
              <table className="w-full text-left text-xs text-slate-400">
                <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/30 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Service Node</th>
                    <th className="py-3 px-4">Cost Pull Capabilities</th>
                    <th className="py-3 px-4">Authentication / Integration Method</th>
                    <th className="py-3 px-4">Sync Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-350">
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Supabase (Postgres)</td>
                    <td className="py-4 px-4">
                      Database row size metadata is read directly. Billing tiers require Management API access tokens.
                    </td>
                    <td className="py-4 px-4 text-indigo-400 font-mono">SUPABASE_MGMT_KEY</td>
                    <td className="py-4 px-4">
                      {liveBillingTier ? (
                        <span className="px-2 py-0.5 text-[9px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 rounded-full flex items-center w-fit">
                          <ShieldCheck className="w-3 h-3 mr-1" /> Live Sync Active ({liveBillingTier.toUpperCase()})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[9px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full">
                          Offline / Simulated
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Backblaze B2</td>
                    <td className="py-4 px-4">
                      Live bucket usage is read from Backblaze B2 and falls back to database media metadata if the API is unavailable.
                    </td>
                    <td className="py-4 px-4 text-indigo-400 font-mono">B2_KEY_ID / B2_APPLICATION_KEY</td>
                    <td className="py-4 px-4">
                      {liveB2Bytes !== null ? (
                        <span className="px-2 py-0.5 text-[9px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 rounded-full flex items-center w-fit">
                          <ShieldCheck className="w-3 h-3 mr-1" /> Live Sync Active ({liveB2Usage?.bucketName || 'EveBash'})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[9px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full">
                          Fallback / Database Metadata
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Cloudflare Edge</td>
                    <td className="py-4 px-4">
                      Workers request counters and monthly invoice limits can sync via Accounts Billing API.
                    </td>
                    <td className="py-4 px-4 text-indigo-400 font-mono">CLOUDFLARE_API_TOKEN</td>
                    <td className="py-4 px-4">
                      {liveCfPlan ? (
                        <span className="px-2 py-0.5 text-[9px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-450 rounded-full flex items-center w-fit">
                          <ShieldCheck className="w-3 h-3 mr-1" /> Live Sync Active ({liveCfPlan.toUpperCase()})
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[9px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full">
                          Offline / Simulated
                        </span>
                      )}
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Registrar (Domain)</td>
                    <td className="py-4 px-4">
                      Fixed wholesale registry costs (e.g. .com at $10.16/year). No live API needed.
                    </td>
                    <td className="py-4 px-4 text-indigo-400 font-mono">Flat Ledger Registry Rates</td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 text-[9px] font-semibold bg-slate-800 border border-slate-700 text-slate-400 rounded-full">
                        Ledger Standard
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Railway (App Server)</td>
                    <td className="py-4 px-4">
                      Container metrics usage billed per minute (CPU/RAM).
                    </td>
                    <td className="py-4 px-4 text-indigo-400 font-mono">RAILWAY_API_TOKEN</td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-0.5 text-[9px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full">
                        Offline / Simulated
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Informational Alert Box */}
            <div className="mt-6 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-start space-x-3 text-xs text-slate-400">
              <HelpCircle className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">Dynamic Estimations vs API Keys:</p>
                <p className="mt-1 leading-relaxed">
                  Instead of exposing production API credentials directly on client-side analytics dashboards, this page calls server-side admin APIs for live service data and uses database metrics as fallback. This provides useful values without compromising security.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB PANEL 2: SUPABASE DETAIL */}
      {activeSubTab === 'supabase' && (
        <div className="space-y-8">
          {renderFilterBar('bg-emerald-600', 'text-emerald-450')}
          {/* Supabase row count indicators */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">User Profiles</p>
              <h4 className="text-xl font-black text-white mt-1.5">{formatNumber(dbStats.profilesCount)}</h4>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Events Catalog</p>
              <h4 className="text-xl font-black text-white mt-1.5">{formatNumber(dbStats.eventsCount)}</h4>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Guest Logs</p>
              <h4 className="text-xl font-black text-white mt-1.5">{formatNumber(dbStats.guestsCount)}</h4>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Media Metadata</p>
              <h4 className="text-xl font-black text-white mt-1.5">{formatNumber(dbStats.photosCount)}</h4>
            </div>
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 text-center col-span-2 md:col-span-1 bg-gradient-to-br from-slate-900/40 to-emerald-950/10">
              <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-black">Total DB Rows</p>
              <h4 className="text-xl font-black text-emerald-400 mt-1.5">{formatNumber(dbStats.totalRows)}</h4>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Database storage footprint and limit gauge */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl md:col-span-2 space-y-6">
              <div>
                <h4 className="text-md font-bold text-white flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-emerald-400" />
                  Estimated Database Footprint
                </h4>
                <p className="text-slate-400 text-xs mt-1">
                  Database storage footprint derived from aggregate active rows.
                </p>
              </div>

              <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Estimated Database Size:</span>
                  <span className="text-white font-bold">{formatSize(dbStats.estimatedSizeBytes)}</span>
                </div>

                {/* Free tier limits representation */}
                <div>
                  <div className="flex justify-between items-center text-[10px] mb-1.5 text-slate-500">
                    <span>Free Tier Row limit (500MB Database Size Equivalent)</span>
                    <span>~0.01% utilized</span>
                  </div>
                  <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, Math.max(1, (dbStats.estimatedSizeBytes / (500 * 1024 * 1024)) * 100))}%` }}
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    />
                  </div>
                </div>

                <div className="flex items-start space-x-2 text-[10px] text-slate-500">
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <p>
                    Size estimation assumes an average row index allocation of 1.2 KB. Real storage space may vary based on Supabase database auto-vacuum settings and PostgreSQL table index sizes.
                  </p>
                </div>
              </div>

              {/* Toggle controls */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-350 uppercase tracking-wide">
                    Select Supabase Tier Configuration
                  </label>
                  {loadingBilling ? (
                    <span className="text-[10px] text-slate-500 animate-pulse font-medium">Syncing with Supabase API...</span>
                  ) : liveBillingTier ? (
                    <span className="px-2 py-0.5 text-[9px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center">
                      <ShieldCheck className="w-3 h-3 mr-1" /> Live Sync: {liveBillingTier.toUpperCase()}
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[9px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full">
                      API Offline (Simulator)
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Free plan */}
                  <button
                    onClick={() => setSupabaseTier('free')}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                      supabaseTier === 'free'
                        ? 'bg-emerald-500/10 border-emerald-500 text-white'
                        : 'bg-slate-900/20 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-xs font-black">Free Tier</p>
                    <p className="text-lg font-black mt-1">$0.00 <span className="text-xs font-medium text-slate-500">/ mo</span></p>
                    <p className="text-[10px] text-slate-500 mt-2">Up to 500 MB DB & 50,000 MAUs. Automatically pauses after 1 week inactivity.</p>
                  </button>

                  {/* Pro plan */}
                  <button
                    onClick={() => setSupabaseTier('pro')}
                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all duration-200 ${
                      supabaseTier === 'pro'
                        ? 'bg-emerald-500/10 border-emerald-500 text-white'
                        : 'bg-slate-900/20 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <p className="text-xs font-black">Pro Tier</p>
                    <p className="text-lg font-black mt-1">$25.00 <span className="text-xs font-medium text-slate-500">/ mo</span></p>
                    <p className="text-[10px] text-slate-500 mt-2">Up to 8 GB DB, 100,000 MAUs. Daily automated backups, never pauses.</p>
                  </button>
                </div>
              </div>
            </div>

            {/* Supabase service details side card */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <h4 className="text-md font-bold text-white mb-1.5 flex items-center">
                  <Server className="w-5 h-5 mr-2 text-indigo-400" />
                  Supabase Features
                </h4>
                <p className="text-slate-400 text-xs mb-6">
                  Supabase hosts PostgreSQL and provides backend API endpoints.
                </p>

                <div className="space-y-4 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Database Engine</span>
                    <span className="text-white font-semibold">PostgreSQL 15</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Connection Pooling</span>
                    <span className="text-white font-semibold">PgBouncer Active</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Auth Engine</span>
                    <span className="text-white font-semibold">Supabase GoTrue</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Restful API Endpoint</span>
                    <span className="text-white font-semibold">PostgREST API</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl mt-6">
                <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center">
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Recommendation
                </p>
                <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                  Based on current usage ({dbStats.totalRows} database rows, under 1MB DB footprint), the platform operates comfortably on the Free Tier ($0/mo). Upgrading to Pro ($25/mo) is only necessary when database sizes exceed 500MB, or to prevent project dormancy if no admin logs in for 7 days.
                </p>
              </div>
            </div>
          </div>

          {/* Supabase Charging Units Cost Table */}
          <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h4 className="text-md font-bold text-white mb-1.5 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-emerald-400" />
              Supabase Billing Units Cost Breakdown
            </h4>
            <p className="text-slate-400 text-xs mb-6">
              Detailed tracking of active database utilization versus plan allowances, including actual monthly and yearly projections.
            </p>

            <div className="overflow-x-auto border border-slate-800/60 rounded-2xl">
              <table className="w-full text-left text-xs text-slate-400">
                <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/30 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Billing Unit</th>
                    <th className="py-3 px-4">Plan Limit / Allowance</th>
                    <th className="py-3 px-4">Actual Usage "Till Now"</th>
                    <th className="py-3 px-4">Cost (Current Month)</th>
                    <th className="py-3 px-4">Cost (Projected Year)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-350">
                  {/* Row 1: Database Storage */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Database Storage (size)</td>
                    <td className="py-4 px-4">{supabaseTier === 'free' ? '500 MB' : '8 GB'}</td>
                    <td className="py-4 px-4">{formatSize(dbStats.estimatedSizeBytes)}</td>
                    <td className="py-4 px-4 font-mono font-bold text-emerald-400">${supabaseDbCostMonth.toFixed(2)}</td>
                    <td className="py-4 px-4 font-mono text-slate-400">${supabaseDbCostYear.toFixed(2)}</td>
                  </tr>

                  {/* Row 2: Monthly Active Users */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Monthly Active Users (MAU)</td>
                    <td className="py-4 px-4">{supabaseTier === 'free' ? '50,000 MAUs' : '100,000 MAUs'}</td>
                    <td className="py-4 px-4">{formatNumber(stats?.mau || users.length)} MAUs</td>
                    <td className="py-4 px-4 font-mono font-bold text-emerald-400">${supabaseMauCostMonth.toFixed(2)}</td>
                    <td className="py-4 px-4 font-mono text-slate-400">${supabaseMauCostYear.toFixed(2)}</td>
                  </tr>

                  {/* Row 3: Data Egress */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Data Egress Bandwidth</td>
                    <td className="py-4 px-4">{supabaseTier === 'free' ? '2 GB' : '50 GB'}</td>
                    <td className="py-4 px-4">~0.05 GB <span className="text-[10px] text-slate-500">(B2/CF Alliance Bypass)</span></td>
                    <td className="py-4 px-4 font-mono font-bold text-emerald-400">${supabaseEgressCostMonth.toFixed(2)}</td>
                    <td className="py-4 px-4 font-mono text-slate-400">${supabaseEgressCostYear.toFixed(2)}</td>
                  </tr>

                  {/* Row 4: Compute Instance */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Compute Instance Tier</td>
                    <td className="py-4 px-4">{supabaseTier === 'free' ? 'Shared (Pauses)' : 'Dedicated Micro (Always-on)'}</td>
                    <td className="py-4 px-4">Active</td>
                    <td className="py-4 px-4 font-mono font-bold text-emerald-400">${supabaseComputeCostMonth.toFixed(2)}</td>
                    <td className="py-4 px-4 font-mono text-slate-400">${supabaseComputeCostYear.toFixed(2)}</td>
                  </tr>

                  {/* Row 5: Edge Functions */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Edge Functions (Invocations)</td>
                    <td className="py-4 px-4">{supabaseTier === 'free' ? '500,000 / mo' : '2 Million / mo'}</td>
                    <td className="py-4 px-4">Minimal</td>
                    <td className="py-4 px-4 font-mono font-bold text-emerald-400">$0.00</td>
                    <td className="py-4 px-4 font-mono text-slate-400">$0.00</td>
                  </tr>

                  {/* Total row */}
                  <tr className="bg-slate-900/30 font-bold border-t border-slate-800">
                    <td className="py-4 px-4 text-white">Total Supabase Expenses</td>
                    <td className="py-4 px-4">-</td>
                    <td className="py-4 px-4">-</td>
                    <td className="py-4 px-4 font-mono text-emerald-400">${(supabaseDbCostMonth + supabaseMauCostMonth + supabaseEgressCostMonth + supabaseComputeCostMonth).toFixed(2)} / mo</td>
                    <td className="py-4 px-4 font-mono text-slate-350">${(supabaseDbCostYear + supabaseMauCostYear + supabaseEgressCostYear + supabaseComputeCostYear).toFixed(2)} / yr</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB PANEL 3: BACKBLAZE B2 STORAGE DETAIL */}
      {activeSubTab === 'backblaze' && (
        <div className="space-y-8">
          {renderFilterBar('bg-sky-600', 'text-sky-405')}
          {/* Backblaze stats breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Photos count/size card */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-lg group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Photos</p>
                  <h3 className="text-2xl font-black text-white mt-1 group-hover:text-indigo-400 transition-colors">
                    {formatNumber(mediaBreakdown.photoCount)}
                  </h3>
                </div>
                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
                  <Sliders className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2.5">
                Total Storage: <span className="text-slate-350 font-bold">{formatSize(mediaBreakdown.photoSize)}</span>
              </p>
            </div>

            {/* Videos count/size card */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-lg group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Active Videos</p>
                  <h3 className="text-2xl font-black text-white mt-1 group-hover:text-emerald-400 transition-colors">
                    {formatNumber(mediaBreakdown.videoCount)}
                  </h3>
                </div>
                <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                  <Sliders className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2.5">
                Total Storage: <span className="text-slate-350 font-bold">{formatSize(mediaBreakdown.videoSize)}</span>
              </p>
            </div>

            {/* Total combined media */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-lg group bg-gradient-to-br from-[#111827]/90 to-sky-950/15">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sky-400 text-xs font-black uppercase tracking-wider">EveBash Bucket Size</p>
                  <h3 className="text-2xl font-black text-white mt-1 group-hover:text-sky-400 transition-colors">
                    {formatDecimalSize(actualB2StorageBytes)}
                  </h3>
                </div>
                <div className="p-2.5 bg-sky-500/10 rounded-xl text-sky-400">
                  <HardDrive className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2.5">
                Source: <span className="text-slate-350 font-bold">{b2StorageSource}</span>
                {typeof liveB2Usage?.fileCount === 'number' ? (
                  <span> | Files: <span className="text-slate-350 font-bold">{formatNumber(liveB2Usage.fileCount)}</span></span>
                ) : null}
              </p>
              {liveB2Usage?.error ? (
                <p className="text-[10px] text-amber-400 mt-2 leading-relaxed">
                  Live Backblaze usage unavailable{liveB2Usage.code ? ` (${liveB2Usage.code})` : ''}: {liveB2Usage.error}. Showing database media total.
                </p>
              ) : null}
            </div>
          </div>

          {/* Backblaze orphan cleanup */}
          <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div>
                <h4 className="text-md font-bold text-white flex items-center">
                  <Search className="w-5 h-5 mr-2 text-sky-400" />
                  Backblaze Orphan File Cleanup
                </h4>
                <p className="text-slate-400 text-xs mt-1 max-w-3xl leading-relaxed">
                  Scan the EveBash bucket for files under <span className="font-mono text-slate-300">events/</span> and <span className="font-mono text-slate-300">profiles/</span> that are no longer referenced by current database media records.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleScanBackblazeOrphans}
                  disabled={orphanActionLoading !== null}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 hover:bg-sky-500/15 disabled:opacity-60 disabled:cursor-not-allowed text-xs font-bold transition-colors"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {orphanActionLoading === 'scan' ? 'Scanning...' : 'Scan Orphans'}
                </button>
                <button
                  onClick={handleDeleteBackblazeOrphans}
                  disabled={orphanActionLoading !== null || !orphanScan?.orphanFiles}
                  className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {orphanActionLoading === 'delete' ? 'Deleting...' : 'Delete Orphans'}
                </button>
              </div>
            </div>

            {orphanActionError ? (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
                {orphanActionError}
              </div>
            ) : null}

            {orphanScan ? (
              <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Managed B2 Files</p>
                  <p className="mt-1 text-xl font-black text-white">{formatNumber(orphanScan.totalFiles || 0)}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Referenced Files</p>
                  <p className="mt-1 text-xl font-black text-emerald-400">{formatNumber(orphanScan.referencedFiles || 0)}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Orphan Files</p>
                  <p className="mt-1 text-xl font-black text-amber-400">{formatNumber(orphanScan.orphanFiles || 0)}</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Orphan Size</p>
                  <p className="mt-1 text-xl font-black text-sky-400">{formatDecimalSize(orphanScan.orphanBytes || 0)}</p>
                  {typeof orphanScan.deletedFiles === 'number' ? (
                    <p className="mt-1 text-[10px] text-emerald-400">
                      Deleted {formatNumber(orphanScan.deletedFiles)} files ({formatDecimalSize(orphanScan.deletedBytes || 0)})
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* Backblaze B2 Charging Units Cost Table */}
          <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h4 className="text-md font-bold text-white mb-1.5 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-sky-400" />
              Backblaze B2 Billing Units Cost Breakdown ({timeframeLabel})
            </h4>
            <p className="text-slate-400 text-xs mb-6">
              Detailed tracking of active storage utilization, transfer bandwidth, and API operations for {timeframeLabel.toLowerCase()}.
            </p>

            <div className="overflow-x-auto border border-slate-800/60 rounded-2xl">
              <table className="w-full text-left text-xs text-slate-400">
                <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/30 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Billing Unit</th>
                    <th className="py-3 px-4">Plan Limit / Allowance</th>
                    <th className="py-3 px-4">Actual Usage "Till Now"</th>
                    <th className="py-3 px-4">Cost ({timeframeLabel})</th>
                    <th className="py-3 px-4">Cost (Projected Year)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-350">
                  {/* Row 1: B2 Storage Space */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Object Storage Size (GB)</td>
                    <td className="py-4 px-4">10 GB Free</td>
                    <td className="py-4 px-4">
                      {actualB2StorageDecimalGB.toFixed(3)} GB ({formatDecimalSize(actualB2StorageBytes)})
                      <span className="block text-[10px] text-slate-500 mt-1">{b2StorageSource}</span>
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-sky-400">
                      ₹{((b2StorageCostMonth * timeframeFactor) * usdToInrRate).toFixed(2)}
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">${(b2StorageCostMonth * timeframeFactor).toFixed(4)} {timeframeSuffix}</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-400">
                      ₹{(b2StorageCostYear * usdToInrRate).toFixed(2)}
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">${b2StorageCostYear.toFixed(4)} / yr</span>
                    </td>
                  </tr>

                  {/* Row 2: B2 Download Egress */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Egress Download Bandwidth</td>
                    <td className="py-4 px-4">Unlimited Free <span className="text-[9px] text-emerald-450">(Bandwidth Alliance)</span></td>
                    <td className="py-4 px-4">Active Routing</td>
                    <td className="py-4 px-4 font-mono font-bold text-sky-400">
                      ₹0.00
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">$0.0000</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-400">
                      ₹0.00
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">$0.0000</span>
                    </td>
                  </tr>

                  {/* Row 3: Class A API Transactions */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Class A API Transactions (List, etc.)</td>
                    <td className="py-4 px-4">Unlimited Free</td>
                    <td className="py-4 px-4">Minimal</td>
                    <td className="py-4 px-4 font-mono font-bold text-sky-400">
                      ₹0.00
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">$0.0000</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-400">
                      ₹0.00
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">$0.0000</span>
                    </td>
                  </tr>

                  {/* Row 4: Class B API Transactions */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Class B API Transactions (Download metadata)</td>
                    <td className="py-4 px-4">2,500/day Free (75,000/mo)</td>
                    <td className="py-4 px-4">{formatNumber(b2ClassBCallsMonth)} calls/mo <span className="text-[10px] text-slate-500">(est.)</span></td>
                    <td className="py-4 px-4 font-mono font-bold text-sky-400">
                      ₹{((b2ClassBCostMonth * timeframeFactor) * usdToInrRate).toFixed(2)}
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">${(b2ClassBCostMonth * timeframeFactor).toFixed(4)} {timeframeSuffix}</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-400">
                      ₹{(b2ClassBCostYear * usdToInrRate).toFixed(2)}
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">${b2ClassBCostYear.toFixed(4)} / yr</span>
                    </td>
                  </tr>

                  {/* Row 5: Class C API Transactions */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Class C API Transactions (Upload creations)</td>
                    <td className="py-4 px-4">2,500/day Free (75,000/mo)</td>
                    <td className="py-4 px-4">{formatNumber(b2ClassCCallsMonth)} calls/mo <span className="text-[10px] text-slate-500">(est.)</span></td>
                    <td className="py-4 px-4 font-mono font-bold text-sky-400">
                      ₹{((b2ClassCCostMonth * timeframeFactor) * usdToInrRate).toFixed(2)}
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">${(b2ClassCCostMonth * timeframeFactor).toFixed(4)} {timeframeSuffix}</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-400">
                      ₹{(b2ClassCCostYear * usdToInrRate).toFixed(2)}
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">${b2ClassCCostYear.toFixed(4)} / yr</span>
                    </td>
                  </tr>

                  {/* Total row */}
                  <tr className="bg-slate-900/30 font-bold border-t border-slate-800">
                    <td className="py-4 px-4 text-white">Total Backblaze B2 Expenses</td>
                    <td className="py-4 px-4">-</td>
                    <td className="py-4 px-4">-</td>
                    <td className="py-4 px-4 font-mono text-sky-400">
                      ₹{((actualB2Cost * timeframeFactor) * usdToInrRate).toFixed(2)}
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">${(actualB2Cost * timeframeFactor).toFixed(4)} {timeframeSuffix}</span>
                    </td>
                    <td className="py-4 px-4 font-mono text-slate-350">
                      ₹{((actualB2Cost * 12) * usdToInrRate).toFixed(2)}
                      <span className="block text-[10px] font-normal text-slate-500 mt-0.5">${(actualB2Cost * 12).toFixed(4)} / yr</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive B2 storage slider & comparison */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl md:col-span-2 space-y-6">
              <div>
                <h4 className="text-md font-bold text-white flex items-center">
                  <Sliders className="w-5 h-5 mr-2 text-sky-400" />
                  B2 Storage Growth Simulator ({timeframeLabel})
                </h4>
                <p className="text-slate-400 text-xs mt-1">
                  Simulate storage growth scaling from current levels up to 10 Terabytes.
                </p>
              </div>

              {/* Slider Input */}
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Simulated Storage Capacity:</span>
                  <span className="text-sky-400 font-bold text-sm">
                    {simulatedStorageGB >= 1000
                      ? `${(simulatedStorageGB / 1000).toFixed(1)} TB`
                      : `${simulatedStorageGB} GB`}
                  </span>
                </div>
                
                <input
                  type="range"
                  min="10"
                  max="10000"
                  step="10"
                  value={simulatedStorageGB}
                  onChange={e => setSimulatedStorageGB(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                />
                
                <div className="flex justify-between text-[10px] text-slate-600 font-semibold uppercase">
                  <span>10 GB (Min)</span>
                  <span>2.5 TB</span>
                  <span>5 TB</span>
                  <span>7.5 TB</span>
                  <span>10 TB (Max)</span>
                </div>
              </div>

              {/* B2 Simulator Pricing Card */}
              <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />
                <p className="text-[10px] text-sky-400 font-black uppercase tracking-wider">Backblaze B2 Simulated Upkeep ({timeframeLabel})</p>
                <h4 className="text-2xl font-black text-white mt-1.5">
                  ₹{((simulatedB2Cost * timeframeFactor) * usdToInrRate).toFixed(2)} <span className="text-xs font-medium text-slate-500">{timeframeSuffix}</span>
                </h4>
                <p className="text-[10px] text-sky-400 font-bold mt-1">
                  ${(simulatedB2Cost * timeframeFactor).toFixed(4)} USD
                </p>
                <p className="text-[10px] text-slate-500 mt-2.5 leading-relaxed">
                  Based on simulated storage capacity of <span className="text-slate-350 font-semibold">{simulatedStorageGB} GB</span> and scaled transaction API volumes.
                </p>
              </div>
            </div>

            {/* Backblaze B2 pricing explanation */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <h4 className="text-md font-bold text-white mb-1.5 flex items-center">
                  <Info className="w-5 h-5 mr-2 text-indigo-400" />
                  B2 Storage Rules
                </h4>
                <p className="text-slate-400 text-xs mb-6">
                  Backblaze B2 provides enterprise storage capabilities.
                </p>

                <div className="space-y-4 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Bucket</span>
                    <span className="text-white font-semibold">{liveB2Usage?.bucketName || 'EveBash'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Live Bucket Files</span>
                    <span className="text-white font-semibold">
                      {typeof liveB2Usage?.fileCount === 'number' ? formatNumber(liveB2Usage.fileCount) : 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Free Tier Limit</span>
                    <span className="text-white font-semibold">10 GB / month</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Storage Unit Rate</span>
                    <span className="text-white font-semibold">$0.006 / GB / month</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Standard Egress Fee</span>
                    <span className="text-white font-semibold">$0.01 / GB</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Bandwidth Alliance</span>
                    <span className="text-emerald-400 font-bold flex items-center">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" /> $0.00 Egress
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-sky-500/5 border border-sky-500/10 rounded-2xl mt-6">
                <p className="text-[10px] text-sky-400 font-bold uppercase tracking-wider flex items-center">
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Egress Saving Strategy
                </p>
                <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                  Due to our Cloudflare DNS setup, requests are routed via the Cloudflare Edge network. Both providers participate in the **Bandwidth Alliance**, reducing outbound media download (egress) transfer fees from Backblaze B2 to $0.00.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB PANEL 4: CLOUDFLARE DETAIL */}
      {activeSubTab === 'cloudflare' && (
        <div className="space-y-8 animate-fadeIn">
          {renderFilterBar('bg-amber-600', 'text-amber-400')}

          {/* Live Cost Banner — shown when API is connected */}
          {liveCfPlan && (
            <div className="bg-amber-955/20 border border-amber-800/30 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-5">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <h4 className="text-base font-bold text-amber-300 font-sans">Live Cloudflare Account Billing</h4>
                <span className="ml-auto text-[10px] text-amber-500 font-mono">Real-time via Cloudflare API v4</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-amber-950/30 border border-amber-900/10 rounded-2xl p-4">
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">Zone Plan</p>
                  <p className="text-2xl font-black text-white">{liveCfPlan.toUpperCase()}</p>
                  <p className="text-[10px] text-amber-500 mt-1">Free Website Tier</p>
                </div>
                <div className="bg-amber-950/30 border border-amber-900/10 rounded-2xl p-4">
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">Domain Registrar</p>
                  <p className="text-2xl font-black text-white">$0.00</p>
                  <p className="text-[10px] text-amber-500 mt-1">Registered via Hostinger</p>
                </div>
                <div className="bg-amber-950/30 border border-amber-900/10 rounded-2xl p-4">
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider mb-1">Active Subscriptions</p>
                  <p className="text-2xl font-black text-white">
                    {liveCfSubscriptionCost > 0 ? `$${liveCfSubscriptionCost.toFixed(2)}` : 'None'}
                  </p>
                  <p className="text-[10px] text-amber-500 mt-1">{liveCfSubscriptions.length} active addon(s)</p>
                </div>
                <div className="bg-amber-900/20 border border-amber-700/25 rounded-2xl p-4">
                  <p className="text-[10px] text-amber-350 font-bold uppercase tracking-wider mb-1">Total Monthly Cost</p>
                  <p className="text-2xl font-black text-amber-300">${actualCloudflareCost.toFixed(2)}</p>
                  <p className="text-[10px] text-amber-500 mt-1">
                    ₹{(actualCloudflareCost * usdToInrRate).toFixed(0)} @ ₹{usdToInrRate}/USD
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Cloudflare metrics block */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Egress savings banner */}
            <div className="bg-[#111827]/80 border border-emerald-950 rounded-2xl p-5 shadow-lg flex items-center justify-between col-span-1 md:col-span-1 bg-gradient-to-br from-[#111827]/90 to-emerald-950/15">
              <div className="space-y-1">
                <p className="text-emerald-400 text-xs font-black uppercase tracking-wider">Bandwidth Alliance</p>
                <h4 className="text-lg font-bold text-white mt-1">Egress: $0.00 / GB</h4>
                <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                  B2 downloads via Cloudflare edge incur zero egress.
                </p>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl shrink-0 hidden sm:block">
                <ShieldCheck className="w-6 h-6" />
              </div>
            </div>

            {/* Live API sync status */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-lg bg-gradient-to-br from-[#111827]/90 to-amber-950/10">
              <p className="text-amber-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${liveCfPlan ? 'bg-emerald-500 animate-pulse' : 'bg-slate-650'}`}></span>
                Live API Connection
              </p>
              <h4 className="text-md font-bold text-white mt-1">
                {liveCfPlan ? `${liveCfPlan.toUpperCase()} Plan` : 'Offline / Simulated'}
              </h4>
              <div className="text-[10px] text-slate-400 mt-2 space-y-1">
                <div>Transformations (30d): <span className="text-slate-200 font-semibold">{liveCfTransformations !== null ? formatNumber(liveCfTransformations) : 'N/A'}</span></div>
                <div>Stored Images (Live): <span className="text-slate-200 font-semibold">{liveCfStoredImages !== null ? formatNumber(liveCfStoredImages) : 'N/A'}</span></div>
              </div>
            </div>
            {/* Registrar cost info */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-lg group">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Domain Registrar Cost</p>
                  <h3 className="text-xl font-black text-white mt-1 group-hover:text-amber-400 transition-colors">
                    $0.00 <span className="text-xs font-medium text-slate-500">/ mo</span>
                  </h3>
                </div>
                <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
                  <Globe className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-2.5">
                $0.00 billed to Cloudflare (registered externally via Hostinger)
              </p>
            </div>
          </div>

          {/* Workers API interactive simulator */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl md:col-span-2 space-y-6">
              <div>
                <h4 className="text-md font-bold text-white flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-amber-400" />
                  Cloudflare Workers API Requests Simulator
                </h4>
                <p className="text-slate-400 text-xs mt-1">
                  Simulate daily serverless API queries to test Workers request tiers.
                </p>
              </div>

              {/* Request Slider */}
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">Simulated Daily Requests:</span>
                  <span className="text-amber-400 font-bold text-sm">
                    {formatNumber(simulatedDailyRequests)} requests / day
                  </span>
                </div>

                <input
                  type="range"
                  min="10000"
                  max="2000000"
                  step="10000"
                  value={simulatedDailyRequests}
                  onChange={e => setSimulatedDailyRequests(Number(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />

                <div className="flex justify-between text-[10px] text-slate-650 font-semibold uppercase">
                  <span>10,000 req/day</span>
                  <span>500k req/day</span>
                  <span>1M req/day</span>
                  <span>1.5M req/day</span>
                  <span>2M req/day</span>
                </div>
              </div>

              {/* Calculation analysis cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-slate-850 bg-slate-900/30">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Estimated Monthly Volume</p>
                  <h4 className="text-md font-black text-white mt-1.5">
                    {formatNumber(monthlyRequests)} <span className="text-[10px] font-semibold text-slate-500">req</span>
                  </h4>
                </div>

                <div className="p-4 rounded-xl border border-slate-850 bg-slate-900/30">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Workers Plan Required</p>
                  <h4 className="text-md font-black text-white mt-1.5">
                    {monthlyRequests <= 3000000 ? 'Workers Free' : 'Workers Paid'}
                  </h4>
                </div>

                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <p className="text-[10px] text-amber-400 font-black uppercase tracking-wider">Estimated Monthly Cost</p>
                  <h4 className="text-md font-black text-white mt-1.5">
                    ${workersCost.toFixed(2)} <span className="text-[10px] font-semibold text-slate-500">/ mo</span>
                  </h4>
                </div>
              </div>
            </div>

            {/* Cloudflare plan terms side card */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
              <div>
                <h4 className="text-md font-bold text-white mb-1.5 flex items-center">
                  <Info className="w-5 h-5 mr-2 text-indigo-400" />
                  Cloudflare Workers Limits
                </h4>
                <p className="text-slate-400 text-xs mb-6">
                  Workers run serverless functions at edge network datacenters.
                </p>

                <div className="space-y-4 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Workers Free Tier</span>
                    <span className="text-white font-semibold">100k requests / day</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Workers Paid Base</span>
                    <span className="text-white font-semibold">$5.00 / month</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Included Paid Volume</span>
                    <span className="text-white font-semibold">10 Million requests</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800/40">
                    <span className="text-slate-400">Overage Surcharge</span>
                    <span className="text-white font-semibold">$0.50 / Million req</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl mt-6">
                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider flex items-center">
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Workers Architecture
                </p>
                <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
                  Cloudflare Workers execute Javascript queries via V8 isolates. Isolates require no cold boot starts, providing much lower latency compared to AWS Lambda serverless functions.
                </p>
              </div>
            </div>
          </div>



          {/* Cloudflare Charging Units Cost Table */}
          <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h4 className="text-md font-bold text-white mb-1.5 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-amber-400" />
              Cloudflare Billing Units Cost Breakdown
            </h4>
            <p className="text-slate-400 text-xs mb-6">
              Detailed tracking of active edge network routing, SSL/TLS security, domain registration, and serverless Workers, including actual monthly and yearly projections.
            </p>

            <div className="overflow-x-auto border border-slate-800/60 rounded-2xl">
              <table className="w-full text-left text-xs text-slate-400">
                <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/30 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Billing Unit</th>
                    <th className="py-3 px-4">Plan Limit / Allowance</th>
                    <th className="py-3 px-4">Actual Usage "Till Now"</th>
                    <th className="py-3 px-4">Cost (Current Month)</th>
                    <th className="py-3 px-4">Cost (Projected Year)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-350">
                  {/* Row 1: Domain Registration */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Domain Registrar (External Hostinger)</td>
                    <td className="py-4 px-4">Registered externally via Hostinger</td>
                    <td className="py-4 px-4">1 Domain Active</td>
                    <td className="py-4 px-4 font-mono font-bold text-amber-400">$0.00</td>
                    <td className="py-4 px-4 font-mono text-slate-400">$0.00</td>
                  </tr>

                  {/* Row 1b: Live Cloudflare Plan Subscriptions */}
                  {liveCfSubscriptionCost > 0 && (
                    <tr className="hover:bg-slate-800/10 transition-colors bg-amber-500/5">
                      <td className="py-4 px-4 font-semibold text-white flex items-center gap-1.5">
                        Cloudflare Premium Subscriptions
                        <span className="text-[9px] bg-amber-500/20 text-amber-350 px-1.5 py-0.5 rounded font-black uppercase">Live</span>
                      </td>
                      <td className="py-4 px-4">Active Plan upgrades / Paid add-ons</td>
                      <td className="py-4 px-4">
                        {liveCfPlan ? `${liveCfPlan.toUpperCase()} Zone Plan` : 'Subscriptions Active'}
                      </td>
                      <td className="py-4 px-4 font-mono font-bold text-amber-400">${liveCfSubscriptionCost.toFixed(2)}</td>
                      <td className="py-4 px-4 font-mono text-slate-400">${(liveCfSubscriptionCost * 12).toFixed(2)}</td>
                    </tr>
                  )}

                  {/* Row 2: Workers Serverless API requests */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Cloudflare Workers API Requests</td>
                    <td className="py-4 px-4">100,000 / day Free (3M / mo)</td>
                    <td className="py-4 px-4">Minimal</td>
                    <td className="py-4 px-4 font-mono font-bold text-amber-400">$0.00</td>
                    <td className="py-4 px-4 font-mono text-slate-400">$0.00</td>
                  </tr>

                  {/* Row 3: Remote Image Resizing */}
                  <tr className="hover:bg-slate-800/10 transition-colors opacity-60">
                    <td className="py-4 px-4 font-semibold text-slate-400 flex items-center gap-1.5">
                      Remote Image Resizing (Cloudflare)
                      <span className="text-[9px] bg-slate-850 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">Bypassed</span>
                    </td>
                    <td className="py-4 px-4 text-slate-500">Deactivated (Shifted to backend)</td>
                    <td className="py-4 px-4 text-slate-500">0 transformations/mo <span className="text-[10px] text-slate-650">(pre-generated on B2)</span></td>
                    <td className="py-4 px-4 font-mono font-bold text-slate-500">$0.00</td>
                    <td className="py-4 px-4 font-mono text-slate-500">$0.00</td>
                  </tr>

                  {/* Row 4: CDN Bandwidth / Egress */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">CDN Content Egress & Data Transfer</td>
                    <td className="py-4 px-4">Unlimited Free</td>
                    <td className="py-4 px-4">Active Cache</td>
                    <td className="py-4 px-4 font-mono font-bold text-amber-400">$0.00</td>
                    <td className="py-4 px-4 font-mono text-slate-400">$0.00</td>
                  </tr>

                  {/* Row 5: SSL/TLS Security */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">Edge SSL/TLS Certificates</td>
                    <td className="py-4 px-4">Unlimited Free</td>
                    <td className="py-4 px-4">Active (Universal SSL)</td>
                    <td className="py-4 px-4 font-mono font-bold text-amber-400">$0.00</td>
                    <td className="py-4 px-4 font-mono text-slate-400">$0.00</td>
                  </tr>

                  {/* Row 6: DDoS Protection & WAF */}
                  <tr className="hover:bg-slate-800/10 transition-colors">
                    <td className="py-4 px-4 font-semibold text-white">DNS Hosting & DDoS Protection (WAF)</td>
                    <td className="py-4 px-4">5 Custom Rules Included</td>
                    <td className="py-4 px-4">Active</td>
                    <td className="py-4 px-4 font-mono font-bold text-amber-400">$0.00</td>
                    <td className="py-4 px-4 font-mono text-slate-400">$0.00</td>
                  </tr>

                  {/* Total row */}
                  <tr className="bg-slate-900/30 font-bold border-t border-slate-800">
                    <td className="py-4 px-4 text-white">Total Cloudflare Expenses</td>
                    <td className="py-4 px-4">-</td>
                    <td className="py-4 px-4">-</td>
                    <td className="py-4 px-4 font-mono text-amber-400">${actualCloudflareCost.toFixed(2)} / mo</td>
                    <td className="py-4 px-4 font-mono text-slate-350">${(actualCloudflareCost * 12).toFixed(2)} / yr</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* TAB PANEL 5: MODAL.COM (AI) */}
      {activeSubTab === 'modal' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Real-time Timeframe Filtering Controls */}
          {renderFilterBar('bg-indigo-650', 'text-indigo-400')}

          {/* Overview Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                Total Cost ({timeFilter === '1d' ? 'Running Day' : timeFilter === '1w' ? 'Running Week' : timeFilter === '1m' ? 'Running Month' : 'Custom'})
              </p>
              <h3 className="text-2xl font-black text-indigo-455 mt-1">
                ₹{actualModalCostInfo.inr.toFixed(2)} <span className="text-xs font-semibold text-slate-400">(${actualModalCostInfo.usd.toFixed(4)})</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-2">
                Estimated for {modalLogs.length} execution runs
              </p>
            </div>

            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Total Invocations</p>
              <h3 className="text-2xl font-black text-white mt-1">
                {modalLogs.length}
              </h3>
              <p className="text-[10px] text-slate-500 mt-2">
                {modalStats.photosCount} Photos | {modalStats.selfiesCount} Selfies | {modalStats.batchesCount} Batches
              </p>
            </div>

            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Avg Process Time</p>
              <h3 className="text-2xl font-black text-white mt-1">
                {modalStats.avgDuration.toFixed(2)}s
              </h3>
              <p className="text-[10px] text-slate-500 mt-2">
                Per execution average
              </p>
            </div>

            <div className="bg-[#111827]/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Faces Detected</p>
              <h3 className="text-2xl font-black text-white mt-1">
                {modalStats.totalFaces}
              </h3>
              <p className="text-[10px] text-slate-500 mt-2">
                Found and index mapped in database
              </p>
            </div>
          </div>

          {/* Cost Logs Table */}
          <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <h4 className="text-md font-bold text-white mb-1.5 flex items-center">
              <Cpu className="w-5 h-5 mr-2 text-indigo-400" />
              Recent Indexing Cost Logs (Last 30 Days)
            </h4>
            <p className="text-slate-400 text-xs mb-6">
              Track real-time face indexing executions, detected faces, and billing cost calculations per upload.
            </p>

            <div className="overflow-x-auto border border-slate-800/60 rounded-2xl">
              <table className="w-full text-left text-xs text-slate-400">
                <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/30 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Function</th>
                    <th className="py-3 px-4">Resources</th>
                    <th className="py-3 px-4">Event ID</th>
                    <th className="py-3 px-4">Execution Time</th>
                    <th className="py-3 px-4">Faces</th>
                    <th className="py-3 px-4">Estimated Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 text-slate-350">
                  {paginatedLogs.length > 0 ? (
                    paginatedLogs.map(log => {
                      const functionName = log.function_name || 'process_single_photo';
                      
                      const duration = Number(log.execution_time_seconds) || 0;
                      const cpu = log.cpu_cores || 1.0;
                      const mem = log.memory_gb || 1.0;
                      
                      const costUsd = duration * ((cpu * 0.0000131) + (mem * 0.00000222));
                      const costInr = costUsd * usdToInrRate;
                      
                      let badgeColor = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
                      if (functionName === 'find_matching_photos') {
                        badgeColor = 'bg-purple-500/10 border-purple-500/20 text-purple-400';
                      } else if (functionName === 'process_media_batch') {
                        badgeColor = 'bg-blue-500/10 border-blue-500/20 text-blue-400';
                      }
                      
                      return (
                        <tr key={log.id} className="hover:bg-slate-800/10 transition-colors">
                          <td className="py-3 px-4 text-[11px] font-mono">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 text-[9px] font-bold border rounded-full ${badgeColor}`}>
                              {functionName}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-[10px] text-slate-400">
                            {cpu} CPU | {mem} GB
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                            {log.event_id ? (
                              <span>📅 {log.event_id}</span>
                            ) : (
                              <span>-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            {duration.toFixed(2)}s
                          </td>
                          <td className="py-3 px-4 font-semibold text-white">
                            {log.faces_detected}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                            ₹{costInr.toFixed(5)} <span className="text-[10px] text-slate-400">(${costUsd.toFixed(6)})</span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500">
                        No face indexing runs logged in the last 30 days.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-800/60 px-4 py-4 sm:px-6 bg-slate-900/10">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-450 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative ml-3 inline-flex items-center rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs font-medium text-slate-450 hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-slate-400">
                        Showing <span className="font-semibold text-white">{Math.min(modalLogs.length, (currentPage - 1) * itemsPerPage + 1)}</span> to{' '}
                        <span className="font-semibold text-white">{Math.min(modalLogs.length, currentPage * itemsPerPage)}</span> of{' '}
                        <span className="font-semibold text-white">{modalLogs.length}</span> entries
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-xl border border-slate-800/65 bg-slate-950 p-1 gap-1" aria-label="Pagination">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center rounded-lg p-1.5 text-slate-450 hover:bg-slate-900 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <span className="sr-only">Previous</span>
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        
                        {pageNumbers.map(page => {
                          const isActive = page === currentPage;
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`relative inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-indigo-650 text-white'
                                  : 'text-slate-450 hover:bg-slate-900 hover:text-slate-200'
                              }`}
                            >
                              {page}
                            </button>
                          );
                        })}

                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center rounded-lg p-1.5 text-slate-450 hover:bg-slate-900 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        >
                          <span className="sr-only">Next</span>
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Railway.app Tab */}
      {activeSubTab === 'railway' && (
        <div className="space-y-8 animate-fadeIn">
          {/* Timeframe & Exchange Rate Controls */}
          {renderFilterBar('bg-fuchsia-600', 'text-fuchsia-400')}

          {/* Live Cost Banner — shown when API is connected */}
          {hasLiveRailway && liveRailwayData && (
            <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h4 className="text-base font-bold text-emerald-300">Live Railway Billing — {liveRailwayData.projectName}</h4>
                <span className="ml-auto text-[10px] text-emerald-500 font-mono">Real-time via Railway GraphQL API</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-emerald-950/40 rounded-2xl p-4">
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">CPU Compute</p>
                  <p className="text-2xl font-black text-white">${liveRailwayData.cpuDollars.toFixed(2)}</p>
                  <p className="text-[10px] text-emerald-500 mt-1">This month</p>
                </div>
                <div className="bg-emerald-950/40 rounded-2xl p-4">
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">RAM Memory</p>
                  <p className="text-2xl font-black text-white">${liveRailwayData.memoryDollars.toFixed(2)}</p>
                  <p className="text-[10px] text-emerald-500 mt-1">This month</p>
                </div>
                <div className="bg-emerald-950/40 rounded-2xl p-4">
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">Network Egress</p>
                  <p className="text-2xl font-black text-white">${liveRailwayData.networkDollars.toFixed(2)}</p>
                  <p className="text-[10px] text-emerald-500 mt-1">This month</p>
                </div>
                <div className="bg-emerald-900/30 border border-emerald-700/30 rounded-2xl p-4">
                  <p className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider mb-1">
                    {liveRailwayData.invoiceDollars !== null ? 'Current Invoice' : 'Estimated Total'}
                  </p>
                  <p className="text-2xl font-black text-emerald-300">${actualRailwayCost.toFixed(2)}</p>
                  <p className="text-[10px] text-emerald-500 mt-1">
                    ₹{(actualRailwayCost * usdToInrRate).toFixed(0)} @ ₹{usdToInrRate}/USD
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Error state — token not configured */}
          {liveRailwayData?.error && (
            <div className="bg-amber-950/30 border border-amber-800/40 rounded-3xl p-5 flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-300">Live Railway data unavailable</p>
                <p className="text-xs text-amber-400/80 mt-1">{liveRailwayData.error}</p>
                <div className="mt-3 space-y-1.5 text-xs text-amber-400/70">
                  <p>To enable live billing sync, add these to your Next.js <code className="bg-amber-950/60 px-1 rounded">.env.local</code>:</p>
                  <p className="font-mono bg-amber-950/60 px-2 py-1 rounded text-amber-300">RAILWAY_API_TOKEN=your_account_token</p>
                  <p className="font-mono bg-amber-950/60 px-2 py-1 rounded text-amber-300">RAILWAY_PROJECT_ID=your_project_id</p>
                  <p className="text-amber-500 mt-2">
                    ⚠️ Must be an <strong>Account Token</strong> — not a Project or Workspace token.<br />
                    Get it from: <strong>Railway Dashboard → Account Settings → Tokens → New Token</strong>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left: Configuration Sliders */}
            <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-8">
              <div>
                <h4 className="text-lg font-bold text-white mb-2 flex items-center">
                  <Sliders className="w-5 h-5 mr-2 text-fuchsia-400" />
                  Railway Server Simulator
                </h4>
                <p className="text-slate-400 text-xs">
                  {hasLiveRailway
                    ? 'Live data is active above. Use these sliders to model future scaling scenarios.'
                    : 'Railway.app bills your edge server usage by the second based on Memory and CPU allocation. Use the sliders to estimate your Node.js container\'s costs.'}
                </p>
              </div>

              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-semibold text-slate-300">Container RAM Allocation</label>
                    <span className="px-3 py-1 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-fuchsia-400">
                      {simulatedRailwayRAM.toFixed(1)} GB
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="8"
                    step="0.1"
                    value={simulatedRailwayRAM}
                    onChange={e => setSimulatedRailwayRAM(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                  />
                  <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                    <span>0.5 GB</span>
                    <span>8 GB</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-semibold text-slate-300">Container vCPU Allocation</label>
                    <span className="px-3 py-1 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-fuchsia-400">
                      {simulatedRailwayCPU.toFixed(2)} vCPU
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="4"
                    step="0.05"
                    value={simulatedRailwayCPU}
                    onChange={e => setSimulatedRailwayCPU(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                  />
                  <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                    <span>0.05 vCPU</span>
                    <span>4 vCPU</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-semibold text-slate-300">Monthly Egress (Bandwidth)</label>
                    <span className="px-3 py-1 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-fuchsia-400">
                      {simulatedRailwayEgress} GB
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="500"
                    step="1"
                    value={simulatedRailwayEgress}
                    onChange={e => setSimulatedRailwayEgress(Number(e.target.value))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                  />
                  <div className="flex justify-between mt-2 text-[10px] text-slate-500">
                    <span>1 GB</span>
                    <span>500 GB</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Cost Breakdown & Architecture Details */}
            <div className="space-y-6">
              <div className="bg-[#111827]/80 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-2xl pointer-events-none" />
                <h4 className="text-lg font-bold text-white mb-6 border-b border-slate-800 pb-4">Estimated Monthly Impact</h4>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-400 text-sm">Memory Compute</span>
                    <span className="font-mono text-white">${railwayRamCostMonth.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-400 text-sm">vCPU Compute</span>
                    <span className="font-mono text-white">${railwayCpuCostMonth.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-400 text-sm">Network Egress</span>
                    <span className="font-mono text-white">${railwayEgressCostMonth.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-slate-800 pt-4 flex justify-between items-center">
                    <span className="font-bold text-slate-300">Total Simulated Cost</span>
                    <span className="font-mono font-black text-fuchsia-400 text-xl">${simulatedRailwayCost.toFixed(2)} / mo</span>
                  </div>
                </div>
              </div>

              <div className="bg-fuchsia-950/20 border border-fuchsia-900/30 rounded-3xl p-6">
                <h4 className="text-sm font-bold text-fuchsia-300 mb-3 flex items-center">
                  <Server className="w-4 h-4 mr-2" /> Server Architecture Notes
                </h4>
                <ul className="space-y-2 text-xs text-fuchsia-200/70 list-disc list-inside">
                  <li><strong>Compute Profile:</strong> Next.js containers naturally idle around 0.005 vCPU and ~300MB RAM. Egress is drastically reduced because heavy media assets are served directly from Backblaze B2 & Cloudflare.</li>
                  <li><strong>Execution Rates:</strong> Billed precisely by the second based on actual usage peaks. Memory is $0.00000386/GB/sec (~$10/GB/month), CPU is $0.00000772/vCPU/sec (~$20/vCPU/month), Egress is $0.05/GB.</li>
                  <li><strong>Included Credits:</strong> Hobby plan ($5/mo) and Pro plan ($20/mo) come with matching usage credits — you only pay overage above that. Adjust sliders to your actual container allocation from Railway dashboard.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

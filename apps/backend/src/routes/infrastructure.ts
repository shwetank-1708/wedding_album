import type { Request, Response } from "express";
import { Router } from "express";
import { adminAuthStatus, verifySuperAdmin } from "../adminAuth.js";
import { getCachedBackblazeAuth } from "../backblaze.js";
import { getSupabaseAdminClient } from "../supabase.js";

export const infrastructureRouter = Router();

const RAILWAY_GQL = "https://backboard.railway.app/graphql/v2";
const RATE_CPU_PER_VCPU_SEC = 0.00000772;
const RATE_MEM_PER_GB_SEC = 0.00000386;
const RATE_NETWORK_TX_PER_GB = 0.05;

type B2File = {
  contentLength?: number;
  size?: number;
};

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

async function authorize(request: Request, response: Response) {
  try {
    const verification = await verifySuperAdmin(request);
    if ("error" in verification) {
      response.status(adminAuthStatus(verification.error)).json({
        success: false,
        error: verification.error,
      });
      return false;
    }
    return true;
  } catch (err: any) {
    response.status(500).json({
      success: false,
      error: err?.message || "Admin authorization failed",
    });
    return false;
  }
}

infrastructureRouter.get("/supabase-billing", async (request, response) => {
  if (!(await authorize(request, response))) return;

  try {
    const managementKey = requireEnv("SUPABASE_MGMT_KEY");
    const projectUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
    const projectRef = projectUrl.match(/https:\/\/(.*?)\.supabase\./)?.[1];

    if (!projectRef) {
      return response.status(400).json({ error: "Could not extract the Supabase project reference." });
    }

    const startDate = typeof request.query.startDate === "string" ? request.query.startDate : undefined;
    const endDate = typeof request.query.endDate === "string" ? request.query.endDate : undefined;

    const headers = {
      Authorization: `Bearer ${managementKey}`,
      "Content-Type": "application/json",
    };

    // 1. Fetch Project Details
    const projectResult = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, { headers });
    if (!projectResult.ok) {
      return response.status(projectResult.status).json({
        error: `Supabase Project API returned status ${projectResult.status}: ${await projectResult.text()}`,
      });
    }

    const project = await projectResult.json();
    const organizationId = project.organization_id || project.organization_slug;
    if (!organizationId) {
      return response.status(502).json({ error: "Supabase project response did not include an organization." });
    }

    // 2. Fetch Organization Details (Plan & Spend Cap)
    let plan = "free";
    let spendCap: boolean | null = null;
    const organizationResult = await fetch(
      `https://api.supabase.com/v1/organizations/${organizationId}`,
      { headers },
    );
    if (organizationResult.ok) {
      const organization = await organizationResult.json();
      plan = String(organization.plan || "free").toLowerCase();
      if (typeof organization.spend_cap === "boolean") {
        spendCap = organization.spend_cap;
      } else if (plan === "pro") {
        spendCap = true;
      }
    }

    // 3. Fetch Add-ons
    let addons: Array<{ name: string; type: string; variant?: string; price: number; currency: string }> = [];
    try {
      const addonsResult = await fetch(
        `https://api.supabase.com/v1/projects/${projectRef}/billing/addons`,
        { headers },
      );
      if (addonsResult.ok) {
        const addonsData = await addonsResult.json();
        const rawAddons: any[] = Array.isArray(addonsData)
          ? addonsData
          : Array.isArray(addonsData?.selected_addons)
            ? addonsData.selected_addons
            : [];

        addons = rawAddons.map((item: any) => {
          const type = String(item.type || item.addon_type || "").toLowerCase();
          const variant = String(item.variant || item.id || "").toLowerCase();
          let price = 0;
          let name = item.name || type;

          if (type.includes("ipv4") || variant.includes("ipv4")) {
            price = 4.0;
            name = "Dedicated IPv4 Address";
          } else if (type.includes("custom_domain") || variant.includes("custom_domain")) {
            price = 10.0;
            name = "Custom Domain";
          } else if (type.includes("pitr") || variant.includes("pitr")) {
            price = 100.0;
            name = "Point-in-Time Recovery (PITR)";
          } else if (type.includes("compute")) {
            if (variant.includes("small")) { price = 10.0; name = "Compute: Small Instance"; }
            else if (variant.includes("medium")) { price = 30.0; name = "Compute: Medium Instance"; }
            else if (variant.includes("large")) { price = 70.0; name = "Compute: Large Instance"; }
            else if (variant.includes("xlarge")) { price = 150.0; name = "Compute: XL Instance"; }
            else { price = 0; name = "Compute: Micro Instance (Included)"; }
          } else if (typeof item.price === "number") {
            price = item.price;
          }

          return {
            name,
            type: type || "addon",
            variant,
            price,
            currency: "usd",
          };
        });
      }
    } catch (addonsErr) {
      console.warn("[infrastructure] Could not fetch Supabase addons:", addonsErr);
    }

    // 4. Fetch Live Database & Auth Telemetry via Management API SQL Query
    let usage: {
      dbBytes: number | null;
      facesTableBytes: number | null;
      facesCount: number | null;
      timeframeMau: number | null;
      totalUsers: number | null;
    } = {
      dbBytes: null,
      facesTableBytes: null,
      facesCount: null,
      timeframeMau: null,
      totalUsers: null,
    };

    try {
      const startIso = startDate && !isNaN(new Date(startDate).getTime())
        ? `'${new Date(startDate).toISOString()}'::timestamptz`
        : "NULL";
      const endIso = endDate && !isNaN(new Date(endDate).getTime())
        ? `'${new Date(endDate).toISOString()}'::timestamptz`
        : "NULL";

      const telemetryQuery = `
        SELECT 
          pg_database_size(current_database()) AS db_bytes,
          CASE 
            WHEN to_regclass('public.faces') IS NOT NULL 
            THEN pg_total_relation_size('public.faces') 
            ELSE 0 
          END AS faces_bytes,
          CASE 
            WHEN to_regclass('public.faces') IS NOT NULL 
            THEN (SELECT count(*) FROM public.faces) 
            ELSE 0 
          END AS faces_count,
          (SELECT count(*) FROM auth.users) AS total_users,
          (SELECT count(distinct id) FROM auth.users 
           WHERE (${startIso} IS NULL OR last_sign_in_at >= ${startIso}) 
             AND (${endIso} IS NULL OR last_sign_in_at <= ${endIso})) AS timeframe_mau;
      `;

      const queryResult = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
        method: "POST",
        headers,
        body: JSON.stringify({ query: telemetryQuery }),
      });

      if (queryResult.ok) {
        const queryData = await queryResult.json();
        const row = Array.isArray(queryData) ? queryData[0] : queryData;
        if (row) {
          usage = {
            dbBytes: typeof row.db_bytes === "number" ? row.db_bytes : Number(row.db_bytes) || null,
            facesTableBytes: typeof row.faces_bytes === "number" ? row.faces_bytes : Number(row.faces_bytes) || 0,
            facesCount: typeof row.faces_count === "number" ? row.faces_count : Number(row.faces_count) || 0,
            timeframeMau: typeof row.timeframe_mau === "number" ? row.timeframe_mau : Number(row.timeframe_mau) || null,
            totalUsers: typeof row.total_users === "number" ? row.total_users : Number(row.total_users) || null,
          };
        }
      } else {
        console.warn("[infrastructure] Supabase database/query returned status:", queryResult.status);
      }
    } catch (queryErr) {
      console.warn("[infrastructure] Could not execute Supabase telemetry query:", queryErr);
    }

    return response.json({
      billing_tier: {
        id: plan,
        name: plan === "free" ? "Free" : plan === "pro" ? "Pro" : plan.toUpperCase(),
        price: plan === "pro" ? 25 : 0,
        currency: "usd",
        interval: "monthly",
      },
      spend_cap: spendCap,
      addons,
      usage,
    });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch Supabase billing data.",
    });
  }
});

infrastructureRouter.get("/cloudflare-billing", async (request, response) => {
  if (!(await authorize(request, response))) return;

  try {
    const apiToken = requireEnv("CLOUDFLARE_API_TOKEN");
    const accountId = requireEnv("CLOUDFLARE_ACCOUNT_ID");
    const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
    const headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };

    const subscriptionsResult = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/subscriptions`,
      { headers },
    );
    const subscriptionsPayload = subscriptionsResult.ok ? await subscriptionsResult.json() : null;
    const subscriptions = subscriptionsPayload?.result || [];

    let zonePlan = "free";
    if (zoneId) {
      const zoneResult = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, { headers });
      if (zoneResult.ok) {
        const zonePayload = await zoneResult.json();
        zonePlan = zonePayload.result?.plan?.legacy_id || zonePayload.result?.plan?.id || zonePlan;
      }
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const transformationsResult = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `
          query GetImageTransformations($accountId: String!, $start: String!, $end: String!) {
            viewer {
              accounts(filter: { accountTag: $accountId }) {
                imagesUniqueTransformations(
                  filter: { datetime_geq: $start, datetime_leq: $end }
                  limit: 100
                ) { datetime uniqueTransformations }
              }
            }
          }
        `,
        variables: {
          accountId,
          start: thirtyDaysAgo.toISOString(),
          end: now.toISOString(),
        },
      }),
    });
    const transformationsPayload = transformationsResult.ok ? await transformationsResult.json() : null;
    const transformationRows = transformationsPayload?.data?.viewer?.accounts?.[0]?.imagesUniqueTransformations || [];
    const uniqueTransformations = transformationRows.reduce(
      (sum: number, row: { uniqueTransformations?: number }) => sum + (row.uniqueTransformations || 0),
      0,
    );

    const imageStatsResult = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/stats`,
      { headers },
    );
    const imageStats = imageStatsResult.ok ? await imageStatsResult.json() : null;

    return response.json({
      zonePlan,
      subscriptions,
      uniqueTransformations,
      storedImages: imageStats?.result?.count?.current || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch Cloudflare billing data.",
    });
  }
});

infrastructureRouter.get("/backblaze-usage", async (request, response) => {
  if (!(await authorize(request, response))) return;

  const bucketId = process.env.B2_BUCKET_ID?.trim();
  const bucketName = process.env.B2_BUCKET_NAME?.trim() || "EveBash";
  if (!bucketId) {
    return response.status(500).json({ error: "B2_BUCKET_ID is not configured." });
  }

  try {
    const auth = await getCachedBackblazeAuth();
    let startFileName: string | undefined;
    let totalBytes = 0;
    let fileCount = 0;

    do {
      const listResult = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_names`, {
        method: "POST",
        headers: {
          Authorization: auth.authorizationToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bucketId,
          maxFileCount: 10000,
          ...(startFileName ? { startFileName } : {}),
        }),
      });
      if (!listResult.ok) {
        return response.status(listResult.status).json({
          error: `Backblaze API returned status ${listResult.status}: ${await listResult.text()}`,
          bucketId,
          bucketName,
        });
      }

      const payload = await listResult.json();
      const files: B2File[] = Array.isArray(payload.files) ? payload.files : [];
      for (const file of files) {
        totalBytes += Number(file.contentLength ?? file.size ?? 0) || 0;
        fileCount += 1;
      }
      startFileName = payload.nextFileName || undefined;
    } while (startFileName);

    return response.json({
      bucketId,
      bucketName,
      fileCount,
      totalBytes,
      totalGb: totalBytes / (1024 * 1024 * 1024),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch Backblaze usage.",
      bucketId,
      bucketName,
    });
  }
});

infrastructureRouter.get("/railway-billing", async (request, response) => {
  if (!(await authorize(request, response))) return;

  const now = new Date();
  const startDate = String(request.query.startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
  const endDate = String(request.query.endDate || now.toISOString());

  try {
    const apiToken = process.env.RAILWAY_API_TOKEN?.trim();
    const projectId = process.env.RAILWAY_PROJECT_ID?.trim();

    if (!apiToken || !projectId) {
      return response.status(200).json({
        configured: false,
        projectName: "EveBash",
        projectId: projectId || null,
        billingPeriod: { start: startDate, end: endDate },
        cpuVcpuMin: 0,
        memGbMin: 0,
        cpuVcpuSec: 0,
        memGbSec: 0,
        networkTxGb: 0,
        networkRxGb: 0,
        cpuDollars: 0,
        memoryDollars: 0,
        networkDollars: 0,
        totalEstimatedDollars: 0,
        invoiceDollars: null,
        error: "Railway API credentials not configured. Please set RAILWAY_API_TOKEN and RAILWAY_PROJECT_ID in backend env.",
        timestamp: new Date().toISOString(),
      });
    }

    const headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };

    const executeGql = async (query: string) => {
      const body = JSON.stringify({ query });
      for (const endpoint of ["https://backboard.railway.com/graphql/v2", "https://backboard.railway.app/graphql/v2"]) {
        try {
          const res = await fetch(endpoint, { method: "POST", headers, body });
          if (res.ok) return res;
        } catch {
          // try fallback
        }
      }
      return fetch("https://backboard.railway.app/graphql/v2", { method: "POST", headers, body });
    };

    let projectName = "EveBash";
    try {
      const projectResult = await executeGql(`{ project(id: "${projectId}") { id name } }`);
      if (projectResult.ok) {
        const projectPayload = await projectResult.json();
        projectName = projectPayload.data?.project?.name || projectName;
      }
    } catch {
      // ignore project name fetch failure
    }

    const usageResult = await executeGql(`{
      usage(
        projectId: "${projectId}",
        measurements: [CPU_USAGE, MEMORY_USAGE_GB, NETWORK_TX_GB, NETWORK_RX_GB],
        startDate: "${startDate}",
        endDate: "${endDate}"
      ) { measurement value }
    }`);

    if (!usageResult.ok) {
      return response.status(200).json({
        configured: true,
        projectName,
        projectId,
        billingPeriod: { start: startDate, end: endDate },
        cpuVcpuMin: 0,
        memGbMin: 0,
        cpuVcpuSec: 0,
        memGbSec: 0,
        networkTxGb: 0,
        networkRxGb: 0,
        cpuDollars: 0,
        memoryDollars: 0,
        networkDollars: 0,
        totalEstimatedDollars: 0,
        invoiceDollars: null,
        error: `Railway API returned ${usageResult.status}: ${await usageResult.text().catch(() => "Unknown error")}`,
        timestamp: new Date().toISOString(),
      });
    }

    const usagePayload = await usageResult.json();
    if (usagePayload.errors?.length) {
      return response.status(200).json({
        configured: true,
        projectName,
        projectId,
        billingPeriod: { start: startDate, end: endDate },
        cpuVcpuMin: 0,
        memGbMin: 0,
        cpuVcpuSec: 0,
        memGbSec: 0,
        networkTxGb: 0,
        networkRxGb: 0,
        cpuDollars: 0,
        memoryDollars: 0,
        networkDollars: 0,
        totalEstimatedDollars: 0,
        invoiceDollars: null,
        error: usagePayload.errors[0]?.message || "Railway GraphQL error",
        timestamp: new Date().toISOString(),
      });
    }

    const usageItems: { measurement: string; value: number }[] = usagePayload.data?.usage || [];
    let cpuVcpuMin = 0;
    let memGbMin = 0;
    let networkTxGb = 0;
    let networkRxGb = 0;
    for (const item of usageItems) {
      const value = Number(item.value) || 0;
      if (item.measurement === "CPU_USAGE") cpuVcpuMin = value;
      if (item.measurement === "MEMORY_USAGE_GB") memGbMin = value;
      if (item.measurement === "NETWORK_TX_GB") networkTxGb = value;
      if (item.measurement === "NETWORK_RX_GB") networkRxGb = value;
    }

    const cpuVcpuSec = cpuVcpuMin * 60;
    const memGbSec = memGbMin * 60;
    const cpuDollars = cpuVcpuSec * RATE_CPU_PER_VCPU_SEC;
    const memoryDollars = memGbSec * RATE_MEM_PER_GB_SEC;
    const networkDollars = networkTxGb * RATE_NETWORK_TX_PER_GB;

    return response.json({
      configured: true,
      projectName,
      projectId,
      billingPeriod: { start: startDate, end: endDate },
      cpuVcpuMin,
      memGbMin,
      cpuVcpuSec,
      memGbSec,
      networkTxGb,
      networkRxGb,
      cpuDollars,
      memoryDollars,
      networkDollars,
      totalEstimatedDollars: cpuDollars + memoryDollars + networkDollars,
      invoiceDollars: null,
      rates: {
        cpuPerVcpuSec: RATE_CPU_PER_VCPU_SEC,
        memPerGbSec: RATE_MEM_PER_GB_SEC,
        networkTxPerGb: RATE_NETWORK_TX_PER_GB,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return response.status(200).json({
      configured: false,
      projectName: "EveBash",
      projectId: null,
      billingPeriod: { start: startDate, end: endDate },
      cpuVcpuMin: 0,
      memGbMin: 0,
      cpuVcpuSec: 0,
      memGbSec: 0,
      networkTxGb: 0,
      networkRxGb: 0,
      cpuDollars: 0,
      memoryDollars: 0,
      networkDollars: 0,
      totalEstimatedDollars: 0,
      invoiceDollars: null,
      error: error instanceof Error ? error.message : "Failed to fetch Railway billing data.",
      timestamp: new Date().toISOString(),
    });
  }
});

infrastructureRouter.get("/qstash-usage", async (request, response) => {
  if (!(await authorize(request, response))) return;

  const startDate = typeof request.query.startDate === "string" ? request.query.startDate : undefined;
  const endDate = typeof request.query.endDate === "string" ? request.query.endDate : undefined;
  const qstashToken = process.env.QSTASH_TOKEN?.trim();
  const queueName = (process.env.QSTASH_QUEUE_NAME || "EveBash").trim();

  try {
    const supabase = getSupabaseAdminClient();

    // Query media items uploaded in timeframe
    let photoQuery = supabase.from("photos").select("id, resource_type, media_type", { count: "exact" });
    if (startDate && !isNaN(new Date(startDate).getTime())) {
      photoQuery = photoQuery.gte("created_at", new Date(startDate).toISOString());
    }
    if (endDate && !isNaN(new Date(endDate).getTime())) {
      photoQuery = photoQuery.lte("created_at", new Date(endDate).toISOString());
    }
    const { count: photoCount } = await photoQuery;

    // Query modal cost logs for batch/video dispatches
    let modalQuery = supabase.from("modal_cost_logs").select("id, function_name", { count: "exact" });
    if (startDate && !isNaN(new Date(startDate).getTime())) {
      modalQuery = modalQuery.gte("created_at", new Date(startDate).toISOString());
    }
    if (endDate && !isNaN(new Date(endDate).getTime())) {
      modalQuery = modalQuery.lte("created_at", new Date(endDate).toISOString());
    }
    const { count: modalCount } = await modalQuery;

    // Upstash QStash message calculation for EveBash:
    // - Each photo triggers chunk completion, thumbnail task, and batch queue dispatch (~1.5 msgs)
    // - Modal batch/video executions correlate to ~0.2 orchestration messages
    const actualMediaCount = photoCount || 0;
    const actualModalLogs = modalCount || 0;
    const totalDispatchedMessages = Math.round(actualMediaCount * 1.5 + actualModalLogs * 0.2);

    // Free Tier: 500 messages/day = 15,000 messages/month
    const freeTierMonthlyAllowance = 15000;
    const billableOverageMessages = Math.max(0, totalDispatchedMessages - freeTierMonthlyAllowance);

    // Pricing: $1.00 per 100,000 messages ($0.00001 / msg), ₹100 per 100,000 messages
    const ratePer100kUsd = 1.00;
    const ratePer100kInr = 100.00;
    const estimatedCostUsd = (billableOverageMessages / 100000) * ratePer100kUsd;
    const estimatedCostInr = (billableOverageMessages / 100000) * ratePer100kInr;

    return response.json({
      configured: Boolean(qstashToken),
      tokenConfigured: Boolean(qstashToken),
      queueName,
      totalDispatchedMessages,
      freeTierMonthlyAllowance,
      billableOverageMessages,
      ratePer100kUsd,
      ratePer100kInr,
      estimatedCostUsd,
      estimatedCostInr,
      mediaCount: actualMediaCount,
      modalLogsCount: actualModalLogs,
      billingPeriod: { start: startDate || null, end: endDate || null },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch QStash usage.",
    });
  }
});

infrastructureRouter.get("/razorpay-billing", async (request, response) => {
  if (!(await authorize(request, response))) return;

  const startDate = typeof request.query.startDate === "string" ? request.query.startDate : undefined;
  const endDate = typeof request.query.endDate === "string" ? request.query.endDate : undefined;
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();

  try {
    const supabase = getSupabaseAdminClient();

    let paymentsQuery = supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (startDate && !isNaN(new Date(startDate).getTime())) {
      paymentsQuery = paymentsQuery.gte("created_at", new Date(startDate).toISOString());
    }
    if (endDate && !isNaN(new Date(endDate).getTime())) {
      paymentsQuery = paymentsQuery.lte("created_at", new Date(endDate).toISOString());
    }

    const { data: payments, error } = await paymentsQuery;
    if (error) {
      throw error;
    }

    const allPayments = payments || [];
    const validPayments = allPayments.filter(
      p => p.status === "captured" || p.status === "manual_offline"
    );
    const onlineCaptured = validPayments.filter(
      p => p.payment_gateway === "razorpay" && p.status === "captured"
    );
    const offlinePayments = validPayments.filter(
      p => p.payment_gateway !== "razorpay" || p.status === "manual_offline"
    );
    const failedPayments = allPayments.filter(p => p.status === "failed");

    const grossOnlineVolumeInr = onlineCaptured.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );
    const grossOfflineVolumeInr = offlinePayments.reduce(
      (sum, p) => sum + (Number(p.amount) || 0),
      0
    );
    const totalGrossVolumeInr = grossOnlineVolumeInr + grossOfflineVolumeInr;

    // Standard Indian Gateway Pricing: 2.0% platform fee + 18% GST on fee = 2.36% effective
    const baseFeePercent = 2.0;
    const gstPercent = 18.0;
    const effectiveFeePercent = 2.36;

    const baseFeeInr = grossOnlineVolumeInr * 0.02;
    const gstFeeInr = baseFeeInr * 0.18;
    const totalFeeInr = grossOnlineVolumeInr * 0.0236;
    const netPayoutInr = grossOnlineVolumeInr - totalFeeInr;

    return response.json({
      configured: Boolean(keyId),
      keyIdMasked: keyId ? `${keyId.slice(0, 8)}...` : null,
      totalPaymentsCount: allPayments.length,
      onlineCapturedCount: onlineCaptured.length,
      offlinePaymentsCount: offlinePayments.length,
      failedPaymentsCount: failedPayments.length,
      grossOnlineVolumeInr,
      grossOfflineVolumeInr,
      totalGrossVolumeInr,
      baseFeePercent,
      gstPercent,
      effectiveFeePercent,
      baseFeeInr,
      gstFeeInr,
      totalFeeInr,
      netPayoutInr,
      billingPeriod: { start: startDate || null, end: endDate || null },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch Razorpay billing.",
    });
  }
});


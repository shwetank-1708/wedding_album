import type { Request, Response } from "express";
import { Router } from "express";
import { adminAuthStatus, verifySuperAdmin } from "../adminAuth.js";
import { getCachedBackblazeAuth } from "../backblaze.js";

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
  const verification = await verifySuperAdmin(request);
  if ("error" in verification) {
    response.status(adminAuthStatus(verification.error)).json({
      success: false,
      error: verification.error,
    });
    return false;
  }
  return true;
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

    const headers = {
      Authorization: `Bearer ${managementKey}`,
      "Content-Type": "application/json",
    };
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

    const organizationResult = await fetch(
      `https://api.supabase.com/v1/organizations/${organizationId}`,
      { headers },
    );
    if (!organizationResult.ok) {
      return response.status(organizationResult.status).json({
        error: `Supabase Organization API returned status ${organizationResult.status}: ${await organizationResult.text()}`,
      });
    }

    const organization = await organizationResult.json();
    const plan = String(organization.plan || "free").toLowerCase();
    return response.json({
      billing_tier: {
        id: plan,
        name: plan === "free" ? "Free" : plan === "pro" ? "Pro" : plan.toUpperCase(),
        price: plan === "pro" ? 25 : 0,
        currency: "usd",
        interval: "monthly",
      },
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

  try {
    const apiToken = requireEnv("RAILWAY_API_TOKEN");
    const projectId = requireEnv("RAILWAY_PROJECT_ID");
    const now = new Date();
    const startDate = String(request.query.startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString());
    const endDate = String(request.query.endDate || now.toISOString());
    const headers = {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    };

    let projectName = "EveBash";
    const projectResult = await fetch(RAILWAY_GQL, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: `{ project(id: "${projectId}") { id name } }` }),
    });
    if (projectResult.ok) {
      const projectPayload = await projectResult.json();
      projectName = projectPayload.data?.project?.name || projectName;
    }

    const usageResult = await fetch(RAILWAY_GQL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: `{
          usage(
            projectId: "${projectId}",
            measurements: [CPU_USAGE, MEMORY_USAGE_GB, NETWORK_TX_GB, NETWORK_RX_GB],
            startDate: "${startDate}",
            endDate: "${endDate}"
          ) { measurement value }
        }`,
      }),
    });
    if (!usageResult.ok) {
      return response.status(502).json({
        error: `Railway API returned ${usageResult.status}: ${await usageResult.text()}`,
      });
    }

    const usagePayload = await usageResult.json();
    if (usagePayload.errors?.length) {
      return response.status(502).json({ error: usagePayload.errors[0]?.message || "Railway GraphQL error" });
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
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return response.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch Railway billing data.",
    });
  }
});

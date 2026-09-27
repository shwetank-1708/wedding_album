import { NextResponse } from "next/server";
import { defaultPricingPlans } from "@/lib/pricingPlans";

export const runtime = "nodejs";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function getBackendApiUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function GET() {
  const apiBaseUrl = getBackendApiUrl();
  if (!apiBaseUrl) {
    return NextResponse.json(
      {
        plans: defaultPricingPlans,
        source: "default",
        error: "Backend API URL is not configured.",
      },
      { headers: corsHeaders() },
    );
  }

  try {
    const backendResponse = await fetch(`${apiBaseUrl}/api/v1/pricing-plans`, {
      method: "GET",
      cache: "no-store",
    });
    const payload = await backendResponse.json().catch(() => null);

    if (!backendResponse.ok || !payload || !Array.isArray(payload.plans)) {
      return NextResponse.json(
        {
          plans: defaultPricingPlans,
          source: "default",
          error: `Backend pricing request failed with status ${backendResponse.status}.`,
        },
        { headers: corsHeaders() },
      );
    }

    return NextResponse.json(payload, {
      headers: corsHeaders(),
    });
  } catch (error) {
    console.error("[PricingPlansProxy] Backend request failed:", error);
    return NextResponse.json(
      {
        plans: defaultPricingPlans,
        source: "default",
        error: "Unable to reach backend API.",
      },
      { headers: corsHeaders() },
    );
  }
}

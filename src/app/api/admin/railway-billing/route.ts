import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

function getBackendApiUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: NextRequest) {
  const apiBaseUrl = getBackendApiUrl();
  if (!apiBaseUrl) {
    return jsonResponse({ error: "Backend API URL is not configured." }, 503);
  }

  try {
    const searchParams = request.nextUrl.search;
    const backendResponse = await fetch(`${apiBaseUrl}/api/admin/railway-billing${searchParams}`, {
      method: "GET",
      headers: {
        "Authorization": request.headers.get("authorization") || "",
        "User-Agent": request.headers.get("user-agent") || "",
        "X-Forwarded-For": request.headers.get("x-forwarded-for") || "",
      },
      cache: "no-store",
    });

    const payload = await backendResponse.json().catch(() => ({
      error: "Unexpected backend response.",
    }));

    return jsonResponse(payload, backendResponse.status);
  } catch (error) {
    console.error("[RailwayBillingProxy] Backend request failed:", error);
    return jsonResponse({ error: "Unable to reach backend API." }, 502);
  }
}

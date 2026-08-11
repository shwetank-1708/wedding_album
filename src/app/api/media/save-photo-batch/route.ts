import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

export async function POST(request: NextRequest) {
  const apiBaseUrl = getBackendApiUrl();
  if (!apiBaseUrl) {
    return jsonResponse({ error: "Backend API URL is not configured." }, 503);
  }

  try {
    const backendResponse = await fetch(`${apiBaseUrl}/api/v1/media/save-photo-batch`, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
        "Authorization": request.headers.get("authorization") || "",
        "User-Agent": request.headers.get("user-agent") || "",
        "X-Forwarded-For": request.headers.get("x-forwarded-for") || "",
      },
      body: await request.text(),
      cache: "no-store",
    });

    const payload = await backendResponse.json().catch(() => ({
      error: "Unexpected backend response.",
    }));

    return jsonResponse(payload, backendResponse.status);
  } catch (error) {
    console.error("[SavePhotoBatchProxy] Backend request failed:", error);
    return jsonResponse({ error: "Unable to reach backend API." }, 502);
  }
}


import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function getBackendApiUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
}

export async function POST(request: NextRequest) {
  const apiBaseUrl = getBackendApiUrl();
  if (!apiBaseUrl) {
    return NextResponse.json({ error: "Backend API URL is not configured." }, { status: 503 });
  }

  try {
    const backendResponse = await fetch(`${apiBaseUrl}/api/v1/subscriptions/apply-pending`, {
      method: "POST",
      headers: {
        Authorization: request.headers.get("authorization") || "",
      },
      cache: "no-store",
    });

    const payload = await backendResponse.json().catch(() => ({
      error: "Unexpected backend response.",
    }));

    return NextResponse.json(payload, { status: backendResponse.status });
  } catch (error) {
    console.error("[SubscriptionApplyPendingProxy] Backend request failed:", error);
    return NextResponse.json({ error: "Unable to reach backend API." }, { status: 502 });
  }
}

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getBackendApiUrl() {
  return (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
}

export async function GET(request: NextRequest) {
  const apiBaseUrl = getBackendApiUrl();
  if (!apiBaseUrl) {
    return NextResponse.json({ error: "Backend API URL is not configured." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId") || "";

  try {
    const backendResponse = await fetch(
      `${apiBaseUrl}/api/v1/media/indexing-status?${new URLSearchParams({ eventId }).toString()}`,
      { cache: "no-store" },
    );
    const payload = await backendResponse.json().catch(() => ({
      error: "Unexpected backend response.",
    }));

    return NextResponse.json(payload, { status: backendResponse.status });
  } catch (error) {
    console.error("[MediaIndexingStatusProxy] Backend request failed:", error);
    return NextResponse.json({ error: "Unable to reach backend API." }, { status: 502 });
  }
}

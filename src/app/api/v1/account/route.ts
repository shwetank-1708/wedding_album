import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status });
}

export async function DELETE(request: NextRequest) {
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "").trim().replace(/\/+$/, "");
  if (!apiBaseUrl) {
    return jsonResponse({ success: false, error: "Backend API URL is not configured." }, 503);
  }

  try {
    const backendResponse = await fetch(`${apiBaseUrl}/api/v1/account`, {
      method: "DELETE",
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
        Authorization: request.headers.get("authorization") || "",
        "User-Agent": request.headers.get("user-agent") || "",
      },
      body: await request.text(),
      cache: "no-store",
    });
    const payload = await backendResponse.json().catch(() => ({
      success: false,
      error: "Unexpected backend response.",
    }));
    return jsonResponse(payload, backendResponse.status);
  } catch (error) {
    console.error("[AccountProxy] Backend request failed:", error);
    return jsonResponse({ success: false, error: "Unable to reach backend API." }, 502);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCachedBackblazeAuth, getUploadPartUrl } from "@/lib/backblaze";

export const runtime = "nodejs";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const fileId = String(body.fileId || "");

    if (!fileId.trim()) {
      return jsonResponse({ error: "Missing fileId" }, 400);
    }

    const backblazeAuth = await getCachedBackblazeAuth();
    const partUrlData = await getUploadPartUrl(backblazeAuth, fileId);

    return jsonResponse({
      uploadUrl: partUrlData.uploadUrl,
      authorizationToken: partUrlData.authorizationToken,
    });
  } catch (error: unknown) {
    console.error("[GetUploadPartUrl] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Failed to get upload part URL" }, 500);
  }
}

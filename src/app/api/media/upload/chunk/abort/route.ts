import { NextRequest, NextResponse } from "next/server";
import { getCachedBackblazeAuth, cancelLargeFile } from "@/lib/backblaze";

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

    console.log(`[AbortChunkedUpload] Cancelling B2 large file for id ${fileId}...`);
    const backblazeAuth = await getCachedBackblazeAuth();
    await cancelLargeFile(backblazeAuth, fileId);

    return jsonResponse({ success: true });
  } catch (error: unknown) {
    console.error("[AbortChunkedUpload] Error:", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Failed to cancel large file" }, 500);
  }
}

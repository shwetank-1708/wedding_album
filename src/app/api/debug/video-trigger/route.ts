import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, { status });
}

export async function GET(request: NextRequest) {
  const results: Record<string, unknown> = {};

  // 1. Check env vars
  results.env = {
    QSTASH_TOKEN: process.env.QSTASH_TOKEN ? `SET (${process.env.QSTASH_TOKEN.slice(0, 8)}...)` : "NOT SET",
    MEDIA_DOMAIN: process.env.MEDIA_DOMAIN || "NOT SET",
    CLOUDFLARE_DOMAIN: process.env.CLOUDFLARE_DOMAIN || "NOT SET",
  };

  const qstashToken = process.env.QSTASH_TOKEN;
  const modalLargeUrl = "https://shwetank-sarthak--wedding-media-engine-process-video-tra-1aa355.modal.run";
  const qstashPublishUrl = `https://qstash-us-east-1.upstash.io/v2/publish/${modalLargeUrl}`;

  // 2. Test direct Modal connectivity (GET to Modal endpoint)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const modalRes = await fetch(modalLargeUrl, {
      method: "GET",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    results.modal_connectivity = {
      reachable: true,
      status: modalRes.status,
      statusText: modalRes.statusText,
    };
  } catch (err: any) {
    results.modal_connectivity = {
      reachable: false,
      error: err?.message || String(err),
      type: err?.name,
    };
  }

  // 3. Test QStash connectivity (HEAD to qstash endpoint)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const qstashRes = await fetch("https://qstash-us-east-1.upstash.io", {
      method: "GET",
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    results.qstash_connectivity = {
      reachable: true,
      status: qstashRes.status,
      statusText: qstashRes.statusText,
    };
  } catch (err: any) {
    results.qstash_connectivity = {
      reachable: false,
      error: err?.message || String(err),
      type: err?.name,
    };
  }

  // 4. If QSTASH_TOKEN exists, try publishing a test message to QStash
  if (qstashToken) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const publishRes = await fetch(qstashPublishUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${qstashToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ test: true, photo_id: "debug-test", storage_key: "test/key", event_id: "test-event" }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const publishBody = await publishRes.text().catch(() => "");
      results.qstash_publish_test = {
        status: publishRes.status,
        ok: publishRes.ok,
        body: publishBody.slice(0, 500),
      };
    } catch (err: any) {
      results.qstash_publish_test = {
        error: err?.message || String(err),
        type: err?.name,
      };
    }
  } else {
    // Try direct modal POST
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const modalPostRes = await fetch(modalLargeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo_id: "debug-test", storage_key: "test/key", event_id: "test-event" }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const body = await modalPostRes.text().catch(() => "");
      results.direct_modal_post_test = {
        status: modalPostRes.status,
        ok: modalPostRes.ok,
        body: body.slice(0, 500),
      };
    } catch (err: any) {
      results.direct_modal_post_test = {
        error: err?.message || String(err),
        type: err?.name,
      };
    }
  }

  return jsonResponse(results);
}

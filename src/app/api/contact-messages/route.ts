import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type ContactMessageBody = {
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  message?: unknown;
  source?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function cleanText(value: unknown, maxLength: number) {
  return String(value || "").trim().slice(0, maxLength);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: NextRequest) {
  let body: ContactMessageBody;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid request body." }, 400);
  }

  const firstName = cleanText(body.firstName, 80);
  const lastName = cleanText(body.lastName, 80);
  const email = cleanText(body.email, 160).toLowerCase();
  const message = cleanText(body.message, 4000);
  const source = body.source === "mobile" ? "mobile" : "web";

  if (!firstName || !lastName || !email || !message) {
    return jsonResponse({ success: false, error: "Please fill in all fields." }, 400);
  }

  if (!isValidEmail(email)) {
    return jsonResponse({ success: false, error: "Please enter a valid email address." }, 400);
  }

  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return jsonResponse({ success: false, error: "Contact message storage is not configured." }, 500);
  }

  const { error } = await supabaseAdmin.from("contact_messages").insert({
    first_name: firstName,
    last_name: lastName,
    email,
    message,
    source,
    user_agent: request.headers.get("user-agent") || "",
  });

  if (error) {
    console.error("[ContactMessages] Insert failed:", error);
    return jsonResponse({ success: false, error: "Unable to send message right now." }, 500);
  }

  return jsonResponse({ success: true });
}

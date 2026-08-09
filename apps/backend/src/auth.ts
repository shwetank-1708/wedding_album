import type { Request } from "express";
import { timingSafeEqual } from "node:crypto";
import { getSupabaseAdminClient } from "./supabase.js";

export function getBearerToken(request: Request) {
  const authorization = request.get("authorization") || "";
  return authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
}

export function getInternalJobSecret() {
  return (
    process.env.INTERNAL_JOB_SECRET ||
    process.env.CRON_SECRET ||
    process.env.QSTASH_TOKEN ||
    ""
  ).trim();
}

export function verifyInternalJob(request: Request) {
  const expected = getInternalJobSecret();
  const received = getBearerToken(request);
  if (!expected || !received) return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export async function verifySupabaseUser(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;

  const supabaseAdmin = getSupabaseAdminClient();
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) return null;
  return { user, supabaseAdmin };
}

import type { Request } from "express";
import { createClient } from "@supabase/supabase-js";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export function getAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export async function verifySuperAdmin(request: Request) {
  const authHeader = request.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    return { error: "Missing authorization token" } as const;
  }

  const supabaseAdmin = getAdminClient();
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData.user) {
    return { error: "Invalid authorization token" } as const;
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, delegated_by")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { error: "Admin profile was not found" } as const;
  }

  if (profile.role !== "admin" || profile.delegated_by) {
    return { error: "Only global super admins can use this endpoint" } as const;
  }

  return { supabaseAdmin, user: userData.user, profile };
}

export function adminAuthStatus(error?: string) {
  return error === "Invalid authorization token" || error === "Missing authorization token"
    ? 401
    : 403;
}

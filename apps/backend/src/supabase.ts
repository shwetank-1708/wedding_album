import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseServiceRoleKey, supabaseUrl } from "./config.js";

export function getSupabasePublicClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabaseAdminClient() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error("Supabase admin environment variables are not configured");
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

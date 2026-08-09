import { Router } from "express";
import { verifySupabaseUser } from "../auth.js";
import { getBearerToken } from "../auth.js";
import { getSupabaseAdminClient } from "../supabase.js";

export const subscriptionRouter = Router();

type PendingProfile = {
  id?: string;
  pending_plan_role?: string | null;
  pending_subscription_duration?: string | null;
  pending_plan_start_date?: string | null;
  pending_plan_end_date?: string | null;
};

function isTodayOrPast(value?: string | null) {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today;
}

function pendingPlanUpdate(profile: PendingProfile) {
  return {
    role: profile.pending_plan_role,
    role_type: "primary",
    subscription_duration: profile.pending_subscription_duration,
    plan_start_date: profile.pending_plan_start_date,
    plan_end_date: profile.pending_plan_end_date,
    pending_plan_role: null,
    pending_subscription_duration: null,
    pending_plan_start_date: null,
    pending_plan_end_date: null,
  };
}

subscriptionRouter.post("/apply-pending", async (request, response) => {
  try {
    const verification = await verifySupabaseUser(request);
    if (!verification) {
      response.status(401).json({ error: "Your session could not be verified." });
      return;
    }

    const { user, supabaseAdmin } = verification;
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("pending_plan_role, pending_subscription_duration, pending_plan_start_date, pending_plan_end_date")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    if (!profile?.pending_plan_role || !isTodayOrPast(profile.pending_plan_start_date)) {
      response.json({ success: true, applied: false });
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(pendingPlanUpdate(profile))
      .eq("id", user.id);

    if (updateError) throw updateError;
    response.json({ success: true, applied: true });
  } catch (error) {
    console.error("[BackendSubscription] Pending-plan activation failed:", error);
    response.status(500).json({ error: error instanceof Error ? error.message : "Unable to activate pending plan." });
  }
});

subscriptionRouter.post("/apply-due", async (request, response) => {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    response.status(503).json({ error: "CRON_SECRET is not configured." });
    return;
  }
  if (getBearerToken(request) !== cronSecret) {
    response.status(401).json({ error: "Invalid cron authorization." });
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, pending_plan_role, pending_subscription_duration, pending_plan_start_date, pending_plan_end_date")
      .not("pending_plan_role", "is", null)
      .lte("pending_plan_start_date", today);

    if (error) throw error;

    const failures: Array<{ id: string; error: string }> = [];
    let applied = 0;
    for (const profile of (profiles || []) as PendingProfile[]) {
      if (!profile.id || !profile.pending_plan_role || !isTodayOrPast(profile.pending_plan_start_date)) continue;
      const { error: updateError } = await supabaseAdmin
        .from("profiles")
        .update(pendingPlanUpdate(profile))
        .eq("id", profile.id);

      if (updateError) {
        failures.push({ id: profile.id, error: updateError.message });
      } else {
        applied += 1;
      }
    }

    response.status(failures.length > 0 ? 207 : 200).json({
      success: failures.length === 0,
      checked: profiles?.length || 0,
      applied,
      failures,
    });
  } catch (error) {
    console.error("[BackendSubscriptionCron] Due-plan activation failed:", error);
    response.status(500).json({ error: error instanceof Error ? error.message : "Unable to apply due plans." });
  }
});

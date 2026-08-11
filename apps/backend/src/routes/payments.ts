import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import Razorpay from "razorpay";
import { verifySupabaseUser } from "../auth.js";
import { getSupabaseAdminClient } from "../supabase.js";

export const paymentsRouter = Router();

export type RazorpayBillingDuration = "monthly" | "threeMonths" | "sixMonths" | "yearly";

const DURATION_TO_MONTHS: Record<RazorpayBillingDuration, number> = {
  monthly: 1,
  threeMonths: 3,
  sixMonths: 6,
  yearly: 12,
};

const DURATION_TO_PROFILE_VALUE: Record<RazorpayBillingDuration, string> = {
  monthly: "monthly",
  threeMonths: "quarterly",
  sixMonths: "half_yearly",
  yearly: "yearly",
};

const GB = 1024 * 1024 * 1024;

function getPlanStorageBytes(role?: string): number {
  switch (role?.toLowerCase()) {
    case "admin":
      return Infinity;
    case "ultimate":
      return 1024 * GB;
    case "elite":
      return 500 * GB;
    case "pro":
      return 200 * GB;
    case "premium":
      return 100 * GB;
    case "standard":
      return 50 * GB;
    case "basic":
      return 25 * GB;
    case "starter":
      return 10 * GB;
    case "free":
    case "freemium":
    default:
      return 1 * GB;
  }
}

type PricingPlanPaymentRow = {
  id: string;
  name: string;
  monthly_price: number | string;
  three_month_price: number | string;
  six_month_price: number | string;
  discounted_yearly_price: number | string;
  active: boolean;
};

function normalizeBillingDuration(value: unknown): RazorpayBillingDuration | null {
  if (value === "monthly" || value === "threeMonths" || value === "sixMonths" || value === "yearly") {
    return value;
  }
  return null;
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapPaymentPlan(row: PricingPlanPaymentRow) {
  return {
    id: row.id,
    name: row.name,
    monthlyPrice: toNumber(row.monthly_price),
    threeMonthPrice: toNumber(row.three_month_price),
    sixMonthPrice: toNumber(row.six_month_price),
    discountedYearlyPrice: toNumber(row.discounted_yearly_price),
    active: Boolean(row.active),
  };
}

function getPricingPlanAmount(
  plan: ReturnType<typeof mapPaymentPlan>,
  duration: RazorpayBillingDuration,
): number {
  if (duration === "monthly") return plan.monthlyPrice;
  if (duration === "threeMonths") return plan.threeMonthPrice;
  if (duration === "sixMonths") return plan.sixMonthPrice;
  return plan.discountedYearlyPrice;
}

function getBillingDurationLabel(duration: RazorpayBillingDuration): string {
  if (duration === "monthly") return "Monthly";
  if (duration === "threeMonths") return "3 Months";
  if (duration === "sixMonths") return "6 Months";
  return "Yearly";
}

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number): Date {
  const nextDate = new Date(date);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function parseDateOnly(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isCurrentPlanActive(planEndDate?: string | null): boolean {
  const endDate = parseDateOnly(planEndDate);
  if (!endDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return endDate >= today;
}

// POST /api/v1/payments/create-order or /api/create-order
paymentsRouter.post("/create-order", async (request: Request, response: Response) => {
  const credentials = getRazorpayCredentials();
  if (!credentials) {
    response.status(500).json({ error: "Razorpay credentials are not configured." });
    return;
  }

  const { planId: rawPlanId, duration: rawDuration } = request.body || {};
  const planId = typeof rawPlanId === "string" ? rawPlanId.trim() : "";
  const duration = normalizeBillingDuration(rawDuration);

  if (!planId || !duration) {
    response.status(400).json({ error: "Plan and billing duration are required." });
    return;
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data, error } = await supabaseAdmin
    .from("pricing_plans")
    .select("id, name, monthly_price, three_month_price, six_month_price, discounted_yearly_price, active")
    .eq("id", planId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    response.status(500).json({ error: error.message || "Unable to load pricing plan." });
    return;
  }

  if (!data) {
    response.status(404).json({ error: "Selected pricing plan is not available." });
    return;
  }

  const plan = mapPaymentPlan(data as PricingPlanPaymentRow);
  const amountInRupees = getPricingPlanAmount(plan, duration);
  const amountInPaise = Math.round(amountInRupees * 100);

  if (amountInPaise < 100) {
    response.status(400).json({ error: "Paid checkout requires an amount of at least ₹1." });
    return;
  }

  try {
    const razorpay = new Razorpay({
      key_id: credentials.keyId,
      key_secret: credentials.keySecret,
    });

    const receipt = `rcpt_${plan.id.slice(0, 10)}_${Date.now().toString(36)}`;
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      notes: {
        planId: plan.id,
        planName: plan.name,
        duration,
        durationLabel: getBillingDurationLabel(duration),
      },
    });

    response.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: credentials.keyId,
      plan_id: plan.id,
      plan_name: plan.name,
      duration,
    });
  } catch (error) {
    request.log.error({ error }, "[Payments] Create order failed");
    const candidate = error as { statusCode?: number; message?: string; error?: { description?: string } };
    const status = candidate.statusCode || 500;
    const message = candidate.error?.description || candidate.message || "Unable to create Razorpay order.";
    response.status(status === 401 ? 401 : 500).json({ error: message });
  }
});

// POST /api/v1/payments/verify-payment or /api/verify-payment
paymentsRouter.post("/verify-payment", async (request: Request, response: Response) => {
  const credentials = getRazorpayCredentials();
  if (!credentials) {
    response.status(500).json({ error: "Razorpay credentials are not configured." });
    return;
  }

  const verification = await verifySupabaseUser(request);
  if (!verification) {
    response.status(401).json({ error: "You must be signed in to activate a plan." });
    return;
  }

  const { user, supabaseAdmin } = verification;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId: rawPlanId, duration: rawDuration } = request.body || {};

  const orderId = typeof razorpay_order_id === "string" ? razorpay_order_id : "";
  const paymentId = typeof razorpay_payment_id === "string" ? razorpay_payment_id : "";
  const signature = typeof razorpay_signature === "string" ? razorpay_signature : "";
  const requestedPlanId = typeof rawPlanId === "string" ? rawPlanId.trim() : "";
  const requestedDuration = normalizeBillingDuration(rawDuration);

  if (!orderId || !paymentId || !signature) {
    response.status(400).json({ error: "Payment id, order id, and signature are required." });
    return;
  }

  const generatedSignature = crypto
    .createHmac("sha256", credentials.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  if (!safeCompare(generatedSignature, signature)) {
    response.status(400).json({ success: false, error: "Invalid payment signature." });
    return;
  }

  try {
    const razorpay = new Razorpay({
      key_id: credentials.keyId,
      key_secret: credentials.keySecret,
    });

    const order = await razorpay.orders.fetch(orderId);
    const notes = (order.notes || {}) as Record<string, unknown>;
    const planId = typeof notes.planId === "string" ? notes.planId : requestedPlanId;
    const duration = normalizeBillingDuration(notes.duration || requestedDuration);

    if (!planId || !duration) {
      response.status(400).json({ error: "Payment order does not include plan details." });
      return;
    }

    if (requestedPlanId && requestedPlanId !== planId) {
      response.status(400).json({ error: "Payment plan mismatch." });
      return;
    }

    if (requestedDuration && requestedDuration !== duration) {
      response.status(400).json({ error: "Payment duration mismatch." });
      return;
    }

    const today = new Date();
    const planStartDate = toDateOnly(today);
    const planEndDate = toDateOnly(addMonths(today, DURATION_TO_MONTHS[duration]));
    const subscriptionDuration = DURATION_TO_PROFILE_VALUE[duration];

    const { data: currentProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, subscription_duration, plan_start_date, plan_end_date")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      response.status(500).json({ error: profileError.message || "Could not load your current plan." });
      return;
    }

    const currentRole = typeof currentProfile?.role === "string" && currentProfile.role ? currentProfile.role : "free";
    const currentStorage = getPlanStorageBytes(currentRole);
    const newStorage = getPlanStorageBytes(planId);

    const isDowngrade =
      currentRole.toLowerCase() !== "admin" &&
      isCurrentPlanActive(currentProfile?.plan_end_date) &&
      newStorage < currentStorage;

    if (isDowngrade) {
      const currentEndDate = parseDateOnly(currentProfile?.plan_end_date) || today;
      const pendingStartDate = addDays(currentEndDate, 1);
      const pendingPlanStartDate = toDateOnly(pendingStartDate);
      const pendingPlanEndDate = toDateOnly(addMonths(pendingStartDate, DURATION_TO_MONTHS[duration]));

      const { error: scheduleError } = await supabaseAdmin
        .from("profiles")
        .update({
          pending_plan_role: planId,
          pending_subscription_duration: subscriptionDuration,
          pending_plan_start_date: pendingPlanStartDate,
          pending_plan_end_date: pendingPlanEndDate,
        })
        .eq("id", user.id);

      if (scheduleError) {
        response.status(500).json({ error: scheduleError.message || "Payment verified, but downgrade scheduling failed." });
        return;
      }

      response.json({
        success: true,
        change_type: "downgrade_scheduled",
        payment_id: paymentId,
        order_id: orderId,
        plan_id: currentRole,
        pending_plan_role: planId,
        pending_subscription_duration: subscriptionDuration,
        pending_plan_start_date: pendingPlanStartDate,
        pending_plan_end_date: pendingPlanEndDate,
      });
      return;
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({
        role: planId,
        role_type: "primary",
        subscription_duration: subscriptionDuration,
        plan_start_date: planStartDate,
        plan_end_date: planEndDate,
        pending_plan_role: null,
        pending_subscription_duration: null,
        pending_plan_start_date: null,
        pending_plan_end_date: null,
      })
      .eq("id", user.id);

    if (updateError) {
      response.status(500).json({ error: updateError.message || "Payment verified, but plan activation failed." });
      return;
    }

    response.json({
      success: true,
      change_type: "immediate",
      payment_id: paymentId,
      order_id: orderId,
      plan_id: planId,
      subscription_duration: subscriptionDuration,
      plan_start_date: planStartDate,
      plan_end_date: planEndDate,
    });
  } catch (error) {
    request.log.error({ error }, "[Payments] Verify payment failed");
    response.status(500).json({ error: error instanceof Error ? error.message : "Unable to verify payment." });
  }
});

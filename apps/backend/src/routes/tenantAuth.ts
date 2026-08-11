import { Router } from "express";
import { getAdminClient } from "../adminAuth.js";

export const tenantAuthRouter = Router();

tenantAuthRouter.post("/check-and-log", async (request, response) => {
  try {
    const { name, phone, slug } = request.body || {};
    if (!phone || !slug) {
      return response.status(400).json({ error: "Missing required fields (phone or slug)" });
    }

    const supabaseAdmin = getAdminClient();

    const { data: allowedData, error: allowedError } = await supabaseAdmin
      .from("allowed_users")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (allowedError) throw allowedError;

    if (allowedData) {
      await supabaseAdmin.from("guests").insert({
        name: name || allowedData.name || "Guest",
        phone,
        event_id: slug,
        event_title: slug,
        status: "approved",
        login_at: new Date().toISOString(),
      });

      return response.json({
        success: true,
        status: "allowed",
        user: {
          name: allowedData.name || name,
          phone,
          role: allowedData.role || "guest",
        },
      });
    }

    return response.json({
      success: false,
      status: "needs_request",
    });
  } catch (error: any) {
    console.error("[BackendTenantAuth] Error in check-and-log:", error);
    return response.status(500).json({ success: false, status: "denied", error: error.message });
  }
});

tenantAuthRouter.post("/request-access", async (request, response) => {
  try {
    const { name, phone } = request.body || {};
    if (!name || !phone) {
      return response.status(400).json({ error: "Missing name or phone" });
    }

    const supabaseAdmin = getAdminClient();
    const { error } = await supabaseAdmin.from("pending_requests").upsert(
      { name, phone, requested_at: new Date().toISOString() },
      { onConflict: "phone" }
    );

    if (error) throw error;
    return response.json({ success: true });
  } catch (error: any) {
    console.error("[BackendTenantAuth] Error in request-access:", error);
    return response.status(500).json({ success: false, error: error.message });
  }
});

tenantAuthRouter.get("/pending-requests", async (_request, response) => {
  try {
    const supabaseAdmin = getAdminClient();
    const { data, error } = await supabaseAdmin
      .from("pending_requests")
      .select("*")
      .order("requested_at", { ascending: false });

    if (error) throw error;
    return response.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error("[BackendTenantAuth] Error in pending-requests:", error);
    return response.status(500).json({ success: false, error: error.message, data: [] });
  }
});

tenantAuthRouter.post("/approve-request", async (request, response) => {
  try {
    const { name, phone } = request.body || {};
    if (!name || !phone) {
      return response.status(400).json({ error: "Missing name or phone" });
    }

    const supabaseAdmin = getAdminClient();

    const { error: insertError } = await supabaseAdmin.from("allowed_users").upsert(
      { name, phone, role: "guest", created_at: new Date().toISOString() },
      { onConflict: "phone" }
    );

    if (insertError) throw insertError;

    const { error: deleteError } = await supabaseAdmin
      .from("pending_requests")
      .delete()
      .eq("phone", phone);

    if (deleteError) throw deleteError;

    return response.json({ success: true });
  } catch (error: any) {
    console.error("[BackendTenantAuth] Error in approve-request:", error);
    return response.status(500).json({ success: false, error: error.message });
  }
});

tenantAuthRouter.post("/deny-request", async (request, response) => {
  try {
    const { phone } = request.body || {};
    if (!phone) {
      return response.status(400).json({ error: "Missing phone" });
    }

    const supabaseAdmin = getAdminClient();
    const { error } = await supabaseAdmin
      .from("pending_requests")
      .delete()
      .eq("phone", phone);

    if (error) throw error;
    return response.json({ success: true });
  } catch (error: any) {
    console.error("[BackendTenantAuth] Error in deny-request:", error);
    return response.status(500).json({ success: false, error: error.message });
  }
});

import { Router } from "express";
import { getAdminClient } from "../adminAuth.js";

export const permissionsRouter = Router();

const SUPER_ADMIN_EMAILS = [
  "shwetank.chauhan17@gmail.com",
  "shwetank.chauhan3@gmail.com",
  "code4sarthak@gmail.com",
];

async function canManageGuestLog(logId: string, requester: { uid?: string; email?: string }) {
  if (!requester.uid && !requester.email) return false;
  if (requester.email && SUPER_ADMIN_EMAILS.includes(requester.email)) {
    return true;
  }

  const supabaseAdmin = getAdminClient();
  const { data: log, error } = await supabaseAdmin
    .from("guests")
    .select("parent_event_owner_id, event_id, parent_event_id")
    .eq("id", logId)
    .maybeSingle();

  if (error || !log) return false;

  let ownerId = log.parent_event_owner_id;
  const linkedEventIds = [log.parent_event_id, log.event_id].filter(Boolean) as string[];

  if (!ownerId && linkedEventIds.length > 0) {
    const { data: ownerEvent } = await supabaseAdmin
      .from("events")
      .select("created_by")
      .in("id", linkedEventIds)
      .limit(1)
      .maybeSingle();

    ownerId = ownerEvent?.created_by;
  }

  if (!ownerId && linkedEventIds.length === 0) return false;
  if (ownerId === requester.uid || ownerId === requester.email) return true;

  if (requester.uid) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role, delegated_by, role_type")
      .eq("id", requester.uid)
      .maybeSingle();

    if (profile) {
      const isGlobalAdmin = profile.role === "admin" && !profile.delegated_by;
      const isDelegatedPrimary = !!ownerId && profile.delegated_by === ownerId && profile.role_type === "primary";
      if (isGlobalAdmin || isDelegatedPrimary) return true;
    }

    if (linkedEventIds.length > 0) {
      const { data: assignedEvents } = await supabaseAdmin
        .from("profile_assigned_events")
        .select("event_id")
        .eq("profile_id", requester.uid)
        .in("event_id", linkedEventIds);

      if ((assignedEvents || []).length > 0) return true;
    }
  }

  return false;
}

permissionsRouter.post("/update-guest-status", async (request, response) => {
  try {
    const { logId, status, requester } = request.body || {};
    if (!logId || !status || !requester) {
      return response.status(400).json({ error: "Missing logId, status, or requester" });
    }

    const allowed = await canManageGuestLog(logId, requester);
    if (!allowed) {
      return response.status(403).json({ success: false, error: "Forbidden: You do not have permission." });
    }

    const supabaseAdmin = getAdminClient();
    const { error } = await supabaseAdmin
      .from("guests")
      .update({ status })
      .eq("id", logId);

    if (error) throw error;
    return response.json({ success: true });
  } catch (error: any) {
    console.error("[BackendPermissions] Error in update-guest-status:", error);
    return response.status(500).json({ success: false, error: error.message });
  }
});

permissionsRouter.post("/delete-guest", async (request, response) => {
  try {
    const { logId, requester } = request.body || {};
    if (!logId || !requester) {
      return response.status(400).json({ error: "Missing logId or requester" });
    }

    const allowed = await canManageGuestLog(logId, requester);
    if (!allowed) {
      return response.status(403).json({ success: false, error: "Forbidden: You do not have permission." });
    }

    const supabaseAdmin = getAdminClient();
    const { error } = await supabaseAdmin
      .from("guests")
      .delete()
      .eq("id", logId);

    if (error) throw error;
    return response.json({ success: true });
  } catch (error: any) {
    console.error("[BackendPermissions] Error in delete-guest:", error);
    return response.status(500).json({ success: false, error: error.message });
  }
});

permissionsRouter.post("/update-guest-permissions", async (request, response) => {
  try {
    const { logId, permissions, requester } = request.body || {};
    if (!logId || !permissions || !requester) {
      return response.status(400).json({ error: "Missing logId, permissions, or requester" });
    }

    const allowed = await canManageGuestLog(logId, requester);
    if (!allowed) {
      return response.status(403).json({ success: false, error: "Forbidden: You do not have permission." });
    }

    const updateData: Record<string, boolean> = {};
    if (typeof permissions.canAdmin === "boolean") updateData.can_admin = permissions.canAdmin;
    if (typeof permissions.canUpload === "boolean") updateData.can_upload = permissions.canUpload;
    if (typeof permissions.canComment === "boolean") updateData.can_comment = permissions.canComment;

    const supabaseAdmin = getAdminClient();
    const { error } = await supabaseAdmin
      .from("guests")
      .update(updateData)
      .eq("id", logId);

    if (error) throw error;
    return response.json({ success: true });
  } catch (error: any) {
    console.error("[BackendPermissions] Error in update-guest-permissions:", error);
    return response.status(500).json({ success: false, error: error.message });
  }
});

import type { Request, Response as ExpressResponse } from "express";
import { Router } from "express";
import { getCachedBackblazeAuth, type BackblazeAuth } from "../backblaze.js";
import { adminAuthStatus, getAdminClient, verifySuperAdmin } from "../adminAuth.js";

export const adminRouter = Router();

class AdminActionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminActionError";
    this.status = status;
  }
}

function jsonResponse(response: ExpressResponse, body: Record<string, unknown>, status = 200) {
  return response.status(status).json(body);
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function isPaidPlanRole(role: string | null | undefined) {
  const cleanRole = String(role || "free").toLowerCase();
  return cleanRole !== "admin" && cleanRole !== "free" && cleanRole !== "user" && cleanRole !== "freemium";
}

function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function normalizeDateOnly(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  return toDateOnly(parsed);
}

function normalizeSubscriptionDuration(value: unknown) {
  const normalized = String(value || "monthly").toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized === "quarterly" || normalized === "3_month" || normalized === "3_months") return "quarterly";
  if (normalized === "half_yearly" || normalized === "6_month" || normalized === "6_months") return "half_yearly";
  if (normalized === "yearly" || normalized === "annual") return "yearly";
  return "monthly";
}

function addDurationToDate(startDate: string, duration: string) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return "";

  const monthsByDuration: Record<string, number> = {
    monthly: 1,
    quarterly: 3,
    half_yearly: 6,
    yearly: 12,
  };

  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + (monthsByDuration[duration] || 1));
  return toDateOnly(end);
}

function toNonNegativeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function toNonNegativeInteger(value: unknown) {
  return Math.round(toNonNegativeNumber(value));
}

function normalizePricingPlan(value: unknown, index: number) {
  const plan = (value || {}) as Record<string, unknown>;
  const id = String(plan.id || "").trim().toLowerCase();
  const name = String(plan.name || "").trim();
  const storageLabel = String(plan.storageLabel || "").trim();

  if (!id) throw new Error("Every pricing plan needs an id");
  if (!name) throw new Error(`Pricing plan ${id} needs a name`);
  if (!storageLabel) throw new Error(`Pricing plan ${id} needs a storage label`);

  const videoLimitMb = plan.videoLimitMb === null || plan.videoLimitMb === undefined || plan.videoLimitMb === ""
    ? null
    : toNonNegativeInteger(plan.videoLimitMb);

  return {
    id,
    name,
    storage_gb: toNonNegativeNumber(plan.storageGb),
    storage_label: storageLabel,
    events: toNonNegativeInteger(plan.events),
    image_upload: Boolean(plan.imageUpload),
    video_upload: Boolean(plan.videoUpload),
    video_limit_mb: videoLimitMb,
    monthly_actual_price: toNonNegativeNumber(plan.monthlyActualPrice ?? plan.monthlyPrice),
    monthly_price: toNonNegativeNumber(plan.monthlyPrice),
    three_month_actual_price: toNonNegativeNumber(plan.threeMonthActualPrice ?? plan.threeMonthPrice),
    three_month_price: toNonNegativeNumber(plan.threeMonthPrice),
    six_month_actual_price: toNonNegativeNumber(plan.sixMonthActualPrice ?? plan.sixMonthPrice),
    six_month_price: toNonNegativeNumber(plan.sixMonthPrice),
    discounted_yearly_price: toNonNegativeNumber(plan.discountedYearlyPrice),
    yearly_price: toNonNegativeNumber(plan.yearlyActualPrice ?? plan.yearlyPrice),
    active: Boolean(plan.active),
    display_order: toNonNegativeInteger(plan.displayOrder ?? index + 1),
    updated_at: new Date().toISOString(),
  };
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(value => String(value || "").trim()).filter(Boolean)));
}

function chunkArray<T>(items: T[], size = 100) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

type B2ListedFile = {
  fileName: string;
  fileId?: string;
  contentLength?: number;
  size?: number;
};

function keyFromMediaUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const parsed = new URL(trimmed);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  } catch {
    return trimmed.replace(/^\/+/, "");
  }
}

function addMediaKeyVariants(target: Set<string>, key: string) {
  const cleanKey = key.trim().replace(/^\/+/, "");
  if (!cleanKey) return;
  target.add(cleanKey);
  target.add(`${cleanKey}-thumbnail.webp`);
  target.add(`${cleanKey}-preview.webp`);
}

function isManagedB2MediaFile(fileName: string) {
  return fileName.startsWith("events/") || fileName.startsWith("profiles/");
}

async function listAllB2Files(auth: BackblazeAuth, bucketId: string) {
  const files: B2ListedFile[] = [];
  let startFileName: string | undefined;

  do {
    const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_names`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId,
        maxFileCount: 10000,
        ...(startFileName ? { startFileName } : {}),
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.message || `Backblaze file listing failed with status ${response.status}`);
    }

    const data = await response.json();
    files.push(...((data.files || []) as B2ListedFile[]));
    startFileName = data.nextFileName || undefined;
  } while (startFileName);

  return files;
}

async function deleteB2FileVersion(auth: BackblazeAuth, file: B2ListedFile) {
  if (!file.fileName || !file.fileId) return false;
  const response = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
    method: "POST",
    headers: {
      Authorization: auth.authorizationToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.fileName,
      fileId: file.fileId,
    }),
  });

  return response.ok;
}

async function getReferencedB2Keys(supabaseAdmin: ReturnType<typeof getAdminClient>) {
  const referencedKeys = new Set<string>();
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("photos")
      .select("storage_key")
      .range(from, from + pageSize - 1);

    if (error) throw error;

    for (const row of data || []) {
      if (row.storage_key) addMediaKeyVariants(referencedKeys, String(row.storage_key));
    }

    if (!data || data.length < pageSize) break;
  }

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("profile_image")
      .range(from, from + pageSize - 1);

    if (error) throw error;

    for (const row of data || []) {
      if (row.profile_image) addMediaKeyVariants(referencedKeys, keyFromMediaUrl(String(row.profile_image)));
    }

    if (!data || data.length < pageSize) break;
  }

  return referencedKeys;
}

async function inspectBackblazeOrphans(supabaseAdmin: ReturnType<typeof getAdminClient>) {
  const auth = await getCachedBackblazeAuth();
  const bucketId = requireEnv("B2_BUCKET_ID");
  const [files, referencedKeys] = await Promise.all([
    listAllB2Files(auth, bucketId),
    getReferencedB2Keys(supabaseAdmin),
  ]);

  const managedFiles = files.filter(file => file.fileName && isManagedB2MediaFile(file.fileName));
  const orphanFiles = managedFiles.filter(file => !referencedKeys.has(file.fileName));
  const orphanBytes = orphanFiles.reduce((sum, file) => sum + (Number(file.contentLength ?? file.size ?? 0) || 0), 0);
  const totalBytes = managedFiles.reduce((sum, file) => sum + (Number(file.contentLength ?? file.size ?? 0) || 0), 0);

  return {
    auth,
    bucketId,
    managedFiles,
    orphanFiles,
    orphanBytes,
    totalBytes,
    referencedFiles: managedFiles.length - orphanFiles.length,
  };
}

async function deleteB2Prefix(auth: BackblazeAuth, bucketId: string, prefix: string) {
  try {
    let startFileName: string | undefined = undefined;
    let totalDeleted = 0;
    while (true) {
      const listResponse: Response = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_names`, {
        method: "POST",
        headers: {
          Authorization: auth.authorizationToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bucketId,
          prefix,
          maxFileCount: 1000,
          ...(startFileName ? { startFileName } : {}),
        }),
      });

      if (!listResponse.ok) break;

      const listData: any = await listResponse.json();
      const files: Array<{ fileName: string; fileId?: string }> = listData.files || [];
      if (files.length === 0) break;

      const chunkSize = 10;
      for (let i = 0; i < files.length; i += chunkSize) {
        const chunk = files.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(async (file) => {
            if (file.fileId && file.fileName) {
              const deleteResponse = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
                method: "POST",
                headers: {
                  Authorization: auth.authorizationToken,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  fileName: file.fileName,
                  fileId: file.fileId,
                }),
              });
              if (deleteResponse.ok) totalDeleted++;
            }
          })
        );
      }

      if (listData.nextFileName) {
        startFileName = listData.nextFileName;
      } else {
        break;
      }
    }
    return totalDeleted > 0;
  } catch (error) {
    console.warn(`[admin/control] Could not delete B2 prefix ${prefix}:`, error);
    return false;
  }
}

async function deleteB2File(auth: BackblazeAuth, bucketId: string, key: string) {
  try {
    const listResponse = await fetch(`${auth.apiUrl}/b2api/v3/b2_list_file_names`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bucketId,
        startFileName: key,
        maxFileCount: 1,
        prefix: key,
      }),
    });

    if (!listResponse.ok) return false;

    const listData = await listResponse.json();
    const file = listData.files?.find((item: { fileName: string; fileId?: string }) => item.fileName === key);
    if (!file?.fileId) return true;

    const deleteResponse = await fetch(`${auth.apiUrl}/b2api/v3/b2_delete_file_version`, {
      method: "POST",
      headers: {
        Authorization: auth.authorizationToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: key,
        fileId: file.fileId,
      }),
    });

    return deleteResponse.ok;
  } catch (error) {
    console.warn(`[admin/control] Could not delete B2 file ${key}:`, error);
    return false;
  }
}

async function syncAllAuthUsers(supabaseAdmin: ReturnType<typeof getAdminClient>) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) throw error;

  let synced = 0;

  for (const authUser of data.users) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing) continue;

    const name = authUser.user_metadata?.name || authUser.email?.split("@")[0] || "Wedding User";
    const { error: insertError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authUser.id,
        name,
        email: authUser.email || null,
        role: "user",
        role_type: "primary",
        created_at: new Date().toISOString(),
      });

    if (insertError) throw insertError;
    synced++;
  }

  return { count: data.users.length, synced };
}

async function updateUserRole(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  payload: Record<string, unknown>,
  actorUserId?: string
) {
  const uid = String(payload.uid || "");
  const role = typeof payload.role === "string" ? payload.role : null;
  const delegatedBy = typeof payload.delegatedBy === "string" ? payload.delegatedBy : "";
  const roleType = typeof payload.roleType === "string" ? payload.roleType : "";
  const assignedEvents = Array.isArray(payload.assignedEvents)
    ? payload.assignedEvents.map(String).filter(Boolean)
    : [];

  if (!uid) {
    throw new Error("User id is required");
  }

  if (role !== null) {
    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from("profiles")
      .select("role, delegated_by")
      .eq("id", uid)
      .maybeSingle();

    if (targetProfileError) throw targetProfileError;

    const targetIsGlobalSuperAdmin = targetProfile?.role === "admin" && !targetProfile.delegated_by;
    const wouldRemoveGlobalSuperAdmin = targetIsGlobalSuperAdmin && (role !== "admin" || !!delegatedBy);

    if (wouldRemoveGlobalSuperAdmin) {
      if (uid === actorUserId) {
        throw new AdminActionError("You cannot revoke your own Super Admin access", 409);
      }

      const { count, error: countError } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .is("delegated_by", null);

      if (countError) throw countError;
      if ((count || 0) <= 1) {
        throw new AdminActionError("At least one Super Admin must remain", 409);
      }
    }
  }

  const updateData: Record<string, string | null> = {};
  if (role !== null) updateData.role = role;

  if (role !== null) {
    if (isPaidPlanRole(role)) {
      const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
        .from("profiles")
        .select("subscription_duration, plan_start_date")
        .eq("id", uid)
        .maybeSingle();

      if (existingProfileError) throw existingProfileError;

      const startDate = normalizeDateOnly(existingProfile?.plan_start_date) || toDateOnly(new Date());
      const duration = normalizeSubscriptionDuration(existingProfile?.subscription_duration);
      updateData.plan_start_date = startDate;
      updateData.plan_end_date = addDurationToDate(startDate, duration);
    } else {
      updateData.plan_start_date = null;
      updateData.plan_end_date = null;
    }
  }

  if (delegatedBy) {
    updateData.delegated_by = delegatedBy;
    updateData.role_type = roleType || "primary";
  } else {
    updateData.delegated_by = null;
    updateData.role_type = null;
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updateData)
    .eq("id", uid);

  if (error) throw error;

  const { error: clearError } = await supabaseAdmin
    .from("profile_assigned_events")
    .delete()
    .eq("profile_id", uid);

  if (clearError) throw clearError;

  if (delegatedBy && roleType === "event" && assignedEvents.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("profile_assigned_events")
      .insert(assignedEvents.map(eventId => ({ profile_id: uid, event_id: eventId })));

    if (insertError) throw insertError;
  }
}

async function promoteSuperAdmin(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  payload: Record<string, unknown>
) {
  const uid = String(payload.uid || "");

  if (!uid) {
    throw new Error("User id is required");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", uid)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    throw new AdminActionError("User profile was not found", 404);
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      role: "admin",
      delegated_by: null,
      role_type: "primary",
      plan_start_date: null,
      plan_end_date: null,
    })
    .eq("id", uid);

  if (error) throw error;

  const { error: clearError } = await supabaseAdmin
    .from("profile_assigned_events")
    .delete()
    .eq("profile_id", uid);

  if (clearError) throw clearError;
}

async function revokeSuperAdmin(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  payload: Record<string, unknown>,
  actorUserId: string
) {
  const uid = String(payload.uid || "");

  if (!uid) {
    throw new Error("User id is required");
  }

  if (uid === actorUserId) {
    throw new AdminActionError("You cannot revoke your own Super Admin access", 409);
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, delegated_by")
    .eq("id", uid)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) {
    throw new AdminActionError("User profile was not found", 404);
  }

  if (profile.role !== "admin" || profile.delegated_by) {
    throw new AdminActionError("Only global Super Admin access can be revoked here", 409);
  }

  const { count, error: countError } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .is("delegated_by", null);

  if (countError) throw countError;
  if ((count || 0) <= 1) {
    throw new AdminActionError("At least one Super Admin must remain", 409);
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      role: "free",
      delegated_by: null,
      role_type: "primary",
      plan_start_date: null,
      plan_end_date: null,
    })
    .eq("id", uid);

  if (error) throw error;

  const { error: clearError } = await supabaseAdmin
    .from("profile_assigned_events")
    .delete()
    .eq("profile_id", uid);

  if (clearError) throw clearError;
}

async function updateUserDuration(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  payload: Record<string, unknown>
) {
  const uid = String(payload.uid || "");
  const duration = normalizeSubscriptionDuration(payload.duration);
  const allowedDurations = new Set(["monthly", "quarterly", "half_yearly", "yearly"]);

  if (!uid) {
    throw new Error("User id is required");
  }

  if (!allowedDurations.has(duration)) {
    throw new Error("A valid duration is required");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role, plan_start_date")
    .eq("id", uid)
    .maybeSingle();

  if (profileError) throw profileError;

  const updateData: Record<string, string> = { subscription_duration: duration };

  if (isPaidPlanRole(profile?.role)) {
    const startDate = normalizeDateOnly(profile?.plan_start_date) || toDateOnly(new Date());
    updateData.plan_start_date = startDate;
    updateData.plan_end_date = addDurationToDate(startDate, duration);
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update(updateData)
    .eq("id", uid);

  if (error) throw error;
}

async function updateUserPlanDates(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  payload: Record<string, unknown>
) {
  const uid = String(payload.uid || "");
  const planStartDate = normalizeDateOnly(payload.planStartDate);
  let planEndDate = normalizeDateOnly(payload.planEndDate);

  if (!uid) {
    throw new Error("User id is required");
  }

  if (payload.recalculateEndDate === true && planStartDate) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("subscription_duration")
      .eq("id", uid)
      .maybeSingle();

    if (profileError) throw profileError;
    planEndDate = addDurationToDate(planStartDate, normalizeSubscriptionDuration(profile?.subscription_duration));
  }

  if (!planStartDate || !planEndDate) {
    throw new Error("Valid plan start and end dates are required");
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      plan_start_date: planStartDate,
      plan_end_date: planEndDate,
    })
    .eq("id", uid);

  if (error) throw error;
}

async function deleteUser(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  payload: Record<string, unknown>
) {
  const uid = String(payload.uid || "");
  if (!uid) {
    throw new Error("User id is required");
  }

  await resetUserData(supabaseAdmin, { uid });

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(uid);
  if (authError) {
    console.warn("[admin/control] Auth deletion warning:", authError.message);
  }

  const { error: assignmentsError } = await supabaseAdmin
    .from("profile_assigned_events")
    .delete()
    .eq("profile_id", uid);

  if (assignmentsError) throw assignmentsError;

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .delete()
    .eq("id", uid);

  if (profileError) throw profileError;
}

async function collectEventTreeIds(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  rootIds: string[]
) {
  const collected = new Set(rootIds.filter(Boolean));
  let frontier = Array.from(collected);

  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const chunk of chunkArray(frontier, 100)) {
      const { data: children, error } = await supabaseAdmin
        .from("events")
        .select("id")
        .in("parent_id", chunk);

      if (error) throw error;

      for (const child of children || []) {
        if (child.id && !collected.has(child.id)) {
          collected.add(child.id);
          nextFrontier.push(child.id);
        }
      }
    }
    frontier = nextFrontier;
  }

  return Array.from(collected);
}

async function resetUserData(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  payload: Record<string, unknown>
) {
  const uid = String(payload.uid || "");
  if (!uid) {
    throw new Error("User id is required");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, phone, role, delegated_by")
    .eq("id", uid)
    .maybeSingle();

  if (profileError) throw profileError;
  if (!profile) throw new Error("User profile was not found");
  const isGlobalSuperAdmin = profile.role === "admin" && !profile.delegated_by;

  const ownerIdentifiers = uniqueValues([profile.id, profile.email, profile.phone]);
  const ownerIdentifierLower = ownerIdentifiers.map(value => value.toLowerCase());

  const directEventIds = new Set<string>();
  for (const chunk of chunkArray(ownerIdentifiers, 100)) {
    const { data: ownedEvents, error: ownedEventsError } = await supabaseAdmin
      .from("events")
      .select("id")
      .in("created_by", chunk);

    if (ownedEventsError) throw ownedEventsError;
    (ownedEvents || []).forEach(event => {
      if (event.id) directEventIds.add(event.id);
    });
  }

  const eventIds = await collectEventTreeIds(supabaseAdmin, Array.from(directEventIds));
  const photoRowsById = new Map<string, { id: string; storage_key?: string | null }>();

  for (const chunk of chunkArray(eventIds, 100)) {
    if (chunk.length === 0) continue;
    const { data: eventPhotos, error: eventPhotosError } = await supabaseAdmin
      .from("photos")
      .select("id, storage_key")
      .in("event_id", chunk);

    if (eventPhotosError) throw eventPhotosError;
    (eventPhotos || []).forEach(photo => photoRowsById.set(photo.id, photo));
  }

  for (const chunk of chunkArray(ownerIdentifiers, 100)) {
    const { data: uploadedPhotos, error: uploadedPhotosError } = await supabaseAdmin
      .from("photos")
      .select("id, storage_key")
      .in("user_id", chunk);

    if (uploadedPhotosError) throw uploadedPhotosError;
    (uploadedPhotos || []).forEach(photo => photoRowsById.set(photo.id, photo));
  }

  const photoRows = Array.from(photoRowsById.values());
  const photoIds = photoRows.map(photo => photo.id).filter(Boolean);

  if (photoRows.length > 0) {
    const auth = await getCachedBackblazeAuth();
    const bucketId = requireEnv("B2_BUCKET_ID");
    for (const photo of photoRows) {
      if (!photo.storage_key) continue;
      await Promise.all([
        deleteB2File(auth, bucketId, photo.storage_key),
        deleteB2File(auth, bucketId, `${photo.storage_key}-thumbnail.webp`),
        deleteB2File(auth, bucketId, `${photo.storage_key}-preview.webp`),
        deleteB2Prefix(auth, bucketId, `hls/${photo.storage_key}/`),
      ]);
    }
  }

  for (const chunk of chunkArray(photoIds, 100)) {
    if (chunk.length === 0) continue;
    const { error: facesByPhotoError } = await supabaseAdmin.from("faces").delete().in("image_id", chunk);
    if (facesByPhotoError) throw facesByPhotoError;

    const { error: likesError } = await supabaseAdmin.from("likes").delete().in("photo_id", chunk);
    if (likesError) throw likesError;

    const { error: commentsError } = await supabaseAdmin.from("comments").delete().in("photo_id", chunk);
    if (commentsError) throw commentsError;

    const { error: photosError } = await supabaseAdmin.from("photos").delete().in("id", chunk);
    if (photosError) throw photosError;
  }

  let guestsDeleted = 0;
  for (const chunk of chunkArray(eventIds, 100)) {
    if (chunk.length === 0) continue;
    const { error: facesByEventError } = await supabaseAdmin.from("faces").delete().in("event_id", chunk);
    if (facesByEventError) throw facesByEventError;

    const { count, error: guestsError } = await supabaseAdmin
      .from("guests")
      .delete({ count: "exact" })
      .or(`event_id.in.(${chunk.join(",")}),parent_event_id.in.(${chunk.join(",")})`);

    if (guestsError) throw guestsError;
    guestsDeleted += count || 0;
  }

  for (const chunk of chunkArray(ownerIdentifiers, 100)) {
    const { count, error } = await supabaseAdmin
      .from("guests")
      .delete({ count: "exact" })
      .in("parent_event_owner_id", chunk);

    if (error) throw error;
    guestsDeleted += count || 0;
  }

  const { data: candidateGuests, error: candidateGuestsError } = await supabaseAdmin
    .from("guests")
    .select("id, phone");

  if (candidateGuestsError) throw candidateGuestsError;

  const directGuestIds = (candidateGuests || [])
    .filter(guest => {
      const idPrefix = String(guest.id || "").split("_")[0].toLowerCase();
      const phone = String(guest.phone || "").toLowerCase();
      return ownerIdentifierLower.includes(idPrefix) || ownerIdentifierLower.includes(phone);
    })
    .map(guest => guest.id)
    .filter(Boolean);

  for (const chunk of chunkArray(directGuestIds, 100)) {
    const { count, error } = await supabaseAdmin.from("guests").delete({ count: "exact" }).in("id", chunk);
    if (error) throw error;
    guestsDeleted += count || 0;
  }

  for (const chunk of chunkArray(eventIds, 100)) {
    if (chunk.length === 0) continue;
    const { error: assignmentsByEventError } = await supabaseAdmin
      .from("profile_assigned_events")
      .delete()
      .in("event_id", chunk);
    if (assignmentsByEventError) throw assignmentsByEventError;
  }

  const { error: assignmentsByProfileError } = await supabaseAdmin
    .from("profile_assigned_events")
    .delete()
    .eq("profile_id", uid);

  if (assignmentsByProfileError) throw assignmentsByProfileError;

  const sortedEventIds = [...eventIds].reverse();

  for (const eventId of sortedEventIds) {
    const { error } = await supabaseAdmin.from("events").delete().eq("id", eventId);
    if (error) throw error;
  }

  if (!isGlobalSuperAdmin) {
    const { error: resetPlanError } = await supabaseAdmin
      .from("profiles")
      .update({
        role: "free",
        subscription_duration: "monthly",
        plan_start_date: null,
        plan_end_date: null,
      })
      .eq("id", uid);

    if (resetPlanError) throw resetPlanError;
  }

  return {
    eventsDeleted: eventIds.length,
    mediaDeleted: photoRows.length,
    guestsDeleted,
  };
}

async function deleteEventTree(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  eventId: string
) {
  const { data: children, error: childrenError } = await supabaseAdmin
    .from("events")
    .select("id")
    .eq("parent_id", eventId);

  if (childrenError) throw childrenError;

  for (const child of children || []) {
    await deleteEventTree(supabaseAdmin, child.id);
  }

  const { data: photos, error: photosSelectError } = await supabaseAdmin
    .from("photos")
    .select("id, storage_key")
    .eq("event_id", eventId);

  if (photosSelectError) throw photosSelectError;

  const photoRows = photos || [];
  const photoIds = photoRows.map(photo => photo.id).filter(Boolean);

  if (photoRows.length > 0) {
    const auth = await getCachedBackblazeAuth();
    const bucketId = requireEnv("B2_BUCKET_ID");
    for (const photo of photoRows) {
      if (!photo.storage_key) continue;
      await Promise.all([
        deleteB2File(auth, bucketId, photo.storage_key),
        deleteB2File(auth, bucketId, `${photo.storage_key}-thumbnail.webp`),
        deleteB2File(auth, bucketId, `${photo.storage_key}-preview.webp`),
        deleteB2Prefix(auth, bucketId, `hls/${photo.storage_key}/`),
      ]);
    }
  }

  for (const chunk of chunkArray(photoIds, 100)) {
    if (chunk.length === 0) continue;
    const { error: facesByPhotoError } = await supabaseAdmin.from("faces").delete().in("image_id", chunk);
    if (facesByPhotoError) throw facesByPhotoError;

    const { error: likesError } = await supabaseAdmin.from("likes").delete().in("photo_id", chunk);
    if (likesError) throw likesError;

    const { error: commentsError } = await supabaseAdmin.from("comments").delete().in("photo_id", chunk);
    if (commentsError) throw commentsError;
  }

  const { error: photosError } = await supabaseAdmin
    .from("photos")
    .delete()
    .eq("event_id", eventId);

  if (photosError) throw photosError;

  const { error: facesByEventError } = await supabaseAdmin
    .from("faces")
    .delete()
    .eq("event_id", eventId);

  if (facesByEventError) throw facesByEventError;

  const { error: assignmentsError } = await supabaseAdmin
    .from("profile_assigned_events")
    .delete()
    .eq("event_id", eventId);

  if (assignmentsError) throw assignmentsError;

  const { error: guestsError } = await supabaseAdmin
    .from("guests")
    .delete()
    .or(`event_id.eq.${eventId},parent_event_id.eq.${eventId}`);

  if (guestsError) throw guestsError;

  const { error: eventError } = await supabaseAdmin
    .from("events")
    .delete()
    .eq("id", eventId);

  if (eventError) throw eventError;
}

async function scanBackblazeOrphans(supabaseAdmin: ReturnType<typeof getAdminClient>) {
  const scan = await inspectBackblazeOrphans(supabaseAdmin);
  return {
    totalFiles: scan.managedFiles.length,
    totalBytes: scan.totalBytes,
    referencedFiles: scan.referencedFiles,
    orphanFiles: scan.orphanFiles.length,
    orphanBytes: scan.orphanBytes,
  };
}

async function deleteBackblazeOrphans(supabaseAdmin: ReturnType<typeof getAdminClient>) {
  const scan = await inspectBackblazeOrphans(supabaseAdmin);
  let deletedFiles = 0;
  let deletedBytes = 0;
  const failedFiles: string[] = [];

  for (const file of scan.orphanFiles) {
    const deleted = await deleteB2FileVersion(scan.auth, file);
    if (deleted) {
      deletedFiles += 1;
      deletedBytes += Number(file.contentLength ?? file.size ?? 0) || 0;
    } else {
      failedFiles.push(file.fileName);
    }
  }

  return {
    totalFiles: scan.managedFiles.length,
    referencedFiles: scan.referencedFiles,
    orphanFiles: scan.orphanFiles.length,
    orphanBytes: scan.orphanBytes,
    deletedFiles,
    deletedBytes,
    failedFiles: failedFiles.slice(0, 20),
    failedCount: failedFiles.length,
  };
}

async function updatePricingPlans(
  supabaseAdmin: ReturnType<typeof getAdminClient>,
  payload: Record<string, unknown>
) {
  const plans = Array.isArray(payload.plans) ? payload.plans : [];
  if (plans.length === 0) {
    throw new Error("At least one pricing plan is required");
  }

  const rows = plans.map((plan, index) => normalizePricingPlan(plan, index));
  const { error } = await supabaseAdmin
    .from("pricing_plans")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    const message = error.message || "";
    const code = error.code || "";
    if (
      code === "42P01" ||
      code === "PGRST205" ||
      message.includes("pricing_plans") ||
      message.toLowerCase().includes("schema cache")
    ) {
      throw new AdminActionError(
        "Pricing table is not ready yet. Apply supabase/migrations/20260710000000_add_pricing_plans.sql in Supabase, then refresh the analytics dashboard.",
        409
      );
    }
    throw error;
  }

  return { count: rows.length };
}

adminRouter.options("/", (_request, response) => response.status(204).end());

adminRouter.post("/", async (request: Request, response: ExpressResponse) => {
  try {
    const verification = await verifySuperAdmin(request);
    if ("error" in verification) {
      const status = adminAuthStatus(verification.error);
      return jsonResponse(response, { success: false, error: verification.error }, status);
    }

    const body = (request.body || {}) as Record<string, unknown>;
    const action = String(body.action || "");
    const payload = (body.payload || {}) as Record<string, unknown>;
    const { supabaseAdmin, user } = verification;

    switch (action) {
      case "syncUsers": {
        const result = await syncAllAuthUsers(supabaseAdmin);
        return jsonResponse(response, { success: true, ...result });
      }
      case "updateUserRole": {
        await updateUserRole(supabaseAdmin, payload, user.id);
        return jsonResponse(response, { success: true });
      }
      case "promoteSuperAdmin": {
        await promoteSuperAdmin(supabaseAdmin, payload);
        return jsonResponse(response, { success: true });
      }
      case "revokeSuperAdmin": {
        await revokeSuperAdmin(supabaseAdmin, payload, user.id);
        return jsonResponse(response, { success: true });
      }
      case "updateUserDuration": {
        await updateUserDuration(supabaseAdmin, payload);
        return jsonResponse(response, { success: true });
      }
      case "updateUserPlanDates": {
        await updateUserPlanDates(supabaseAdmin, payload);
        return jsonResponse(response, { success: true });
      }
      case "resetUserData": {
        const result = await resetUserData(supabaseAdmin, payload);
        return jsonResponse(response, { success: true, ...result });
      }
      case "deleteUser": {
        await deleteUser(supabaseAdmin, payload);
        return jsonResponse(response, { success: true });
      }
      case "deleteEvent": {
        const eventId = String(payload.eventId || "");
        if (!eventId) throw new Error("Event id is required");
        await deleteEventTree(supabaseAdmin, eventId);
        return jsonResponse(response, { success: true });
      }
      case "toggleSampleGallery": {
        const eventId = String(payload.eventId || "");
        if (!eventId) throw new Error("Event id is required");
        const isSampleGallery = Boolean(payload.isSampleGallery);

        const { error } = await supabaseAdmin
          .from("events")
          .update({ is_sample_gallery: isSampleGallery })
          .eq("id", eventId);

        if (error) throw error;
        return jsonResponse(response, { success: true });
      }
      case "deleteGuest": {
        const guestId = String(payload.guestId || "");
        if (!guestId) throw new Error("Guest id is required");
        const { error } = await supabaseAdmin.from("guests").delete().eq("id", guestId);
        if (error) throw error;
        return jsonResponse(response, { success: true });
      }
      case "scanBackblazeOrphans": {
        const result = await scanBackblazeOrphans(supabaseAdmin);
        return jsonResponse(response, { success: true, ...result });
      }
      case "deleteBackblazeOrphans": {
        if (payload.confirm !== "DELETE_ORPHAN_B2_FILES") {
          throw new Error("Deletion confirmation is required");
        }
        const result = await deleteBackblazeOrphans(supabaseAdmin);
        return jsonResponse(response, { success: true, ...result });
      }
      case "updatePricingPlans": {
        const result = await updatePricingPlans(supabaseAdmin, payload);
        return jsonResponse(response, { success: true, ...result });
      }
      default:
        return jsonResponse(response, { success: false, error: "Unsupported admin action" }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin action failed";
    console.error("[admin/control]", message);
    const status = error instanceof AdminActionError ? error.status : 500;
    return jsonResponse(response, { success: false, error: message }, status);
  }
});

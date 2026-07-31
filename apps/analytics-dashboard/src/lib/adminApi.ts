import { supabase } from './supabase';

export type AdminAction =
  | 'syncUsers'
  | 'updateUserRole'
  | 'promoteSuperAdmin'
  | 'revokeSuperAdmin'
  | 'updateUserDuration'
  | 'updateUserPlanDates'
  | 'resetUserData'
  | 'deleteUser'
  | 'deleteEvent'
  | 'toggleSampleGallery'
  | 'deleteGuest'
  | 'scanBackblazeOrphans'
  | 'deleteBackblazeOrphans'
  | 'updatePricingPlans';

export interface AdminActionResult {
  success: boolean;
  error?: string;
  count?: number;
  synced?: number;
  eventsDeleted?: number;
  mediaDeleted?: number;
  guestsDeleted?: number;
  orphanFiles?: number;
  orphanBytes?: number;
  referencedFiles?: number;
  totalFiles?: number;
  deletedFiles?: number;
  deletedBytes?: number;
}

function getApiBaseUrl() {
  const env = (import.meta as any).env;
  return (
    env.VITE_API_BASE_URL ||
    env.VITE_NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

async function getAccessToken(forceRefresh = false) {
  const sessionResult = forceRefresh
    ? await supabase.auth.refreshSession()
    : await supabase.auth.getSession();

  let session = sessionResult.data.session;

  if (!forceRefresh && session?.expires_at) {
    const expiresInSeconds = session.expires_at - Math.floor(Date.now() / 1000);
    if (expiresInSeconds < 60) {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data.session;
    }
  }

  return session?.access_token || '';
}

async function postAdminAction(action: AdminAction, payload: Record<string, unknown>, token: string) {
  const response = await fetch(`${getApiBaseUrl()}/api/admin/control`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, payload }),
  });

  const result = await response.json().catch(() => ({}));
  return { response, result };
}

export async function runAdminAction(
  action: AdminAction,
  payload: Record<string, unknown> = {}
): Promise<AdminActionResult> {
  let token = await getAccessToken();

  if (!token) {
    return { success: false, error: 'Please sign in again before running this action.' };
  }

  let { response, result } = await postAdminAction(action, payload, token);

  if (!response.ok && result.error === 'Invalid authorization token') {
    token = await getAccessToken(true);
    if (token) {
      ({ response, result } = await postAdminAction(action, payload, token));
    }
  }

  if (!response.ok || !result.success) {
    return {
      success: false,
      error: result.error || `Admin action failed with status ${response.status}`,
    };
  }

  return result;
}

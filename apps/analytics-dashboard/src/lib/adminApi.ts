import { supabase } from './supabase';

export type AdminAction =
  | 'deleteGalleryMedia'
  | 'viewGallery'
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
  | 'updatePricingPlans'
  | 'recordPayment'
  | 'deletePayment';

export interface GalleryMedia {
  id: string;
  url: string;
  thumbnail_url?: string | null;
  preview_url?: string | null;
  media_type?: string | null;
  resource_type?: string | null;
}

export interface AdminActionResult {
  appliedMediaType?: 'images' | 'videos' | null;
  gallery?: { id: string; title: string; parent_id?: string | null };
  media?: GalleryMedia[];
  hasMore?: boolean;
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

export function getApiBaseUrl() {
  const env = (import.meta as any).env;
  return (
    env.VITE_API_BASE_URL ||
    env.VITE_NEXT_PUBLIC_SITE_URL ||
    'http://localhost:8080'
  ).replace(/\/$/, '');
}

export async function getAccessToken(forceRefresh = false) {
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
  const apiBaseUrl = getApiBaseUrl();
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}/api/admin/control`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, payload }),
    });
  } catch {
    throw new Error(
      `Unable to reach the backend API at ${apiBaseUrl}. Please ensure the backend server is running (run 'npm run backend' in the project root).`
    );
  }

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

export interface InfraInvoice {
  id: string;
  provider: 'supabase' | 'railway' | 'cloudflare' | 'backblaze' | 'modal' | 'qstash' | 'other' | string;
  amount_usd: number;
  amount_inr: number;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  invoice_number?: string | null;
  notes?: string | null;
  paid_at: string;
  created_at: string;
}

export async function fetchInfraInvoices(): Promise<InfraInvoice[]> {
  try {
    const { data, error } = await supabase
      .from('infra_invoices')
      .select('*')
      .order('paid_at', { ascending: false });

    if (!error && data) {
      console.log(`[InfraInvoices] Successfully fetched ${data.length} invoice(s) from Supabase:`, data);
      return data as InfraInvoice[];
    }
    if (error) {
      console.warn('[InfraInvoices] Direct fetch error from Supabase:', error);
    }
  } catch (err) {
    console.warn('[InfraInvoices] Direct fetch failed, trying backend API:', err);
  }

  // Fallback to backend API
  const token = await getAccessToken();
  if (!token) {
    console.warn('[InfraInvoices] No access token available for backend fallback fetch');
    return [];
  }
  const apiBase = getApiBaseUrl();
  try {
    const res = await fetch(`${apiBase}/api/admin/infra-invoices`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      console.warn(`[InfraInvoices] Backend API fetch failed with status ${res.status}`);
      return [];
    }
    const data = await res.json();
    const invoices = Array.isArray(data.invoices) ? data.invoices : [];
    console.log(`[InfraInvoices] Fetched ${invoices.length} invoice(s) from backend API:`, invoices);
    return invoices;
  } catch (backendErr) {
    console.warn('[InfraInvoices] Backend API fetch error:', backendErr);
    return [];
  }
}

export async function recordInfraInvoice(payload: {
  provider: string;
  amount_usd?: number;
  amount_inr?: number;
  billing_period_start?: string;
  billing_period_end?: string;
  invoice_number?: string;
  notes?: string;
  paid_at?: string;
}): Promise<{ success: boolean; invoice?: InfraInvoice; error?: string }> {
  console.log('[InfraInvoices] Attempting to record invoice with payload:', payload);
  try {
    const numUsd = Number(payload.amount_usd) || 0;
    const numInr = Number(payload.amount_inr) || (numUsd * 100);

    const { data, error } = await supabase
      .from('infra_invoices')
      .insert({
        provider: payload.provider.toLowerCase().trim(),
        amount_usd: numUsd > 0 ? numUsd : (numInr / 100),
        amount_inr: numInr > 0 ? numInr : (numUsd * 100),
        billing_period_start: payload.billing_period_start || null,
        billing_period_end: payload.billing_period_end || null,
        invoice_number: payload.invoice_number ? String(payload.invoice_number).trim() : null,
        notes: payload.notes ? String(payload.notes).trim() : null,
        paid_at: payload.paid_at ? new Date(payload.paid_at).toISOString() : new Date().toISOString(),
      })
      .select()
      .single();

    if (!error && data) {
      console.log('[InfraInvoices] Successfully recorded invoice in Supabase:', data);
      return { success: true, invoice: data as InfraInvoice };
    }
    if (error) {
      console.warn('[InfraInvoices] Direct insert error in Supabase, trying backend API fallback:', error);
    }
  } catch (err) {
    console.warn('[InfraInvoices] Direct insert threw exception, trying backend API fallback:', err);
  }

  // Fallback to backend API
  const token = await getAccessToken();
  if (!token) return { success: false, error: 'Not authenticated' };
  const apiBase = getApiBaseUrl();
  try {
    const res = await fetch(`${apiBase}/api/admin/infra-invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log('[InfraInvoices] Recorded invoice via backend API response:', data);
    return data;
  } catch (err: any) {
    console.error('[InfraInvoices] Failed to record invoice via both direct and backend paths:', err);
    return { success: false, error: err?.message || 'Failed to record invoice' };
  }
}

export async function deleteInfraInvoice(id: string): Promise<{ success: boolean; error?: string }> {
  console.log('[InfraInvoices] Deleting invoice ID:', id);
  try {
    const { error } = await supabase
      .from('infra_invoices')
      .delete()
      .eq('id', id);

    if (!error) {
      console.log('[InfraInvoices] Successfully deleted invoice from Supabase, ID:', id);
      return { success: true };
    }
    if (error) {
      console.warn('[InfraInvoices] Direct delete error, trying backend API:', error);
    }
  } catch (err) {
    console.warn('[InfraInvoices] Direct delete failed, trying backend API:', err);
  }

  // Fallback to backend API
  const token = await getAccessToken();
  if (!token) return { success: false, error: 'Not authenticated' };
  const apiBase = getApiBaseUrl();
  try {
    const res = await fetch(`${apiBase}/api/admin/infra-invoices/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to delete invoice' };
  }
}


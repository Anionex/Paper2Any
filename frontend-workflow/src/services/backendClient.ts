import { API_KEY } from '../config/api';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

const GUEST_ID_STORAGE_KEY = 'paper2any_guest_id';

export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') {
    return 'guest-server';
  }

  const existing = localStorage.getItem(GUEST_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(GUEST_ID_STORAGE_KEY, generated);
  return generated;
}

export async function getBackendHeaders(initialHeaders: HeadersInit = {}): Promise<Headers> {
  const headers = new Headers(initialHeaders);
  headers.set('X-API-Key', API_KEY);
  headers.set('X-Guest-Id', getOrCreateGuestId());

  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch (err) {
      console.warn('[backendClient] Failed to get session for Authorization header:', err);
    }
  }

  return headers;
}

export async function backendFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = await getBackendHeaders(options.headers);
  return fetch(url, {
    ...options,
    headers,
  });
}

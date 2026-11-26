import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { IN_PREVIEW } from './env';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** Null in the claude.ai preview and wherever Supabase isn't configured: the app then runs on this device only. */
export const supabase: SupabaseClient | null =
  !IN_PREVIEW && url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }) : null;

export const AUTH_ON = supabase !== null;
export const GOOGLE_SIGNIN = AUTH_ON && import.meta.env.VITE_GOOGLE_SIGNIN === 'on';

export async function accessToken(): Promise<string | undefined> {
  if (!supabase) return undefined;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

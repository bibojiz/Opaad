import type { Usage } from './agent-core';

/** Supabase settings for the server. Both values are public (the browser has them too). */
function config(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

export type AuthResult = { required: boolean; user?: { id: string }; token?: string };

/** Checks the caller's Supabase session token with Supabase itself. */
export async function verifyUser(header: string | null, fetchImpl: typeof fetch = fetch): Promise<AuthResult> {
  const c = config();
  if (!c) return { required: false };
  const token = header?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return { required: true };
  try {
    const res = await fetchImpl(`${c.url}/auth/v1/user`, { headers: { apikey: c.key, Authorization: `Bearer ${token}` } });
    if (!res.ok) return { required: true };
    const user = (await res.json()) as { id?: string };
    return user.id ? { required: true, user: { id: user.id }, token } : { required: true };
  } catch {
    return { required: true };
  }
}

/** Logs one AI request for the admin portal. Never blocks the answer: failures are ignored. */
export async function recordUsage(token: string, model: string, usage: Usage | undefined, fetchImpl: typeof fetch = fetch): Promise<void> {
  const c = config();
  if (!c) return;
  try {
    await fetchImpl(`${c.url}/rest/v1/rpc/record_ai_usage`, {
      method: 'POST',
      headers: { apikey: c.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_model: model, p_prompt: usage?.prompt ?? 0, p_completion: usage?.completion ?? 0, p_cost: usage?.cost ?? 0 }),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    /* usage logging is best effort */
  }
}

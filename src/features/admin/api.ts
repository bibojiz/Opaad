import { z } from 'zod';
import { supabase } from '@/lib/supabase';

const num = z.coerce.number();

export const OverviewSchema = z.object({
  users: num,
  new_7d: num,
  active_7d: num,
  pro: num,
  ai_requests_7d: num,
  ai_cost_7d: num,
  ai_cost_30d: num,
  ai_requests_30d: num,
  feedback_open: num,
  daily: z.array(z.object({ day: z.string(), requests: num, cost: num })),
});
export type Overview = z.infer<typeof OverviewSchema>;

export const AdminUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  created_at: z.string(),
  last_active: z.string().nullable(),
  plan: z.enum(['free', 'pro']),
  is_admin: z.boolean(),
  executives: num,
  open_items: num,
  ai_requests: num,
  ai_cost_30d: num,
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const FeedbackRowSchema = z.object({
  id: num,
  created_at: z.string(),
  email: z.string().nullable(),
  kind: z.enum(['idea', 'problem', 'praise']),
  message: z.string(),
  page: z.string().nullable(),
  resolved: z.boolean(),
});
export type FeedbackRow = z.infer<typeof FeedbackRowSchema>;

function db() {
  if (!supabase) throw new Error('Accounts are not switched on.');
  return supabase;
}

export async function amIAdmin(): Promise<boolean> {
  const { data: u } = await db().auth.getUser();
  if (!u.user) return false;
  const { data } = await db().from('profiles').select('is_admin').eq('id', u.user.id).maybeSingle();
  return Boolean(data?.is_admin);
}

export async function fetchOverview(): Promise<Overview> {
  const { data, error } = await db().rpc('admin_overview');
  if (error) throw error;
  return OverviewSchema.parse(data);
}

export async function fetchUsers(): Promise<AdminUser[]> {
  const { data, error } = await db().rpc('admin_users');
  if (error) throw error;
  return z.array(AdminUserSchema).parse(data);
}

export async function fetchFeedback(): Promise<FeedbackRow[]> {
  const { data, error } = await db().rpc('admin_feedback');
  if (error) throw error;
  return z.array(FeedbackRowSchema).parse(data);
}

export async function setPlan(userId: string, plan: 'free' | 'pro'): Promise<void> {
  const { error } = await db().rpc('admin_set_plan', { p_user: userId, p_plan: plan });
  if (error) throw error;
}

export async function resolveFeedback(id: number, resolved: boolean): Promise<void> {
  const { error } = await db().rpc('admin_resolve_feedback', { p_id: id, p_resolved: resolved });
  if (error) throw error;
}

export async function sendFeedback(kind: 'idea' | 'problem' | 'praise', message: string, page: string): Promise<void> {
  const { data: u } = await db().auth.getUser();
  if (!u.user) throw new Error('Sign in to send feedback.');
  const { error } = await db().from('feedback').insert({ user_id: u.user.id, kind, message: message.slice(0, 4000), page: page.slice(0, 120) });
  if (error) throw error;
}

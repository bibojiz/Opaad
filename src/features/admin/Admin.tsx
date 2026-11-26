import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { OpaadMark } from '@/components/ui';
import { useToast } from '@/components/overlays';
import { amIAdmin, fetchFeedback, fetchOverview, fetchUsers, resolveFeedback, setPlan, type AdminUser, type FeedbackRow, type Overview } from './api';

type Tab = 'overview' | 'users' | 'feedback';
type Load<T> = { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready'; data: T };

const usd = (n: number, digits = 2) => `$${n.toFixed(digits)}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '–');
const ago = (iso: string | null) => {
  if (!iso) return 'Never';
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return 'Just now';
  if (h < 24) return `${Math.floor(h)}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

function useLoad<T>(fn: () => Promise<T>): [Load<T>, () => void] {
  const [s, setS] = useState<Load<T>>({ state: 'loading' });
  const run = useCallback(() => {
    setS({ state: 'loading' });
    fn()
      .then((data) => setS({ state: 'ready', data }))
      .catch((e: unknown) => setS({ state: 'error', message: e instanceof Error ? e.message : 'Could not load.' }));
  }, [fn]);
  useEffect(run, [run]);
  return [s, run];
}

function Status<T>({ load, children }: { load: Load<T>; children: (d: T) => ReactNode }) {
  if (load.state === 'loading') return <p role="status" className="py-8 text-ink-2">Loading…</p>;
  if (load.state === 'error') return <p role="alert" className="py-8 text-danger">{load.message}</p>;
  return <>{children(load.data)}</>;
}

/** Admin portal. Reachable at /admin by accounts marked admin in Supabase; shows counts and account details, never workspace content. */
export function Admin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  useEffect(() => {
    amIAdmin().then(setAllowed).catch(() => setAllowed(false));
  }, []);

  if (allowed === null) return <p role="status" className="p-6 text-ink-2">Checking access…</p>;
  if (!allowed)
    return (
      <main className="mx-auto flex max-w-md flex-col gap-3 p-6">
        <h1 className="text-xl font-semibold">Admins only</h1>
        <p className="text-ink-2">This account can't open the admin portal.</p>
        <Link to="/" className="font-semibold underline">Back to Opaad</Link>
      </main>
    );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'users', label: 'Users' },
    { id: 'feedback', label: 'Feedback' },
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <OpaadMark size={22} />
          <span className="font-display text-xl leading-none">Opaad</span>
          <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-semibold text-white">Admin</span>
          <div className="flex-1" />
          <Link to="/" className="text-sm font-semibold underline">Back to app</Link>
        </div>
        <nav aria-label="Admin sections" className="mx-auto flex max-w-6xl gap-1 px-2 sm:px-4">
          {tabs.map((t) => (
            <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)} className={`min-h-11 border-b-2 px-3 text-[15px] ${tab === t.id ? 'border-ink font-semibold' : 'border-transparent text-ink-2'}`}>
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6">
        <p className="text-sm text-ink-2">You see account details and counts only. Nobody here can read anyone's tasks, notes or drafts.</p>
        {tab === 'overview' && <OverviewTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'feedback' && <FeedbackTab />}
      </main>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4">
      <span className="text-[13px] text-ink-2">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {sub && <span className="text-[13px] text-ink-3">{sub}</span>}
    </div>
  );
}

function OverviewTab() {
  const [load, reload] = useLoad(fetchOverview);
  return (
    <Status load={load}>
      {(o: Overview) => {
        const perReq = o.ai_requests_30d ? o.ai_cost_30d / o.ai_requests_30d : 0;
        const max = Math.max(...o.daily.map((d) => d.cost), 0.0001);
        return (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Tile label="Accounts" value={String(o.users)} sub={`${o.new_7d} new this week`} />
              <Tile label="Active this week" value={String(o.active_7d)} sub={o.users ? `${Math.round((o.active_7d / o.users) * 100)}% of accounts` : undefined} />
              <Tile label="AI requests, 7 days" value={String(o.ai_requests_7d)} sub={`${o.ai_requests_30d} in 30 days`} />
              <Tile label="AI cost, 7 days" value={usd(o.ai_cost_7d)} sub={`${usd(o.ai_cost_30d)} in 30 days`} />
              <Tile label="Cost per AI request" value={usd(perReq, 4)} sub="Average, 30 days" />
              <Tile label="Paid accounts" value={String(o.pro)} />
              <Tile label="Open feedback" value={String(o.feedback_open)} />
            </div>
            <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold">AI cost per day, last 14 days</h2>
                <button type="button" onClick={reload} className="min-h-11 text-sm font-semibold underline">Refresh</button>
              </div>
              <div aria-hidden className="flex h-40 items-end gap-1.5">
                {o.daily.map((d) => (
                  <div key={d.day} className="flex h-full flex-1 flex-col justify-end" title={`${day(d.day)}: ${usd(d.cost, 3)} · ${d.requests} requests`}>
                    <div className="w-full rounded-t bg-ink" style={{ height: `${Math.max((d.cost / max) * 100, d.cost ? 3 : 0)}%` }} />
                  </div>
                ))}
              </div>
              <div aria-hidden className="flex justify-between text-xs text-ink-3">
                <span>{day(o.daily[0]?.day ?? null)}</span>
                <span>Today</span>
              </div>
              <table className="sr-only">
                <caption>AI cost and requests per day</caption>
                <thead><tr><th>Day</th><th>Requests</th><th>Cost</th></tr></thead>
                <tbody>{o.daily.map((d) => <tr key={d.day}><td>{day(d.day)}</td><td>{d.requests}</td><td>{usd(d.cost, 3)}</td></tr>)}</tbody>
              </table>
            </section>
          </>
        );
      }}
    </Status>
  );
}

function UsersTab() {
  const toast = useToast();
  const [load, reload] = useLoad(fetchUsers);
  const change = async (u: AdminUser, plan: 'free' | 'pro') => {
    try {
      await setPlan(u.id, plan);
      toast(`${u.email ?? 'Account'} is now on ${plan === 'pro' ? 'Pro' : 'Free'}`);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not change the plan.');
    }
  };
  return (
    <Status load={load}>
      {(users: AdminUser[]) =>
        users.length === 0 ? (
          <p className="py-8 text-ink-2">No accounts yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full min-w-[860px] text-left text-sm">
              <caption className="sr-only">Accounts, newest first</caption>
              <thead className="border-b border-line text-[13px] text-ink-2">
                <tr>
                  {['Email', 'Joined', 'Last active', 'Executives', 'Open items', 'AI requests', 'AI cost, 30d', 'Plan'].map((h) => (
                    <th key={h} scope="col" className="px-3 py-2.5 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-line-soft last:border-0">
                    <td className="px-3 py-2.5">
                      {u.email ?? '–'} {u.is_admin && <span className="ml-1 rounded bg-subtle px-1.5 py-0.5 text-xs font-semibold">Admin</span>}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{day(u.created_at)}</td>
                    <td className="px-3 py-2.5">{ago(u.last_active)}</td>
                    <td className="px-3 py-2.5 tabular-nums">{u.executives}</td>
                    <td className="px-3 py-2.5 tabular-nums">{u.open_items}</td>
                    <td className="px-3 py-2.5 tabular-nums">{u.ai_requests}</td>
                    <td className="px-3 py-2.5 tabular-nums">{usd(u.ai_cost_30d, 3)}</td>
                    <td className="px-3 py-2.5">
                      <label className="sr-only" htmlFor={`plan-${u.id}`}>Plan for {u.email}</label>
                      <select id={`plan-${u.id}`} value={u.plan} onChange={(e) => void change(u, e.target.value as 'free' | 'pro')} className="h-9 rounded-field border border-line bg-surface px-2">
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </Status>
  );
}

const kindLabel = { idea: 'Idea', problem: 'Problem', praise: 'Praise' } as const;

function FeedbackTab() {
  const toast = useToast();
  const [load, reload] = useLoad(fetchFeedback);
  const toggle = async (f: FeedbackRow) => {
    try {
      await resolveFeedback(f.id, !f.resolved);
      reload();
    } catch {
      toast('Could not update that.');
    }
  };
  return (
    <Status load={load}>
      {(rows: FeedbackRow[]) =>
        rows.length === 0 ? (
          <p className="py-8 text-ink-2">No feedback yet. Testers send it from "Send feedback" in the app menu.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((f) => (
              <li key={f.id} className={`flex flex-col gap-2 rounded-card border border-line bg-surface p-4 ${f.resolved ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${f.kind === 'problem' ? 'bg-danger-soft text-danger-ink' : f.kind === 'praise' ? 'bg-lime text-ink' : 'bg-subtle text-ink'}`}>{kindLabel[f.kind]}</span>
                  <span>{f.email ?? 'Unknown'}</span>
                  <span>· {day(f.created_at)}</span>
                  {f.page && <span>· on {f.page}</span>}
                </div>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{f.message}</p>
                <button type="button" onClick={() => void toggle(f)} className="min-h-11 self-start text-sm font-semibold underline">
                  {f.resolved ? 'Reopen' : 'Mark as handled'}
                </button>
              </li>
            ))}
          </ul>
        )
      }
    </Status>
  );
}

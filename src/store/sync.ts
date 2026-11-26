import type { AppState } from '@/lib/model';
import { supabase } from '@/lib/supabase';
import { initialState } from './logic';
import { getState, replaceState, subscribeState } from './store';

/**
 * Keeps the assistant's workspace in their Supabase account.
 * The whole workspace is one versioned document (user_state). Saves carry the version they were based on;
 * if another device saved first, the two are merged by record id and saved again.
 */

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error';
let status: SyncStatus = 'idle';
const statusListeners = new Set<() => void>();
function setStatus(next: SyncStatus) {
  if (status === next) return;
  status = next;
  statusListeners.forEach((l) => l());
}
export const syncStatus = {
  get: () => status,
  subscribe: (l: () => void) => {
    statusListeners.add(l);
    return () => statusListeners.delete(l);
  },
};

const OWNER_KEY = 'opaad:owner';
let userId = '';
let version = 0;
let lastSynced: AppState | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let unsubscribe: (() => void) | undefined;
let inflight: Promise<void> | null = null;

/** Never leaves the device: the assistant's own OpenRouter key and per-device Google connection state. */
export function toCloud(s: AppState): AppState {
  return { ...s, settings: { ...s.settings, ownKey: '' }, events: {} };
}

function keepLocal(remote: AppState, local: AppState): AppState {
  const base = initialState();
  return {
    ...base,
    ...remote,
    settings: { ...base.settings, ...remote.settings, ownKey: local.settings.ownKey, google: local.settings.google },
    events: local.events,
  };
}

function byKey<T>(remote: T[], local: T[], key: (x: T) => string): T[] {
  const m = new Map(remote.map((x) => [key(x), x] as const));
  for (const x of local) m.set(key(x), x);
  return [...m.values()];
}
const byId = <T extends { id: string }>(remote: T[], local: T[]) => byKey(remote, local, (x) => x.id);

/** Two devices edited at once: keep everything from both; for the same record, this device wins. */
export function mergeStates(local: AppState, remote: AppState): AppState {
  return {
    ...keepLocal(remote, local),
    profile: local.profile.onboarded ? local.profile : remote.profile,
    executives: byId(remote.executives, local.executives),
    activeExecId: local.activeExecId || remote.activeExecId,
    items: byId(remote.items, local.items),
    plan: local.plan.length ? local.plan : remote.plan,
    drafts: byId(remote.drafts, local.drafts),
    reports: byKey(remote.reports, local.reports, (r) => `${r.execId}|${r.date}`),
    chats: { ...remote.chats, ...local.chats },
    readAlerts: [...new Set([...remote.readAlerts, ...local.readAlerts])],
    usage: local.usage,
  };
}

async function pull(): Promise<{ state: AppState; version: number } | null> {
  const { data, error } = await supabase!.from('user_state').select('state, version').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? { state: data.state as AppState, version: Number(data.version) } : null;
}

async function push(): Promise<void> {
  const local = getState();
  if (local === lastSynced) return;
  setStatus('saving');
  const { data, error } = await supabase!.rpc('save_state', { p_state: toCloud(local), p_base_version: version });
  if (error) {
    setStatus(navigator.onLine ? 'error' : 'offline');
    return;
  }
  if (Number(data) === -1) {
    const remote = await pull();
    if (!remote) return;
    const merged = mergeStates(getState(), remote.state);
    version = remote.version;
    lastSynced = null;
    replaceState(merged);
    const retry = await supabase!.rpc('save_state', { p_state: toCloud(merged), p_base_version: version });
    if (retry.error || Number(retry.data) === -1) {
      setStatus('error');
      return;
    }
    version = Number(retry.data);
    lastSynced = merged;
  } else {
    version = Number(data);
    lastSynced = local;
  }
  setStatus(getState() === lastSynced ? 'saved' : 'saving');
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    inflight = (inflight ?? Promise.resolve()).then(push).catch(() => setStatus('error'));
  }, 1200);
}

async function refreshIfChanged() {
  if (!userId || document.visibilityState !== 'visible') return;
  if (getState() !== lastSynced) return schedule();
  try {
    const remote = await pull();
    if (remote && remote.version > version) {
      version = remote.version;
      const next = keepLocal(remote.state, getState());
      lastSynced = next;
      replaceState(next);
    }
  } catch {
    /* stay on the copy we have */
  }
}

/** First load after sign-in: cloud copy wins; a first-time account takes what is on this device. */
export async function startSync(uid: string): Promise<void> {
  if (!supabase) return;
  userId = uid;
  const previousOwner = localStorage.getItem(OWNER_KEY);
  if (previousOwner && previousOwner !== uid) replaceState(initialState());
  const remote = await pull();
  if (remote) {
    version = remote.version;
    const next = keepLocal(remote.state, getState());
    lastSynced = next;
    replaceState(next);
  } else {
    version = 0;
    lastSynced = null;
    await push();
  }
  localStorage.setItem(OWNER_KEY, uid);
  unsubscribe?.();
  unsubscribe = subscribeState(() => {
    if (getState() !== lastSynced) schedule();
  });
  document.addEventListener('visibilitychange', refreshIfChanged);
  window.addEventListener('online', schedule);
}

/** Sends any unsaved change, then stops. */
export async function stopSync(flush = true): Promise<void> {
  clearTimeout(timer);
  if (flush && userId && getState() !== lastSynced) await push().catch(() => undefined);
  await inflight?.catch(() => undefined);
  unsubscribe?.();
  unsubscribe = undefined;
  document.removeEventListener('visibilitychange', refreshIfChanged);
  window.removeEventListener('online', schedule);
  userId = '';
  version = 0;
  lastSynced = null;
  localStorage.removeItem(OWNER_KEY);
}

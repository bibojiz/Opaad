import { useSyncExternalStore } from 'react';
import { get, set, del, keys } from 'idb-keyval';
import type { AppState } from '@/lib/model';
import { initialState } from './logic';

const KEY = 'opaad:state:v1';
let state: AppState = initialState();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function getState(): AppState {
  return state;
}

export function setState(updater: (s: AppState) => AppState): void {
  const next = updater(state);
  if (next === state) return;
  state = next;
  listeners.forEach((l) => l());
  clearTimeout(timer);
  timer = setTimeout(() => {
    void set(KEY, state).catch(() => undefined);
  }, 150);
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useApp(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

export async function loadState(): Promise<void> {
  try {
    const saved = await get<AppState>(KEY);
    if (saved && saved.version === 1) {
      state = { ...initialState(), ...saved, settings: { ...initialState().settings, ...saved.settings } };
    }
  } catch {
    /* private mode or storage blocked: run in memory */
  }
}

/* Evidence files live in IndexedDB next to the state, keyed by evidence id. */
export async function saveEvidenceFile(id: string, file: Blob): Promise<void> {
  await set(`opaad:ev:${id}`, file);
}

export async function readEvidenceFile(id: string): Promise<Blob | undefined> {
  return get<Blob>(`opaad:ev:${id}`);
}

export async function deleteEvidenceFile(id: string): Promise<void> {
  await del(`opaad:ev:${id}`);
}

/** Deletes everything Opaad stored on this device. */
export async function wipeAll(): Promise<void> {
  const all = await keys();
  await Promise.all(all.filter((k) => typeof k === 'string' && k.startsWith('opaad:')).map((k) => del(k)));
  state = initialState();
  listeners.forEach((l) => l());
}

export function exportJson(): string {
  return JSON.stringify(state, null, 2);
}

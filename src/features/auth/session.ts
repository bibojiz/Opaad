import { useSyncExternalStore } from 'react';
import { AUTH_ON, DIRECT_ACCESS, supabase } from '@/lib/supabase';
import { startSync, stopSync } from '@/store/sync';
import { wipeAll } from '@/store/store';

export type Session = { status: 'loading' | 'out' | 'syncing' | 'in'; email: string; error?: string };

const DIRECT_KEY = 'opaad:direct-email';
function directEmail(): string {
  try {
    return localStorage.getItem(DIRECT_KEY) ?? '';
  } catch {
    return '';
  }
}
let session: Session = AUTH_ON ? { status: 'loading', email: '' } : DIRECT_ACCESS ? (directEmail() ? { status: 'in', email: directEmail() } : { status: 'out', email: '' }) : { status: 'in', email: '' };
let currentUser = '';
const listeners = new Set<() => void>();
function set(next: Session) {
  session = next;
  listeners.forEach((l) => l());
}

export function useSession(): Session {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => session,
  );
}

/** Listens to Supabase sign-in changes; loads the account's workspace on sign-in. */
export function initSession(): void {
  if (!supabase) return;
  supabase.auth.onAuthStateChange((_event, s) => {
    // Supabase asks that no other auth call runs inside this callback.
    setTimeout(() => {
      if (s?.user) {
        if (currentUser === s.user.id) return;
        currentUser = s.user.id;
        set({ status: 'syncing', email: s.user.email ?? '' });
        startSync(s.user.id)
          .then(() => set({ status: 'in', email: s.user.email ?? '' }))
          .catch(() => set({ status: 'in', email: s.user.email ?? '', error: "Couldn't reach your account. Changes stay on this device until the connection is back." }));
      } else {
        currentUser = '';
        set({ status: 'out', email: '' });
      }
    }, 0);
  });
}

/** Testing shortcut: in with just an email, no check. */
export function enterDirect(email: string): void {
  try {
    localStorage.setItem(DIRECT_KEY, email);
  } catch {
    /* private mode: stays in for this visit */
  }
  set({ status: 'in', email });
}

/** Saves what's pending, signs out, and clears this device so the next person sees nothing. */
export async function signOut(): Promise<void> {
  if (DIRECT_ACCESS) {
    try {
      localStorage.removeItem(DIRECT_KEY);
    } catch {
      /* nothing stored */
    }
    await wipeAll();
    set({ status: 'out', email: '' });
    return;
  }
  if (!supabase) return;
  await stopSync(true);
  await supabase.auth.signOut();
  await wipeAll();
  currentUser = '';
  set({ status: 'out', email: '' });
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSyncExternalStore } from 'react';
import { AUTH_ON, DIRECT_ACCESS } from '@/lib/supabase';
import { syncStatus } from '@/store/sync';
import { Button } from '@/components/ui';
import { signOut, useSession } from './session';

const statusText = { idle: 'Up to date', saved: 'All changes saved', saving: 'Saving…', offline: "You're offline. Changes save when you're back.", error: "Couldn't save just now. Opaad will try again." } as const;

export function AccountSettings() {
  const session = useSession();
  const status = useSyncExternalStore(syncStatus.subscribe, syncStatus.get);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  if (!AUTH_ON && !DIRECT_ACCESS) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-base font-semibold">Account</h2>
      <p className="text-sm text-ink-2">
        Signed in as <span className="font-semibold text-ink">{session.email}</span>
      </p>
      <p role="status" className="text-[13px] text-ink-3">{DIRECT_ACCESS ? 'Testing mode: your work is saved on this device only.' : statusText[status]}</p>
      <Button
        variant="secondary"
        className="self-start"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await signOut();
          nav('/signin', { replace: true });
        }}
      >
        {busy ? 'Signing out…' : 'Sign out'}
      </Button>
    </section>
  );
}

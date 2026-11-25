import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IN_PREVIEW } from '@/lib/env';
import { exportJson, setState, useApp, wipeAll } from '@/store/store';
import { aiRequestsLeft } from '@/store/logic';
import { PageHeader } from '@/app/shell';
import { Button, Field, inputCls } from '@/components/ui';
import { Sheet, useToast } from '@/components/overlays';
import { FREE_AI_REQUESTS } from '@/lib/model';
import { notificationSupport, requestNotifications } from '@/lib/device';

export function Settings() {
  const s = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const [wipe, setWipe] = useState(false);
  const [key, setKey] = useState(s.settings.ownKey);
  const left = aiRequestsLeft(s, FREE_AI_REQUESTS);
  const perm = notificationSupport();

  const download = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `opaad-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader title="Settings" subtitle={s.profile.name} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-7 border-t border-line bg-surface px-4 py-5 lg:rounded-card lg:border lg:px-6">
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">You</h2>
          <Field label="First name"><input className={inputCls} value={s.profile.name} onChange={(e) => setState((st) => ({ ...st, profile: { ...st.profile, name: e.target.value } }))} /></Field>
          <Field label="Role"><input className={inputCls} value={s.profile.role} onChange={(e) => setState((st) => ({ ...st, profile: { ...st.profile, role: e.target.value } }))} /></Field>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Reminders</h2>
          <p className="text-sm leading-relaxed text-ink-2">
            {perm === 'granted' ? 'On. Reminders show on this device while Opaad is open or installed.' : perm === 'denied' ? 'Blocked in your browser settings. Allow notifications for this site to turn them on.' : perm === 'unsupported' ? 'This browser does not support notifications. On iPhone, add Opaad to your Home Screen first.' : 'Off.'}
          </p>
          {perm === 'default' && <Button variant="secondary" className="self-start" onClick={async () => { const p = await requestNotifications(); setState((st) => ({ ...st, settings: { ...st.settings, notifications: p } })); }}>Turn on reminders</Button>}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Plan</h2>
          <p className="text-sm leading-relaxed text-ink-2">
            {left === Infinity ? 'Unlimited AI requests.' : `Free plan: ${left} of ${FREE_AI_REQUESTS} AI requests left. Tasks, notes, reminders and reports are free without limits.`} The paid plan with unlimited AI is on the way.
          </p>
          {IN_PREVIEW && s.usage.aiRequests > 0 && <Button variant="secondary" className="self-start" onClick={() => setState((st) => ({ ...st, usage: { ...st.usage, aiRequests: 0 } }))}>Reset free requests (preview only)</Button>}
          {!IN_PREVIEW && <details className="rounded-card border border-line p-3">
            <summary className="cursor-pointer text-sm font-medium">Testing Opaad? Use your own OpenRouter key</summary>
            <form className="mt-3 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); setState((st) => ({ ...st, settings: { ...st.settings, ownKey: key.trim() } })); toast(key.trim() ? 'Key saved on this device' : 'Key removed'); }}>
              <label htmlFor="ownkey" className="text-[13px] text-ink-2">Stored only on this device and sent with your requests. Requests then don't count against the free plan.</label>
              <input id="ownkey" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-or-…" className={`${inputCls} h-11`} />
              <Button type="submit" variant="secondary" className="self-start">{s.settings.ownKey ? 'Update key' : 'Save key'}</Button>
            </form>
          </details>}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">Your data</h2>
          <p className="text-sm leading-relaxed text-ink-2">Everything is stored in this browser on this device. Opaad has no copy. Clearing your browser data deletes it, so export a copy now and then.</p>
          <div className="flex flex-wrap gap-2">
            {!IN_PREVIEW && <Button variant="secondary" onClick={download}>Export a copy</Button>}
            <Button variant="danger" onClick={() => setWipe(true)}>Delete all data</Button>
          </div>
        </section>

        <p className="text-xs leading-relaxed text-ink-3">Opaad 1.0 · Early access. AI answers can be wrong: check names, numbers and dates before you send anything.</p>
      </main>

      <Sheet open={wipe} onClose={() => setWipe(false)} title="Delete everything?">
        <p className="mb-4 text-[15px] leading-relaxed text-ink-2">Every executive, task, note, reminder, report, chat and attached file on this device is deleted. This can't be undone.</p>
        <div className="flex gap-2">
          <Button variant="danger" className="flex-1" onClick={async () => { await wipeAll(); setWipe(false); nav('/welcome', { replace: true }); }}>Delete everything</Button>
          <Button variant="secondary" className="flex-1" onClick={() => setWipe(false)}>Cancel</Button>
        </div>
      </Sheet>
    </div>
  );
}

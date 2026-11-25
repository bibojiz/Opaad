import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Mail } from 'lucide-react';
import { getState, setState, useApp } from '@/store/store';
import { addEventLocal, applyActions, calendarFor, removeEventLocal, removeItems } from '@/store/logic';
import { describeAction } from '@/lib/agent';
import { copyText, openEmail, shareToWhatsApp } from '@/lib/device';
import { calendarAvailable, createEvent, deleteEvent } from '@/lib/gcal';
import type { Action, ChatMessage } from '@/lib/model';
import { useToast } from '@/components/overlays';
import { calendarMessage, ensureToken } from '@/features/calendar/calendar';

type EventAction = Extract<Action, { kind: 'add_event' }>;

/** "Opaad wants to…": nothing changes until the assistant approves. */
export function ActionCard({ message, execId, onApplied }: { message: ChatMessage; execId: string; onApplied: (ids: string[]) => void }) {
  const actions = message.actions ?? [];
  const [picked, setPicked] = useState<boolean[]>(() => actions.map(() => true));
  const [dismissed, setDismissed] = useState(message.actionState === 'dismissed');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const s = useApp();
  const applied = message.actionState === 'applied';
  const count = picked.filter(Boolean).length;
  const cal = calendarFor(s, execId);
  const calendarReady = !!cal?.canWrite && calendarAvailable();
  const eventNote = calendarReady ? `Adds to ${cal.name}` : cal ? `${cal.name} is view only, so this becomes a reminder` : 'No calendar connected, so this becomes a reminder';

  const approve = async () => {
    if (busy) return;
    const chosen = actions.filter((_, i) => picked[i]);
    const events = chosen.filter((a): a is EventAction => a.kind === 'add_event');
    let local: Action[] = chosen.filter((a) => a.kind !== 'add_event');
    const pushed: { calendarId: string; id: string }[] = [];
    let note = '';
    const target = calendarFor(getState(), execId);
    if (events.length && target?.canWrite && calendarAvailable()) {
      setBusy(true);
      try {
        await ensureToken();
        for (const ev of events) {
          const created = await createEvent(target.id, ev);
          pushed.push({ calendarId: target.id, id: created.id });
          setState((st) => addEventLocal(st, execId, created));
        }
      } catch (err) {
        const rest = events.slice(pushed.length);
        local = [...local, ...rest];
        note = `${calendarMessage(err)} Saved as ${rest.length > 1 ? 'reminders' : 'a reminder'} instead.`;
      } finally {
        setBusy(false);
      }
    } else {
      local = [...local, ...events];
    }
    let ids: string[] = [];
    setState((st) => {
      const r = applyActions(st, execId, local);
      ids = r.createdIds;
      return r.state;
    });
    onApplied(ids);
    const done = `${chosen.length} change${chosen.length > 1 ? 's' : ''} made${pushed.length ? `, ${pushed.length} on the calendar` : ''}`;
    toast(note || done, () => {
      setState((st) => removeItems(st, ids));
      for (const p of pushed) {
        setState((st) => removeEventLocal(st, execId, p.id));
        deleteEvent(p.calendarId, p.id).catch(() => toast("Couldn't remove the event. Delete it in Google Calendar."));
      }
    });
  };

  if (dismissed) return <p className="text-[13px] text-ink-2">Suggestions dismissed.</p>;

  return (
    <div className="w-full max-w-[96%] rounded-2xl border border-line bg-surface p-3">
      <p className="mb-2 text-xs font-semibold tracking-wider text-ink-2 uppercase">{applied ? 'Done' : 'Opaad wants to'}</p>
      <ul className="flex flex-col gap-2">
        {actions.map((a, i) => {
          const d = describeAction(a);
          return (
            <li key={i} className="flex flex-col gap-2 rounded-card border border-line-soft p-2.5">
              <label className="flex items-start gap-2.5">
                {!applied ? (
                  <input
                    type="checkbox"
                    checked={picked[i] ?? false}
                    onChange={() => setPicked((p) => p.map((v, j) => (j === i ? !v : v)))}
                    className="mt-0.5 size-5 shrink-0 accent-ink"
                    aria-label={`Include: ${d.label}`}
                  />
                ) : (
                  <Check size={18} className="mt-0.5 shrink-0" aria-hidden />
                )}
                <span className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-semibold text-ink-2">{d.label}</span>
                  <span className="text-[15px] leading-snug">{d.detail}</span>
                </span>
              </label>
              <Detail action={a} applied={applied} eventNote={eventNote} />
            </li>
          );
        })}
      </ul>
      {!applied && (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={!count || busy} onClick={() => void approve()} className="h-11 flex-1 rounded-card bg-lime text-[15px] font-semibold disabled:bg-disabled disabled:text-disabled-ink">
            {busy ? 'Adding to calendar…' : `Approve ${count > 1 ? `all ${count}` : ''}`}
          </button>
          <button type="button" onClick={() => setDismissed(true)} className="h-11 rounded-card border border-line px-4 text-[15px]">
            Not now
          </button>
        </div>
      )}
    </div>
  );
}

function Detail({ action, applied, eventNote }: { action: Action; applied: boolean; eventNote: string }) {
  const toast = useToast();
  if (action.kind === 'add_event') {
    return (
      <div className="flex flex-col gap-1 pl-7 text-sm text-ink-2">
        {action.notes && <p className="whitespace-pre-wrap">{action.notes}</p>}
        {!applied && <p className="text-[13px] text-ink-3">{eventNote}</p>}
      </div>
    );
  }
  if (action.kind === 'draft_message') {
    return (
      <div className="flex flex-col gap-2 pl-7">
        {action.subject && <p className="text-[13px] text-ink-2">Subject: {action.subject}</p>}
        <p className="rounded-field bg-subtle p-2.5 text-sm leading-relaxed whitespace-pre-wrap">{action.body}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={async () => toast((await copyText(action.body)) ? 'Copied' : 'Copy failed. Select the text instead.')} className="flex h-10 items-center gap-1.5 rounded-card border border-line px-3 text-sm">
            <Copy size={15} aria-hidden /> Copy
          </button>
          {action.channel === 'whatsapp' ? (
            <button type="button" onClick={() => void shareToWhatsApp(action.body)} className="h-10 rounded-card bg-whatsapp px-3 text-sm font-semibold">
              Open in WhatsApp
            </button>
          ) : (
            <button type="button" onClick={() => openEmail(action.subject ?? '', action.body)} className="flex h-10 items-center gap-1.5 rounded-card border border-line px-3 text-sm">
              <Mail size={15} aria-hidden /> Open in email
            </button>
          )}
        </div>
      </div>
    );
  }
  if (action.kind === 'plan_day') {
    return (
      <ol className="flex flex-col gap-1 pl-7 text-sm">
        {action.blocks.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="w-24 shrink-0 text-ink-2 tabular-nums">
              {b.start}–{b.end}
            </span>
            <span>{b.title}</span>
          </li>
        ))}
      </ol>
    );
  }
  if (action.kind === 'write_report') {
    return applied ? (
      <Link to="/report" className="pl-7 text-sm font-semibold underline">
        Open tonight's report
      </Link>
    ) : (
      <p className="line-clamp-4 pl-7 text-sm whitespace-pre-wrap text-ink-2">{action.text}</p>
    );
  }
  return null;
}

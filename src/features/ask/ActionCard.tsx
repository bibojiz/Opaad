import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Mail } from 'lucide-react';
import { setState } from '@/store/store';
import { applyActions, removeItems } from '@/store/logic';
import { describeAction } from '@/lib/agent';
import { copyText, openEmail, shareToWhatsApp } from '@/lib/device';
import type { Action, ChatMessage } from '@/lib/model';
import { useToast } from '@/components/overlays';

/** "Opaad wants to…": nothing changes until the assistant approves. */
export function ActionCard({ message, execId, onApplied }: { message: ChatMessage; execId: string; onApplied: (ids: string[]) => void }) {
  const actions = message.actions ?? [];
  const [picked, setPicked] = useState<boolean[]>(() => actions.map(() => true));
  const [dismissed, setDismissed] = useState(message.actionState === 'dismissed');
  const toast = useToast();
  const applied = message.actionState === 'applied';
  const count = picked.filter(Boolean).length;

  const approve = () => {
    const chosen = actions.filter((_, i) => picked[i]);
    let ids: string[] = [];
    setState((st) => {
      const r = applyActions(st, execId, chosen);
      ids = r.createdIds;
      return r.state;
    });
    onApplied(ids);
    toast(`${chosen.length} change${chosen.length > 1 ? 's' : ''} made`, () => setState((st) => removeItems(st, ids)));
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
              <Detail action={a} applied={applied} />
            </li>
          );
        })}
      </ul>
      {!applied && (
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={!count} onClick={approve} className="h-11 flex-1 rounded-card bg-lime text-[15px] font-semibold disabled:bg-disabled disabled:text-disabled-ink">
            Approve {count > 1 ? `all ${count}` : ''}
          </button>
          <button type="button" onClick={() => setDismissed(true)} className="h-11 rounded-card border border-line px-4 text-[15px]">
            Not now
          </button>
        </div>
      )}
    </div>
  );
}

function Detail({ action, applied }: { action: Action; applied: boolean }) {
  const toast = useToast();
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

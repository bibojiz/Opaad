import { Link } from 'react-router-dom';
import { AlertCircle, Clock, FileText, Sparkles, Ticket } from 'lucide-react';
import { setState, useApp } from '@/store/store';
import { activeExec } from '@/store/logic';
import { PageHeader } from '@/app/shell';
import { Empty } from '@/components/ui';
import { deriveAlerts, type AlertKind } from '@/lib/alerts';

const ICONS: Record<AlertKind, { I: typeof Clock; cls: string }> = {
  overdue: { I: AlertCircle, cls: 'bg-danger-soft text-danger-ink' },
  due: { I: Clock, cls: 'bg-[#FFF6DA]' },
  report: { I: FileText, cls: 'bg-lime' },
  learned: { I: Sparkles, cls: 'bg-subtle' },
  plan: { I: Ticket, cls: 'bg-subtle' },
};

export function Alerts() {
  const s = useApp();
  const exec = activeExec(s);
  const alerts = deriveAlerts(s, exec);
  const unread = alerts.filter((a) => !s.readAlerts.includes(a.id));
  const markAll = () => setState((st) => ({ ...st, readAlerts: Array.from(new Set([...st.readAlerts, ...alerts.map((a) => a.id)])).slice(-300) }));
  const markOne = (id: string) => setState((st) => (st.readAlerts.includes(id) ? st : { ...st, readAlerts: [...st.readAlerts, id].slice(-300) }));

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader title="Alerts" subtitle={unread.length ? `${unread.length} unread` : 'All caught up'}>
        <button type="button" onClick={markAll} aria-disabled={!unread.length} className={`h-10 rounded-field border border-line bg-surface px-3 text-sm ${unread.length ? '' : 'text-ink-3'}`}>
          Mark all read
        </button>
      </PageHeader>
      <main className="mx-auto w-full max-w-2xl flex-1 border-t border-line bg-surface px-4 pb-8 lg:rounded-card lg:border lg:px-6">
        {alerts.length ? (
          <ul>
            {alerts.map((a) => {
              const { I, cls } = ICONS[a.kind];
              const isUnread = !s.readAlerts.includes(a.id);
              return (
                <li key={a.id} className="border-b border-line-soft">
                  <Link to={a.href} onClick={() => markOne(a.id)} className="flex items-start gap-3 py-3.5">
                    <span aria-hidden className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${cls}`}><I size={17} /></span>
                    <span className="flex flex-1 flex-col gap-1">
                      <span className={`text-[15px] leading-snug ${isUnread ? 'font-semibold' : 'font-medium'} ${a.kind === 'overdue' ? 'text-danger-ink' : ''}`}>{a.title}</span>
                      <span className="text-sm leading-snug text-ink-2">{a.body}</span>
                    </span>
                    {isUnread && <span className="mt-2 size-2 shrink-0 rounded-full bg-ink"><span className="sr-only">Unread</span></span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="pt-5"><Empty title="Nothing needs you right now" body="Overdue items, reminders coming up and tonight's report show here." /></div>
        )}
        <p className="mt-6 rounded-card bg-subtle p-3 text-[13px] leading-relaxed text-ink-2">Opaad only alerts you about your own tasks and reports. It never reads {exec?.addressAs ?? 'your executive'}'s WhatsApp or email, and reads a calendar only if you connect one.</p>
      </main>
    </div>
  );
}

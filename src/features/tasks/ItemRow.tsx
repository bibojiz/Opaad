import { Link } from 'react-router-dom';
import { Check, ChevronRight, Paperclip } from 'lucide-react';
import type { Item } from '@/lib/model';
import { dueLabel, isOverdue } from '@/lib/dates';
import { setState } from '@/store/store';
import { toggleDone } from '@/store/logic';
import { useToast } from '@/components/overlays';

export function ItemRow({ item, fresh, compact }: { item: Item; fresh?: boolean; compact?: boolean }) {
  const toast = useToast();
  const late = !item.done && item.type !== 'note' && !!item.due && isOverdue(item.due);
  const meta = item.done
    ? "Done · in tonight's report"
    : [item.due ? (late ? `Overdue since ${dueLabel(item.due)}` : dueLabel(item.due)) : '', item.raiseWithExec ? 'To raise' : '', item.tag].filter(Boolean).join(' · ');
  const ring = late ? 'border-danger' : item.type === 'note' ? 'border-[#8FA33A]' : item.type === 'reminder' ? 'border-reminder' : 'border-ink';
  return (
    <li className={`relative flex items-start gap-2 border-b border-line-soft py-1.5 ${fresh ? 'anim-row-in' : ''}`}>
      {fresh && <span aria-hidden className="anim-flash pointer-events-none absolute inset-y-0 -right-4 -left-4 bg-lime" />}
      {item.type !== 'note' ? (
        <button
          type="button"
          aria-pressed={item.done}
          aria-label={`${item.done ? 'Mark not done' : 'Mark done'}: ${item.title}`}
          onClick={() => {
            setState((s) => toggleDone(s, item.id));
            if (!item.done) toast("Done. It's in tonight's report.", () => setState((s) => toggleDone(s, item.id)));
          }}
          className="relative -ml-2.5 flex size-11 shrink-0 items-center justify-center"
        >
          <span className={`flex size-5 items-center justify-center rounded-full border-[1.5px] ${item.done ? 'border-ink bg-lime' : ring}`}>{item.done && <Check size={11} strokeWidth={4} className="anim-pop" aria-hidden />}</span>
        </button>
      ) : (
        <span aria-hidden className="relative flex size-11 shrink-0 items-center justify-center -ml-2.5">
          <span className="size-2.5 rounded-sm bg-note" />
        </span>
      )}
      <Link to={`/tasks/${item.id}`} className="relative flex min-w-0 flex-1 flex-col gap-0.5 pt-2.5 pb-1">
        <span className={`text-base leading-snug ${item.done ? 'text-ink-3 line-through' : late ? 'text-danger' : ''}`}>{item.title}</span>
        {!compact && meta && <span className={`text-sm leading-snug ${late ? 'text-danger-ink' : 'text-ink-2'}`}>{meta}</span>}
      </Link>
      {item.evidence.length > 0 && (
        <span className="relative mt-3.5 flex items-center gap-0.5 text-xs text-ink-2" aria-label={`${item.evidence.length} attached`}>
          <Paperclip size={14} aria-hidden />
          {item.evidence.length}
        </span>
      )}
      <ChevronRight size={18} className="relative mt-3.5 shrink-0 text-ink-3" aria-hidden />
    </li>
  );
}

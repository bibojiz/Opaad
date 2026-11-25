import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

const MARK_PATH =
  'M12.0734 0.307585C14.9831 -0.309762 17.9993 0.00651104 20.7401 1.21741C23.481 2.42842 25.8237 4.47977 27.4719 7.11099C29.1201 9.74222 30 12.8358 30 16.0004H25.7745C25.8263 16.1124 25.8766 16.2253 25.9235 16.3399C26.55 17.8681 26.7138 19.55 26.3944 21.1724C26.0751 22.7948 25.2867 24.2854 24.1292 25.4551C22.9717 26.6248 21.4966 27.4208 19.8911 27.7435C18.2857 28.0662 16.6213 27.9007 15.109 27.2677C15.0723 27.2523 15.0365 27.2352 15.0001 27.2194V32C12.0334 32 9.13325 31.062 6.66652 29.3039C4.19981 27.5458 2.27686 25.047 1.14153 22.1234C0.0062357 19.1998 -0.290432 15.9825 0.288282 12.8789C0.867065 9.77512 2.29575 6.9239 4.39355 4.68623C6.49127 2.44866 9.16385 0.925 12.0734 0.307585ZM15.0001 16.0004V19.5409H18.2767V16.0004H15.0001Z';

export function OpaadMark({ size = 20, className = '', label }: { size?: number; className?: string; label?: string }) {
  return (
    <svg width={size * 0.94} height={size} viewBox="0 0 30 32" className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={MARK_PATH} fillRule="evenodd" clipRule="evenodd" fill="currentColor" />
    </svg>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'danger' | 'whatsapp';
const variants: Record<Variant, string> = {
  primary: 'bg-lime text-ink hover:brightness-95 disabled:bg-disabled disabled:text-disabled-ink',
  secondary: 'bg-surface text-ink border border-line hover:bg-subtle disabled:text-disabled-ink',
  ghost: 'bg-transparent text-ink-2 hover:bg-subtle',
  dark: 'bg-ink text-white hover:bg-ink/90',
  danger: 'bg-surface text-danger-ink border border-line hover:bg-danger-soft',
  whatsapp: 'bg-whatsapp text-ink hover:brightness-95',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'lg' | 'sm'; block?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', block, className = '', type = 'button', ...rest }, ref) {
  const sz = size === 'lg' ? 'h-13 px-5 text-base' : size === 'sm' ? 'h-10 px-3 text-sm' : 'h-12 px-4 text-[15px]';
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-card font-semibold transition-[filter,background-color] duration-150 ${sz} ${variants[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  );
});

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; round?: boolean; tone?: 'plain' | 'lime' | 'dark' }>(function IconButton(
  { label, round, tone = 'plain', className = '', type = 'button', children, ...rest },
  ref,
) {
  const toneCls = tone === 'lime' ? 'bg-lime border-transparent' : tone === 'dark' ? 'bg-ink text-white border-transparent' : 'bg-surface border-line hover:bg-subtle';
  return (
    <button ref={ref} type={type} aria-label={label} title={label} className={`inline-flex size-11 shrink-0 items-center justify-center border ${round ? 'rounded-full' : 'rounded-card'} ${toneCls} ${className}`} {...rest}>
      {children}
    </button>
  );
});

export function Chip({ on, onClick, children, className = '' }: { on: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`min-h-10 rounded-[10px] border px-3 py-2 text-left text-sm leading-tight ${on ? 'border-ink bg-ink font-semibold text-white' : 'border-line bg-surface text-ink hover:bg-subtle'} ${className}`}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-ink-2">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-card border border-dashed border-line p-4">
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="text-sm leading-relaxed text-ink-2">{body}</p>
      {action}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      <span>
        {label} {hint && <span className="font-normal text-ink-2">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputCls = 'h-13 w-full rounded-field border border-line bg-surface px-3.5 text-base text-ink outline-none focus:border-ink';

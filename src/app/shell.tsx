import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bell, ChevronDown, FileText, Home, ListChecks, Menu, Settings as Cog, UserRound, X } from 'lucide-react';
import { OpaadMark } from '@/components/ui';
import { useApp } from '@/store/store';
import { activeExec, aiRequestsLeft } from '@/store/logic';
import { deriveAlerts } from '@/lib/alerts';
import { FREE_AI_REQUESTS } from '@/lib/model';

type AskOpts = { prompt?: string; send?: boolean };
type Shell = { navOpen: boolean; setNavOpen: (v: boolean) => void; collapsed: boolean; toggleCollapsed: () => void; openAsk: (o?: AskOpts) => void };
const ShellCtx = createContext<Shell | null>(null);
export function useShell(): Shell {
  const c = useContext(ShellCtx);
  if (!c) throw new Error('useShell outside provider');
  return c;
}

export function ShellProvider({ children, openAsk }: { children: ReactNode; openAsk: (o?: AskOpts) => void }) {
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('opaad:rail') === '1');
  const loc = useLocation();
  useEffect(() => setNavOpen(false), [loc.pathname]);
  const value = useMemo<Shell>(
    () => ({
      navOpen,
      setNavOpen,
      collapsed,
      toggleCollapsed: () =>
        setCollapsed((c) => {
          localStorage.setItem('opaad:rail', c ? '0' : '1');
          return !c;
        }),
      openAsk,
    }),
    [navOpen, collapsed, openAsk],
  );
  return <ShellCtx.Provider value={value}>{children}</ShellCtx.Provider>;
}

function useNavItems() {
  const s = useApp();
  const exec = activeExec(s);
  const alerts = deriveAlerts(s, exec).filter((a) => !s.readAlerts.includes(a.id)).length;
  const openTasks = s.items.filter((i) => i.execId === exec?.id && !i.done && i.type !== 'note').length;
  return [
    { to: '/', label: 'Today', icon: Home, meta: '' },
    { to: '/tasks', label: 'Tasks', icon: ListChecks, meta: openTasks ? String(openTasks) : '' },
    { to: '/report', label: 'Report', icon: FileText, meta: '' },
    { to: '/alerts', label: 'Alerts', icon: Bell, meta: alerts ? String(alerts) : '', strong: true },
    { to: '/executive', label: 'Executive', icon: UserRound, meta: '' },
    { to: '/settings', label: 'Settings', icon: Cog, meta: '' },
  ];
}

function NavList({ rail, onNavigate }: { rail?: boolean; onNavigate?: () => void }) {
  const items = useNavItems();
  return (
    <ul className="flex flex-col gap-1">
      {items.map((it, i) => (
        <li key={it.to} style={{ ['--i' as string]: i }}>
          <NavLink
            to={it.to}
            end={it.to === '/'}
            onClick={onNavigate}
            title={rail ? it.label : undefined}
            className={({ isActive }) => `flex h-12 items-center gap-3 rounded-card px-3 text-base ${rail ? 'justify-center' : ''} ${isActive ? 'bg-subtle font-semibold' : 'font-medium hover:bg-subtle'}`}
          >
            <it.icon size={22} strokeWidth={1.7} aria-hidden />
            {!rail && <span className="flex-1">{it.label}</span>}
            {!rail && it.meta && <span className={`min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-semibold ${it.strong ? 'bg-ink text-white' : 'bg-disabled text-ink'}`}>{it.meta}</span>}
            {rail && <span className="sr-only">{it.label}</span>}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

function SidebarBody({ rail, onClose }: { rail?: boolean; onClose?: () => void }) {
  const s = useApp();
  const exec = activeExec(s);
  const left = aiRequestsLeft(s, FREE_AI_REQUESTS);
  const initials = (exec?.name ?? '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="flex h-full flex-col gap-4">
      <div className={`flex items-center gap-2.5 px-1 ${rail ? 'justify-center' : ''}`}>
        <OpaadMark size={22} label="Opaad" />
        {!rail && <span className="flex-1 font-display text-[22px] leading-none tracking-[-1px]">Opaad</span>}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close menu" className="flex size-11 items-center justify-center rounded-card border border-line">
            <X size={18} aria-hidden />
          </button>
        )}
      </div>
      {exec && !rail && (
        <NavLink to="/executive" onClick={onClose} className="flex items-center gap-2.5 rounded-card border border-line p-2.5 hover:bg-subtle">
          <span aria-hidden className="flex size-9 items-center justify-center rounded-[10px] bg-ink text-xs font-bold text-white">{initials}</span>
          <span className="flex flex-1 flex-col">
            <span className="text-[15px] font-semibold">{exec.addressAs}</span>
            <span className="text-[13px] text-ink-2">{s.executives.length > 1 ? 'Switch executive' : 'Add another executive'}</span>
          </span>
          <ChevronDown size={16} className="text-ink-2" aria-hidden />
        </NavLink>
      )}
      <NavList rail={rail} onNavigate={onClose} />
      <div className="flex-1" />
      {!rail && left !== Infinity && (
        <div className="flex flex-col gap-2 rounded-card border border-line bg-subtle p-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold">Free plan</span>
            <span className="text-[13px] text-ink-2">
              {left} of {FREE_AI_REQUESTS} AI requests left
            </span>
          </div>
          <div aria-hidden className="h-1.5 overflow-hidden rounded-full border border-line bg-surface">
            <div className="h-full bg-ink" style={{ width: `${(left / FREE_AI_REQUESTS) * 100}%` }} />
          </div>
        </div>
      )}
      {!rail && (
        <div className="flex items-center gap-2.5 px-1">
          <span aria-hidden className="flex size-8 items-center justify-center rounded-full border border-ink bg-lime text-[13px] font-bold">{(s.profile.name[0] ?? 'Y').toUpperCase()}</span>
          <span className="flex flex-col">
            <span className="text-sm font-semibold">{s.profile.name || 'You'}</span>
            <span className="text-xs text-ink-2">{s.profile.role}</span>
          </span>
        </div>
      )}
    </div>
  );
}

/** Persistent sidebar on desktop; slide-out drawer on phones. */
export function Sidebar() {
  const { navOpen, setNavOpen, collapsed } = useShell();
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen, setNavOpen]);
  return (
    <>
      <aside aria-label="Main menu" className={`sticky top-0 hidden h-dvh shrink-0 border-r border-line bg-surface px-3 py-4 lg:block ${collapsed ? 'w-[76px]' : 'w-[264px]'}`}>
        <SidebarBody rail={collapsed} />
      </aside>
      <div className="lg:hidden">
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => setNavOpen(false)}
          className={`fixed inset-0 z-40 bg-ink/40 ${navOpen ? 't-std visible opacity-100' : 't-out invisible opacity-0'}`}
        />
        <nav
          aria-label="Main menu"
          className={`fixed inset-y-0 left-0 z-50 w-[300px] max-w-[85vw] border-r border-line bg-surface px-3 pt-4 pb-5 ${navOpen ? 't-large visible translate-x-0' : 't-large-out invisible -translate-x-full'}`}
        >
          <SidebarBody onClose={() => setNavOpen(false)} />
        </nav>
      </div>
    </>
  );
}

export function PageHeader({ title, subtitle, children, display }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode; display?: boolean }) {
  const { setNavOpen, toggleCollapsed, collapsed, openAsk } = useShell();
  return (
    <header className="flex items-center gap-2 px-4 pt-4 pb-3 lg:px-8 lg:pt-6">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => (window.matchMedia('(min-width: 1024px)').matches ? toggleCollapsed() : setNavOpen(true))}
        aria-expanded={collapsed ? false : undefined}
        className="flex size-11 shrink-0 items-center justify-center rounded-card border border-line bg-surface hover:bg-subtle"
      >
        <Menu size={20} strokeWidth={1.8} aria-hidden />
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pl-1">
        {display ? title : <h1 className="truncate font-display text-2xl leading-none tracking-[-1.5px]">{title}</h1>}
        {subtitle && <span className="truncate text-sm text-ink-2">{subtitle}</span>}
      </div>
      {children}
      <button type="button" onClick={() => openAsk()} aria-label="Ask Opaad" aria-haspopup="dialog" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lime hover:brightness-95">
        <OpaadMark size={20} />
      </button>
    </header>
  );
}

export function AlertsBell() {
  const s = useApp();
  const exec = activeExec(s);
  const unread = deriveAlerts(s, exec).filter((a) => !s.readAlerts.includes(a.id)).length;
  return (
    <NavLink to="/alerts" aria-label={unread ? `Alerts, ${unread} unread` : 'Alerts'} className="relative flex size-11 items-center justify-center rounded-card hover:bg-subtle">
      <Bell size={22} strokeWidth={1.6} aria-hidden />
      {unread > 0 && <span aria-hidden className="absolute top-2.5 right-2.5 size-2 rounded-full bg-danger" />}
    </NavLink>
  );
}

import { lazy, Suspense, useCallback, useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { createBrowserRouter, createMemoryRouter, Navigate, Outlet, RouterProvider, useLocation } from 'react-router-dom';
import { getState, setState, useApp } from '@/store/store';
import { updateItem } from '@/store/logic';
import { ToastProvider, useToast } from '@/components/overlays';
import { ShellProvider, Sidebar, useShell } from './shell';
import { AskPanel } from '@/features/ask/AskPanel';
import { Today } from '@/features/today/Today';
import { Tasks } from '@/features/tasks/Tasks';
import { notify } from '@/lib/device';
import { parseLocal } from '@/lib/dates';
import { IN_PREVIEW } from '@/lib/env';
import { AUTH_ON, DIRECT_ACCESS } from '@/lib/supabase';
import { useSession } from '@/features/auth/session';
import { SignIn } from '@/features/auth/SignIn';

type AskState = { open: boolean; initial?: { prompt?: string; send?: boolean; n: number } };

/** With accounts on, nothing past here renders until the person is signed in and their workspace is loaded. */
function useAuthGate(): ReactElement | null {
  const session = useSession();
  if (!AUTH_ON && !DIRECT_ACCESS) return null;
  if (session.status === 'out') return <Navigate to="/signin" replace />;
  if (session.status !== 'in') return <SignIn />;
  return null;
}

function Layout() {
  const gate = useAuthGate();
  const s = useApp();
  const loc = useLocation();
  const [ask, setAsk] = useState<AskState>({ open: false });

  const openAsk = useCallback((o?: { prompt?: string; send?: boolean }) => {
    setAsk({ open: true, initial: { ...o, n: Date.now() } });
    if (!IN_PREVIEW) window.history.pushState({ ...window.history.state, opaadAsk: true }, '');
  }, []);
  const closeAsk = useCallback(() => {
    if (!IN_PREVIEW && window.history.state?.opaadAsk) window.history.back();
    else setAsk((a) => ({ ...a, open: false }));
  }, []);

  useEffect(() => {
    const onPop = () => setAsk((a) => (a.open ? { ...a, open: false } : a));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => setAsk((a) => (a.open ? { ...a, open: false } : a)), [loc.pathname]);

  if (gate) return gate;
  if (!s.profile.onboarded || !s.executives.length) return <Navigate to="/welcome" replace />;
  return (
    <ShellProvider openAsk={openAsk}>
      <Frame />
      <AskPanel open={ask.open} onClose={closeAsk} initial={ask.initial} />
      <ReminderWatcher />
    </ShellProvider>
  );
}

function Frame() {
  const { collapsed } = useShell();
  return (
    <div className="flex min-h-dvh" style={{ '--sidebar-w': collapsed ? '76px' : '264px' } as CSSProperties}>
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

/** Fires reminders on this device: at the time for reminders, 15 minutes before for to-dos. */
function ReminderWatcher() {
  const toast = useToast();
  useEffect(() => {
    const tick = () => {
      const st = getState();
      const now = Date.now();
      for (const i of st.items) {
        if (i.done || i.notified || i.type === 'note' || !i.due) continue;
        const d = parseLocal(i.due);
        if (!d) continue;
        const fireAt = i.type === 'reminder' ? d.getTime() : d.getTime() - 15 * 60_000;
        if (fireAt <= now && now - d.getTime() < 6 * 3600_000) {
          const title = i.type === 'reminder' ? `Reminder: ${i.title}` : `Due in 15 minutes: ${i.title}`;
          void notify(title, 'Open Opaad to mark it done or move it.', i.id);
          toast(title);
          setState((x) => updateItem(x, i.id, { notified: true }));
        }
      }
    };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [toast]);
  return null;
}

const Onboarding = lazy(() => import('@/features/onboarding/Onboarding').then((m) => ({ default: m.Onboarding })));

function OnboardingGate() {
  const gate = useAuthGate();
  const s = useApp();
  if (gate) return gate;
  if (s.profile.onboarded && s.executives.length) return <Navigate to="/" replace />;
  return (
    <Suspense fallback={null}>
      <Onboarding />
    </Suspense>
  );
}

const AdminPage = lazy(() => import('@/features/admin/Admin').then((m) => ({ default: m.Admin })));

function AdminGate() {
  const gate = useAuthGate();
  if (!AUTH_ON) return <Navigate to="/" replace />;
  if (gate) return gate;
  return (
    <Suspense fallback={null}>
      <AdminPage />
    </Suspense>
  );
}

const routes = [
  { path: '/signin', element: <SignIn /> },
  { path: '/admin', element: <AdminGate /> },
  { path: '/welcome', element: <OnboardingGate /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Today /> },
      { path: 'tasks', element: <Tasks /> },
      { path: 'tasks/:id', lazy: async () => ({ Component: (await import('@/features/tasks/TaskDetail')).TaskDetail }) },
      { path: 'report', lazy: async () => ({ Component: (await import('@/features/report/Report')).Report }) },
      { path: 'executive', lazy: async () => ({ Component: (await import('@/features/executive/Executive')).ExecutivePage }) },
      { path: 'alerts', lazy: async () => ({ Component: (await import('@/features/alerts/Alerts')).Alerts }) },
      { path: 'settings', lazy: async () => ({ Component: (await import('@/features/settings/Settings')).Settings }) },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
];
const router = IN_PREVIEW ? createMemoryRouter(routes) : createBrowserRouter(routes);

export function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}

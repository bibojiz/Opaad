import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './app/App';
import { loadState } from './store/store';
import { IN_PREVIEW } from './lib/env';
import { initSession } from './features/auth/session';

async function start() {
  await loadState();
  initSession();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  if (!IN_PREVIEW && 'serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    });
  }
}

void start();

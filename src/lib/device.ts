import { useEffect, useRef, useState } from 'react';
import { IN_PREVIEW } from './env';

/* ---------- Sharing: the assistant sends; Opaad only hands over the text and files ---------- */

export async function shareToWhatsApp(text: string, files: File[] = []): Promise<'shared' | 'opened' | 'cancelled'> {
  if (!IN_PREVIEW && files.length && typeof navigator.canShare === 'function' && navigator.canShare({ files })) {
    try {
      await navigator.share({ text, files });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  openLink(`https://wa.me/?text=${encodeURIComponent(text)}`);
  return 'opened';
}

export function openEmail(subject: string, body: string): void {
  openLink(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
}

function openLink(href: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ---------- Notifications for reminders (while Opaad is open or installed) ---------- */

export function notificationSupport(): 'default' | 'granted' | 'denied' | 'unsupported' {
  if (IN_PREVIEW || typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotifications(): Promise<'default' | 'granted' | 'denied' | 'unsupported'> {
  if (notificationSupport() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationSupport();
  }
}

export async function notify(title: string, body: string, tag: string): Promise<void> {
  if (notificationSupport() !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, tag, icon: '/icon-192.png', badge: '/icon-192.png' });
    else new Notification(title, { body, tag, icon: '/icon-192.png' });
  } catch {
    /* notification blocked by the browser */
  }
}

/* ---------- Voice input (Web Speech API where the browser has it) ---------- */

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognition(): (new () => Recognition) | undefined {
  if (IN_PREVIEW || typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function useVoice(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const supported = !!getRecognition();
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => () => rec.current?.stop(), []);

  const toggle = () => {
    const R = getRecognition();
    if (!R) return;
    if (listening) {
      rec.current?.stop();
      return;
    }
    const r = new R();
    r.lang = navigator.language || 'en-GB';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? '')
        .join(' ')
        .trim();
      cb.current(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return { supported, listening, toggle };
}

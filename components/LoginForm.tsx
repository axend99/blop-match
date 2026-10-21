'use client';

import { useEffect, useRef, useState } from 'react';
import type { Lang } from '@/lib/i18n';
import type { Dict } from '@/lib/i18n/en';
import { createClient } from '@/lib/supabase/client';

// Google's own "Sign in with Google" button (Google Identity Services) on our domain, so the
// Google window shows blop-match.vercel.app instead of the Supabase project address. Used only
// on the production origin (the only JavaScript origin allowed in Google Cloud); elsewhere,
// or if the script fails to load, the redirect button below is kept.
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');

type GoogleId = {
  initialize: (config: Record<string, unknown>) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('gsi'));
    document.head.appendChild(script);
  });
}

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'invalid' | 'googleError';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginForm({ t, lang }: { t: Dict['login']; lang: Lang }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [googleBusy, setGoogleBusy] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const [inApp, setInApp] = useState(false);
  const gisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInApp(/Instagram|FBAN|FBAV|WhatsApp/i.test(navigator.userAgent));
    if (!GOOGLE_CLIENT_ID || window.location.origin !== SITE_URL) return;
    let cancelled = false;

    // A fresh nonce for every attempt: Google signs its hash, Supabase checks the original.
    async function setup() {
      const nonce = crypto.randomUUID();
      window.google!.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        nonce: await sha256Hex(nonce),
        callback: async ({ credential }: { credential: string }) => {
          setGoogleBusy(true);
          const { error } = await createClient()
            .auth.signInWithIdToken({ provider: 'google', token: credential, nonce })
            .catch((err: unknown) => ({ error: err }));
          if (error) {
            setGoogleBusy(false);
            setStatus('googleError');
            setup();
          } else {
            window.location.assign('/auth/continue');
          }
        },
      });
      if (cancelled || !gisRef.current) return;
      window.google!.accounts.id.renderButton(gisRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: Math.min(gisRef.current.offsetWidth || 320, 400),
        locale: lang === 'pt' ? 'pt-PT' : 'en',
      });
      setGisReady(true);
    }

    loadGoogleScript()
      .then(() => {
        if (!cancelled) setup();
      })
      .catch(() => {}); // keep the redirect button
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const callbackUrl = () => `${window.location.origin}/auth/callback`;

  async function signInWithGoogle() {
    setGoogleBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl() },
    });
    if (error) {
      setGoogleBusy(false);
      setStatus('googleError');
    }
  }

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setStatus('invalid');
      return;
    }
    setStatus('sending');
    const { error } = await createClient().auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: callbackUrl() },
    });
    setStatus(error ? 'error' : 'sent');
  }

  if (status === 'sent') {
    return (
      <div className="space-y-4 rounded-3xl bg-white p-6 text-center">
        <h2 className="text-xl font-semibold">{t.sentTitle}</h2>
        <p className="text-midnight/70">{t.sentBody}</p>
        <button type="button" onClick={() => setStatus('idle')} className="text-sm font-medium text-violet underline">
          {t.useAnotherEmail}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {inApp && <p className="rounded-2xl bg-lime/40 p-4 text-sm">{t.inAppHint}</p>}
      <div ref={gisRef} className={gisReady ? 'flex min-h-11 justify-center' : 'h-0 overflow-hidden'} />
      <button
        type="button"
        hidden={gisReady}
        onClick={signInWithGoogle}
        disabled={googleBusy}
        className="flex w-full items-center justify-center gap-3 rounded-full border border-midnight/15 bg-white px-6 py-4 text-lg font-semibold disabled:opacity-60"
      >
        <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {t.google}
      </button>
      {status === 'googleError' && (
        <p role="alert" className="text-sm text-red-700">
          {t.googleError}
        </p>
      )}

      <div className="flex items-center gap-3 text-sm text-midnight/50">
        <span className="h-px flex-1 bg-midnight/15" />
        {t.or}
        <span className="h-px flex-1 bg-midnight/15" />
      </div>

      <form onSubmit={sendLink} noValidate className="space-y-3">
        <label htmlFor="email" className="block font-medium">
          {t.emailLabel}
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          aria-invalid={status === 'invalid'}
          className="w-full rounded-2xl border border-midnight/15 bg-white px-4 py-3 text-lg outline-none focus:border-violet focus:ring-2 focus:ring-violet/30"
        />
        {(status === 'invalid' || status === 'error') && (
          <p role="alert" className="text-sm text-red-700">
            {status === 'invalid' ? t.invalidEmail : t.sendError}
          </p>
        )}
        <button
          type="submit"
          disabled={status === 'sending'}
          className="w-full rounded-full bg-violet px-6 py-4 text-lg font-semibold text-white disabled:opacity-60"
        >
          {status === 'sending' ? t.sending : t.emailSubmit}
        </button>
      </form>
    </div>
  );
}

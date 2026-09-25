'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { applySessionToApp, extendSession, getSession } from '@/lib/auth/api';
import { useTranslation } from '@/lib/i18n';
import { isSessionValid, useAuthStore } from '@/lib/stores/auth';

const currentPath = () => `${window.location.pathname}${window.location.search}`;

/**
 * AUTH-26 route guard for every application route. Nothing inside the shell — not even the demo
 * data bootstrap — renders until a valid session exists; without one the user goes to /login with
 * the current path as a (validated) returnTo. Losing the session later (sign-out in another tab,
 * revocation) sends the user back to sign in as well.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace(`/login?returnTo=${encodeURIComponent(currentPath())}`);
      return;
    }
    applySessionToApp(s);
    setOk(true);
    // Session cleared or revoked elsewhere → leave the app.
    return useAuthStore.subscribe((st) => {
      if (!st.session) router.replace(`/login?returnTo=${encodeURIComponent(currentPath())}`);
      else if (st.revoked.includes(st.session.sessionId)) router.replace('/auth/logout?reason=revoked');
    });
  }, [router]);

  if (!ok) {
    return (
      <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center text-sm text-muted">
        {t('auth.loading.session')}
      </div>
    );
  }
  return <>{children}</>;
}

const WARN_MS = 2 * 60_000;

/** AUTH-06.2/06.3 — expiry warning with "Stay signed in", then an expired dialog with "Sign in again". */
export function SessionTimer() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const revoked = useAuthStore((s) => s.revoked);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, []);

  if (!session) return null;
  const left = new Date(session.sessionExpiry).getTime() - now;
  const expired = !isSessionValid(session, revoked, now);
  const warning = !expired && left <= WARN_MS;
  const mins = Math.max(0, Math.floor(left / 60_000));
  const secs = Math.max(0, Math.floor((left % 60_000) / 1000));
  const signInAgain = () => router.replace(`/auth/logout?reason=expired&returnTo=${encodeURIComponent(pathname)}`);

  return (
    <>
      <Dialog open={warning} onClose={() => extendSession()} title={t('auth.session.warningTitle')}>
        <p className="text-body-sm text-muted">{t('auth.session.warningBody', { time: `${mins}:${String(secs).padStart(2, '0')}` })}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => router.replace('/auth/logout')}>{t('auth.session.signOut')}</Button>
          <Button onClick={() => extendSession()}>{t('auth.session.stay')}</Button>
        </div>
      </Dialog>
      <Dialog open={expired} onClose={signInAgain} title={t('auth.session.expiredTitle')}>
        <p className="text-body-sm text-muted">{t('auth.session.expiredBody')}</p>
        <div className="mt-5 flex justify-end">
          <Button onClick={signInAgain}>{t('auth.session.signInAgain')}</Button>
        </div>
      </Dialog>
    </>
  );
}

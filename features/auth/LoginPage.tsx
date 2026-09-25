'use client';

import { Building2, ChevronRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { discover, getSession, isValidWorkEmail, normalizeEmail, startSso, type DiscoveryResult, type PublicOrg } from '@/lib/auth/api';
import { safeReturnTo } from '@/lib/auth/redirect';
import { useTranslation } from '@/lib/i18n';
import { AuthCard, AuthLoading, AuthPage, AuthSupportLink, Notice, SecurityNote, SSOButton, WorkEmailField } from './components';

type Phase = 'idle' | 'searching' | 'resolved' | 'multiple' | 'unknown' | 'not_configured' | 'redirecting';

/**
 * AUTH-01/02/03/04 — SSO-first sign-in. Work email → organization discovery → identity provider.
 * No password field: authentication and MFA belong to the organization's IdP.
 */
export function LoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const sp = useSearchParams();
  // AUTH-01: only safe internal paths survive; anything else falls back to Overview.
  const returnTo = safeReturnTo(sp.get('returnTo'));
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<DiscoveryResult | null>(null);

  // Authenticated users never see /login — send them to their destination.
  useEffect(() => {
    if (getSession()) router.replace(returnTo);
    else setChecked(true);
  }, [router, returnTo]);

  const goSso = async (org: PublicOrg) => {
    setPhase('redirecting');
    router.push(await startSso({ email, orgHandle: org.handle, returnTo }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = normalizeEmail(email);
    if (!value) { setError(t('auth.login.emailRequired')); return; }
    if (!isValidWorkEmail(value)) { setError(t('auth.login.emailError')); return; }
    setError(undefined);
    setEmail(value);
    setPhase('searching');
    const r = await discover(value);
    setResult(r);
    if (r.kind === 'resolved') { setPhase('resolved'); return; }
    setPhase(r.kind);
  };

  const reset = () => { setPhase('idle'); setResult(null); };

  if (!checked) return <AuthLoading label={t('auth.loading.session')} />;
  if (phase === 'redirecting') return <AuthLoading label={t('auth.loading.redirecting')} />;

  const notice = sp.get('signedOut') ? <Notice tone="info">{t('auth.login.signedOut')}</Notice>
    : sp.get('expired') ? <Notice tone="warn">{t('auth.login.expired')}</Notice>
      : sp.get('revoked') ? <Notice tone="warn">{t('auth.login.revoked')}</Notice> : null;

  return (
    <AuthPage footer={<AuthSupportLink />}>
      {phase === 'resolved' && result?.kind === 'resolved' ? (
        // AUTH-03.2 organization found
        <AuthCard title={result.organization.name} description={t('auth.login.orgFound')}>
          <p className="flex items-center gap-2 rounded-input border border-line px-4 py-3 text-body-sm text-muted">
            <Building2 aria-hidden className="size-4 shrink-0" />
            <span className="min-w-0 truncate"><span className="font-medium text-fg">{email}</span> · {t('auth.login.providerVia', { provider: result.organization.provider })}</span>
          </p>
          <SSOButton type="button" onClick={() => void goSso(result.organization)} />
          <Button variant="ghost" onClick={reset}>{t('auth.login.useDifferent')}</Button>
          <SecurityNote />
        </AuthCard>
      ) : phase === 'multiple' && result?.kind === 'multiple' ? (
        <AuthCard title={t('auth.login.multipleTitle')} description={t('auth.login.multipleBody')}>
          <ul className="flex flex-col gap-2">
            {result.organizations.map((o) => (
              <li key={o.handle}>
                <button type="button" onClick={() => void goSso(o)}
                  className="flex w-full items-center gap-3 rounded-input border border-line-strong px-4 py-3 text-left transition-colors duration-fast hover:bg-subtle">
                  <Building2 aria-hidden className="size-5 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label font-semibold text-fg">{o.name}</span>
                    <span className="block truncate text-caption text-faint">{t('auth.login.providerVia', { provider: o.provider })}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 text-muted" />
                </button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" onClick={reset}>{t('auth.login.back')}</Button>
        </AuthCard>
      ) : (
        <AuthCard title={t('auth.login.title')} description={t('auth.login.description')}>
          {notice}
          {phase === 'unknown' && <Notice tone="error">{t('auth.login.unknownTitle')} {t('auth.login.unknownBody')}</Notice>}
          {phase === 'not_configured' && result?.kind === 'not_configured' && (
            <Notice tone="error">{t('auth.login.notConfiguredTitle')} {t('auth.login.notConfiguredBody', { org: result.organizationName })}</Notice>
          )}
          <form noValidate onSubmit={(e) => void submit(e)} className="flex flex-col gap-4">
            <WorkEmailField value={email} onChange={(v) => { setEmail(v); setError(undefined); if (phase !== 'idle' && phase !== 'searching') reset(); }}
              error={error} disabled={phase === 'searching'} autoFocus />
            <SSOButton loading={phase === 'searching'}>{phase === 'searching' ? t('auth.loading.checkingOrg') : undefined}</SSOButton>
          </form>
          <SecurityNote />
          {process.env.NODE_ENV !== 'production' && <p className="text-caption text-faint">{t('auth.login.demoHint')}</p>}
        </AuthCard>
      )}
    </AuthPage>
  );
}

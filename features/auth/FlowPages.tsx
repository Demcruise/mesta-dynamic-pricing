'use client';

import { ArrowRight, Check, Fingerprint } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Pill } from '@/components/ds/Pill';
import { Button } from '@/components/ui/button';
import {
  getSession, getWorkspaces, handleCallback, idpContext, idpIssueCode, logout, switchWorkspace, workspaceLabel,
  type AuthErrorReason, type WorkspaceOption,
} from '@/lib/auth/api';
import { useTranslation } from '@/lib/i18n';
import { useToastStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { AuthCard, AuthLoading, AuthPage, AuthSupportLink, Notice } from './components';

/**
 * Demo identity provider (AUTH-04). Stands in for the organization's IdP in this frontend-only
 * build: shows the account and a simulated MFA approval, then returns a signed, nonce-bound code to
 * /auth/callback. Deliberately generic — it never imitates a real provider's sign-in page.
 */
export function IdpPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const sp = useSearchParams();
  const state = sp.get('state');
  const nonce = sp.get('nonce');
  const email = sp.get('login_hint') ?? '';
  const [busy, setBusy] = useState(false);
  const ctx = state ? idpContext(state) : null;
  if (!state || !nonce || !ctx || !email) {
    return <AuthPage><AuthCard title={t('auth.error.title')} tone="error" description={t('auth.idp.invalid')} /></AuthPage>;
  }
  const back = (q: Record<string, string>) => router.replace(`/auth/callback?${new URLSearchParams({ state, ...q })}`);
  return (
    <AuthPage>
      <AuthCard title={ctx.organization} description={<Pill tone="warn">{t('auth.idp.badge')}</Pill>}>
        <p className="text-body-sm text-muted">{t('auth.idp.explain', { provider: ctx.provider })}</p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-input border border-line px-4 py-3 text-body-sm">
          <dt className="text-muted">{t('auth.idp.account')}</dt><dd className="truncate font-medium text-fg">{email}</dd>
          <dt className="text-muted">{t('auth.idp.organization')}</dt><dd className="truncate text-fg">{ctx.organization}</dd>
        </dl>
        <div className="flex items-start gap-3 rounded-input bg-subtle px-4 py-3">
          <Fingerprint aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
          <div>
            <p className="text-label font-semibold text-fg">{t('auth.idp.mfa')}</p>
            <p className="text-caption text-muted">{t('auth.idp.mfaBody')}</p>
          </div>
        </div>
        <Button className="h-control-lg w-full" loading={busy} onClick={() => { setBusy(true); back({ code: idpIssueCode({ email, orgId: ctx.orgId, nonce }) }); }}>
          <Check className="size-4" aria-hidden />{t('auth.idp.approve')}
        </Button>
        <div className="flex justify-between gap-2">
          <Button variant="ghost" onClick={() => back({ error: 'access_denied' })}>{t('auth.idp.deny')}</Button>
          <Button variant="ghost" onClick={() => back({ error: 'temporarily_unavailable' })}>{t('auth.idp.outage')}</Button>
        </div>
      </AuthCard>
    </AuthPage>
  );
}

/** AUTH-05 — validate the response, establish the session, resolve workspace, redirect. */
export function CallbackPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const sp = useSearchParams();
  const ran = useRef(false);
  const [label, setLabel] = useState(t('auth.loading.verifying'));
  useEffect(() => {
    if (ran.current) return; // the code is single-use; never process it twice
    ran.current = true;
    void handleCallback({ state: sp.get('state'), code: sp.get('code'), error: sp.get('error') }).then((r) => {
      if (r.kind === 'error') router.replace(`/auth/error?reason=${r.reason}`);
      else if (r.kind === 'select_workspace') router.replace('/workspaces');
      else { setLabel(t('auth.loading.workspace')); router.replace(r.returnTo); }
    });
  }, [router, sp, t]);
  return <AuthLoading label={label} />;
}

const REASONS: AuthErrorReason[] = ['invalid_response', 'provider_unavailable', 'account_disabled', 'not_configured', 'not_provisioned', 'session_failed'];

/** AUTH-12 — one reusable error surface; copy only, never provider codes, tenant ids or traces. */
export function AuthErrorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const sp = useSearchParams();
  const reason = REASONS.find((r) => r === sp.get('reason')) ?? 'invalid_response';
  return (
    <AuthPage footer={<AuthSupportLink />}>
      <AuthCard title={t('auth.error.title')} tone="error" description={t(`auth.error.${reason}`)}>
        <Button className="h-control-lg w-full" onClick={() => router.replace('/login')}>{t('auth.error.tryAgain')}</Button>
        <p className="text-caption text-muted">{t('auth.error.contact')}</p>
      </AuthCard>
    </AuthPage>
  );
}

/** AUTH-14 — terminate the Mesta session (IdP logout would follow here), then back to /login. */
export function LogoutPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const sp = useSearchParams();
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const reason = sp.get('reason') === 'expired' ? 'expired' : sp.get('reason') === 'revoked' ? 'revoked' : 'user';
    logout(reason);
    const q = reason === 'expired' ? `expired=1${sp.get('returnTo') ? `&returnTo=${encodeURIComponent(sp.get('returnTo')!)}` : ''}` : reason === 'revoked' ? 'revoked=1' : 'signedOut=1';
    router.replace(`/login?${q}`);
  }, [router, sp]);
  return <AuthLoading label={t('auth.loading.signingOut')} />;
}

/** AUTH-07.2 / AUTH-15 — workspace selection after sign-in, and switching from the profile menu. */
export function WorkspacesPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToastStore((s) => s.push);
  const [data, setData] = useState<{ options: WorkspaceOption[]; returnTo: string } | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const switching = !!getSession();

  useEffect(() => {
    void getWorkspaces().then((d) => {
      if (!d) { router.replace('/login'); return; }
      setData(d);
    });
  }, [router]);

  if (data === undefined || data === null) return <AuthLoading label={t('auth.loading.session')} />;
  if (busy) return <AuthLoading label={t('auth.loading.workspace')} />;

  const pick = async (id: string) => {
    setBusy(id);
    const ok = await switchWorkspace(id);
    if (!ok) { router.replace('/auth/error?reason=session_failed'); return; }
    if (switching) toast(t('auth.workspaces.switched', { workspace: workspaceLabel(id) }));
    // Switching invalidates workspace-specific state: land on Overview rather than a stale deep route.
    router.replace(switching ? '/overview' : data.returnTo);
  };

  return (
    <AuthPage footer={switching ? <Button variant="ghost" onClick={() => router.back()}>{t('auth.workspaces.cancel')}</Button> : <AuthSupportLink />}>
      <AuthCard title={switching ? t('auth.workspaces.switchTitle') : t('auth.workspaces.welcome')} description={switching ? undefined : t('auth.workspaces.title')}>
        {data.options.length === 0 ? <Notice tone="error">{t('auth.workspaces.none')}</Notice> : (
          <ul className="flex flex-col gap-2">
            {data.options.map((w) => (
              <li key={w.id}>
                <button type="button" disabled={w.current} onClick={() => void pick(w.id)}
                  className={cn('flex w-full items-center gap-3 rounded-input border px-4 py-3 text-left transition-colors duration-fast',
                    w.current ? 'cursor-default border-brand bg-brand-soft' : 'border-line-strong hover:bg-subtle')}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-label font-semibold text-fg">{w.organization}</span>
                    <span className="block truncate text-caption text-muted">{w.businessUnit} · {w.location}</span>
                    <span className="block truncate text-caption text-faint">{t(`common.role.${w.role}`)}</span>
                  </span>
                  {w.current ? <Pill size="sm" tone="brand">{t('auth.workspaces.current')}</Pill> : <ArrowRight aria-hidden className="size-4 text-muted" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </AuthCard>
    </AuthPage>
  );
}

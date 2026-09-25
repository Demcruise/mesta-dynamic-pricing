'use client';

import { CircleAlert, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useEffect, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { MestaLogo } from '@/components/shell/MestaLogo';
import { Button } from '@/components/ui/button';
import { fieldInputCls } from '@/components/ui/field';
import { useTranslation } from '@/lib/i18n';
import { useUiStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

/*
 * Authentication surface (AUTH-02/22/23/24). AuthPage → AuthBrand + AuthCard(heading, description,
 * body) + AuthSupportLink. One centred card, 420px max, the Mesta type/spacing tokens, no split
 * imagery; on phones the card loses its frame and fills the width with the same padding.
 */

/** Theme + locale for auth routes (they live outside the app shell and its data bootstrap). */
export function AuthProviders({ children }: { children: ReactNode }) {
  const theme = useUiStore((s) => s.theme);
  const locale = useUiStore((s) => s.locale);
  const [ready, setReady] = useState(false);
  useEffect(() => { void Promise.resolve(useUiStore.persist.rehydrate()).then(() => setReady(true)); }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = locale;
  }, [theme, locale]);
  return ready ? <>{children}</> : null;
}

export function AuthPage({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center bg-bg px-4 py-10 sm:justify-center sm:py-16">
      <div className="mb-8"><MestaLogo variant="full" className="scale-125" /></div>
      <div className="w-full max-w-[420px]">{children}</div>
      {footer && <div className="mt-6 w-full max-w-[420px] text-center">{footer}</div>}
    </main>
  );
}

export function AuthCard({ title, description, children, tone = 'default' }: {
  title: string; description?: ReactNode; children?: ReactNode; tone?: 'default' | 'error';
}) {
  return (
    <section aria-labelledby="auth-title" className="rounded-panel border-line bg-surface sm:border sm:p-8">
      {tone === 'error' && <CircleAlert aria-hidden className="mb-4 size-8 text-critical" />}
      <h1 id="auth-title" className="text-heading text-fg">{title}</h1>
      {description && <div className="mt-2 text-body text-muted">{description}</div>}
      {children && <div className="mt-6 flex flex-col gap-4">{children}</div>}
    </section>
  );
}

/** AUTH-03.1 — label, input, inline error; loading/disabled mirror the discovery state. */
export function WorkEmailField({ value, onChange, error, disabled, autoFocus, ...rest }: {
  value: string; onChange: (v: string) => void; error?: string | undefined; disabled?: boolean; autoFocus?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label text-fg">{t('auth.login.emailLabel')}</label>
      <input
        id={id} type="email" inputMode="email" autoComplete="username" spellCheck={false} autoCapitalize="none"
        placeholder={t('auth.login.emailPlaceholder')} className={fieldInputCls} value={value} disabled={disabled}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus} aria-invalid={!!error} aria-describedby={error ? `${id}-err` : undefined}
        onChange={(e) => onChange(e.target.value)} {...rest}
      />
      {error && <p id={`${id}-err`} role="alert" className="text-caption text-critical">{error}</p>}
    </div>
  );
}

export function SSOButton({ loading, disabled, children, onClick, type = 'submit' }: {
  loading?: boolean; disabled?: boolean; children?: ReactNode; onClick?: () => void; type?: 'submit' | 'button';
}) {
  const { t } = useTranslation();
  return (
    <Button type={type} onClick={onClick} loading={loading} disabled={disabled} className="h-control-lg w-full text-[15px]">
      {!loading && <LockKeyhole className="size-4" aria-hidden />}
      {children ?? t('auth.login.continue')}
    </Button>
  );
}

export function SecurityNote() {
  const { t } = useTranslation();
  return (
    <p className="flex items-start gap-2 text-caption text-muted">
      <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-up" />
      {t('auth.login.securityNote')}
    </p>
  );
}

export function AuthSupportLink() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="text-label font-medium text-brand hover:underline">
        {t('auth.login.help')}
      </button>
      {open && <p className="mx-auto mt-2 max-w-sm text-caption text-muted">{t('auth.login.helpBody')}</p>}
    </div>
  );
}

/** AUTH-13 — explicit, named progress states instead of a generic spinner. */
export function AuthLoading({ label }: { label: string }) {
  return (
    <AuthPage>
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 py-10 text-center">
        <LoaderCircle aria-hidden className="size-7 animate-spin text-brand" />
        <p className="text-body font-medium text-fg">{label}</p>
      </div>
    </AuthPage>
  );
}

export function Notice({ tone, children }: { tone: 'info' | 'warn' | 'error'; children: ReactNode }) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-input px-4 py-3 text-body-sm',
      tone === 'info' ? 'bg-info-soft text-info' : tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-critical-soft text-critical')}>
      {children}
    </p>
  );
}

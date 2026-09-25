'use client';

import { History, Lock } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pill } from '@/components/ds/Pill';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { fieldInputCls } from '@/components/ui/field';
import { formatDate } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { useScopedSkuList } from '@/lib/queries';
import { diffSection, validateSection, type FieldChange, type SectionKey, type WorkspaceConfig } from '@/lib/settings-config';
import { useSessionStore, useToastStore, useWorkspaceSettingsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';

/*
 * Settings building blocks (SET-033…040). One section header, one card, one 2-column form grid,
 * one field anatomy, one save bar — so every settings page has the same rhythm: 32px between
 * sections, 24px card padding, 16px field gap, 6–8px label → control.
 */

export function SectionHeader({ slug, meta, readOnly, actions }: {
  slug: string;
  meta?: { by: string; at: string; auditId: string } | undefined;
  readOnly?: boolean;
  actions?: ReactNode;
}) {
  const { t, locale } = useTranslation();
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-2xl">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-heading text-fg">{t(`settings.section.${slug}.title`)}</h2>
          {readOnly && <Pill tone="neutral" icon={Lock}>{t('settings.readOnly.badge')}</Pill>}
        </div>
        <p className="mt-2 text-body text-muted">{t(`settings.section.${slug}.desc`)}</p>
        {/* SET-043: provenance of the current values, with a jump to the audit trail. */}
        {meta !== undefined && (
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-faint">
            <History className="size-3.5" aria-hidden />
            {meta.by ? t('settings.meta.changed', { by: meta.by, at: formatDate(meta.at, locale) }) : t('settings.meta.never')}
            {meta.auditId && (
              <Link href="/audit?type=settings_change" className="font-medium text-brand hover:underline">{t('settings.meta.viewAudit')}</Link>
            )}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** SET-039/040: shown once per section when the viewer cannot change it. */
export function ReadOnlyNotice() {
  const { t } = useTranslation();
  return (
    <div role="note" className="mb-6 flex items-start gap-3 rounded-card border border-line bg-subtle px-5 py-4">
      <Lock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
      <div>
        <p className="text-label font-semibold text-fg">{t('settings.readOnly.title')}</p>
        <p className="mt-0.5 text-body-sm text-muted">{t('settings.readOnly.body')}</p>
      </div>
    </div>
  );
}

export function SettingsCard({ title, description, children, className, id }: { title: string; description?: string; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} aria-label={title} className={cn('scroll-mt-24 rounded-card border border-line bg-surface p-6', className)}>
      <h3 className="text-section text-fg">{title}</h3>
      {description && <p className="mt-1 text-body-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** SET-036: related settings sit on a 2-column grid; long-form content spans both columns. */
export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2', className)}>{children}</div>;
}

export function SettingField({ label, hint, error, children, className, htmlFor, sensitive }: {
  label: string; hint?: string | undefined; error?: string | undefined; children: ReactNode; className?: string; htmlFor?: string; sensitive?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <label htmlFor={htmlFor} className="flex flex-wrap items-center gap-2 text-label text-fg">
        {label}
        {sensitive && <Pill tone="warn" size="sm">{t('settings.confirm.sensitive')}</Pill>}
      </label>
      {children}
      {error ? <p role="alert" className="text-caption text-critical">{error}</p> : hint && <p className="text-caption text-faint">{hint}</p>}
    </div>
  );
}

export const selectCls = cn(fieldInputCls, 'pr-8');

/** Unit-suffixed number input used across settings (hours, days, %, IDR). */
export function NumberInput({ id, value, onChange, suffix, prefix, disabled, invalid, min, max, step, allowEmpty }: {
  id?: string; value: number | null; onChange: (v: number | null) => void; suffix?: string; prefix?: string;
  disabled?: boolean; invalid?: boolean; min?: number; max?: number; step?: number; allowEmpty?: boolean;
}) {
  return (
    <span className="relative flex items-center">
      {prefix && <span aria-hidden className="pointer-events-none absolute left-3.5 text-[13px] font-medium text-faint">{prefix}</span>}
      <input
        id={id} type="number" inputMode="decimal" disabled={disabled} min={min} max={max} step={step}
        aria-invalid={invalid || undefined}
        className={cn(fieldInputCls, 'tabular disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted', prefix && 'pl-12', suffix && 'pr-16')}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? (allowEmpty ? null : 0) : Number(e.target.value))}
      />
      {suffix && <span aria-hidden className="pointer-events-none absolute right-3.5 text-[13px] font-medium text-faint">{suffix}</span>}
    </span>
  );
}

/** Switch row: label + explanation left, switch right. The whole row is the click target. */
export function ToggleRow({ label, hint, checked, onChange, disabled, sensitive }: {
  label: string; hint?: string | undefined; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; sensitive?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <label className={cn('flex items-start justify-between gap-4 rounded-input border border-line px-4 py-3', disabled ? 'cursor-not-allowed bg-subtle' : 'cursor-pointer hover:border-line-strong')}>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2 text-label text-fg">
          {label}
          {sensitive && <Pill tone="warn" size="sm">{t('settings.confirm.sensitive')}</Pill>}
        </span>
        {hint && <span className="mt-0.5 block text-caption text-faint">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span aria-hidden className="h-5 w-9 rounded-full bg-line-strong transition-colors duration-fast peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:opacity-60" />
        <span aria-hidden className="absolute left-0.5 top-0.5 size-4 rounded-full bg-surface shadow-e2 transition-transform duration-fast peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

/**
 * Draft → validate → confirm → save for one workspace section (SET-031/032/037/038/045).
 * The draft lives in the settings store, so it survives moving between sections and is
 * flagged in the nav; `beforeunload` guards leaving the app with unsaved work.
 */
export function useSectionEditor<K extends SectionKey>(key: K) {
  const can = useCan();
  const readOnly = !can('settings.manage');
  const saved = useWorkspaceSettingsStore((s) => s.config[key]);
  const draft = useWorkspaceSettingsStore((s) => s.drafts[key]) as WorkspaceConfig[K] | undefined;
  const setDraft = useWorkspaceSettingsStore((s) => s.setDraft);
  const meta = useWorkspaceSettingsStore((s) => s.meta[key]);
  const value = draft ?? saved;
  const changes = useMemo(() => (draft ? diffSection(key, saved, draft) : []), [key, saved, draft]);
  const errors = useMemo(() => validateSection(key, value), [key, value]);
  const dirty = changes.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (patch: Partial<WorkspaceConfig[K]> | ((v: WorkspaceConfig[K]) => WorkspaceConfig[K])) => {
    if (readOnly) return;
    const next = typeof patch === 'function' ? patch(value) : { ...value, ...patch };
    setDraft(key, JSON.stringify(next) === JSON.stringify(saved) ? undefined : next);
  };
  return {
    value, saved, set, dirty, changes, errors, readOnly,
    meta: meta ?? { by: '', at: '', auditId: '' },
    discard: () => setDraft(key, undefined),
  };
}

/** Sticky save bar + high-impact confirmation for a section editor. */
export function SaveBar<K extends SectionKey>({ sectionKey, slug, editor }: {
  sectionKey: K; slug: string; editor: ReturnType<typeof useSectionEditor<K>>;
}) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const save = useWorkspaceSettingsStore((s) => s.save);
  const products = useScopedSkuList().data;
  const [confirming, setConfirming] = useState(false);
  const invalid = Object.keys(editor.errors).length > 0;
  const sensitive = editor.changes.filter((c) => c.sensitive);
  if (!editor.dirty) return null;

  const commit = () => {
    const note = editor.changes.map((c) => `${c.path}: ${fmt(c.from)} → ${fmt(c.to)}`).join('; ');
    save(sectionKey, editor.value, user, note);
    setConfirming(false);
    toast(t('settings.save.saved', { section: t(`settings.section.${slug}.title`) }));
  };

  return (
    <>
      <div role="region" aria-label={t('settings.save.unsaved')} className="sticky bottom-16 z-20 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface/95 px-5 py-3 shadow-e3 backdrop-blur md:bottom-4">
        <p className="text-label text-fg">
          <span className="font-semibold">{t('settings.save.unsaved')}</span>
          <span className="tabular ml-2 text-muted">{t('settings.save.count', { n: editor.changes.length })}</span>
          {invalid && <span className="ml-2 text-critical">{t('settings.save.invalid')}</span>}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={editor.discard}>{t('settings.save.discard')}</Button>
          <Button disabled={invalid} onClick={() => (sensitive.length > 0 ? setConfirming(true) : commit())}>{t('settings.save.save')}</Button>
        </div>
      </div>
      {/* SET-032/045: high-impact changes show from → to and the blast radius before they apply. */}
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={t('settings.confirm.title')} className="max-w-lg">
        <p className="text-body-sm text-muted">{t('settings.confirm.intro')}</p>
        <ul className="mt-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
          {editor.changes.map((c) => <ChangeLine key={c.path} change={c} />)}
        </ul>
        <div className="mt-4 rounded-input bg-subtle px-3 py-2 text-body-sm">
          <span className="font-medium text-fg">{t('settings.confirm.affected')}: </span>
          <span className="tabular text-muted">
            {t('settings.confirm.affectedValue', {
              skus: products.length, cats: new Set(products.map((p) => p.category)).size, regions: new Set(products.map((p) => p.region)).size,
            })}
          </span>
        </div>
        <p className="mt-3 text-caption text-faint">{t('settings.confirm.note')}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>{t('common.action.cancel')}</Button>
          <Button onClick={commit}>{t('settings.confirm.apply')}</Button>
        </div>
      </Dialog>
    </>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return v.toLocaleString('en-US');
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (Array.isArray(v) || typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function ChangeLine({ change }: { change: FieldChange }) {
  const { t } = useTranslation();
  return (
    <li className="rounded-input border border-line px-3 py-2">
      <p className="flex flex-wrap items-center gap-2 text-caption font-medium text-muted">
        <code className="font-mono">{change.path}</code>
        {change.sensitive && <Pill tone="warn" size="sm">{t('settings.confirm.sensitive')}</Pill>}
      </p>
      <p className="tabular mt-1 break-all text-body-sm text-fg">
        <span className="text-muted line-through">{fmt(change.from)}</span> <span aria-hidden>→</span> <span className="font-semibold">{fmt(change.to)}</span>
      </p>
    </li>
  );
}

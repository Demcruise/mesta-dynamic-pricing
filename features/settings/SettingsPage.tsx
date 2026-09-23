'use client';

import { Check, Lock, RotateCcw } from 'lucide-react';
import { PageHeader } from '@/components/ds/states';
import { Button } from '@/components/ui/button';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { PERMISSIONS, POLICY_LOCKED, ROLES, can, type Action } from '@/lib/rbac';
import { useAuditStore, usePolicyStore, useRecommendationStore, useSessionStore, useToastStore, useUiStore } from '@/lib/stores';
import type { Locale } from '@/lib/format';
import type { Role } from '@/lib/ontology';
import { cn } from '@/lib/utils';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { t, locale } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const density = useUiStore((s) => s.density);
  const setDensity = useUiStore((s) => s.setDensity);
  const setLocale = useUiStore((s) => s.setLocale);
  const recs = useRecommendationStore((s) => s.items);
  const pending = recs.filter((r) => r.status === 'pending').length;
  const sources = {
    agent: recs.filter((r) => r.source === 'agent').length,
    simulation: recs.filter((r) => r.source === 'simulation').length,
    manual: recs.filter((r) => r.source === 'manual').length,
  };

  return (
    <>
      <PageHeader title={t('common.nav.settings')} subtitle={t('common.settings.subtitle')} />
      <section aria-label={t('common.settings.appearance')} className="max-w-lg divide-y divide-line rounded-card border border-line bg-surface px-card shadow-e1">
        <Row label={t('common.user.theme')}>
          {(['light', 'dark'] as const).map((v) => (
            <Button key={v} size="sm" variant={theme === v ? 'primary' : 'secondary'} aria-pressed={theme === v} onClick={() => setTheme(v)}>
              {t(`common.user.${v}`)}
            </Button>
          ))}
        </Row>
        <Row label={t('common.user.language')}>
          {(['id', 'en'] as const).map((l: Locale) => (
            <Button key={l} size="sm" variant={locale === l ? 'primary' : 'secondary'} aria-pressed={locale === l} onClick={() => setLocale(l)}>
              {l.toUpperCase()}
            </Button>
          ))}
        </Row>
        <Row label={t('common.density.label')}>
          {(['comfortable', 'compact'] as const).map((d) => (
            <Button key={d} size="sm" variant={density === d ? 'primary' : 'secondary'} aria-pressed={density === d} onClick={() => setDensity(d)}>
              {t(`common.density.${d}`)}
            </Button>
          ))}
        </Row>
      </section>
      <section aria-label={t('common.settings.ai')} className="mt-6 max-w-lg rounded-card border border-line bg-surface p-card shadow-e1">
        <h2 className="text-sm font-semibold">{t('common.settings.ai')}</h2>
        <dl className="mt-3 flex flex-col gap-3 text-sm">
          <div>
            <dt className="text-xs font-medium text-muted">{t('common.settings.aiVolume')}</dt>
            <dd className="mt-0.5">
              {t('common.settings.aiVolumeBody', { total: recs.length, pending, decided: recs.length - pending })}
            </dd>
            <dd className="tabular mt-0.5 text-xs text-faint">{t('common.settings.aiVolumeSources', sources)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">{t('common.settings.aiModel')}</dt>
            <dd className="mt-0.5">{t('common.settings.aiModelBody')}</dd>
          </div>
          <div className="rounded-input bg-warn-soft p-3">
            <dt className="text-xs font-medium text-warn">{t('common.settings.aiLimit')}</dt>
            <dd className="mt-0.5 text-muted">{t('common.settings.aiLimitBody')}</dd>
          </div>
        </dl>
      </section>
      <PolicyMatrix />
    </>
  );
}

/**
 * GOV-003: writable policy matrix. `can()` already consults the persisted override
 * map, so toggles take effect immediately across the workspace. `policy.manage`
 * is locked — overriding it could lock out every role. This is a local demo
 * control only; the code-owned PERMISSIONS matrix remains the default.
 */
function PolicyMatrix() {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const canDo = useCan();
  const toast = useToastStore((s) => s.push);
  const overrides = usePolicyStore((s) => s.overrides);
  const setOverride = usePolicyStore((s) => s.set);
  const resetAll = usePolicyStore((s) => s.resetAll);
  const editable = canDo('policy.manage');
  const overrideCount = Object.keys(overrides).length;

  const toggle = (role: Role, action: Action) => {
    const key = `${role}:${action}` as const;
    const effective = can(role, action);
    const next = !effective;
    const codeDefault = (PERMISSIONS[action] as readonly Role[]).includes(role);
    setOverride(key, next === codeDefault ? undefined : next);
    useAuditStore.getState().record({
      type: 'policy_override', actorId: user.userId, actorRole: user.role, entityType: 'policy',
      entityId: key, sku: null, source: 'ui',
      note: `${action} → ${role}: ${next === codeDefault ? 'reset to default' : next ? 'allowed' : 'denied'}`,
    });
    toast(t('common.settings.policyChanged', { action, role: t(`common.role.${role}`) }));
  };

  return (
      <section aria-label={t('common.settings.access')} className="mt-6 rounded-card border border-line bg-surface p-card shadow-e1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">{t('common.settings.access')}</h2>
            <p className="mt-1 text-xs text-muted">
              {editable ? t('common.settings.accessBodyEdit') : t('common.settings.accessBody')}
            </p>
          </div>
          {editable && overrideCount > 0 && (
            <Button size="sm" variant="secondary" onClick={() => { resetAll(); toast(t('common.settings.policyReset')); }}>
              <RotateCcw className="size-3.5" />{t('common.settings.policyResetAll', { n: overrideCount })}
            </Button>
          )}
        </div>
        <div className="mt-3 max-h-96 overflow-auto rounded-input border border-line" tabIndex={0}>
          <table className="w-full text-xs">
            <caption className="sr-only">{t('common.settings.access')}</caption>
            <thead className="sticky top-0 bg-surface text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="py-1.5 pe-2 ps-3 text-left font-medium">{t('common.settings.accessAction')}</th>
                {ROLES.map((r) => (
                  <th key={r} scope="col" className="py-1.5 pe-3 text-center font-medium">{t(`common.role.${r}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(PERMISSIONS) as Action[]).map((a) => {
                const locked = POLICY_LOCKED.has(a);
                return (
                <tr key={a} className="border-b border-line last:border-0">
                  <th scope="row" className="py-1.5 pe-2 ps-3 text-left font-normal text-muted">
                    <code>{a}</code>
                    {locked && <Lock className="ms-1 inline size-3 text-faint" aria-label={t('common.settings.policyLocked')} />}
                  </th>
                  {ROLES.map((r) => {
                    const key = `${r}:${a}` as const;
                    const overridden = overrides[key] !== undefined;
                    const allowed = can(r, a);
                    const mark = allowed
                      ? <Check className="mx-auto size-3.5 text-ok" aria-label={t('common.settings.accessYes')} />
                      : <span aria-label={t('common.settings.accessNo')} className="text-faint">—</span>;
                    return (
                    <td key={r} className={cn('py-1.5 pe-3 text-center', overridden && 'bg-brand-soft/40')}>
                      {editable && !locked ? (
                        <button
                          type="button"
                          onClick={() => toggle(r, a)}
                          aria-pressed={allowed}
                          aria-label={t('common.settings.policyCell', { action: a, role: t(`common.role.${r}`) })}
                          className="mx-auto block rounded px-1 hover:bg-subtle focus-visible:outline-2 focus-visible:outline-brand"
                        >
                          {mark}
                          {overridden && <span className="mx-auto mt-0.5 block size-1 rounded-full bg-brand" aria-hidden />}
                        </button>
                      ) : (
                        <span className="relative inline-block">
                          {mark}
                          {overridden && <span className="absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-brand" aria-hidden />}
                        </span>
                      )}
                    </td>
                    );
                  })}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {editable && <p className="mt-2 text-xs text-faint">{t('common.settings.policyHonest')}</p>}
      </section>
  );
}

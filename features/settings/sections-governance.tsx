'use client';

import { Check, Lock, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Pill } from '@/components/ds/Pill';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { fieldInputCls } from '@/components/ui/field';
import { formatDate } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { Role } from '@/lib/ontology';
import { can, PERMISSIONS, POLICY_LOCKED, ROLES, type Action } from '@/lib/rbac';
import { AUDIT_EVENT_CLASSES, FEATURE_DEPS, type WorkspaceConfig } from '@/lib/settings-config';
import { useAuditStore, usePolicyStore, useSessionStore, useToastStore, useWorkspaceSettingsStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { FormGrid, NumberInput, ReadOnlyNotice, SaveBar, SectionHeader, SettingField, SettingsCard, ToggleRow, selectCls, useSectionEditor } from './ui';

// ── Roles & permissions (SET-012) ─────────────────────────────────────────────────────────
/**
 * Permission matrix grouped by capability area instead of one long checkbox wall. `can()` consults
 * the persisted override map, so toggles take effect immediately; `policy.manage` stays locked.
 */
export function RolesSection() {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const canDo = useCan();
  const toast = useToastStore((s) => s.push);
  const overrides = usePolicyStore((s) => s.overrides);
  const setOverride = usePolicyStore((s) => s.set);
  const resetAll = usePolicyStore((s) => s.resetAll);
  const editable = canDo('policy.manage');
  const overrideCount = Object.keys(overrides).length;
  const groups = new Map<string, Action[]>();
  for (const a of Object.keys(PERMISSIONS) as Action[]) {
    const g = a.split('.')[0]!;
    groups.set(g, [...(groups.get(g) ?? []), a]);
  }

  const toggle = (role: Role, action: Action) => {
    const key = `${role}:${action}` as const;
    const next = !can(role, action);
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
    <>
      <SectionHeader
        slug="roles"
        readOnly={!editable}
        actions={editable && overrideCount > 0 ? (
          <Button variant="secondary" onClick={() => { resetAll(); toast(t('common.settings.policyReset')); }}>
            <RotateCcw className="size-4" aria-hidden />{t('common.settings.policyResetAll', { n: overrideCount })}
          </Button>
        ) : undefined}
      />
      {!editable && <ReadOnlyNotice />}
      <SettingsCard title={t('settings.roles.matrix')} description={`${editable ? t('common.settings.accessBodyEdit') : t('common.settings.accessBody')} ${t('settings.roles.adminNote')}`}>
        <div className="-mx-6 -mb-6 max-h-[640px] overflow-auto border-t border-divider" tabIndex={0} role="region" aria-label={t('settings.roles.matrix')}>
          <table className="mesta-table min-w-[820px]" style={{ tableLayout: 'fixed' }}>
            <caption className="sr-only">{t('settings.roles.matrix')}</caption>
            <colgroup><col />{ROLES.map((r) => <col key={r} style={{ width: 120 }} />)}</colgroup>
            <thead className="sticky top-0 z-[1]">
              <tr>
                <th scope="col" className="text-left">{t('common.settings.accessAction')}</th>
                {ROLES.map((r) => <th key={r} scope="col" className="text-center">{t(`common.role.${r}`)}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...groups.entries()].flatMap(([g, actions]) => [
                <tr key={`g-${g}`} className="!h-9">
                  <th colSpan={ROLES.length + 1} scope="colgroup" className="!bg-subtle text-left text-caption font-semibold uppercase tracking-wide text-muted">{g}</th>
                </tr>,
                ...actions.map((a) => {
                  const locked = POLICY_LOCKED.has(a);
                  return (
                    <tr key={a}>
                      <th scope="row" className="text-left font-normal text-muted">
                        <code className="font-mono text-caption">{a}</code>
                        {locked && <Lock className="ms-1 inline size-3 text-faint" aria-label={t('common.settings.policyLocked')} />}
                      </th>
                      {ROLES.map((r) => {
                        const overridden = overrides[`${r}:${a}`] !== undefined;
                        const allowed = can(r, a);
                        const mark = allowed
                          ? <Check className="mx-auto size-4 text-up" aria-label={t('common.settings.accessYes')} />
                          : <span aria-label={t('common.settings.accessNo')} className="text-faint">—</span>;
                        return (
                          <td key={r} className={cn('text-center', overridden && '!bg-brand-soft')}>
                            {editable && !locked ? (
                              <button type="button" onClick={() => toggle(r, a)} aria-pressed={allowed}
                                aria-label={t('common.settings.policyCell', { action: a, role: t(`common.role.${r}`) })}
                                className="mx-auto grid size-8 place-items-center rounded-row hover:bg-subtle">
                                {mark}
                              </button>
                            ) : mark}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
        </div>
      </SettingsCard>
      {editable && <p className="mt-3 text-caption text-faint">{t('common.settings.policyHonest')}</p>}
    </>
  );
}

// ── Audit & retention (SET-022/023) ───────────────────────────────────────────────────────
export function AuditRetentionSection() {
  const { t } = useTranslation();
  const ed = useSectionEditor('audit');
  const v = ed.value;
  return (
    <>
      <SectionHeader slug="audit" meta={ed.meta} readOnly={ed.readOnly} />
      {ed.readOnly && <ReadOnlyNotice />}
      <div className="flex flex-col gap-8">
        <SettingsCard title={t('settings.audit.retentionLabel')}>
          <FormGrid>
            <SettingField label={t('settings.audit.retentionDays')} htmlFor="au-ret" sensitive>
              <select id="au-ret" className={selectCls} disabled={ed.readOnly} value={v.retentionDays} onChange={(e) => ed.set({ retentionDays: Number(e.target.value) })}>
                {[365, 1095, 2555, 3650].map((d) => <option key={d} value={d}>{t(`settings.audit.retention.${d}`)}</option>)}
              </select>
            </SettingField>
            <SettingField label={t('settings.audit.format')} htmlFor="au-fmt">
              <select id="au-fmt" className={selectCls} disabled={ed.readOnly} value={v.format} onChange={(e) => ed.set({ format: e.target.value as typeof v.format })}>
                <option value="json">JSON</option><option value="csv">CSV</option>
              </select>
            </SettingField>
            <SettingField label={t('settings.audit.timezone')} htmlFor="au-tz">
              <select id="au-tz" className={selectCls} disabled={ed.readOnly} value={v.timezone} onChange={(e) => ed.set({ timezone: e.target.value })}>
                {['Asia/Jakarta', 'UTC'].map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </SettingField>
            <SettingField label={t('settings.audit.actorLabel')} htmlFor="au-actor">
              <select id="au-actor" className={selectCls} disabled={ed.readOnly} value={v.actorIdentity} onChange={(e) => ed.set({ actorIdentity: e.target.value as typeof v.actorIdentity })}>
                {(['sso', 'local'] as const).map((x) => <option key={x} value={x}>{t(`settings.audit.actor.${x}`)}</option>)}
              </select>
            </SettingField>
            <SettingField label={t('settings.audit.exportRoles')} className="md:col-span-2">
              <span className="flex flex-wrap gap-2">
                {ROLES.map((r) => {
                  const on = v.exportRoles.includes(r);
                  return (
                    <button key={r} type="button" disabled={ed.readOnly} aria-pressed={on}
                      onClick={() => ed.set({ exportRoles: on ? v.exportRoles.filter((x) => x !== r) : [...v.exportRoles, r] })}
                      className={cn('h-8 rounded-full border px-3 text-caption font-medium transition-colors duration-fast disabled:cursor-not-allowed', on ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong text-muted hover:text-fg')}>
                      {t(`common.role.${r}`)}
                    </button>
                  );
                })}
              </span>
            </SettingField>
            <div className="md:col-span-2"><ToggleRow sensitive label={t('settings.audit.immutable')} checked={v.immutable} disabled={ed.readOnly} onChange={(immutable) => ed.set({ immutable })} /></div>
          </FormGrid>
        </SettingsCard>
        <SettingsCard title={t('settings.audit.events')}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {AUDIT_EVENT_CLASSES.map((e) => {
              // Configuration and price changes are always captured — they are the audit trail itself.
              const locked = e === 'configuration_changed' || e === 'price_change';
              return (
                <ToggleRow key={e} label={t(`settings.audit.ev.${e}`)} hint={locked ? t('settings.audit.lockedEvent') : undefined}
                  checked={locked || v.events[e] !== false} disabled={ed.readOnly || locked}
                  onChange={(on) => ed.set({ events: { ...v.events, [e]: on } })} />
              );
            })}
          </div>
        </SettingsCard>
      </div>
      <SaveBar sectionKey="audit" slug="audit" editor={ed} />
    </>
  );
}

// ── API & access (SET-024) ────────────────────────────────────────────────────────────────
interface Credential { id: string; name: string; kind: 'api_key' | 'service' | 'webhook' | 'integration'; hint: string; created: string; lastUsed: string | null; expires: string; owner: string }
const CREDENTIALS: Credential[] = [
  { id: 'cred-1', name: 'ERP sync', kind: 'integration', hint: 'erp_••••3f9a', created: '2026-01-12T09:00:00+07:00', lastUsed: '2026-09-24T06:15:00+07:00', expires: '2027-01-12T09:00:00+07:00', owner: 'Sari Ops' },
  { id: 'cred-2', name: 'POS publish', kind: 'service', hint: 'svc_••••a21c', created: '2026-02-03T09:00:00+07:00', lastUsed: '2026-09-24T22:40:00+07:00', expires: '2026-10-03T09:00:00+07:00', owner: 'Sari Ops' },
  { id: 'cred-3', name: 'BI export', kind: 'api_key', hint: 'mk_live_••••7d02', created: '2026-05-20T09:00:00+07:00', lastUsed: '2026-09-18T14:02:00+07:00', expires: '2027-05-20T09:00:00+07:00', owner: 'Budi Manager' },
  { id: 'cred-4', name: 'Marketplace webhook', kind: 'webhook', hint: 'whsec_••••e8b4', created: '2026-03-01T09:00:00+07:00', lastUsed: null, expires: '2027-03-01T09:00:00+07:00', owner: 'Budi Manager' },
];

export function ApiSection() {
  const { t, locale } = useTranslation();
  const canManage = useCan()('settings.manage');
  const toast = useToastStore((s) => s.push);
  const user = useSessionStore((s) => s.user);
  const [revoked, setRevoked] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<Credential | null>(null);
  const now = Date.now();
  const statusOf = (c: Credential) => revoked.has(c.id) ? 'revoked' : new Date(c.expires).getTime() - now < 30 * 86_400_000 ? 'expiring' : 'active';
  const TONE = { active: 'up', expiring: 'warn', revoked: 'faint' } as const;

  return (
    <>
      <SectionHeader slug="api" readOnly={!canManage} />
      {!canManage && <ReadOnlyNotice />}
      <SettingsCard title={t('settings.api.keys')} description={t('settings.api.secretNote')}>
        <div className="-mx-6 -mb-6 overflow-x-auto border-t border-divider">
          <table className="mesta-table rows-lg min-w-[1000px]" style={{ tableLayout: 'fixed' }}>
            <caption className="sr-only">{t('settings.api.keys')}</caption>
            <colgroup><col /><col style={{ width: 176 }} /><col style={{ width: 136 }} /><col style={{ width: 136 }} /><col style={{ width: 136 }} /><col style={{ width: 140 }} /><col style={{ width: 104 }} /></colgroup>
            <thead><tr>
              <th scope="col" className="text-left">{t('settings.api.name')}</th>
              <th scope="col" className="text-left">{t('settings.api.key')}</th>
              <th scope="col" className="text-left">{t('settings.api.created')}</th>
              <th scope="col" className="text-left">{t('settings.api.lastUsed')}</th>
              <th scope="col" className="text-left">{t('settings.api.expires')}</th>
              <th scope="col" className="text-left">{t('settings.api.statusLabel')}</th>
              <th scope="col" className="text-right"><span className="sr-only">{t('settings.api.revoke')}</span></th>
            </tr></thead>
            <tbody>
              {CREDENTIALS.map((c) => {
                const st = statusOf(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <span className="block truncate font-semibold text-fg">{c.name}</span>
                      <span className="block truncate text-caption text-faint">{t(`settings.api.kind.${c.kind}`)} · {t('settings.api.owner')}: {c.owner}</span>
                    </td>
                    <td className="truncate font-mono text-caption text-muted">{c.hint}</td>
                    <td className="tabular truncate text-muted">{formatDate(c.created, locale).split(',').slice(0, 2).join(',')}</td>
                    <td className="tabular truncate text-muted">{c.lastUsed ? formatDate(c.lastUsed, locale).split(',').slice(0, 2).join(',') : t('settings.api.never')}</td>
                    <td className="tabular truncate text-muted">{formatDate(c.expires, locale).split(',').slice(0, 2).join(',')}</td>
                    <td><Pill size="sm" tone={TONE[st]}>{t(`settings.api.status.${st}`)}</Pill></td>
                    <td className="text-right">
                      <Button size="sm" variant="secondary" disabled={!canManage || st === 'revoked'} onClick={() => setConfirm(c)}>{t('settings.api.revoke')}</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SettingsCard>
      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title={t('settings.api.revoke')}>
        <p className="text-body-sm text-muted">{confirm && t('settings.api.revokeConfirm', { name: confirm.name })}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirm(null)}>{t('common.action.cancel')}</Button>
          <Button variant="destructive" onClick={() => {
            if (!confirm) return;
            setRevoked((s) => new Set(s).add(confirm.id));
            useAuditStore.getState().record({ type: 'settings_change', actorId: user.userId, actorRole: user.role, entityType: 'settings', entityId: 'api', sku: null, source: 'ui', note: `credential revoked: ${confirm.name}` });
            toast(t('settings.api.revoked', { name: confirm.name }));
            setConfirm(null);
          }}>{t('settings.api.revoke')}</Button>
        </div>
      </Dialog>
    </>
  );
}

// ── Security (SET-025) ────────────────────────────────────────────────────────────────────
export function SecuritySection() {
  const { t } = useTranslation();
  const ed = useSectionEditor('security');
  const v = ed.value;
  return (
    <>
      <SectionHeader slug="security" meta={ed.meta} readOnly={ed.readOnly} />
      {ed.readOnly && <ReadOnlyNotice />}
      <p role="note" className="mb-6 rounded-input bg-warn-soft px-4 py-3 text-body-sm text-warn">{t('settings.sec.impact')}</p>
      <div className="flex flex-col gap-8">
        <SettingsCard title={t('settings.sec.session')}>
          <FormGrid>
            <SettingField label={t('settings.sec.timeout')} htmlFor="sec-timeout" error={ed.errors.sessionMinutes ? t(`settings.err.${ed.errors.sessionMinutes}`) : undefined} sensitive>
              <NumberInput id="sec-timeout" suffix={t('settings.unit.minutes')} value={v.sessionMinutes} disabled={ed.readOnly} invalid={!!ed.errors.sessionMinutes} onChange={(n) => ed.set({ sessionMinutes: n ?? 0 })} />
            </SettingField>
            <div className="md:self-end"><ToggleRow sensitive label={t('settings.sec.reauth')} checked={v.reauthSensitive} disabled={ed.readOnly} onChange={(reauthSensitive) => ed.set({ reauthSensitive })} /></div>
          </FormGrid>
        </SettingsCard>
        <SettingsCard title={t('settings.sec.signin')}>
          <FormGrid>
            <SettingField label={t('settings.sec.ssoLabel')} htmlFor="sec-sso" sensitive>
              <select id="sec-sso" className={selectCls} disabled={ed.readOnly} value={v.sso} onChange={(e) => ed.set({ sso: e.target.value as typeof v.sso })}>
                {(['saml', 'oidc', 'off'] as const).map((x) => <option key={x} value={x}>{t(`settings.sec.sso.${x}`)}</option>)}
              </select>
            </SettingField>
            <SettingField label={t('settings.sec.policyLabel')} htmlFor="sec-pol" sensitive>
              <select id="sec-pol" className={selectCls} disabled={ed.readOnly} value={v.loginPolicy} onChange={(e) => ed.set({ loginPolicy: e.target.value as typeof v.loginPolicy })}>
                {(['sso_only', 'sso_or_password'] as const).map((x) => <option key={x} value={x}>{t(`settings.sec.policy.${x}`)}</option>)}
              </select>
            </SettingField>
            <SettingField label={t('settings.sec.domains')} htmlFor="sec-dom" sensitive>
              <input id="sec-dom" className={fieldInputCls} disabled={ed.readOnly} value={v.trustedDomains} onChange={(e) => ed.set({ trustedDomains: e.target.value })} />
            </SettingField>
            <div className="md:self-end"><ToggleRow sensitive label={t('settings.sec.mfa')} checked={v.mfa} disabled={ed.readOnly} onChange={(mfa) => ed.set({ mfa })} /></div>
          </FormGrid>
        </SettingsCard>
      </div>
      <SaveBar sectionKey="security" slug="security" editor={ed} />
    </>
  );
}

// ── Feature controls (SET-030) ────────────────────────────────────────────────────────────
export function FeaturesSection() {
  const { t } = useTranslation();
  const ed = useSectionEditor('features');
  const v = ed.value;
  const config = useWorkspaceSettingsStore((s) => s.config);
  // Dependency checks read the saved workspace policy, not just this section.
  const depMet = (d: string): boolean => {
    if (d === 'approvalPolicy') return config.approvals.tiers.length > 0;
    if (d === 'guardrails') return config.guardrails.maxChangePct > 0;
    if (d === 'confidence') return config.approvals.autoApproveConfidence >= 50;
    return v[d as keyof WorkspaceConfig['features']] === true;
  };
  return (
    <>
      <SectionHeader slug="features" meta={ed.meta} readOnly={ed.readOnly} />
      {ed.readOnly && <ReadOnlyNotice />}
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(Object.keys(v) as (keyof typeof v)[]).map((f) => {
          const deps = FEATURE_DEPS[f] ?? [];
          const blocked = deps.some((d) => !depMet(d)) && !v[f];
          return (
            <li key={f} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
              <ToggleRow label={t(`settings.feat.${f}`)} sensitive={f === 'autoApproval' || f === 'apiAccess'}
                hint={blocked ? t('settings.feat.blocked') : undefined}
                checked={v[f]} disabled={ed.readOnly || blocked} onChange={(on) => ed.set({ [f]: on })} />
              <div>
                <p className="text-caption font-medium text-muted">{deps.length ? t('settings.feat.requires') : t('settings.feat.noDeps')}</p>
                {deps.length > 0 && (
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {deps.map((d) => (
                      <li key={d} className={cn('flex items-center gap-1.5 text-body-sm', depMet(d) ? 'text-up' : 'text-critical')}>
                        {depMet(d) ? <Check className="size-3.5" aria-hidden /> : <span aria-hidden>✕</span>}
                        {t(`settings.feat.dep.${d}`)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <SaveBar sectionKey="features" slug="features" editor={ed} />
    </>
  );
}

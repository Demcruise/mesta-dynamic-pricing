'use client';

import { KeyRound, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Pill } from '@/components/ds/Pill';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { recordAuthEvent, roleFor, statusOf, workspaceLabel } from '@/lib/auth/api';
import { DIRECTORY_USERS, ORGANIZATIONS, type Organization } from '@/lib/auth/directory';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { Role } from '@/lib/ontology';
import { ROLES } from '@/lib/rbac';
import { useSessionStore, useToastStore } from '@/lib/stores';
import { useAuthStore } from '@/lib/stores/auth';
import { useSsoAdminStore } from '@/lib/stores/sso-admin';
import { cn } from '@/lib/utils';
import { FormGrid, ReadOnlyNotice, SectionHeader, SettingField, SettingsCard, selectCls } from './ui';

/*
 * Access administration (AUTH-16/17/18, AUTH-29/30). Identity & SSO, Users and Sessions live in
 * Settings → Access; ordinary users see them read-only and never meet protocol details at sign-in.
 */

/** The organization being administered = the signed-in session's organization. */
function useAdminOrg(): Organization {
  const orgId = useAuthStore((s) => s.session?.organizationId);
  return ORGANIZATIONS.find((o) => o.id === orgId) ?? ORGANIZATIONS[0]!;
}

// ── Identity & SSO ──────────────────────────────────────────────────────────────────────────
export function IdentitySsoSection() {
  const { t, locale } = useTranslation();
  const can = useCan();
  const readOnly = !can('settings.manage');
  const org = useAdminOrg();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const stored = useSsoAdminStore((s) => s.groupRoles[org.id]);
  const storedFallback = useSsoAdminStore((s) => (org.id in s.fallbackRole ? s.fallbackRole[org.id] : undefined));
  const setMapping = useSsoAdminStore((s) => s.setMapping);
  const [mapping, setLocal] = useState<Record<string, Role>>(() => ({ ...(stored ?? org.groupRoles) }));
  const [fallback, setFallback] = useState<Role | null>(storedFallback !== undefined ? storedFallback : org.fallbackRole);
  const [newGroup, setNewGroup] = useState('');
  const idp = org.idp;
  const dirty = JSON.stringify(mapping) !== JSON.stringify(stored ?? org.groupRoles) || fallback !== (storedFallback !== undefined ? storedFallback : org.fallbackRole);
  // AUTH-18: groups asserted by the IdP that no mapping covers (invalid-group handling).
  const unmapped = useMemo(
    () => [...new Set(DIRECTORY_USERS.filter((u) => u.email.endsWith(org.domains[0] ?? '#')).flatMap((u) => u.groups))].filter((g) => !mapping[g]),
    [org, mapping],
  );
  const certDays = idp ? Math.round((new Date(idp.certificateExpiresAt).getTime() - Date.now()) / 86_400_000) : 0;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const save = () => {
    setMapping(org.id, mapping, fallback);
    recordAuthEvent('auth_sso_config_changed', {
      actorId: user.userId, actorRole: user.role, entityId: org.id,
      note: `group mapping: ${Object.entries(mapping).map(([g, r]) => `${g}→${r}`).join(', ')}; fallback: ${fallback ?? 'none'}`,
    });
    toast(t('settings.sso.saved'));
  };

  return (
    <>
      <SectionHeader slug="identity-sso" readOnly={readOnly} />
      {readOnly && <ReadOnlyNotice />}
      <div className="flex flex-col gap-8">
        <SettingsCard title={t('settings.sso.provider')}>
          {!idp ? <p className="text-body-sm text-muted">{t('settings.sso.notConfigured')}</p> : (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
              <Fact label={t('settings.sso.providerName')}><span className="flex items-center gap-2"><KeyRound className="size-4 text-muted" aria-hidden />{idp.label}</span></Fact>
              <Fact label={t('settings.sso.protocol')}><Pill tone="neutral">{idp.type === 'oidc' ? 'OpenID Connect' : 'SAML 2.0'}</Pill></Fact>
              <Fact label={t('settings.sso.domains')}>{org.domains.join(', ')}</Fact>
              <Fact label={t('settings.sso.entityId')}><code className="break-all font-mono text-caption">{idp.entityId}</code></Fact>
              <Fact label={t('settings.sso.redirectUri')}><code className="break-all font-mono text-caption">{origin}{idp.redirectUri}</code></Fact>
              <Fact label={t('settings.sso.certificate')}>
                <span className={cn('tabular', certDays < 60 ? 'text-warn' : 'text-fg')}>
                  {t('settings.sso.certExpires', { date: formatDate(idp.certificateExpiresAt, locale).split(',').slice(0, 2).join(','), days: certDays })}
                </span>
              </Fact>
              <Fact label={t('settings.sso.provisioning')}>
                {idp.scim === 'active'
                  ? <StatusBadge status="healthy" label={t('settings.sso.scimActive')} />
                  : <StatusBadge status="warning" label={t('settings.sso.scimOff')} />}
              </Fact>
              <Fact label={t('settings.sso.credentials')}><span className="flex items-center gap-2 text-muted"><ShieldCheck className="size-4 text-up" aria-hidden />{t('settings.sso.noCredentials')}</span></Fact>
            </dl>
          )}
        </SettingsCard>

        <SettingsCard title={t('settings.sso.mapping')} description={t('settings.sso.mappingHint')}>
          <div className="relative -mx-6 overflow-x-auto border-y border-divider">
            <table className="mesta-table min-w-[560px]" style={{ tableLayout: 'fixed' }}>
              <caption className="sr-only">{t('settings.sso.mapping')}</caption>
              <colgroup><col /><col style={{ width: 240 }} /><col style={{ width: 96 }} /></colgroup>
              <thead><tr>
                <th scope="col" className="text-left">{t('settings.sso.group')}</th>
                <th scope="col" className="text-left">{t('settings.sso.role')}</th>
                <th scope="col" className="text-right"><span className="sr-only">{t('settings.sso.remove')}</span></th>
              </tr></thead>
              <tbody>
                {Object.entries(mapping).map(([g, r]) => (
                  <tr key={g}>
                    <td className="truncate font-mono text-caption text-fg">{g}</td>
                    <td>
                      <select aria-label={`${t('settings.sso.role')} — ${g}`} className={cn(selectCls, 'h-control-md text-[13px]')} disabled={readOnly} value={r}
                        onChange={(e) => setLocal({ ...mapping, [g]: e.target.value as Role })}>
                        {ROLES.map((x) => <option key={x} value={x}>{t(`common.role.${x}`)}</option>)}
                      </select>
                    </td>
                    <td className="text-right">
                      <Button size="sm" variant="ghost" disabled={readOnly} onClick={() => { const next = { ...mapping }; delete next[g]; setLocal(next); }}>{t('settings.sso.remove')}</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-col gap-5">
            {!readOnly && (
              <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); const g = newGroup.trim(); if (g && !mapping[g]) { setLocal({ ...mapping, [g]: 'analyst' }); setNewGroup(''); } }}>
                <SettingField label={t('settings.sso.addGroup')} htmlFor="sso-new-group" className="w-72">
                  <input id="sso-new-group" className={cn(selectCls, 'pr-3.5 font-mono')} value={newGroup} onChange={(e) => setNewGroup(e.target.value)} placeholder="pricing-leads" />
                </SettingField>
                <Button type="submit" variant="secondary" className="h-control-lg">{t('settings.sso.add')}</Button>
              </form>
            )}
            <FormGrid>
              <SettingField label={t('settings.sso.fallback')} hint={t('settings.sso.fallbackHint')} htmlFor="sso-fallback">
                <select id="sso-fallback" className={selectCls} disabled={readOnly} value={fallback ?? ''} onChange={(e) => setFallback((e.target.value || null) as Role | null)}>
                  <option value="">{t('settings.sso.noFallback')}</option>
                  {ROLES.map((x) => <option key={x} value={x}>{t(`common.role.${x}`)}</option>)}
                </select>
              </SettingField>
              <SettingField label={t('settings.sso.multiple')}>
                <p className="text-body-sm text-muted">{t('settings.sso.multipleRule')}</p>
              </SettingField>
            </FormGrid>
            {unmapped.length > 0 && (
              <p role="note" className="rounded-input bg-warn-soft px-4 py-3 text-body-sm text-warn">
                {t('settings.sso.unmapped', { groups: unmapped.join(', ') })}
              </p>
            )}
            {!readOnly && (
              <div className="flex justify-end gap-2">
                <Button variant="secondary" disabled={!dirty} onClick={() => { setLocal({ ...(stored ?? org.groupRoles) }); setFallback(storedFallback !== undefined ? storedFallback : org.fallbackRole); }}>{t('settings.save.discard')}</Button>
                <Button disabled={!dirty} onClick={save}>{t('settings.save.save')}</Button>
              </div>
            )}
          </div>
        </SettingsCard>
      </div>
    </>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption font-medium text-muted">{label}</dt>
      <dd className="mt-1 text-body-sm text-fg">{children}</dd>
    </div>
  );
}

// ── Users (AUTH-17) ─────────────────────────────────────────────────────────────────────────
export function UsersSection() {
  const { t, locale } = useTranslation();
  const can = useCan();
  const readOnly = !can('settings.manage');
  const me = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const statuses = useSsoAdminStore((s) => s.userStatus);
  const setStatus = useSsoAdminStore((s) => s.setUserStatus);
  void statuses; // re-render on status changes

  const toggle = (id: string, name: string, next: 'active' | 'disabled') => {
    setStatus(id, next);
    recordAuthEvent(next === 'active' ? 'auth_user_provisioned' : 'auth_user_deprovisioned', { actorId: me.userId, actorRole: me.role, entityId: id, note: name });
    toast(t(next === 'active' ? 'settings.users.reactivated' : 'settings.users.deprovisioned', { name }));
  };

  return (
    <>
      <SectionHeader slug="users" readOnly={readOnly} />
      {readOnly && <ReadOnlyNotice />}
      <div className="relative overflow-x-auto rounded-card border border-line bg-surface">
        <table className="mesta-table rows-lg min-w-[860px]" style={{ tableLayout: 'fixed' }}>
          <caption className="sr-only">{t('settings.section.users.title')}</caption>
          <colgroup><col /><col style={{ width: 200 }} /><col style={{ width: 112 }} /><col style={{ width: 144 }} /><col style={{ width: 120 }} /><col style={{ width: 136 }} /></colgroup>
          <thead><tr>
            <th scope="col" className="text-left">{t('settings.users.user')}</th>
            <th scope="col" className="text-left">{t('settings.users.workspaces')}</th>
            <th scope="col" className="text-left">{t('settings.users.role')}</th>
            <th scope="col" className="text-left">{t('settings.users.status')}</th>
            <th scope="col" className="text-left">{t('settings.users.lastSignIn')}</th>
            <th scope="col" className="text-right"><span className="sr-only">{t('settings.users.actions')}</span></th>
          </tr></thead>
          <tbody>
            {DIRECTORY_USERS.map((u) => {
              const status = statusOf(u);
              const firstWs = u.memberships[0]?.workspaceId ?? '';
              const role = roleFor(u, firstWs);
              return (
                <tr key={u.id}>
                  <td>
                    <span className="block truncate font-semibold text-fg">{u.name}</span>
                    <span className="block truncate text-caption text-faint">{u.email} · {u.groups.join(', ')}</span>
                  </td>
                  <td>
                    <span className="block truncate text-body-sm text-fg" title={u.memberships.map((m) => workspaceLabel(m.workspaceId)).join('\n')}>{workspaceLabel(firstWs)}</span>
                    {u.memberships.length > 1 && <span className="block text-caption text-faint">{t('settings.users.more', { n: u.memberships.length - 1 })}</span>}
                  </td>
                  <td className="truncate">{role ? t(`common.role.${role}`) : <span className="text-faint">—</span>}</td>
                  <td><StatusBadge status={status === 'active' ? 'healthy' : 'failed'} label={t(`settings.users.state.${status}`)} /></td>
                  <td className="tabular truncate text-muted">{u.lastSignInAt ? formatRelativeTime(u.lastSignInAt, locale) : t('settings.api.never')}</td>
                  <td className="text-right">
                    {status === 'active'
                      ? <Button size="sm" variant="secondary" disabled={readOnly || u.id === me.userId} onClick={() => toggle(u.id, u.name, 'disabled')}>{t('settings.users.deprovision')}</Button>
                      : <Button size="sm" variant="secondary" disabled={readOnly} onClick={() => toggle(u.id, u.name, 'active')}>{t('settings.users.reactivate')}</Button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-caption text-faint">{t('settings.users.scimNote')}</p>
    </>
  );
}

// ── Sessions (AUTH-06/19 revocation) ────────────────────────────────────────────────────────
interface OtherSession { id: string; user: string; device: string; ip: string; started: string }
const OTHER_SESSIONS: OtherSession[] = [
  { id: 'sess_demo_budi', user: 'Budi Manager', device: 'Chrome · Windows', ip: '10.12.4.21', started: '2026-09-25T07:40:00+07:00' },
  { id: 'sess_demo_andre', user: 'Andre Finance', device: 'Chrome · macOS', ip: '10.12.6.40', started: '2026-09-25T08:15:00+07:00' },
  { id: 'sess_demo_sari', user: 'Sari Ops', device: 'Edge · Windows', ip: '10.12.8.3', started: '2026-09-25T06:05:00+07:00' },
  { id: 'sess_demo_dewi', user: 'Dewi Compliance', device: 'Safari · macOS', ip: '10.14.1.77', started: '2026-09-24T16:20:00+07:00' },
];

export function SessionsSection() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const can = useCan();
  const readOnly = !can('settings.manage');
  const me = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const session = useAuthStore((s) => s.session);
  const revoked = useAuthStore((s) => s.revoked);
  const revoke = useAuthStore((s) => s.revoke);
  const [confirm, setConfirm] = useState<{ id: string; user: string; self: boolean } | null>(null);

  const doRevoke = () => {
    if (!confirm) return;
    if (confirm.self) { setConfirm(null); router.replace('/auth/logout?reason=revoked'); return; }
    revoke(confirm.id);
    recordAuthEvent('auth_session_revoked', { actorId: me.userId, actorRole: me.role, entityId: confirm.id, note: confirm.user });
    toast(t('settings.sessions.revoked', { user: confirm.user }));
    setConfirm(null);
  };

  return (
    <>
      <SectionHeader slug="sessions" readOnly={readOnly} />
      {readOnly && <ReadOnlyNotice />}
      <div className="flex flex-col gap-8">
        {session && (
          <SettingsCard title={t('settings.sessions.current')}>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
              <Fact label={t('settings.sessions.signedInAs')}>{session.name} · {session.email}</Fact>
              <Fact label={t('settings.sessions.workspace')}>{workspaceLabel(session.workspaceId)}</Fact>
              <Fact label={t('settings.sessions.provider')}>{session.identityProvider}</Fact>
              <Fact label={t('settings.sessions.started')}><span className="tabular">{formatDate(session.sessionCreatedAt, locale)}</span></Fact>
              <Fact label={t('settings.sessions.expires')}><span className="tabular">{formatDate(session.sessionExpiry, locale)}</span></Fact>
              <Fact label={t('settings.sessions.role')}>{t(`common.role.${session.role}`)}</Fact>
            </dl>
            <div className="mt-5 flex justify-end">
              <Button variant="secondary" onClick={() => setConfirm({ id: session.sessionId, user: session.name, self: true })}>{t('settings.sessions.endMine')}</Button>
            </div>
          </SettingsCard>
        )}
        <SettingsCard title={t('settings.sessions.active')}>
          <div className="relative -mx-6 -mb-6 overflow-x-auto border-t border-divider">
            <table className="mesta-table min-w-[760px]" style={{ tableLayout: 'fixed' }}>
              <caption className="sr-only">{t('settings.sessions.active')}</caption>
              <colgroup><col /><col style={{ width: 176 }} /><col style={{ width: 128 }} /><col style={{ width: 160 }} /><col style={{ width: 112 }} /></colgroup>
              <thead><tr>
                <th scope="col" className="text-left">{t('settings.sessions.user')}</th>
                <th scope="col" className="text-left">{t('settings.sessions.device')}</th>
                <th scope="col" className="text-left">{t('settings.sessions.ip')}</th>
                <th scope="col" className="text-left">{t('settings.sessions.started')}</th>
                <th scope="col" className="text-right"><span className="sr-only">{t('settings.sessions.revoke')}</span></th>
              </tr></thead>
              <tbody>
                {OTHER_SESSIONS.filter((s) => s.user !== session?.name).map((s) => {
                  const isRevoked = revoked.includes(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="truncate font-semibold text-fg">{s.user}</td>
                      <td className="truncate text-muted">{s.device}</td>
                      <td className="tabular truncate text-muted">{s.ip}</td>
                      <td className="tabular truncate text-muted">{formatRelativeTime(s.started, locale)}</td>
                      <td className="text-right">
                        {isRevoked ? <Pill size="sm" tone="faint">{t('settings.sessions.revokedLabel')}</Pill>
                          : <Button size="sm" variant="secondary" disabled={readOnly} onClick={() => setConfirm({ id: s.id, user: s.user, self: false })}>{t('settings.sessions.revoke')}</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SettingsCard>
      </div>
      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title={t('settings.sessions.confirmTitle')}>
        <p className="text-body-sm text-muted">{confirm && t(confirm.self ? 'settings.sessions.confirmSelf' : 'settings.sessions.confirmBody', { user: confirm.user })}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirm(null)}>{t('common.action.cancel')}</Button>
          <Button variant="destructive" onClick={doRevoke}>{t('settings.sessions.revoke')}</Button>
        </div>
      </Dialog>
    </>
  );
}

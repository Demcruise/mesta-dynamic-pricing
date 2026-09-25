'use client';

import { ArrowDown, ChevronRight, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Pill } from '@/components/ds/Pill';
import { StatusBadge } from '@/components/ds/StatusBadge';
import { Button } from '@/components/ui/button';
import { fieldInputCls } from '@/components/ui/field';
import { CATEGORIES } from '@/lib/categories';
import { formatDate, formatPrice, formatRelativeTime } from '@/lib/format';
import { governingStrategy } from '@/lib/guardrails';
import { useTranslation } from '@/lib/i18n';
import type { Role } from '@/lib/ontology';
import { useDataSources, useRecommendations, useScopedSkuList, useStrategies } from '@/lib/queries';
import { ROLES } from '@/lib/rbac';
import { ALL_STORES, BU_BY_REGION, ORG_NAME, REGIONS, STORES_BY_REGION } from '@/lib/scope';
import { applyRounding, type Channel, type EngineAction, type SourceSystem, type WorkspaceConfig } from '@/lib/settings-config';
import { useToastStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { FormGrid, NumberInput, ReadOnlyNotice, SaveBar, SectionHeader, SettingField, SettingsCard, ToggleRow, selectCls, useSectionEditor } from './ui';

const SYSTEMS: SourceSystem[] = ['erp', 'pos', 'engine', 'competitor', 'model', 'warehouse'];
const ACTIONS: EngineAction[] = ['block', 'fallback', 'flag', 'warn'];

/** Resolves an error code from validateSection to its message. */
function useErr(errors: Record<string, string>) {
  const { t } = useTranslation();
  return (field: string) => (errors[field] ? t(`settings.err.${errors[field]}`) : undefined);
}

// ── General (SET-003) ─────────────────────────────────────────────────────────────────────
export function GeneralSection() {
  const { t, locale } = useTranslation();
  const ed = useSectionEditor('general');
  const v = ed.value;
  const text = (key: keyof WorkspaceConfig['general'], label: string, readOnlyField = false) => (
    <SettingField label={label} htmlFor={`gen-${key}`}>
      <input id={`gen-${key}`} className={cn(fieldInputCls, 'disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted')} disabled={ed.readOnly || readOnlyField}
        value={String(v[key])} onChange={(e) => ed.set({ [key]: e.target.value } as Partial<WorkspaceConfig['general']>)} />
    </SettingField>
  );
  return (
    <>
      <SectionHeader slug="general" meta={ed.meta} readOnly={ed.readOnly} />
      {ed.readOnly && <ReadOnlyNotice />}
      <div className="flex flex-col gap-8">
        <SettingsCard title={t('settings.general.identity')}>
          <FormGrid>
            {text('name', t('settings.general.name'))}
            {text('workspaceId', t('settings.general.id'), true)}
            {text('org', t('settings.general.org'))}
            <SettingField label={t('settings.general.environment')} htmlFor="gen-env">
              <select id="gen-env" className={selectCls} disabled={ed.readOnly} value={v.environment} onChange={(e) => ed.set({ environment: e.target.value as typeof v.environment })}>
                {(['production', 'staging', 'sandbox'] as const).map((x) => <option key={x} value={x}>{t(`settings.general.env.${x}`)}</option>)}
              </select>
            </SettingField>
            <SettingField label={t('settings.general.statusLabel')}>
              <span className="flex h-control-lg items-center"><StatusBadge status={v.status === 'active' ? 'healthy' : 'warning'} label={t(`settings.general.status.${v.status}`)} /></span>
            </SettingField>
            <SettingField label={t('settings.general.created')}>
              <span className="tabular flex h-control-lg items-center text-body text-fg">{formatDate(v.createdAt, locale)}</span>
            </SettingField>
          </FormGrid>
        </SettingsCard>
        <SettingsCard title={t('settings.general.ownership')}>
          <FormGrid>
            {text('owner', t('settings.general.owner'))}
            {text('admin', t('settings.general.admin'))}
            {text('support', t('settings.general.support'))}
          </FormGrid>
        </SettingsCard>
      </div>
      <SaveBar sectionKey="general" slug="general" editor={ed} />
    </>
  );
}

// ── Scope & hierarchy (SET-004/005) ───────────────────────────────────────────────────────
export function ScopeSection() {
  const { t } = useTranslation();
  const ed = useSectionEditor('scope');
  const v = ed.value;
  const stores = v.defaultRegion ? STORES_BY_REGION[v.defaultRegion as keyof typeof STORES_BY_REGION] ?? [] : ALL_STORES;
  const bus = [...new Set(Object.values(BU_BY_REGION))];
  const startPath = [ORG_NAME, v.defaultRegion ? BU_BY_REGION[v.defaultRegion as keyof typeof BU_BY_REGION] : `${t('settings.scope.all')} ${v.buLabel}`,
    v.defaultRegion || `${t('settings.scope.all')} ${v.regionLabel}`, v.defaultStore || `${t('settings.scope.all')} ${v.storeLabel}`, v.defaultCategory || `${t('settings.scope.all')} ${v.categoryLabel}`].join(' / ');
  return (
    <>
      <SectionHeader slug="scope-hierarchy" meta={ed.meta} readOnly={ed.readOnly} />
      {ed.readOnly && <ReadOnlyNotice />}
      <div className="flex flex-col gap-8">
        <SettingsCard title={t('settings.scope.hierarchy')}>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              <FormGrid>
                {(['buLabel', 'regionLabel', 'storeLabel', 'categoryLabel'] as const).map((key, i) => (
                  <SettingField key={key} label={t(`settings.scope.${['bu', 'region', 'store', 'category'][i]}`)} htmlFor={`sc-${key}`}>
                    <input id={`sc-${key}`} className={fieldInputCls} disabled={ed.readOnly} value={v[key]} onChange={(e) => ed.set({ [key]: e.target.value })} />
                  </SettingField>
                ))}
              </FormGrid>
              <SettingField label={t('settings.scope.source')} htmlFor="sc-src">
                <select id="sc-src" className={selectCls} disabled={ed.readOnly} value={v.source} onChange={(e) => ed.set({ source: e.target.value as SourceSystem })}>
                  {SYSTEMS.map((s) => <option key={s} value={s}>{t(`settings.system.${s}`)}</option>)}
                </select>
              </SettingField>
              <ToggleRow label={t('settings.scope.inherit')} checked={v.inherit} disabled={ed.readOnly} onChange={(inherit) => ed.set({ inherit })} />
            </div>
            {/* Read-only tree preview of the live hierarchy. */}
            <div>
              <p className="mb-3 text-label text-muted">{t('settings.scope.preview')}</p>
              <ul className="rounded-input border border-line bg-subtle p-4 font-mono text-caption text-fg" aria-label={t('settings.scope.preview')}>
                <li className="font-semibold">{ORG_NAME}</li>
                {bus.map((bu) => (
                  <li key={bu} className="ml-3 border-l border-line-strong pl-3">
                    <span className="text-muted">{v.buLabel}:</span> {bu}
                    <ul>
                      {REGIONS.filter((r) => BU_BY_REGION[r] === bu).map((r) => (
                        <li key={r} className="ml-3 border-l border-line-strong pl-3">
                          <span className="text-muted">{v.regionLabel}:</span> {r}
                          <ul>{STORES_BY_REGION[r].slice(0, 3).map((s) => <li key={s} className="ml-3 border-l border-line-strong pl-3"><span className="text-muted">{v.storeLabel}:</span> {s}</li>)}</ul>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SettingsCard>
        <SettingsCard title={t('settings.scope.defaults')} description={t('settings.scope.noRewrite')}>
          <FormGrid>
            <SettingField label={t('settings.scope.defaultRegion')} htmlFor="sc-region">
              <select id="sc-region" className={selectCls} disabled={ed.readOnly} value={v.defaultRegion} onChange={(e) => ed.set({ defaultRegion: e.target.value, defaultStore: '' })}>
                <option value="">{t('settings.scope.all')}</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </SettingField>
            <SettingField label={t('settings.scope.defaultStore')} htmlFor="sc-store">
              <select id="sc-store" className={selectCls} disabled={ed.readOnly} value={v.defaultStore} onChange={(e) => ed.set({ defaultStore: e.target.value })}>
                <option value="">{t('settings.scope.all')}</option>
                {stores.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </SettingField>
            <SettingField label={t('settings.scope.defaultCategory')} htmlFor="sc-cat">
              <select id="sc-cat" className={selectCls} disabled={ed.readOnly} value={v.defaultCategory} onChange={(e) => ed.set({ defaultCategory: e.target.value })}>
                <option value="">{t('settings.scope.all')}</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </SettingField>
            <SettingField label={t('settings.scope.currency')} htmlFor="sc-cur">
              <select id="sc-cur" className={selectCls} disabled={ed.readOnly} value={v.currency} onChange={(e) => ed.set({ currency: e.target.value })}>
                <option value="IDR">IDR — Indonesian Rupiah</option>
              </select>
            </SettingField>
            <p className="md:col-span-2 rounded-input bg-subtle px-4 py-3 text-body-sm">
              <span className="font-medium text-fg">{t('settings.scope.current')}: </span><span className="text-muted">{startPath}</span>
            </p>
          </FormGrid>
        </SettingsCard>
      </div>
      <SaveBar sectionKey="scope" slug="scope-hierarchy" editor={ed} />
    </>
  );
}

// ── Pricing engine (SET-006/007/008/028/029) ──────────────────────────────────────────────
export function PricingEngineSection() {
  const { t, locale } = useTranslation();
  const ed = useSectionEditor('pricing');
  const err = useErr(ed.errors);
  const v = ed.value;
  const strategies = useStrategies().data;
  const recs = useRecommendations().data;
  const sample = 49_287;
  const final = applyRounding(sample, v.rounding, v.increment, v.psychological);
  return (
    <>
      <SectionHeader slug="pricing-engine" meta={ed.meta} readOnly={ed.readOnly} />
      {ed.readOnly && <ReadOnlyNotice />}
      <div className="flex flex-col gap-8">
        <SettingsCard title={t('settings.pricing.calc')}>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <FormGrid>
              <SettingField label={t('settings.pricing.currency')} htmlFor="pe-cur">
                <select id="pe-cur" className={selectCls} disabled={ed.readOnly} value={v.currency} onChange={(e) => ed.set({ currency: e.target.value })}><option value="IDR">IDR</option></select>
              </SettingField>
              <SettingField label={t('settings.pricing.precision')} htmlFor="pe-prec">
                <select id="pe-prec" className={selectCls} disabled={ed.readOnly} value={v.precision} onChange={(e) => ed.set({ precision: Number(e.target.value) })}>
                  {[0, 1, 2].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </SettingField>
              <SettingField label={t('settings.pricing.rounding')} htmlFor="pe-round">
                <select id="pe-round" className={selectCls} disabled={ed.readOnly} value={v.rounding} onChange={(e) => ed.set({ rounding: e.target.value as typeof v.rounding })}>
                  {(['nearest', 'up', 'down'] as const).map((r) => <option key={r} value={r}>{t(`settings.pricing.round.${r}`)}</option>)}
                </select>
              </SettingField>
              <SettingField label={t('settings.pricing.increment')} htmlFor="pe-inc" error={err('increment')}>
                <NumberInput id="pe-inc" prefix="IDR" value={v.increment} disabled={ed.readOnly} invalid={!!ed.errors.increment} onChange={(n) => ed.set({ increment: n ?? 0 })} />
              </SettingField>
              <div className="md:col-span-2">
                <ToggleRow label={t('settings.pricing.psychological')} checked={v.psychological} disabled={ed.readOnly} onChange={(psychological) => ed.set({ psychological })} />
              </div>
            </FormGrid>
            {/* SET-007: the transformation is always visible, never hidden. */}
            <dl aria-label={t('settings.pricing.example')} className="flex flex-col gap-3 self-start rounded-card border border-line bg-subtle p-5">
              <p className="text-caption font-semibold uppercase tracking-wide text-faint">{t('settings.pricing.example')}</p>
              <div><dt className="text-caption text-muted">{t('settings.pricing.calculated')}</dt><dd className="tabular text-numeric-md text-fg">{formatPrice(sample, locale)}</dd></div>
              <div className="flex items-center gap-2 text-muted"><ArrowDown className="size-4" aria-hidden /><dt className="text-caption">{t('settings.pricing.applied')}:</dt><dd className="text-caption">{t(`settings.pricing.round.${v.rounding}`)} · IDR {v.increment.toLocaleString('en-US')}</dd></div>
              <div><dt className="text-caption text-muted">{t('settings.pricing.final')}</dt><dd className="tabular text-numeric-md font-semibold text-brand">{formatPrice(final, locale)}</dd></div>
            </dl>
          </div>
        </SettingsCard>

        <SettingsCard title={t('settings.pricing.cadence')}>
          <FormGrid>
            <SettingField label={t('settings.pricing.refresh')} htmlFor="pe-refresh"><NumberInput id="pe-refresh" suffix={t('settings.unit.minutes')} value={v.refreshMinutes} disabled={ed.readOnly} onChange={(n) => ed.set({ refreshMinutes: n ?? 0 })} /></SettingField>
            <SettingField label={t('settings.pricing.recFreshness')} htmlFor="pe-recf"><NumberInput id="pe-recf" suffix={t('settings.unit.days')} value={v.recFreshnessDays} disabled={ed.readOnly} onChange={(n) => ed.set({ recFreshnessDays: n ?? 0 })} /></SettingField>
            <SettingField label={t('settings.pricing.simHorizon')} htmlFor="pe-sim"><NumberInput id="pe-sim" suffix={t('settings.unit.days')} value={v.simHorizonDays} disabled={ed.readOnly} onChange={(n) => ed.set({ simHorizonDays: n ?? 0 })} /></SettingField>
            <SettingField label={t('settings.pricing.competitorFreshness')} htmlFor="pe-comp"><NumberInput id="pe-comp" suffix={t('settings.unit.hours')} value={v.competitorFreshnessHours} disabled={ed.readOnly} onChange={(n) => ed.set({ competitorFreshnessHours: n ?? 0 })} /></SettingField>
          </FormGrid>
        </SettingsCard>

        <SettingsCard title={t('settings.pricing.behavior')} description={t('settings.pricing.behaviorHint')}>
          <FormGrid>
            {(Object.keys(v.behavior) as (keyof typeof v.behavior)[]).map((b) => (
              <SettingField key={b} label={t(`settings.pricing.b.${b}`)} htmlFor={`pe-b-${b}`} sensitive={b === 'guardrailFailure'}>
                <select id={`pe-b-${b}`} className={selectCls} disabled={ed.readOnly} value={v.behavior[b]} onChange={(e) => ed.set({ behavior: { ...v.behavior, [b]: e.target.value as EngineAction } })}>
                  {ACTIONS.map((a) => <option key={a} value={a}>{t(`settings.action.${a}`)}</option>)}
                </select>
              </SettingField>
            ))}
          </FormGrid>
        </SettingsCard>

        {/* SET-028/029: model transparency lives with the engine it describes, concise and factual. */}
        <SettingsCard title={t('settings.model.title')} description={t('settings.model.switchLocked')}>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2">
            <Fact label={t('settings.model.type')}>{t('settings.model.typeValue')}</Fact>
            <Fact label={t('settings.model.version')}><span className="tabular">{v.demandModel}</span> · <Pill tone="up" size="sm">{t('settings.model.statusValue')}</Pill></Fact>
            <Fact label={t('settings.model.released')}><span className="tabular">{formatDate('2026-09-01T09:00:00+07:00', locale)}</span></Fact>
            <Fact label={t('settings.model.usedBy')}>{t('settings.model.usedByValue', { n: strategies.filter((s) => s.status === 'active').length })}</Fact>
            <Fact label={t('settings.model.sources')}>{t('settings.model.sourcesValue')}</Fact>
            <Fact label={t('settings.model.volume')}>{t('common.settings.aiVolumeBody', { total: recs.length, pending: recs.filter((r) => r.status === 'pending').length, decided: recs.filter((r) => r.status !== 'pending').length })}</Fact>
            <Fact label={t('settings.model.method')}>{t('settings.model.methodValue')}</Fact>
            <Fact label={t('settings.model.review')}>{t('settings.model.reviewValue')}</Fact>
            <div className="rounded-input bg-warn-soft px-4 py-3 md:col-span-2">
              <dt className="text-caption font-semibold text-warn">{t('settings.model.limits')}</dt>
              <dd className="mt-0.5 text-body-sm text-fg">{t('settings.model.limitsValue')}</dd>
            </div>
          </dl>
        </SettingsCard>
      </div>
      <SaveBar sectionKey="pricing" slug="pricing-engine" editor={ed} />
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

// ── Data & integrations (SET-009/010/011) ─────────────────────────────────────────────────
export function IntegrationsSection() {
  const { t, locale } = useTranslation();
  const ed = useSectionEditor('data');
  const err = useErr(ed.errors);
  const v = ed.value;
  const sources = useDataSources().data;
  const toast = useToastStore((s) => s.push);
  return (
    <>
      <SectionHeader slug="integrations" meta={ed.meta} readOnly={ed.readOnly} />
      {ed.readOnly && <ReadOnlyNotice />}
      <div className="flex flex-col gap-8">
        <SettingsCard title={t('settings.int.center')}>
          <div className="-mx-6 -mb-6 overflow-x-auto border-t border-divider">
            <table className="mesta-table min-w-[960px]" style={{ tableLayout: 'fixed' }}>
              <caption className="sr-only">{t('settings.int.center')}</caption>
              <colgroup><col /><col style={{ width: 132 }} /><col style={{ width: 132 }} /><col style={{ width: 120 }} /><col style={{ width: 88 }} /><col style={{ width: 120 }} /><col style={{ width: 232 }} /></colgroup>
              <thead><tr>
                <th scope="col" className="text-left">{t('settings.int.connection')}</th>
                <th scope="col" className="text-left">{t('settings.int.status')}</th>
                <th scope="col" className="text-left">{t('settings.int.lastSync')}</th>
                <th scope="col" className="text-right">{t('settings.int.records')}</th>
                <th scope="col" className="text-right">{t('settings.int.errors')}</th>
                <th scope="col" className="text-left">{t('settings.int.env')}</th>
                <th scope="col" className="text-right">{t('settings.int.actions')}</th>
              </tr></thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="block truncate font-semibold text-fg">{s.name}</span>
                      <span className="block truncate text-caption text-faint">{t(`data.kind.${s.kind}`)} · {t('settings.int.owner')}: {t('common.role.ops_lead')}</span>
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className="tabular truncate text-muted">{formatRelativeTime(s.lastSyncAt, locale)}</td>
                    <td className="num">{s.recordsTotal.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US')}</td>
                    <td className={cn('num', s.rejectedRecords > 0 ? 'font-semibold text-critical' : 'text-muted')}>{s.rejectedRecords}</td>
                    <td className="text-muted">{t('settings.general.env.production')}</td>
                    <td className="text-right">
                      <span className="inline-flex gap-2">
                        <Link href="/data" className="inline-flex h-control-sm items-center rounded-input px-2.5 text-caption font-medium text-brand hover:bg-subtle">{t('settings.int.details')}</Link>
                        <Button size="sm" variant="secondary" disabled={ed.readOnly} onClick={() => toast(t('settings.int.testOk', { name: s.name }))}>{t('settings.int.test')}</Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SettingsCard>

        <SettingsCard title={t('settings.int.freshness')} description={t('settings.int.freshnessHint')}>
          <div className="flex flex-col divide-y divide-divider">
            {(Object.keys(v.freshness) as (keyof typeof v.freshness)[]).map((f) => (
              <div key={f} className="grid grid-cols-1 items-start gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)]">
                <p className="pt-3 text-label font-semibold text-fg">{t(`settings.int.feed.${f}`)}</p>
                <SettingField label={t('settings.int.warnAfter')} htmlFor={`fr-${f}-w`}>
                  <NumberInput id={`fr-${f}-w`} suffix={t('settings.unit.hours')} value={v.freshness[f].warn} disabled={ed.readOnly} onChange={(n) => ed.set({ freshness: { ...v.freshness, [f]: { ...v.freshness[f], warn: n ?? 0 } } })} />
                </SettingField>
                <SettingField label={t('settings.int.blockAfter')} htmlFor={`fr-${f}-b`} error={err(`freshness.${f}`)}>
                  <NumberInput id={`fr-${f}-b`} suffix={t('settings.unit.hours')} value={v.freshness[f].block} disabled={ed.readOnly} invalid={!!ed.errors[`freshness.${f}`]} onChange={(n) => ed.set({ freshness: { ...v.freshness, [f]: { ...v.freshness[f], block: n ?? 0 } } })} />
                </SettingField>
              </div>
            ))}
          </div>
        </SettingsCard>

        <SettingsCard title={t('settings.int.sot')}>
          <FormGrid>
            {(Object.keys(v.sourceOfTruth) as (keyof typeof v.sourceOfTruth)[]).map((f) => (
              <SettingField key={f} label={t(`settings.int.sotField.${f}`)} htmlFor={`sot-${f}`}>
                <select id={`sot-${f}`} className={selectCls} disabled={ed.readOnly} value={v.sourceOfTruth[f]} onChange={(e) => ed.set({ sourceOfTruth: { ...v.sourceOfTruth, [f]: e.target.value as SourceSystem } })}>
                  {SYSTEMS.map((s) => <option key={s} value={s}>{t(`settings.system.${s}`)}</option>)}
                </select>
              </SettingField>
            ))}
            <SettingField label={t('settings.int.conflictLabel')} htmlFor="sot-conflict" className="md:col-span-2">
              <select id="sot-conflict" className={selectCls} disabled={ed.readOnly} value={v.conflict} onChange={(e) => ed.set({ conflict: e.target.value as typeof v.conflict })}>
                {(['source_of_truth', 'most_recent', 'flag'] as const).map((c) => <option key={c} value={c}>{t(`settings.int.conflict.${c}`)}</option>)}
              </select>
            </SettingField>
          </FormGrid>
        </SettingsCard>
      </div>
      <SaveBar sectionKey="data" slug="integrations" editor={ed} />
    </>
  );
}

// ── Approval policies (SET-013/014) ───────────────────────────────────────────────────────
export function ApprovalsSection() {
  const { t, locale } = useTranslation();
  const ed = useSectionEditor('approvals');
  const err = useErr(ed.errors);
  const v = ed.value;
  const setTier = (i: number, patch: Partial<(typeof v.tiers)[number]>) => ed.set({ tiers: v.tiers.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  // SET-014: strategies are authored by analysts/managers; a tier approved by the author's role violates SoD.
  const authorRoles: Role[] = ['analyst'];
  const sodViolations = v.sod.authorNotApprover ? v.tiers.map((tier, i) => ({ tier, i })).filter(({ tier }) => tier.max === null && authorRoles.includes(tier.role)) : [];
  return (
    <>
      <SectionHeader slug="approvals" meta={ed.meta} readOnly={ed.readOnly} actions={<Link href="/approvals" className="inline-flex items-center gap-1 text-label font-medium text-brand hover:underline">{t('common.nav.approvals')}<ChevronRight className="size-4" aria-hidden /></Link>} />
      {ed.readOnly && <ReadOnlyNotice />}
      <div className="flex flex-col gap-8">
        <SettingsCard title={t('settings.appr.tiers')} description={t('settings.appr.tiersHint')}>
          <ol className="flex flex-col gap-4">
            {v.tiers.map((tier, i) => (
              <li key={i} className="grid grid-cols-1 items-start gap-x-6 gap-y-3 rounded-input border border-line p-4 md:grid-cols-[88px_minmax(0,1fr)_minmax(0,1fr)]">
                <p className="pt-3 text-label font-semibold text-fg">{t('settings.appr.level', { n: i + 1 })}</p>
                <SettingField label={tier.max === null ? t('settings.appr.above') : t('settings.appr.upTo')} htmlFor={`tier-${i}`} error={err(`tiers.${i}`)} sensitive>
                  {tier.max === null
                    ? <span className="tabular flex h-control-lg items-center text-body text-muted">&gt; {formatPrice(v.tiers[i - 1]?.max ?? 0, locale)}</span>
                    : <NumberInput id={`tier-${i}`} prefix="IDR" value={tier.max} disabled={ed.readOnly} invalid={!!ed.errors[`tiers.${i}`]} onChange={(n) => setTier(i, { max: n ?? 0 })} />}
                </SettingField>
                <SettingField label={t('settings.appr.approver')} htmlFor={`tier-role-${i}`}>
                  <select id={`tier-role-${i}`} className={selectCls} disabled={ed.readOnly} value={tier.role} onChange={(e) => setTier(i, { role: e.target.value as Role })}>
                    {ROLES.map((r) => <option key={r} value={r}>{t(`common.role.${r}`)}</option>)}
                  </select>
                </SettingField>
              </li>
            ))}
          </ol>
        </SettingsCard>

        <SettingsCard title={t('settings.appr.timing')}>
          <FormGrid>
            <SettingField label={t('settings.appr.sla')} htmlFor="ap-sla" error={err('slaHours')}><NumberInput id="ap-sla" suffix={t('settings.unit.hours')} value={v.slaHours} disabled={ed.readOnly} onChange={(n) => ed.set({ slaHours: n ?? 0 })} /></SettingField>
            <SettingField label={t('settings.appr.escalate')} htmlFor="ap-esc"><NumberInput id="ap-esc" suffix={t('settings.unit.hours')} value={v.escalateAfterHours} disabled={ed.readOnly} onChange={(n) => ed.set({ escalateAfterHours: n ?? 0 })} /></SettingField>
            <SettingField label={t('settings.appr.expiry')} htmlFor="ap-exp"><NumberInput id="ap-exp" suffix={t('settings.unit.days')} value={v.expiryDays} disabled={ed.readOnly} onChange={(n) => ed.set({ expiryDays: n ?? 0 })} /></SettingField>
            <SettingField label={t('settings.appr.auto')} htmlFor="ap-auto" error={err('autoApproveConfidence')} sensitive>
              <NumberInput id="ap-auto" suffix="%" value={v.autoApproveConfidence} disabled={ed.readOnly} invalid={!!ed.errors.autoApproveConfidence} onChange={(n) => ed.set({ autoApproveConfidence: n ?? 0 })} />
            </SettingField>
            <SettingField label={t('settings.appr.highImpact')} htmlFor="ap-hi" sensitive><NumberInput id="ap-hi" prefix="IDR" value={v.highImpactIdr} disabled={ed.readOnly} onChange={(n) => ed.set({ highImpactIdr: n ?? 0 })} /></SettingField>
            <div className="md:col-span-2"><ToggleRow label={t('settings.appr.justification')} checked={v.requireJustification} disabled={ed.readOnly} onChange={(requireJustification) => ed.set({ requireJustification })} /></div>
          </FormGrid>
        </SettingsCard>

        <SettingsCard title={t('settings.appr.sodLabel')}>
          <div className="flex flex-col gap-3">
            {(Object.keys(v.sod) as (keyof typeof v.sod)[]).map((k) => (
              <ToggleRow key={k} sensitive label={t(`settings.appr.sod.${k}`)} checked={v.sod[k]} disabled={ed.readOnly} onChange={(on) => ed.set({ sod: { ...v.sod, [k]: on } })} />
            ))}
            {/* SET-014: violations are visible before saving. */}
            {sodViolations.map(({ tier, i }) => (
              <p key={i} role="alert" className="flex items-start gap-2 rounded-input bg-critical-soft px-4 py-3 text-body-sm text-critical">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />{t('settings.appr.sodViolation', { n: i + 1, role: t(`common.role.${tier.role}`) })}
              </p>
            ))}
          </div>
        </SettingsCard>
      </div>
      <SaveBar sectionKey="approvals" slug="approvals" editor={ed} />
    </>
  );
}

// ── Guardrail defaults + inheritance (SET-015/016) ────────────────────────────────────────
export function GuardrailDefaultsSection() {
  const { t, locale } = useTranslation();
  const ed = useSectionEditor('guardrails');
  const err = useErr(ed.errors);
  const v = ed.value;
  const products = useScopedSkuList().data;
  const strategies = useStrategies().data;
  const governed = useMemo(() => products.filter((p) => governingStrategy(p, strategies)), [products, strategies]);
  const [sku, setSku] = useState('');
  const product = governed.find((p) => p.sku === sku) ?? governed[0] ?? products[0];
  const strategy = product ? governingStrategy(product, strategies) : null;
  // Inheritance chain for "max change per cycle": workspace → strategy → SKU (product bounds don't set %).
  const levels = [
    { level: 'workspace', value: v.maxChangePct, set: true },
    { level: 'strategy', value: strategy?.guardrail.maxChangePercent ?? null, set: !!strategy },
    { level: 'sku', value: null as number | null, set: false },
  ];
  const effective = [...levels].reverse().find((l) => l.set && l.value !== null)?.value ?? v.maxChangePct;
  return (
    <>
      <SectionHeader slug="guardrails" meta={ed.meta} readOnly={ed.readOnly} actions={<Link href="/guardrails" className="inline-flex items-center gap-1 text-label font-medium text-brand hover:underline">{t('common.nav.guardrails')}<ChevronRight className="size-4" aria-hidden /></Link>} />
      {ed.readOnly && <ReadOnlyNotice />}
      <div className="flex flex-col gap-8">
        <SettingsCard title={t('settings.gr.defaults')}>
          <FormGrid>
            <SettingField label={t('settings.gr.maxChange')} htmlFor="gr-max" error={err('maxChangePct')} sensitive>
              <NumberInput id="gr-max" suffix="%" value={v.maxChangePct} disabled={ed.readOnly} invalid={!!ed.errors.maxChangePct} onChange={(n) => ed.set({ maxChangePct: n ?? 0 })} />
            </SettingField>
            <SettingField label={t('settings.gr.ceiling')} htmlFor="gr-ceil" error={err('ceilingPct')} sensitive>
              <NumberInput id="gr-ceil" suffix="%" value={v.ceilingPct} disabled={ed.readOnly} invalid={!!ed.errors.ceilingPct} onChange={(n) => ed.set({ ceilingPct: n ?? 0 })} />
            </SettingField>
            <SettingField label={t('settings.gr.floorPrice')} hint={t('settings.gr.floorHint')} htmlFor="gr-floor" sensitive>
              <NumberInput id="gr-floor" prefix="IDR" allowEmpty value={v.floorPrice} disabled={ed.readOnly} onChange={(n) => ed.set({ floorPrice: n })} />
            </SettingField>
            <SettingField label={t('settings.gr.approvalThreshold')} htmlFor="gr-appr" sensitive>
              <NumberInput id="gr-appr" prefix="IDR" value={v.approvalThresholdIdr} disabled={ed.readOnly} onChange={(n) => ed.set({ approvalThresholdIdr: n ?? 0 })} />
            </SettingField>
            <SettingField label={t('settings.gr.confidence')} htmlFor="gr-conf" error={err('confidenceThreshold')} sensitive>
              <NumberInput id="gr-conf" suffix="%" value={v.confidenceThreshold} disabled={ed.readOnly} onChange={(n) => ed.set({ confidenceThreshold: n ?? 0 })} />
            </SettingField>
            <SettingField label={t('settings.gr.frequency')} htmlFor="gr-freq">
              <NumberInput id="gr-freq" suffix={t('settings.unit.days')} value={v.changeFrequencyDays} disabled={ed.readOnly} onChange={(n) => ed.set({ changeFrequencyDays: n ?? 0 })} />
            </SettingField>
            <SettingField label={t('settings.gr.staleData')} htmlFor="gr-stale">
              <select id="gr-stale" className={selectCls} disabled={ed.readOnly} value={v.staleData} onChange={(e) => ed.set({ staleData: e.target.value as EngineAction })}>
                {ACTIONS.map((a) => <option key={a} value={a}>{t(`settings.action.${a}`)}</option>)}
              </select>
            </SettingField>
            <div className="md:self-end"><ToggleRow sensitive label={t('settings.gr.map')} checked={v.mapEnforced} disabled={ed.readOnly} onChange={(mapEnforced) => ed.set({ mapEnforced })} /></div>
          </FormGrid>
        </SettingsCard>

        <SettingsCard title={`${t('settings.gr.inheritance')} · ${t('settings.gr.maxChange')}`} description={t('settings.gr.inheritanceHint')}>
          {product && (
            <label className="mb-5 flex flex-wrap items-center gap-3 text-label text-muted">
              {t('settings.gr.examplePick')}
              <select className={cn(selectCls, 'w-72')} value={product.sku} onChange={(e) => setSku(e.target.value)}>
                {governed.slice(0, 100).map((p) => <option key={p.sku} value={p.sku}>{p.sku} · {p.name}</option>)}
              </select>
            </label>
          )}
          <ol className="grid grid-cols-1 gap-3 md:grid-cols-4" aria-label={t('settings.gr.inheritance')}>
            {levels.map((l, i) => {
              const overrides = l.set && l.value !== null && i > 0;
              return (
                <li key={l.level} className="rounded-input border border-line p-4">
                  <p className="text-caption font-medium text-muted">{t(`settings.gr.level.${l.level}`)}{l.level === 'strategy' && strategy ? ` · ${strategy.name}` : ''}</p>
                  <p className={cn('tabular mt-1 text-numeric-md font-semibold', l.set && l.value !== null ? 'text-fg' : 'text-faint')}>{l.set && l.value !== null ? `±${l.value}%` : '—'}</p>
                  <div className="mt-2">
                    {i === 0 ? <Pill size="sm" tone="neutral">{t('settings.state.default')}</Pill>
                      : overrides ? <Pill size="sm" tone="brand">{t('settings.state.overridden')}</Pill>
                        : <Pill size="sm" tone="faint">{t('settings.state.inherited')}</Pill>}
                  </div>
                </li>
              );
            })}
            <li className="rounded-input border border-brand bg-brand-soft p-4">
              <p className="text-caption font-semibold text-brand">{t('settings.gr.effective')}</p>
              <p className="tabular mt-1 text-numeric-md font-semibold text-brand">±{effective}%</p>
              <p className="mt-2 truncate text-caption text-muted">{product?.sku}</p>
            </li>
          </ol>
        </SettingsCard>
      </div>
      <SaveBar sectionKey="guardrails" slug="guardrails" editor={ed} />
    </>
  );
}

// ── Workflow defaults (SET-017/018/019) ───────────────────────────────────────────────────
export function WorkflowSection() {
  const { t } = useTranslation();
  const ed = useSectionEditor('workflow');
  const v = ed.value;
  const num = (key: keyof typeof v, label: string, suffix: string) => (
    <SettingField label={label} htmlFor={`wf-${key}`}>
      <NumberInput id={`wf-${key}`} suffix={suffix} value={v[key] as number} disabled={ed.readOnly} onChange={(n) => ed.set({ [key]: n ?? 0 } as Partial<typeof v>)} />
    </SettingField>
  );
  const sel = <K extends keyof typeof v>(key: K, label: string, opts: readonly string[], prefix: string) => (
    <SettingField label={label} htmlFor={`wf-${String(key)}`}>
      <select id={`wf-${String(key)}`} className={selectCls} disabled={ed.readOnly} value={String(v[key])} onChange={(e) => ed.set({ [key]: e.target.value } as Partial<typeof v>)}>
        {opts.map((o) => <option key={o} value={o}>{t(`${prefix}.${o}`)}</option>)}
      </select>
    </SettingField>
  );
  return (
    <>
      <SectionHeader slug="workflow" meta={ed.meta} readOnly={ed.readOnly} />
      {ed.readOnly && <ReadOnlyNotice />}
      <div className="flex flex-col gap-8">
        <SettingsCard title={t('settings.wf.recs')}>
          <FormGrid>
            {num('recTtlDays', t('settings.wf.ttl'), t('settings.unit.days'))}
            {num('staleHours', t('settings.wf.stale'), t('settings.unit.hours'))}
            {num('escalateHours', t('settings.wf.escalate'), t('settings.unit.hours'))}
            {sel('defaultQueue', t('settings.wf.queueLabel'), ['decide', 'all', 'impact'], 'settings.wf.queue')}
            {sel('assignment', t('settings.wf.assignment'), ['owner', 'round_robin', 'category'], 'settings.wf.assign')}
            {sel('sort', t('settings.wf.sortLabel'), ['confidence', 'impact', 'age'], 'settings.wf.sort')}
            {sel('reviewMode', t('settings.wf.reviewLabel'), ['cards', 'table'], 'settings.wf.review')}
          </FormGrid>
        </SettingsCard>
        <SettingsCard title={t('settings.wf.sim')}>
          <FormGrid>
            {num('simScenarios', t('settings.wf.simScenarios'), '')}
            {num('simHorizonDays', t('settings.wf.simHorizon'), t('settings.unit.days'))}
            {sel('simBaseline', t('settings.wf.simBaseline'), ['current', 'competitor'], 'settings.wf.baseline')}
            <div className="md:self-end"><ToggleRow label={t('settings.wf.simConfidence')} checked={v.simShowConfidence} disabled={ed.readOnly} onChange={(simShowConfidence) => ed.set({ simShowConfidence })} /></div>
          </FormGrid>
        </SettingsCard>
        <SettingsCard title={t('settings.wf.exp')}>
          <FormGrid>
            {num('expDurationDays', t('settings.wf.expDuration'), t('settings.unit.days'))}
            {num('expMinSample', t('settings.wf.expSample'), t('settings.wf.units'))}
            {num('expMaxDeltaPct', t('settings.wf.expDelta'), '%')}
            <SettingField label={t('settings.wf.expConclusion')} htmlFor="wf-expc">
              <select id="wf-expc" className={selectCls} disabled={ed.readOnly} value={v.expConclusion} onChange={(e) => ed.set({ expConclusion: e.target.value as typeof v.expConclusion })}>
                {(['manager', 'analyst'] as const).map((r) => <option key={r} value={r}>{t(`common.role.${r}`)}</option>)}
              </select>
            </SettingField>
            <div className="md:col-span-2"><ToggleRow label={t('settings.wf.expApproval')} checked={v.expRequireApproval} disabled={ed.readOnly} onChange={(expRequireApproval) => ed.set({ expRequireApproval })} /></div>
          </FormGrid>
        </SettingsCard>
      </div>
      <SaveBar sectionKey="workflow" slug="workflow" editor={ed} />
    </>
  );
}

// ── Alerts & routing (SET-020/021) ────────────────────────────────────────────────────────
export function AlertsRoutingSection() {
  const { t } = useTranslation();
  const ed = useSectionEditor('alerts');
  const v = ed.value;
  const CHANNELS: Channel[] = ['inapp', 'email', 'webhook', 'slack'];
  const setRule = (i: number, patch: Partial<(typeof v.routing)[number]>) => ed.set({ routing: v.routing.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const toggleIn = <T,>(list: T[], x: T) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  return (
    <>
      <SectionHeader slug="alerts" meta={ed.meta} readOnly={ed.readOnly} />
      {ed.readOnly && <ReadOnlyNotice />}
      <SettingsCard title={t('settings.route.title')} description={t('settings.route.hint')}>
        <div className="-mx-6 -mb-6 overflow-x-auto border-t border-divider">
          <table className="mesta-table rows-lg min-w-[1040px]" style={{ tableLayout: 'fixed' }}>
            <caption className="sr-only">{t('settings.route.title')}</caption>
            <colgroup><col /><col style={{ width: 128 }} /><col style={{ width: 300 }} /><col style={{ width: 280 }} /><col style={{ width: 112 }} /></colgroup>
            <thead><tr>
              <th scope="col" className="text-left">{t('settings.route.event')}</th>
              <th scope="col" className="text-left">{t('settings.route.severity')}</th>
              <th scope="col" className="text-left">{t('settings.route.recipients')}</th>
              <th scope="col" className="text-left">{t('settings.route.channels')}</th>
              <th scope="col" className="text-center">{t('settings.route.mandatory')}</th>
            </tr></thead>
            <tbody>
              {v.routing.map((r, i) => (
                <tr key={r.event}>
                  <th scope="row" className="text-left font-semibold text-fg">{t(`settings.event.${r.event}`)}</th>
                  <td><StatusBadge status={r.severity} label={t(`common.severity.${r.severity}`)} /></td>
                  <td>
                    <span className="flex flex-wrap gap-1.5">
                      {ROLES.map((role) => (
                        <button key={role} type="button" disabled={ed.readOnly} aria-pressed={r.recipients.includes(role)}
                          onClick={() => setRule(i, { recipients: toggleIn(r.recipients, role) })}
                          className={cn('h-7 rounded-full border px-2.5 text-caption font-medium transition-colors duration-fast disabled:cursor-not-allowed', r.recipients.includes(role) ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong text-muted hover:text-fg')}>
                          {t(`common.role.${role}`)}
                        </button>
                      ))}
                    </span>
                  </td>
                  <td>
                    <span className="flex flex-wrap gap-1.5">
                      {CHANNELS.map((c) => (
                        <button key={c} type="button" disabled={ed.readOnly} aria-pressed={r.channels.includes(c)}
                          onClick={() => setRule(i, { channels: toggleIn(r.channels, c) })}
                          className={cn('h-7 rounded-full border px-2.5 text-caption font-medium transition-colors duration-fast disabled:cursor-not-allowed', r.channels.includes(c) ? 'border-brand bg-brand-soft text-brand' : 'border-line-strong text-muted hover:text-fg')}>
                          {t(`settings.channel.${c}`)}
                        </button>
                      ))}
                    </span>
                  </td>
                  <td className="text-center">
                    <input type="checkbox" className="size-4 accent-brand" aria-label={`${t('settings.route.mandatory')} — ${t(`settings.event.${r.event}`)}`}
                      disabled={ed.readOnly} checked={r.mandatory} onChange={(e) => setRule(i, { mandatory: e.target.checked })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>
      <SaveBar sectionKey="alerts" slug="alerts" editor={ed} />
    </>
  );
}

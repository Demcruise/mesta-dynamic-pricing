'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { CategoryIcon } from '@/components/ds/ProductIdentity';
import { CATEGORIES } from '@/lib/categories';
import { deriveAlerts, deriveExceptions } from '@/lib/exceptions';
import { catalogRows } from '@/features/guardrails/report';
import { signalRows } from '@/lib/signals';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import {
  useAnomalies, useAuditLog, useDataSources, useDeploymentRecords, useExperiments, useOverrideRequests,
  useRecommendations, useRules, useScenarios, useSkuList, useStrategies,
} from '@/lib/queries';
import { ALL_STORES, regionOfStore } from '@/lib/scope';
import { useProductCatalogStore, useUiStore } from '@/lib/stores';
import { useCommandStore } from './command-store';
import { NAV } from './nav';

interface Item { id: string; group: string; label: string; hint?: string; /** Current state chip (MESTA-SEARCH-001 result anatomy). */ state?: string; href: string; run?: () => void; icon?: ReactNode }

function Highlight({ text, q }: { text: string; q: string }): ReactNode {
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-brand-soft text-brand">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

const MAX_PER_GROUP = 6;
const RECENT_KEY = 'mesta-cmd-recent';
const MAX_RECENT = 5;

function loadRecent(): Item[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as Item[]; } catch { return []; }
}
function saveRecent(item: Item) {
  try {
    const { icon: _icon, ...rest } = item; // ReactNode can't survive localStorage — recents render icon-less.
    const next = [rest, ...loadRecent().filter((r) => r.href !== item.href)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* storage unavailable */ }
}
/** Prefix matches outrank substring matches; stable otherwise. */
const rank = (needle: string) => (a: Item, b: Item) =>
  Number(b.label.toLowerCase().startsWith(needle)) - Number(a.label.toLowerCase().startsWith(needle));

export function CommandMenu() {
  const { open, setOpen } = useCommandStore();
  const { t } = useTranslation();
  const router = useRouter();
  const can = useCan();
  const skus = useSkuList().data;
  const strategies = useStrategies().data;
  const recs = useRecommendations().data;
  const rules = useRules().data;
  const experiments = useExperiments().data;
  const scenarios = useScenarios().data;
  const overrides = useOverrideRequests().data;
  const deployments = useDeploymentRecords().data;
  const anomalies = useAnomalies().data;
  const sources = useDataSources().data;
  const auditLog = useAuditLog().data;
  const observations = useProductCatalogStore((s) => s.competitors);
  const setScope = useUiStore((s) => s.setScope);
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  // MESTA-SEARCH-001 coverage: derived once per data change, filtered per keystroke
  // so typing never re-runs the derivations (PERF-002).
  const index = useMemo(() => ({
    guardrails: catalogRows(skus, strategies, rules, recs, Date.now()),
    signals: signalRows(skus, observations),
    competitors: [...new Set(observations.map((o) => o.competitor))],
    exceptions: deriveExceptions({ products: skus, competitors: observations, recs, overrides }),
    alerts: deriveAlerts({ anomalies, deployments, sources }),
  }), [skus, strategies, rules, recs, observations, overrides, anomalies, deployments, sources]);

  // Global shortcuts: Cmd/Ctrl+K toggles; "/" opens (unless typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useCommandStore.getState().setOpen(!useCommandStore.getState().open);
        return;
      }
      const el = e.target as HTMLElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement || el.isContentEditable;
      if (e.key === '/' && !typing) {
        e.preventDefault();
        useCommandStore.getState().setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const [recent, setRecent] = useState<Item[]>([]);
  useEffect(() => { if (open) { setQ(''); setCursor(0); setRecent(loadRecent()); } }, [open]);

  const items = useMemo<Item[]>(() => {
    const needle = q.trim().toLowerCase();
    const match = (s: string) => !needle || s.toLowerCase().includes(needle);
    const out: Item[] = [];
    if (can('recommendation.view')) {
      out.push({ id: 'qa-pending', group: t('common.cmd.actions'), label: t('common.cmd.pendingApprovals'), href: '/recommendations?status=pending' });
    }
    if (can('strategy.create')) out.push({ id: 'qa-strategy', group: t('common.cmd.actions'), label: t('common.cmd.createStrategy'), href: '/strategy/new' });
    if (can('deployment.view')) out.push({ id: 'qa-deploy', group: t('common.cmd.actions'), label: t('common.cmd.deployFailures'), href: '/deployment?status=failed' });
    for (const n of NAV) if (!n.action || can(n.action)) out.push({ id: `nav-${n.key}`, group: t('common.cmd.actions'), label: t(`common.nav.${n.key}`), href: n.href });
    const filteredQuick = out.filter((i) => match(i.label));
    const skuHits = skus
      .filter((p) => match(p.sku) || match(p.name))
      .slice(0, MAX_PER_GROUP)
      .map((p) => ({
        id: p.sku, group: t('common.cmd.sku'), label: p.name, hint: `${p.sku} · ${p.category}`,
        href: `/catalog/${p.sku}`, icon: <CategoryIcon category={p.category} className="size-4" />,
      }));
    const strHits = strategies
      .filter((s) => match(s.name) || match(s.id))
      .slice(0, MAX_PER_GROUP)
      .map((s) => ({ id: s.id, group: t('common.cmd.strategy'), label: s.name, hint: s.id, href: `/strategy/${s.id}/edit` }));
    const recHits = recs
      .filter((r) => match(r.id) || match(r.sku))
      .slice(0, MAX_PER_GROUP)
      .map((r) => ({ id: r.id, group: t('common.cmd.recommendation'), label: r.id, hint: r.sku, href: `/recommendations/${r.id}` }));
    // Rules and experiments have no detail route — hits deep-link to their pages.
    const ruleHits = rules
      .filter((r) => match(r.name) || match(r.id))
      .slice(0, MAX_PER_GROUP)
      .map((r) => ({ id: r.id, group: t('common.cmd.rule'), label: r.name, hint: r.id, href: '/rules' }));
    const expHits = experiments
      .filter((e) => match(e.name) || match(e.id))
      .slice(0, MAX_PER_GROUP)
      .map((e) => ({ id: e.id, group: t('common.cmd.experiment'), label: e.name, hint: e.id, href: '/experiments' }));
    // Scenarios have no detail route — deep-link to the simulator.
    const scnHits = scenarios
      .filter((s) => match(s.id) || match(s.sku))
      .slice(0, MAX_PER_GROUP)
      .map((s) => ({ id: s.id, group: t('common.cmd.scenario'), label: s.id, hint: s.sku, href: '/simulation' }));
    // Approvals: decidable recs jump to the inbox rather than the queue.
    const aprHits = recs
      .filter((r) => (r.status === 'pending' || r.status === 'escalated') && (match(r.id) || match(r.sku)))
      .slice(0, MAX_PER_GROUP)
      .map((r) => ({ id: `apr-${r.id}`, group: t('common.cmd.approval'), label: r.id, hint: r.sku, href: '/approvals' }));
    const catHits = CATEGORIES
      .filter((c) => match(c))
      .map((c) => ({ id: `cat-${c}`, group: t('common.cmd.category'), label: c, href: `/catalog?cat=${encodeURIComponent(c)}` }));
    const storeHits = ALL_STORES
      .filter((s) => match(s))
      .map((s) => ({
        id: `store-${s}`, group: t('common.cmd.store'), label: s, href: '/catalog',
        run: () => setScope({ region: regionOfStore(s), store: s, category: null }),
      }));
    // Guardrails / signals / competitors / exceptions / alerts / audit events —
    // the remaining MESTA-SEARCH-001 entity types. Each carries its current state.
    const grHits = index.guardrails
      .filter((g) => match(t(`guardrails.constraint.${g.id}.name`)) || match(g.id))
      .map((g) => ({
        id: `gr-${g.id}`, group: t('common.cmd.guardrail'), label: t(`guardrails.constraint.${g.id}.name`),
        state: t(`common.status.${!g.available ? 'not_modelled' : !g.enforced ? 'observed' : g.breaches > 0 ? 'breached' : 'active'}`),
        hint: `${g.covered}`, href: '/guardrails',
      }));
    const sigHits = index.signals
      .filter((s) => match(s.product.sku) || match(s.product.name))
      .slice(0, MAX_PER_GROUP)
      .map((s) => ({
        id: `sig-${s.product.sku}`, group: t('common.cmd.signal'), label: s.product.name,
        hint: `${s.product.sku} · ${s.product.category}`, state: t(`signals.risk.${s.stockRisk}`), href: '/signals',
        icon: <CategoryIcon category={s.product.category} className="size-4" />,
      }));
    const cmpHits = index.competitors
      .filter((c) => match(c))
      .slice(0, MAX_PER_GROUP)
      .map((c) => ({ id: `cmp-${c}`, group: t('common.cmd.competitor'), label: c, href: '/competitors' }));
    const excHits = index.exceptions
      .filter((x) => match(t(`exceptions.kind.${x.kind}`)) || match(x.sku ?? '') || match(x.refId ?? '') || match(x.category ?? ''))
      .slice(0, MAX_PER_GROUP)
      .map((x) => ({
        id: `exc-${x.id}`, group: t('common.cmd.exception'), label: t(`exceptions.kind.${x.kind}`),
        hint: x.sku ?? x.category ?? undefined, state: t(`common.severity.${x.severity}`), href: x.href,
      }));
    const alHits = index.alerts
      .filter((a) => match(t(`alerts.kind.${a.kind}`)) || match(a.sku ?? '') || match(a.observed ?? ''))
      .slice(0, MAX_PER_GROUP)
      .map((a) => ({
        id: `al-${a.id}`, group: t('common.cmd.alert'), label: t(`alerts.kind.${a.kind}`),
        hint: a.sku ?? a.observed ?? undefined, state: t(`common.severity.${a.severity}`), href: a.href,
      }));
    const audHits = auditLog
      .filter((e) => match(t(`common.event.${e.type}`)) || match(e.sku ?? '') || match(e.entityId))
      .slice(0, MAX_PER_GROUP)
      .map((e) => ({
        id: `aud-${e.id}`, group: t('common.cmd.audit'), label: t(`common.event.${e.type}`),
        hint: e.sku ?? e.entityId, href: '/audit',
      }));
    if (needle) {
      return [...skuHits.sort(rank(needle)), ...strHits.sort(rank(needle)), ...recHits.sort(rank(needle)),
        ...aprHits.sort(rank(needle)), ...scnHits.sort(rank(needle)), ...ruleHits.sort(rank(needle)),
        ...expHits.sort(rank(needle)), ...grHits.sort(rank(needle)), ...sigHits.sort(rank(needle)),
        ...cmpHits.sort(rank(needle)), ...excHits.sort(rank(needle)), ...alHits.sort(rank(needle)),
        ...audHits.sort(rank(needle)), ...catHits.sort(rank(needle)), ...storeHits.sort(rank(needle)),
        ...filteredQuick.sort(rank(needle))];
    }
    const recentItems = recent.map((r) => ({ ...r, id: `recent-${r.id}`, group: t('common.cmd.recent') }));
    return [...recentItems, ...filteredQuick, ...skuHits.slice(0, 3)];
  }, [q, skus, strategies, recs, rules, experiments, scenarios, can, t, recent, setScope, index, auditLog]);

  useEffect(() => { setCursor(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const go = (item: Item | undefined) => {
    if (!item) return;
    saveRecent({ ...item, id: item.id.replace(/^recent-/, '') });
    setOpen(false);
    item.run?.();
    router.push(item.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(items[cursor]); }
  };

  let lastGroup = '';
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t('common.cmd.open')} className="max-w-lg self-start mt-[12vh]">
      <input
        autoFocus
        role="combobox"
        aria-label={t('common.cmd.open')}
        aria-expanded
        aria-controls="cmd-list"
        aria-activedescendant={items[cursor] ? `cmd-${items[cursor].id}` : undefined}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t('common.cmd.placeholder')}
        className="mb-2 h-10 w-full rounded-input border border-line bg-surface px-3 text-sm"
      />
      {items.length === 0 ? (
        <p className="p-4 text-center text-sm text-muted">{t('common.cmd.noResults')}</p>
      ) : (
        <ul id="cmd-list" role="listbox" ref={listRef} className="max-h-72 overflow-auto">
          {items.map((it, i) => {
            const header = it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <li key={it.id} role="presentation">
                {header && <p className="px-2 pb-1 pt-2 text-xs font-medium text-faint">{header}</p>}
                <div
                  id={`cmd-${it.id}`}
                  role="option"
                  aria-selected={i === cursor}
                  onMouseMove={() => setCursor(i)}
                  onClick={() => go(it)}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-input px-2 py-1.5 text-sm ${i === cursor ? 'bg-brand-soft text-brand' : ''}`}
                >
                  <span className="flex min-w-0 items-center gap-2">{it.icon}<span className="truncate"><Highlight text={it.label} q={q.trim()} /></span></span>
                  <span className="flex shrink-0 items-center gap-2">
                    {it.state && <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[11px] text-muted">{it.state}</span>}
                    {it.hint && <span className="text-xs text-faint"><Highlight text={it.hint} q={q.trim()} /></span>}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}

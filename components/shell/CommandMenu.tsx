'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { CategoryIcon } from '@/components/ds/ProductIdentity';
import { CATEGORIES } from '@/lib/categories';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import { useExperiments, useScenarios, useSkuList, useStrategies, useRecommendations, useRules } from '@/lib/queries';
import { ALL_STORES, regionOfStore } from '@/lib/scope';
import { useUiStore } from '@/lib/stores';
import { useCommandStore } from './command-store';
import { NAV } from './nav';

interface Item { id: string; group: string; label: string; hint?: string; href: string; run?: () => void; icon?: ReactNode }

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
  const setScope = useUiStore((s) => s.setScope);
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

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
    if (needle) {
      return [...skuHits.sort(rank(needle)), ...strHits.sort(rank(needle)), ...recHits.sort(rank(needle)),
        ...aprHits.sort(rank(needle)), ...scnHits.sort(rank(needle)), ...ruleHits.sort(rank(needle)),
        ...expHits.sort(rank(needle)), ...catHits.sort(rank(needle)), ...storeHits.sort(rank(needle)),
        ...filteredQuick.sort(rank(needle))];
    }
    const recentItems = recent.map((r) => ({ ...r, id: `recent-${r.id}`, group: t('common.cmd.recent') }));
    return [...recentItems, ...filteredQuick, ...skuHits.slice(0, 3)];
  }, [q, skus, strategies, recs, rules, experiments, scenarios, can, t, recent, setScope]);

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
                  {it.hint && <span className="shrink-0 text-xs text-faint"><Highlight text={it.hint} q={q.trim()} /></span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}

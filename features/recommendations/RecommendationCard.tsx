'use client';

import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AgentBorderCard } from '@/components/ds/AgentBorderCard';
import { AgentRunTimeline, type RunStep } from '@/components/ds/AgentRunTimeline';
import { ConfidenceBar } from '@/components/ds/ConfidenceBar';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { PriceValue } from '@/components/ds/PriceValue';
import { RationaleBreakdown } from '@/components/ds/RationaleBreakdown';
import { Sparkline } from '@/components/ds/Sparkline';
import { StatusChip } from '@/components/ds/StatusChip';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { canDecideHighImpact, recommendationHealth, requiresManager, stageDecision } from '@/lib/actions/recommendation';
import { elasticityBand } from '@/lib/domain';
import { formatDate, formatPrice } from '@/lib/format';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { Product, Recommendation } from '@/lib/ontology';
import { useProductCatalogStore, useSessionStore, useToastStore, useUndoStore } from '@/lib/stores';
import { DecisionDialog, type DialogMode } from './DecisionDialog';
import { changeRatio } from './filters';

export function RecommendationCard({ rec, product, defaultOpen = false, showStatus = true }: {
  rec: Recommendation; product: Product | undefined; defaultOpen?: boolean;
  /** Under a status-owning queue tab the chip repeats the tab — only render it when it adds information. */
  showStatus?: boolean;
}) {
  const { t, locale } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const can = useCan();
  const toast = useToastStore((s) => s.push);
  const staged = useUndoStore((s) => s.staged[rec.id]);
  const competitors = useProductCatalogStore((s) => s.competitors);
  const [dialog, setDialog] = useState<DialogMode>(null);
  const health = recommendationHealth(rec);
  const topReason = [...rec.rationale].sort((a, b) => b.weight - a.weight)[0]?.detail;
  const decidable = rec.status === 'pending' || rec.status === 'escalated';
  const locked = !!staged;
  const canDecide = decidable && !locked && can('recommendation.decide');
  // Second-level rule: high-impact approvals need a manager or a live delegation grant.
  const needsManager = decidable && requiresManager(rec);
  const canApprove = canDecide && (!needsManager || canDecideHighImpact(user));
  const [staleAck, setStaleAck] = useState(false);

  const latestObs = competitors
    .filter((c) => c.sku === rec.sku)
    .map((c) => c.observedAt)
    .sort()
    .at(-1);

  const run: RunStep[] = [
    {
      id: 'observed', label: t('recommendations.run.observed'), at: latestObs,
      detail: product ? `${t('recommendations.card.competitor')}: ${formatPrice(product.competitorAvg, locale)}` : undefined,
    },
    {
      id: 'elasticity', label: t('recommendations.run.elasticity'),
      detail: product ? `${t(`catalog.elasticity.${elasticityBand(product.elasticity)}`)} (${product.elasticity})` : undefined,
    },
    {
      id: 'guardrail', label: t('recommendations.run.guardrail'), ok: !health.breach,
      detail: t(health.breach ? 'recommendations.run.guardrailBreach' : 'recommendations.run.guardrailOk'),
    },
    { id: 'formed', label: t('recommendations.run.formed'), at: rec.createdAt, detail: `${rec.confidence}%` },
  ];

  const approve = () => {
    const r = stageDecision(user, rec.id, 'approved', health.stale ? { ackStale: staleAck } : {});
    if (!r.ok) toast(t(`recommendations.err.${r.error}`));
  };

  return (
    <AgentBorderCard actor={rec.source === 'agent' ? 'agent' : 'human'} status={rec.status} className="flex flex-col gap-3">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">
            <Link href={`/catalog/${rec.sku}`} className="tabular text-brand hover:underline">{rec.sku}</Link>
            {product && <span className="ml-2 font-normal">{product.name}</span>}
          </h2>
          <p className="text-xs text-muted">
            <Link href={`/recommendations/${rec.id}`} className="tabular hover:underline">{rec.id}</Link>
            {' · '}{t(`recommendations.source.${rec.source}`)} · <span className="tabular">{formatDate(rec.createdAt, locale)}</span>
            {' · '}{t('recommendations.card.owner')}: <span className="tabular">{rec.ownerId === 'agent' ? t('common.source.agent') : rec.ownerId}</span>
          </p>
          {topReason && <p className="mt-0.5 max-w-prose truncate text-xs text-faint" title={topReason}>{t('recommendations.card.reason')}: {topReason}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showStatus && <StatusChip status={rec.status} />}
          {decidable && health.stale && <StatusChip status="stale" />}
          {needsManager && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
              <TriangleAlert className="size-3" aria-hidden />{t('recommendations.card.requiresManager')}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div>
          <p className="text-xs text-muted">{t('recommendations.card.current')}</p>
          <PriceValue value={rec.currentPrice} muted />
        </div>
        <div>
          <p className="text-xs text-muted">{t('recommendations.card.proposed')}</p>
          <span className="flex items-center gap-2"><PriceValue value={rec.proposedPrice} /><DeltaBadge value={changeRatio(rec)} /></span>
        </div>
        <div>
          <p className="text-xs text-muted">{t('recommendations.card.impact')}</p>
          <PriceValue value={rec.projectedMarginImpact} />
        </div>
        <ConfidenceBar value={rec.confidence} />
      </div>

      {decidable && health.stale && (
        <p role="note" className="flex items-center gap-1.5 text-xs text-warn"><TriangleAlert className="size-3.5" aria-hidden />{t('recommendations.card.stale')}</p>
      )}
      {decidable && health.breach && (
        <p role="note" className="flex items-center gap-1.5 text-xs text-critical"><TriangleAlert className="size-3.5" aria-hidden />{t('recommendations.card.breach')}</p>
      )}

      <RationaleBreakdown factors={rec.rationale} />

      <details open={defaultOpen} className="text-sm">
        <summary className="cursor-pointer text-xs font-medium text-muted">{t('recommendations.card.evidence')}</summary>
        <div className="mt-2">
          <AgentRunTimeline steps={run} />
        </div>
        {product && (
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-muted">{t('recommendations.card.trend')}</p>
              <Sparkline points={product.priceHistory.map((h) => h.price)} className="h-10 w-full text-brand" />
            </div>
            <dl className="grid grid-cols-2 gap-1 text-xs">
              <dt className="text-muted">{t('recommendations.card.current')}</dt><dd><PriceValue value={product.price} /></dd>
              <dt className="text-muted">{t('recommendations.card.proposed')}</dt><dd><PriceValue value={rec.proposedPrice} /></dd>
              <dt className="text-muted">{t('recommendations.card.competitor')}</dt><dd><PriceValue value={product.competitorAvg} /></dd>
            </dl>
          </div>
        )}
        <RoleGate action="simulation.use">
          <Link href={rec.scenarioId ? `/simulation/${rec.scenarioId}` : `/simulation?sku=${rec.sku}`} className="mt-2 inline-block text-xs text-brand underline">
            {t('recommendations.card.simulate')}
          </Link>
        </RoleGate>
      </details>

      {rec.decisionNote && (
        <p className="text-xs text-muted"><strong>{t('recommendations.card.decision')}:</strong> {rec.decisionNote}</p>
      )}

      {locked && (
        <p role="status" className="text-xs text-info">
          {t('recommendations.card.pendingUndo', { s: Math.max(0, Math.ceil((staged.expiresAt - Date.now()) / 1000)) })}
        </p>
      )}

      <RoleGate action="recommendation.decide">
        <div className="flex flex-wrap items-center gap-2">
          {canDecide && health.stale && (
            <label className="flex items-center gap-1.5 text-xs text-warn">
              <input type="checkbox" checked={staleAck} onChange={(e) => setStaleAck(e.target.checked)} />
              {t('recommendations.card.staleAck')}
            </label>
          )}
          <Button size="sm" disabled={!canApprove || (health.stale && !staleAck)} onClick={approve}
            title={needsManager && !canDecideHighImpact(user) ? t('recommendations.card.requiresManager') : undefined}
          >{t('recommendations.action.approve')}</Button>
          <Button size="sm" variant="secondary" disabled={!canDecide} onClick={() => setDialog('adjust')}>{t('recommendations.action.adjust')}</Button>
          <Button size="sm" variant="secondary" disabled={!canDecide} onClick={() => setDialog('reject')}>{t('recommendations.action.reject')}</Button>
          <Button size="sm" variant="ghost" disabled={!canDecide} onClick={() => setDialog('request')}>{t('recommendations.action.requestChanges')}</Button>
          {rec.status === 'pending' && (
            <Button size="sm" variant="ghost" disabled={!canDecide} onClick={() => setDialog('escalate')}>{t('recommendations.action.escalate')}</Button>
          )}
        </div>
      </RoleGate>

      <DecisionDialog rec={rec} product={product} mode={dialog} onClose={() => setDialog(null)} />
    </AgentBorderCard>
  );
}

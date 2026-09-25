'use client';

import { ChevronRight, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { AgentBorderCard } from '@/components/ds/AgentBorderCard';
import { AgentRunTimeline, type RunStep } from '@/components/ds/AgentRunTimeline';
import { ApprovalChain } from '@/components/ds/ApprovalChain';
import { ConfidenceBar } from '@/components/ds/ConfidenceBar';
import { ConstraintRange } from '@/components/ds/ConstraintRange';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { Money } from '@/components/ds/numeric';
import { Pill } from '@/components/ds/Pill';
import { CategoryIcon } from '@/components/ds/ProductIdentity';
import { RationaleBreakdown } from '@/components/ds/RationaleBreakdown';
import { Sparkline } from '@/components/ds/Sparkline';
import { StatusChip } from '@/components/ds/StatusChip';
import { RoleGate } from '@/components/shell/RoleGate';
import { Button } from '@/components/ui/button';
import { canDecideAtLevel, pendingApprovalLevel, recommendationHealth, stageDecision } from '@/lib/actions/recommendation';
import { elasticityBand } from '@/lib/domain';
import { formatDate, formatPrice } from '@/lib/format';
import { explainBounds, governingStrategy } from '@/lib/guardrails';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { Product, Recommendation } from '@/lib/ontology';
import { useStrategies } from '@/lib/queries';
import { useProductCatalogStore, useSessionStore, useToastStore, useUndoStore } from '@/lib/stores';
import { cn } from '@/lib/utils';
import { DecisionDialog, type DialogMode } from './DecisionDialog';
import { changeRatio } from './filters';

/**
 * One recommendation, one anatomy (RECOMMENDATION-004/005, APPROVAL-030):
 *   identity → metadata → primary driver → status → impact (3 fixed columns) → confidence →
 *   evidence (collapsed) → decision actions (pinned to the bottom).
 * Every slot renders even when empty so sibling cards in a grid row share geometry; long text is
 * clamped (name/driver/status notes: 2 lines) and detail lives behind the Evidence disclosure.
 *
 * `variant`: `card` (queue grid, fills the row height), `detail` (full page — two-level grid and
 * the constraint visualisation), `panel` (inside a drawer — no outer frame, sectioned).
 */
export function RecommendationCard({ rec, product, defaultOpen = false, showStatus = true, stickyActions = false, variant = 'card' }: {
  rec: Recommendation; product: Product | undefined; defaultOpen?: boolean;
  /** Under a status-owning queue tab the chip repeats the tab — only render it when it adds information. */
  showStatus?: boolean;
  /** M-06: on the detail surface the decision row stays pinned while evidence scrolls. */
  stickyActions?: boolean;
  variant?: 'card' | 'detail' | 'panel';
}) {
  const { t, locale } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const can = useCan();
  const toast = useToastStore((s) => s.push);
  const staged = useUndoStore((s) => s.staged[rec.id]);
  const competitors = useProductCatalogStore((s) => s.competitors);
  const strategies = useStrategies().data;
  const [dialog, setDialog] = useState<DialogMode>(null);
  const health = recommendationHealth(rec);
  const reasons = [...rec.rationale].sort((a, b) => b.weight - a.weight);
  const topReason = reasons[0]?.detail;
  const decidable = rec.status === 'pending' || rec.status === 'escalated';
  const locked = !!staged;
  const canDecide = decidable && !locked && can('recommendation.decide');
  // Multi-level chain: the level currently awaiting a decision, if any.
  const pendingLevel = decidable ? pendingApprovalLevel(rec) : null;
  const canApprove = canDecide && (!pendingLevel || canDecideAtLevel(user, pendingLevel));
  const [staleAck, setStaleAck] = useState(false);
  const detailed = variant !== 'card';

  const latestObs = competitors.filter((c) => c.sku === rec.sku).map((c) => c.observedAt).sort().at(-1);

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
    else if ('awaiting' in r && r.awaiting) toast(t('recommendations.card.chainRecorded', { level: t(`common.role.${r.awaiting}`) }));
  };

  const bounds = detailed && product ? explainBounds(product, governingStrategy(product, strategies)?.guardrail ?? null) : null;

  // ── slots ────────────────────────────────────────────────────────────────────────────
  const identity = (
    <div className="flex min-w-0 items-start gap-3">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-input border border-line-icon bg-icon">
        {product ? <CategoryIcon category={product.category} className="size-[18px]" /> : null}
      </span>
      <div className="min-w-0">
        <h2 className={cn('line-clamp-2 font-semibold text-fg', variant === 'detail' ? 'text-lg leading-6' : 'text-[15px] leading-5')} title={product?.name}>
          {product?.name ?? rec.sku}
        </h2>
        <Link href={`/catalog/${rec.sku}`} className="tabular text-caption font-semibold text-brand underline-offset-2 hover:underline">{rec.sku}</Link>
        {product && <span className="text-caption text-faint"> · {product.category}</span>}
      </div>
    </div>
  );

  // RECOMMENDATION-015: ID strongest, source secondary, timestamp/owner tertiary.
  const meta = (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-caption text-faint">
      <Link href={`/recommendations/${rec.id}`} className="tabular font-semibold text-fg hover:underline">{rec.id}</Link>
      <span aria-hidden>·</span><span className="text-muted">{t(`recommendations.source.${rec.source}`)}</span>
      <span aria-hidden>·</span><span className="tabular">{formatDate(rec.createdAt, locale)}</span>
      <span aria-hidden>·</span><span className="max-w-full truncate">{t('recommendations.card.owner')}: {rec.ownerId === 'agent' ? t('common.source.agent') : rec.ownerId}</span>
    </p>
  );

  // RECOMMENDATION-016: one stable driver slot; extra drivers are counted, detailed in Evidence.
  const driver = (
    <div className="min-h-12">
      <p className="text-caption font-medium text-muted">{t('recommendations.card.reason')}</p>
      <p className="line-clamp-2 text-body-sm text-fg" title={topReason}>{topReason ?? t('recommendations.card.noDriver')}</p>
      {reasons.length > 1 && <p className="text-caption text-faint">{t('recommendations.card.moreSignals', { n: reasons.length - 1 })}</p>}
    </div>
  );

  // RECOMMENDATION-010/011: compact states — badge + at most a 2-line note, never a block.
  const statusGroup = (
    <div className="flex min-h-6 flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {showStatus && <StatusChip status={rec.status} />}
        {decidable && health.stale && <StatusChip status="stale" />}
        {pendingLevel && <Pill tone="warn" icon={TriangleAlert}>{t(`recommendations.card.requires_${pendingLevel}`)}</Pill>}
        {decidable && health.breach && <Pill tone="critical" icon={TriangleAlert}>{t('recommendations.run.guardrailBreach')}</Pill>}
      </div>
      {decidable && (health.stale || health.breach) && (
        <p role="note" className={cn('line-clamp-2 text-caption', health.breach ? 'text-critical' : 'text-warn')}>
          {health.breach ? t('recommendations.card.breachShort') : t('recommendations.card.staleShort')}
        </p>
      )}
    </div>
  );

  // RECOMMENDATION-012/013/014 & APPROVAL-019: three fixed columns, labels share one baseline.
  const impact = (
    <dl className={cn('grid gap-x-4 gap-y-3', variant === 'detail' ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3')}>
      <ImpactCell label={t('recommendations.card.current')}><Money value={rec.currentPrice} className="text-muted" /></ImpactCell>
      <ImpactCell label={t('recommendations.card.proposed')}>
        <span className="flex flex-wrap items-center gap-x-1.5"><Money value={rec.proposedPrice} className="font-semibold text-fg" /><DeltaBadge value={changeRatio(rec)} size="sm" /></span>
      </ImpactCell>
      <ImpactCell label={t('recommendations.card.impact')}><Money value={rec.projectedMarginImpact} signed className="font-semibold" /></ImpactCell>
      {variant === 'detail' && (
        <ImpactCell label={t('recommendations.card.confidence')}><ConfidenceBar value={rec.confidence} /></ImpactCell>
      )}
    </dl>
  );

  const confidence = variant === 'detail' ? null : (
    <div className="flex items-center justify-between gap-3">
      <span className="text-caption font-medium text-muted">{t('recommendations.card.confidence')}</span>
      <ConfidenceBar value={rec.confidence} />
    </div>
  );

  // RECOMMENDATION-009: one disclosure pattern; everything variable-height lives here.
  const evidence = (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-label font-medium text-fg [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 text-muted transition-transform duration-fast group-open:rotate-90" aria-hidden />
        {t('recommendations.card.evidence')}
      </summary>
      <div className="mt-4 flex flex-col gap-5 [overflow-wrap:anywhere]">
        <RationaleBreakdown factors={rec.rationale} />
        <ApprovalChain rec={rec} />
        <AgentRunTimeline steps={run} />
        {product && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-caption text-muted">{t('recommendations.card.trend')}</p>
              <Sparkline points={product.priceHistory.map((h) => h.price)} tone="brand" className="h-10 w-full" />
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-caption">
              <dt className="text-muted">{t('recommendations.card.current')}</dt><dd className="text-right"><Money value={product.price} /></dd>
              <dt className="text-muted">{t('recommendations.card.proposed')}</dt><dd className="text-right"><Money value={rec.proposedPrice} /></dd>
              <dt className="text-muted">{t('recommendations.card.competitor')}</dt><dd className="text-right"><Money value={product.competitorAvg} /></dd>
            </dl>
          </div>
        )}
        {bounds && <ConstraintRange bounds={bounds} proposed={rec.proposedPrice} compact />}
        <RoleGate action="simulation.use">
          <Link href={rec.scenarioId ? `/simulation/${rec.scenarioId}` : `/simulation?sku=${rec.sku}`} className="text-caption font-medium text-brand underline">
            {t('recommendations.card.simulate')}
          </Link>
        </RoleGate>
      </div>
    </details>
  );

  // RECOMMENDATION-020/021 & APPROVAL-020/021: stable order, re-check attached to Approve, bottom-pinned.
  const actions = (
    <RoleGate action="recommendation.decide">
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 border-t border-divider pt-4',
          stickyActions && 'sticky bottom-0 -mx-6 -mb-6 rounded-b-card bg-surface/95 px-6 pb-4 backdrop-blur',
        )}
      >
        {canDecide && health.stale && (
          // Attached to Approve (it gates it) but on its own line, so every card's button row keeps one geometry.
          <label className="flex w-full items-center gap-1.5 text-caption font-medium text-warn">
            <input type="checkbox" className="size-4 accent-brand" checked={staleAck} onChange={(e) => setStaleAck(e.target.checked)} />
            {t('recommendations.card.staleAckShort')}
          </label>
        )}
        <Button size="sm" disabled={!canApprove || (health.stale && !staleAck)} onClick={approve}
          title={pendingLevel && !canDecideAtLevel(user, pendingLevel) ? t(`recommendations.card.requires_${pendingLevel}`) : undefined}
        >{t('recommendations.action.approve')}</Button>
        <Button size="sm" variant="secondary" disabled={!canDecide} onClick={() => setDialog('adjust')}>{t('recommendations.action.adjust')}</Button>
        <Button size="sm" variant="secondary" disabled={!canDecide} onClick={() => setDialog('reject')}>{t('recommendations.action.reject')}</Button>
        <Button size="sm" variant="ghost" disabled={!canDecide} onClick={() => setDialog('request')}>{t('recommendations.action.requestChanges')}</Button>
        <Button size="sm" variant="ghost" disabled={!canDecide || rec.status !== 'pending'} onClick={() => setDialog('escalate')}>{t('recommendations.action.escalate')}</Button>
      </div>
    </RoleGate>
  );

  const notes = (
    <>
      {rec.decisionNote && <p className="text-caption text-muted"><strong>{t('recommendations.card.decision')}:</strong> {rec.decisionNote}</p>}
      {locked && (
        <p role="status" className="text-caption text-info">
          {t('recommendations.card.pendingUndo', { s: Math.max(0, Math.ceil((staged.expiresAt - Date.now()) / 1000)) })}
        </p>
      )}
    </>
  );

  const dialogEl = <DecisionDialog rec={rec} product={product} mode={dialog} onClose={() => setDialog(null)} />;

  if (variant === 'panel') {
    // APPROVAL-010…013: drawer content — Summary and Evidence as separate sections, 24px rhythm.
    return (
      <div className="flex flex-col gap-6">
        <span className="sr-only">{t(`common.agent.${rec.source === 'agent' ? 'agent' : 'human'}`)} · {t(`common.status.${rec.status}`)}</span>
        <div className="flex flex-col gap-3">{identity}{meta}</div>
        {statusGroup}
        <Section title={t('recommendations.card.summary')}>
          <div className="flex flex-col gap-4">{impact}{confidence}{driver}</div>
        </Section>
        <Section title={t('recommendations.card.evidence')}>{evidence}</Section>
        {notes}
        {actions}
        {dialogEl}
      </div>
    );
  }

  if (variant === 'detail') {
    // APPROVAL-018: identity/status band, then the financial row, then evidence.
    return (
      <AgentBorderCard actor={rec.source === 'agent' ? 'agent' : 'human'} status={rec.status} className="flex flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">{identity}{meta}</div>
          {statusGroup}
        </header>
        {driver}
        <div className="border-y border-divider py-5">{impact}</div>
        {evidence}
        {notes}
        {actions}
        {dialogEl}
      </AgentBorderCard>
    );
  }

  // Queue card: fills the grid row; the action zone is pushed to the bottom (RECOMMENDATION-006/007).
  return (
    <AgentBorderCard actor={rec.source === 'agent' ? 'agent' : 'human'} status={rec.status} className="flex h-full flex-col gap-4">
      <header className="flex flex-col gap-2">{identity}{meta}</header>
      {driver}
      {statusGroup}
      <div className="min-h-[76px] rounded-input bg-subtle px-4 py-3">{impact}</div>
      {confidence}
      {evidence}
      {notes}
      <div className="mt-auto">{actions}</div>
      {dialogEl}
    </AgentBorderCard>
  );
}

function ImpactCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-caption font-medium text-muted" title={label}>{label}</dt>
      <dd className="tabular mt-1 text-body-sm">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-divider pt-6">
      <h3 className="text-caption font-semibold uppercase tracking-wide text-faint">{title}</h3>
      {children}
    </section>
  );
}

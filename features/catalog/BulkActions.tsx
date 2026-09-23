'use client';

import { useMemo, useState } from 'react';
import { PriceValue } from '@/components/ds/PriceValue';
import { ActionSummary, RecoveryNotice } from '@/components/ds/trust';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, inputCls } from '@/components/ui/field';
import { bulkAssignStrategy, bulkPriceEdit, bulkPricePreview } from '@/lib/actions/catalog';
import { downloadCsv, rowsToCsv } from '@/components/ds/table/csv';
import { marginPct } from '@/lib/domain';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { useSessionStore, useStrategyStore, useToastStore } from '@/lib/stores';

/** §17 catalog bulk ops over the current SKU selection: CSV export, assign-to-strategy, bulk price edit. */
export function BulkActionBar({ products, onClear }: { products: Product[]; onClear: () => void }) {
  const { t } = useTranslation();
  const can = useCan();
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const exportCsv = () => {
    const csv = rowsToCsv(
      ['sku', 'name', 'category', 'brand', 'cost', 'price', 'minPrice', 'maxPrice', 'mapPrice', 'competitorAvg', 'marginPct', 'elasticity', 'stockUnits', 'stockStatus'],
      products,
      (p) => [p.sku, p.name, p.category, p.brand, p.cost, p.price, p.minPrice, p.maxPrice, p.mapPrice, p.competitorAvg, marginPct(p), p.elasticity, p.stockUnits, p.stockStatus],
    );
    downloadCsv('mesta-catalog-selection.csv', csv);
  };

  return (
    <>
      {can('catalog.export') && (
        <Button variant="secondary" size="sm" onClick={exportCsv}>{t('catalog.action.exportSelected')}</Button>
      )}
      {can('catalog.apply_strategy') && (
        <Button variant="secondary" size="sm" onClick={() => setAssignOpen(true)}>{t('catalog.action.assignStrategy')}</Button>
      )}
      {can('catalog.override_price') && (
        <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)}>{t('catalog.action.bulkEdit')}</Button>
      )}
      <AssignDialog open={assignOpen} onClose={() => setAssignOpen(false)} products={products} />
      <BulkEditDialog open={editOpen} onClose={() => setEditOpen(false)} products={products} onDone={onClear} />
    </>
  );
}

function AssignDialog({ open, onClose, products }: { open: boolean; onClose: () => void; products: Product[] }) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const strategies = useStrategyStore((s) => s.items);
  const [strategyId, setStrategyId] = useState('');
  const active = strategies.filter((s) => s.status === 'active' || s.status === 'draft');

  const confirm = () => {
    const r = bulkAssignStrategy(user, strategyId, products.map((p) => p.sku));
    if (!r.ok) { toast(t(`catalog.bulk.err.${r.error}`)); return; }
    toast(t('catalog.bulk.assigned', { n: products.length }));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('catalog.bulk.assignTitle')} className="max-w-md">
      <div className="flex flex-col gap-3">
        <Field label={t('catalog.bulk.assignTo')}>
          {(p) => (
            <select {...p} className={inputCls} value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
              <option value="">{t('catalog.bulk.assignPlaceholder')}</option>
              {active.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </Field>
        <p className="text-xs text-muted">{t('catalog.bulk.assignBody', { n: products.length })}</p>
        <ActionSummary
          consequence={t('catalog.bulk.assignSummary', { n: products.length })}
          action={
            <>
              <Button variant="secondary" onClick={onClose}>{t('common.action.cancel')}</Button>
              <Button disabled={!strategyId} onClick={confirm}>{t('catalog.bulk.assignConfirm')}</Button>
            </>
          }
        />
      </div>
    </Dialog>
  );
}

function BulkEditDialog({ open, onClose, products, onDone }: { open: boolean; onClose: () => void; products: Product[]; onDone: () => void }) {
  const { t } = useTranslation();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const pct = Number(delta);
  const valid = delta.trim() !== '' && Number.isFinite(pct) && pct !== 0 && Math.abs(pct) <= 50;
  const rows = useMemo(
    () => (open && valid ? bulkPricePreview(products.map((p) => p.sku), pct) : []),
    [open, valid, products, pct],
  );
  const blocked = rows.filter((r) => r.check !== 'ok');
  const asManager = user.role === 'manager';
  const reasonErr = submitted && !reason.trim() ? t('catalog.bulk.err.note_required') : undefined;

  const confirm = () => {
    setSubmitted(true);
    const r = bulkPriceEdit(user, products.map((p) => p.sku), pct, reason);
    if (!r.ok) { toast(t(`catalog.bulk.err.${r.error}`)); return; }
    toast(t(asManager ? 'catalog.bulk.applied' : 'catalog.bulk.requested', { n: asManager ? r.applied : r.requested, blocked: r.blocked.length }));
    onDone();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('catalog.bulk.editTitle')} className="max-w-lg">
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('catalog.bulk.delta')} error={submitted && !valid ? t('catalog.bulk.err.delta') : undefined}>
            {(p) => <Input {...p} type="number" min={-50} max={50} step={0.5} value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="-5" />}
          </Field>
          <Field label={t('catalog.bulk.reason')} error={reasonErr}>
            {(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
        </div>
        {!asManager && <p className="rounded-input bg-info-soft px-3 py-2 text-xs text-info">{t('catalog.bulk.analystNote')}</p>}
        {rows.length > 0 && (
          <ul className="max-h-56 divide-y divide-line overflow-auto rounded-input border border-line text-xs">
            {rows.map((r) => (
              <li key={r.sku} className="flex items-center gap-2 px-3 py-2">
                <span className="tabular font-medium">{r.sku}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{r.name}</span>
                <PriceValue value={r.currentPrice} muted />
                <span aria-hidden>→</span>
                <PriceValue value={r.newPrice} />
                {r.check !== 'ok' && <span className="text-warn">{t(`catalog.bulk.check.${r.check}`)}</span>}
              </li>
            ))}
          </ul>
        )}
        {blocked.length > 0 && <p className="text-xs text-warn">{t('catalog.bulk.blocked', { n: blocked.length })}</p>}
        <RecoveryNotice>{t('catalog.bulk.editHonest')}</RecoveryNotice>
        <ActionSummary
          consequence={t('catalog.bulk.editSummary', { n: rows.length - blocked.length, blocked: blocked.length })}
          action={
            <>
              <Button variant="secondary" onClick={onClose}>{t('common.action.cancel')}</Button>
              <Button disabled={!valid || rows.length - blocked.length === 0} onClick={confirm}>
                {t(asManager ? 'catalog.bulk.editConfirm' : 'catalog.bulk.requestConfirm', { n: rows.length - blocked.length })}
              </Button>
            </>
          }
        />
      </div>
    </Dialog>
  );
}

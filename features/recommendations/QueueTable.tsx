'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ConfidenceBar } from '@/components/ds/ConfidenceBar';
import { DeltaBadge } from '@/components/ds/DeltaBadge';
import { PriceValue } from '@/components/ds/PriceValue';
import { ProductIdentity } from '@/components/ds/ProductIdentity';
import { StatusChip } from '@/components/ds/StatusChip';
import { MestaDataTable, useColumnVisibility, type DataColumn, type TableGroupOption } from '@/components/ds/table/DataTable';
import { recommendationHealth } from '@/lib/actions/recommendation';
import { formatRelativeTime } from '@/lib/format';
import { useTranslation } from '@/lib/i18n';
import type { Product, Recommendation } from '@/lib/ontology';
import { changeRatio, type SortKey } from './filters';

interface Row {
  rec: Recommendation;
  product: Product | undefined;
}

/**
 * PAGE 02 dense table view — the same filtered/sorted queue rows as the card
 * grid, rendered for scanning. Sort headers map onto the queue's canonical
 * sort keys (fixed direction per key); selection feeds the bulk dialog.
 */
export function QueueTable({
  rows,
  productMap,
  sort,
  onSort,
  selected,
  onToggle,
  onToggleAll,
  onOpen,
}: {
  rows: Recommendation[];
  productMap: Map<string, Product>;
  sort: SortKey;
  onSort: (key: SortKey) => void;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onOpen: (rec: Recommendation) => void;
}) {
  const { t, locale } = useTranslation();
  const visibility = useColumnVisibility('rec-queue', ['source']);
  const data = useMemo<Row[]>(() => rows.map((rec) => ({ rec, product: productMap.get(rec.sku) })), [rows, productMap]);

  const columns: DataColumn<Row>[] = [
    {
      id: 'id', header: t('recommendations.table.id'), required: true, defaultWidth: 104,
      cell: ({ rec }) => <Link href={`/recommendations/${rec.id}`} className="tabular text-brand hover:underline">{rec.id}</Link>,
    },
    {
      id: 'product', header: t('recommendations.table.product'), required: true, sortKey: 'category', defaultWidth: 220,
      cell: ({ rec, product }) => (product
        ? <ProductIdentity product={product} size="sm" />
        : <span className="tabular text-muted">{rec.sku}</span>),
    },
    {
      id: 'current', header: t('recommendations.table.current'), align: 'right', defaultWidth: 104,
      cell: ({ rec }) => <PriceValue value={rec.currentPrice} />,
    },
    {
      id: 'proposed', header: t('recommendations.table.proposed'), align: 'right', defaultWidth: 104,
      cell: ({ rec }) => <PriceValue value={rec.proposedPrice} />,
    },
    {
      id: 'delta', header: t('recommendations.table.delta'), align: 'right', defaultWidth: 88,
      cell: ({ rec }) => <DeltaBadge value={changeRatio(rec)} />,
    },
    {
      id: 'confidence', header: t('recommendations.table.confidence'), sortKey: 'confidence', defaultWidth: 168,
      cell: ({ rec }) => <ConfidenceBar value={rec.confidence} />,
    },
    {
      id: 'impact', header: t('recommendations.table.impact'), align: 'right', sortKey: 'impact', defaultWidth: 120,
      cell: ({ rec }) => <PriceValue value={rec.projectedMarginImpact} />,
    },
    {
      id: 'status', header: t('recommendations.table.status'), defaultWidth: 120,
      cell: ({ rec }) => (
        <span className="flex items-center gap-1">
          <StatusChip status={rec.status} />
          {recommendationHealth(rec).stale && <StatusChip status="stale" />}
        </span>
      ),
    },
    {
      id: 'source', header: t('recommendations.table.source'), defaultWidth: 96,
      cell: ({ rec }) => <span className="text-muted">{t(`recommendations.source.${rec.source}`)}</span>,
    },
    {
      id: 'age', header: t('recommendations.table.age'), sortKey: 'age', defaultWidth: 104,
      cell: ({ rec }) => <span className="tabular whitespace-nowrap text-muted">{formatRelativeTime(rec.createdAt, locale)}</span>,
    },
  ];

  const groups: TableGroupOption<Row>[] = [
    {
      id: 'status', label: t('recommendations.table.status'),
      value: ({ rec }) => rec.status,
      format: (v) => t(`common.status.${v}`),
    },
    {
      id: 'category', label: t('recommendations.filter.category'),
      value: ({ product }) => product?.category ?? '—',
    },
  ];

  return (
    <MestaDataTable<Row>
      tableId="rec-queue"
      caption={t('recommendations.table.caption')}
      columns={columns}
      rows={data}
      getRowId={(r) => r.rec.id}
      resizable
      minWidth={1080}
      visibility={visibility}
      groups={groups}
      sort={{ key: sort, dir: sort === 'category' ? 'asc' : 'desc', onSort: (k) => onSort(k as SortKey) }}
      selection={{ selected, onToggle, onToggleAll, label: t('recommendations.table.select') }}
      onRowClick={({ rec }) => onOpen(rec)}
    />
  );
}

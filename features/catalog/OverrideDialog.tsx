'use client';

import { useState } from 'react';
import { PriceValue } from '@/components/ds/PriceValue';
import { ConsequencePreview, DocsLink, RecoveryNotice } from '@/components/ds/trust';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { requestOverride } from '@/lib/actions/ops';
import { validatePrice } from '@/lib/domain';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { useAuditStore, useProductCatalogStore, useSessionStore, useToastStore } from '@/lib/stores';

export function OverrideDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open={product !== null} onClose={onClose} title={t('catalog.override.title')}>
      {product && <OverrideForm key={product.sku} product={product} onClose={onClose} />}
    </Dialog>
  );
}

function OverrideForm({ product, onClose }: { product: Product; onClose: () => void }) {
  const { t } = useTranslation();
  const can = useCan();
  const user = useSessionStore((s) => s.user);
  const toast = useToastStore((s) => s.push);
  const [price, setPrice] = useState(String(product.price));
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  // Managers apply overrides directly; everyone else files a request for approval.
  const direct = can('catalog.override_price') && can('override.decide');

  const result = validatePrice(product, Number(price));
  const priceErr = result === 'ok' ? undefined : t(`catalog.override.err.${result}`);
  const reasonErr = reason.trim() ? undefined : t('catalog.override.err.reason');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    // Handler-level RBAC: visibility alone is not enough.
    if (!can('override.request') || priceErr || reasonErr) return;
    const newPrice = Number(price);
    if (direct) {
      if (!useProductCatalogStore.getState().applyPrice(product.sku, newPrice, 'manual_override')) return;
      useAuditStore.getState().record({
        type: 'manual_override', actorId: user.userId, actorRole: user.role, entityType: 'product',
        entityId: product.sku, sku: product.sku, source: 'ui', note: reason.trim(),
        snapshot: { oldPrice: product.price, newPrice },
      });
    } else {
      const r = requestOverride(user, product.sku, newPrice, reason);
      if (!r.ok) { toast(t(`exceptions.err.${r.error}`)); return; }
      toast(t('catalog.override.requestedToast'));
    }
    onClose();
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        <span className="tabular">{product.sku}</span> · {product.name} · <PriceValue value={product.price} />
      </p>
      <p className="text-xs text-faint">
        {t('catalog.detail.minMax')}: <PriceValue value={product.minPrice} /> – <PriceValue value={product.maxPrice} /> · {t('catalog.detail.map')}: <PriceValue value={product.mapPrice} />
      </p>
      <Field label={t('catalog.override.newPrice')} error={submitted ? priceErr : undefined}>
        {(p) => <Input {...p} type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />}
      </Field>
      <Field label={t('catalog.override.reason')} error={submitted ? reasonErr : undefined}>
        {(p) => <Input {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
      {!priceErr && (
        <ConsequencePreview
          items={[
            { label: t('catalog.override.consequence.current'), value: <PriceValue value={product.price} /> },
            {
              label: t('catalog.override.consequence.new'), value: <PriceValue value={Number(price)} />,
              tone: Number(price) > product.price ? 'up' : Number(price) < product.price ? 'down' : 'default',
            },
            {
              label: t('catalog.override.consequence.delta'),
              value: `${Number(price) > product.price ? '+' : ''}${(((Number(price) - product.price) / product.price) * 100).toFixed(1)}%`,
              tone: Number(price) > product.price ? 'up' : Number(price) < product.price ? 'down' : 'default',
            },
            {
              label: t('catalog.override.consequence.vsMap'),
              value: `${Number(price) >= product.mapPrice ? '+' : ''}${(((Number(price) - product.mapPrice) / product.mapPrice) * 100).toFixed(1)}%`,
              tone: Number(price) < product.mapPrice ? 'warn' : 'default',
            },
          ]}
        />
      )}
      <RecoveryNotice>
        {direct ? t('catalog.override.recovery') : t('catalog.override.requestNote')}{' '}
        <DocsLink href={direct ? '/audit' : '/exceptions'}>{t(direct ? 'common.action.viewAudit' : 'catalog.override.viewQueue')}</DocsLink>
      </RecoveryNotice>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t('catalog.override.cancel')}</Button>
        <Button type="submit">{direct ? t('catalog.override.submit') : t('catalog.override.requestSubmit')}</Button>
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { PriceValue } from '@/components/ds/PriceValue';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { validatePrice } from '@/lib/domain';
import { useCan } from '@/lib/hooks';
import { useTranslation } from '@/lib/i18n';
import type { Product } from '@/lib/ontology';
import { useAuditStore, useProductCatalogStore, useSessionStore } from '@/lib/stores';

export function OverrideDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  return (
    <Dialog open={product !== null} onClose={onClose} title="Override">
      {product && <OverrideForm key={product.sku} product={product} onClose={onClose} />}
    </Dialog>
  );
}

function OverrideForm({ product, onClose }: { product: Product; onClose: () => void }) {
  const { t } = useTranslation();
  const can = useCan();
  const user = useSessionStore((s) => s.user);
  const [price, setPrice] = useState(String(product.price));
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const result = validatePrice(product, Number(price));
  const priceErr = result === 'ok' ? undefined : t(`catalog.override.err.${result}`);
  const reasonErr = reason.trim() ? undefined : t('catalog.override.err.reason');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    // Handler-level RBAC: visibility alone is not enough.
    if (!can('catalog.override_price') || priceErr || reasonErr) return;
    const newPrice = Number(price);
    if (!useProductCatalogStore.getState().applyPrice(product.sku, newPrice, 'manual_override')) return;
    useAuditStore.getState().record({
      type: 'manual_override', actorId: user.userId, actorRole: user.role, entityType: 'product',
      entityId: product.sku, sku: product.sku, source: 'ui', note: reason.trim(),
      snapshot: { oldPrice: product.price, newPrice },
    });
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
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t('catalog.override.cancel')}</Button>
        <Button type="submit">{t('catalog.override.submit')}</Button>
      </div>
    </form>
  );
}

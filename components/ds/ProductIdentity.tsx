import { Cookie, Croissant, CupSoda, Home, Milk, Package, Snowflake, SprayCan, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/ontology';

/**
 * UX-005 / SKU-001 — stable category→icon map. One lucide icon per category, never
 * random per SKU: the icon carries category identity, the name carries the product.
 */
export const CATEGORY_ICON: Record<string, LucideIcon> = {
  Beverages: CupSoda,
  Snacks: Cookie,
  Dairy: Milk,
  'Personal Care': SprayCan,
  Household: Home,
  'Frozen Food': Snowflake,
  Bakery: Croissant,
};

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const Icon = CATEGORY_ICON[category] ?? Package;
  return <Icon aria-hidden className={cn('shrink-0 text-muted', className)} />;
}

/**
 * SKU-002 hierarchy: product name primary, `Category · SKU` secondary.
 * The icon is a quiet contextual cue — secondary to the name, never a dominant color.
 */
export function ProductIdentity({
  product,
  size = 'md',
  className,
}: {
  product: Pick<Product, 'sku' | 'name' | 'category'>;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <span
        aria-hidden
        className={cn(
          'grid shrink-0 place-items-center rounded-input border border-line bg-subtle text-muted',
          size === 'sm' ? 'size-6' : 'size-8',
        )}
      >
        <CategoryIcon category={product.category} className={size === 'sm' ? 'size-3.5' : 'size-4'} />
      </span>
      <span className="min-w-0">
        <span className={cn('block truncate font-medium text-fg', size === 'sm' ? 'text-xs' : 'text-sm')} title={product.name}>
          {product.name}
        </span>
        <span className={cn('block truncate text-muted', size === 'sm' ? 'text-[11px]' : 'text-xs')}>
          {product.category} · <span className="tabular">{product.sku}</span>
        </span>
      </span>
    </span>
  );
}

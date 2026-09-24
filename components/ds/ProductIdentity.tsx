import { Cookie, Croissant, CupSoda, Home, Milk, Package, Snowflake, SprayCan, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Product } from '@/lib/ontology';

/**
 * UX-005 / SKU-001 / ICON-001 — stable category→icon map. One lucide icon per category (same
 * family, stroke and bounding box), never random per SKU: the icon carries category identity,
 * the name carries the product.
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
  return <Icon aria-hidden strokeWidth={1.75} className={cn('shrink-0 text-muted', className)} />;
}

const SIZE = {
  // Catalog identity rows (72px): 36px tile, 15px title (TABLE-007).
  lg: { box: 'size-9 rounded-input', icon: 'size-[18px]', title: 'text-[15px] leading-5 font-semibold', meta: 'text-xs leading-4' },
  // Standard tables and cards: 32px tile, 14px title.
  md: { box: 'size-8 rounded-input', icon: 'size-4', title: 'text-sm leading-5 font-semibold', meta: 'text-xs leading-4' },
  // Dense lists / drawers: 28px tile, 13px title.
  sm: { box: 'size-7 rounded-row', icon: 'size-3.5', title: 'text-[13px] leading-[18px] font-medium', meta: 'text-xs leading-4' },
} as const;

/**
 * SkuIdentity (TABLE-007 / CROSS-001) — the one product reference used on every surface:
 * fixed icon tile + product name (one line, truncated with a tooltip) over `Category · SKU`
 * (one line). The icon slot never changes width, so names line up across rows and cards.
 */
export function ProductIdentity({
  product,
  size = 'md',
  showSku = true,
  className,
}: {
  product: Pick<Product, 'sku' | 'name' | 'category'>;
  size?: 'sm' | 'md' | 'lg';
  /** Omit the SKU from the meta line when a dedicated SKU column already shows it. */
  showSku?: boolean;
  className?: string;
}) {
  const s = SIZE[size];
  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <span aria-hidden className={cn('grid shrink-0 place-items-center border border-line-icon bg-icon', s.box)}>
        <CategoryIcon category={product.category} className={s.icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-fg', s.title)} title={product.name}>{product.name}</span>
        <span className={cn('block truncate text-faint', s.meta)}>
          {product.category}
          {showSku && <> · <span className="tabular">{product.sku}</span></>}
        </span>
      </span>
    </span>
  );
}

/** Backlog v11 name for the same component. */
export const SkuIdentity = ProductIdentity;

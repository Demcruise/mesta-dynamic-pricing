import { cva, type VariantProps } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/utils';

const button = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-input text-sm font-medium tracking-label transition-colors duration-fast ease-standard disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Reference CTA: solid action blue, hairline light border, 1px inset top highlight.
        primary: 'border border-white/20 bg-brand text-brand-fg shadow-cta hover:bg-brand-hover',
        secondary: 'border border-line-strong bg-surface text-fg hover:bg-subtle',
        ghost: 'text-fg hover:bg-subtle',
        // Pressed state of a toggle/filter button — soft brand, never competes with the primary CTA.
        selected: 'border border-brand/30 bg-brand-soft text-brand',
        destructive: 'border border-white/20 bg-down text-brand-fg shadow-cta hover:opacity-90',
      },
      size: { sm: 'h-control-sm px-2.5 text-xs', md: 'h-control-md px-3.5 text-[13px]', icon: 'size-control-md max-sm:size-11' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  ref?: Ref<HTMLButtonElement>;
  /** Async action in flight: spinner + aria-busy, interaction blocked. */
  loading?: boolean;
}

export function Button({ className, variant, size, type = 'button', loading = false, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(button({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

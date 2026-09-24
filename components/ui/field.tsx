import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Toolbar / filter control (40px, --control-h-md). Every filter bar and table toolbar shares it. */
export const inputCls =
  'h-control-md w-full rounded-input border border-line-strong bg-input px-3 text-[13px] text-fg transition-colors duration-fast ease-standard placeholder:text-faint hover:border-line-strong hover:bg-surface';

/** Form field control (44px, --control-h-lg, 15px text) — wizard and settings forms (STRATEGY-005/006). */
export const fieldInputCls =
  'h-control-lg w-full rounded-input border border-line-strong bg-input px-3.5 text-[15px] text-fg transition-colors duration-fast ease-standard placeholder:text-faint hover:bg-surface aria-[invalid=true]:border-critical';

/** Compact header control (period selects, segmented toggles) — reference "Weekly ▾" button. */
export const controlCls =
  'h-control-md rounded-input border border-line-strong bg-input px-3 text-xs font-medium tracking-label text-fg transition-colors duration-fast ease-standard hover:bg-subtle';

type FieldSlot = { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string };

/**
 * Label (13px medium) → control → helper (12px) or error. `optional` renders the same muted
 * "(optional)" marker everywhere; hint and error are both wired to aria-describedby.
 */
export function Field({
  label, error, hint, optional, children, className,
}: {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  /** Text of the optional marker, e.g. t('common.form.optional'). */
  optional?: string | undefined;
  className?: string;
  children: (p: FieldSlot) => ReactNode;
}) {
  const id = useId();
  const describedBy = [error && `${id}-err`, hint && `${id}-hint`].filter(Boolean).join(' ');
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-label text-fg">
        {label}
        {optional && <span className="ml-1 font-normal text-faint">({optional})</span>}
      </label>
      {children({ id, 'aria-invalid': !!error, ...(describedBy ? { 'aria-describedby': describedBy } : {}) })}
      {error
        ? <p id={`${id}-err`} role="alert" className="text-caption text-critical">{error}</p>
        : hint && <p id={`${id}-hint`} className="text-caption text-faint">{hint}</p>}
    </div>
  );
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, className)} {...p} />;
}

/**
 * 44px form input with a fixed unit adornment (IDR prefix, % suffix) so currency and percentage
 * fields read consistently and their values align (STRATEGY-005).
 */
export function AffixInput({ prefix, suffix, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { prefix?: string; suffix?: string }) {
  return (
    <span className={cn('relative flex items-center', className)}>
      {prefix && <span aria-hidden className="pointer-events-none absolute left-3.5 text-[13px] font-medium text-faint">{prefix}</span>}
      <input
        className={cn(fieldInputCls, 'tabular', prefix && 'pl-12', suffix && 'pr-10')}
        {...p}
      />
      {suffix && <span aria-hidden className="pointer-events-none absolute right-3.5 text-[13px] font-medium text-faint">{suffix}</span>}
    </span>
  );
}

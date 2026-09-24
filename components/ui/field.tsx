import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const inputCls =
  'h-9 w-full rounded-input border border-line-strong bg-input px-3 text-[13px] text-fg transition-colors duration-fast ease-standard placeholder:text-faint hover:border-line-strong hover:bg-surface';

/** Compact header control (period selects, segmented toggles) — reference "Weekly ▾" button. */
export const controlCls =
  'h-9 rounded-input border border-line-strong bg-input px-3 text-xs font-medium tracking-label text-fg transition-colors duration-fast ease-standard hover:bg-subtle';

export function Field({
  label, error, children,
}: { label: string; error?: string | undefined; children: (p: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted">{label}</label>
      {children({ id, 'aria-invalid': !!error, ...(error ? { 'aria-describedby': `${id}-err` } : {}) })}
      {error && <p id={`${id}-err`} role="alert" className="text-xs text-critical">{error}</p>}
    </div>
  );
}

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputCls, className)} {...p} />;
}

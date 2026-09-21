'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Native <dialog> modal: browser provides focus trap, Escape and inert background. */
export function Dialog({
  open, onClose, title, children, className,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className={cn('m-auto w-full max-w-md rounded-card border border-line bg-surface p-0 text-fg backdrop:bg-black/40', className)}
    >
      {open && (
        <div className="p-5">
          <h2 className="mb-3 text-base font-semibold">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}

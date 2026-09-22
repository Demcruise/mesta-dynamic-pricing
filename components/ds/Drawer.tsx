'use client';

import { ArrowUpRight, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Full-page destination for the same entity — rendered in the footer. */
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
}

/** Quick-view side panel (native <dialog> modal → focus trap, Escape, inert background for free). */
export function Drawer({ open, onClose, title, href, hrefLabel, children }: Props) {
  const { t } = useTranslation();
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
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-md animate-drawer-in rounded-none rounded-l-card border-0 border-l border-line bg-surface p-0 text-fg shadow-e4 backdrop:bg-black/40 max-sm:max-w-none max-sm:rounded-none max-sm:border-l-0 motion-reduce:animate-none"
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between gap-2 border-b border-line p-4">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.table.close')}
              className="grid size-9 shrink-0 place-items-center rounded-input text-muted transition-colors duration-fast hover:bg-subtle hover:text-fg"
            >
              <X className="size-4" aria-hidden />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {href && (
            <footer className="border-t border-line p-4">
              <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
                {hrefLabel ?? t('common.table.openFull')} <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}

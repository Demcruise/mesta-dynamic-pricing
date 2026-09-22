'use client';

import { create } from 'zustand';
import { Dialog } from '@/components/ui/dialog';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type GlossaryTerm = 'margin' | 'elasticity' | 'map' | 'confidence';
const TERMS: GlossaryTerm[] = ['margin', 'elasticity', 'map', 'confidence'];

export const useGlossaryStore = create<{ open: boolean; term: GlossaryTerm | null; show: (t: GlossaryTerm | null) => void; close: () => void }>((set) => ({
  open: false,
  term: null,
  show: (term) => set({ open: true, term }),
  close: () => set({ open: false }),
}));

/** Inline term that opens the glossary on that entry; a real button so it works by keyboard. */
export function Term({ k, children }: { k: GlossaryTerm; children?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <button type="button" onClick={() => useGlossaryStore.getState().show(k)} className="underline decoration-dotted underline-offset-2">
      {children ?? t(`common.glossary.${k}`)}
    </button>
  );
}

export function GlossaryDialog() {
  const { t } = useTranslation();
  const { open, term, close } = useGlossaryStore();
  return (
    <Dialog open={open} onClose={close} title={t('common.glossary.title')} className="max-w-lg">
      <dl className="flex flex-col gap-3 text-sm">
        {TERMS.map((k) => (
          <div key={k} className={cn('rounded-input p-2', term === k && 'bg-brand-soft')}>
            <dt className="font-medium">{t(`common.glossary.${k}`)}</dt>
            <dd className="text-muted">{t(`common.glossary.${k}Def`)}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

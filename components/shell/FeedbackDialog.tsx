'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { create } from 'zustand';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { useTranslation } from '@/lib/i18n';
import { useFeedbackStore, useToastStore } from '@/lib/stores';

export const useFeedbackDialog = create<{ open: boolean; setOpen: (v: boolean) => void }>((set) => ({ open: false, setOpen: (open) => set({ open }) }));

export function FeedbackDialog() {
  const { t } = useTranslation();
  const { open, setOpen } = useFeedbackDialog();
  return (
    <Dialog open={open} onClose={() => setOpen(false)} title={t('common.feedback.title')}>
      {open && <Form onDone={() => setOpen(false)} />}
    </Dialog>
  );
}

function Form({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const page = usePathname();
  const toast = useToastStore((s) => s.push);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState(false);
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!msg.trim()) { setErr(true); return; }
        useFeedbackStore.getState().add(msg.trim(), page);
        toast(t('common.feedback.thanks'));
        onDone();
      }}
    >
      <Field label={t('common.feedback.placeholder')} error={err ? t('common.feedback.required') : undefined}>
        {(p) => <Input {...p} value={msg} onChange={(e) => setMsg(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>{t('common.feedback.cancel')}</Button>
        <Button type="submit">{t('common.feedback.send')}</Button>
      </div>
    </form>
  );
}

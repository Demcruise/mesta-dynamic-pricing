'use client';

import { PageHeader } from '@/components/ds/states';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n';
import { useUiStore } from '@/lib/stores';
import type { Locale } from '@/lib/format';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { t, locale } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const density = useUiStore((s) => s.density);
  const setDensity = useUiStore((s) => s.setDensity);
  const setLocale = useUiStore((s) => s.setLocale);

  return (
    <>
      <PageHeader title={t('common.nav.settings')} subtitle={t('common.settings.subtitle')} />
      <section aria-label={t('common.settings.appearance')} className="max-w-lg divide-y divide-line rounded-card border border-line bg-surface px-card shadow-e1">
        <Row label={t('common.user.theme')}>
          {(['light', 'dark'] as const).map((v) => (
            <Button key={v} size="sm" variant={theme === v ? 'primary' : 'secondary'} aria-pressed={theme === v} onClick={() => setTheme(v)}>
              {t(`common.user.${v}`)}
            </Button>
          ))}
        </Row>
        <Row label={t('common.user.language')}>
          {(['id', 'en'] as const).map((l: Locale) => (
            <Button key={l} size="sm" variant={locale === l ? 'primary' : 'secondary'} aria-pressed={locale === l} onClick={() => setLocale(l)}>
              {l.toUpperCase()}
            </Button>
          ))}
        </Row>
        <Row label={t('common.density.label')}>
          {(['comfortable', 'compact'] as const).map((d) => (
            <Button key={d} size="sm" variant={density === d ? 'primary' : 'secondary'} aria-pressed={density === d} onClick={() => setDensity(d)}>
              {t(`common.density.${d}`)}
            </Button>
          ))}
        </Row>
      </section>
    </>
  );
}

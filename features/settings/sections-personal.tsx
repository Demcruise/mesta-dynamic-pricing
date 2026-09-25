'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Segmented } from '@/components/ui/segmented';
import { NAV } from '@/components/shell/nav';
import { useTranslation } from '@/lib/i18n';
import { NOTIFICATION_EVENTS } from '@/lib/settings-config';
import { useSessionStore, useUiStore, useWorkspaceSettingsStore } from '@/lib/stores';
import { FormGrid, SectionHeader, SettingField, SettingsCard, selectCls } from './ui';

/** SET-026 — personal preferences: low risk, so they autosave (SET-031) and say so. */
export function PreferencesSection() {
  const { t, locale } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const density = useUiStore((s) => s.density);
  const setDensity = useUiStore((s) => s.setDensity);
  const setLocale = useUiStore((s) => s.setLocale);
  const prefs = useWorkspaceSettingsStore((s) => s.prefs);
  const setPrefs = useWorkspaceSettingsStore((s) => s.setPrefs);

  return (
    <>
      <SectionHeader slug="preferences" actions={<span className="flex items-center gap-1.5 text-caption text-up"><Check className="size-3.5" aria-hidden />{t('settings.save.autosave')}</span>} />
      <div className="flex flex-col gap-8">
        <SettingsCard title={t('settings.prefs.appearance')}>
          <FormGrid>
            <SettingField label={t('settings.prefs.theme')}>
              <Segmented label={t('settings.prefs.theme')} value={theme} onChange={setTheme} className="self-start"
                options={[{ value: 'light', label: t('common.user.light') }, { value: 'dark', label: t('common.user.dark') }]} />
            </SettingField>
            <SettingField label={t('settings.prefs.language')}>
              <Segmented label={t('settings.prefs.language')} value={locale} onChange={setLocale} className="self-start"
                options={[{ value: 'id', label: 'Bahasa Indonesia' }, { value: 'en', label: 'English' }]} />
            </SettingField>
            <SettingField label={t('settings.prefs.density')}>
              <Segmented label={t('settings.prefs.density')} value={density} onChange={setDensity} className="self-start"
                options={[{ value: 'comfortable', label: t('common.density.comfortable') }, { value: 'compact', label: t('common.density.compact') }]} />
            </SettingField>
          </FormGrid>
        </SettingsCard>

        <SettingsCard title={t('settings.prefs.regional')}>
          <FormGrid>
            <SettingField label={t('settings.prefs.timezone')} htmlFor="pref-tz">
              <select id="pref-tz" className={selectCls} value={prefs.timezone} onChange={(e) => setPrefs({ timezone: e.target.value })}>
                {['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'UTC'].map((z) => <option key={z} value={z}>{z}</option>)}
              </select>
            </SettingField>
            <SettingField label={t('settings.prefs.dateFormat')} htmlFor="pref-date">
              <select id="pref-date" className={selectCls} value={prefs.dateFormat} onChange={(e) => setPrefs({ dateFormat: e.target.value as typeof prefs.dateFormat })}>
                {(['medium', 'iso', 'dmy'] as const).map((f) => <option key={f} value={f}>{t(`settings.prefs.date.${f}`)}</option>)}
              </select>
            </SettingField>
            <SettingField label={t('settings.prefs.currencyLabel')} htmlFor="pref-cur">
              <select id="pref-cur" className={selectCls} value={prefs.currencyDisplay} onChange={(e) => setPrefs({ currencyDisplay: e.target.value as typeof prefs.currencyDisplay })}>
                {(['code', 'symbol'] as const).map((f) => <option key={f} value={f}>{t(`settings.prefs.currency.${f}`)}</option>)}
              </select>
            </SettingField>
            <SettingField label={t('settings.prefs.numberLabel')} htmlFor="pref-num">
              <select id="pref-num" className={selectCls} value={prefs.numberFormat} onChange={(e) => setPrefs({ numberFormat: e.target.value as typeof prefs.numberFormat })}>
                {(['locale', 'en', 'id'] as const).map((f) => <option key={f} value={f}>{t(`settings.prefs.number.${f}`)}</option>)}
              </select>
            </SettingField>
          </FormGrid>
        </SettingsCard>

        <SettingsCard title={t('settings.prefs.workspace')}>
          <FormGrid>
            <SettingField label={t('settings.prefs.landing')} htmlFor="pref-landing">
              <select id="pref-landing" className={selectCls} value={prefs.landing} onChange={(e) => setPrefs({ landing: e.target.value })}>
                {NAV.map((n) => <option key={n.href} value={n.href}>{t(`common.nav.${n.key}`)}</option>)}
              </select>
            </SettingField>
          </FormGrid>
        </SettingsCard>
      </div>
    </>
  );
}

/** SET-020 — personal delivery per event; admin-mandated routes are locked on (SET-021). */
export function NotificationsSection() {
  const { t } = useTranslation();
  const role = useSessionStore((s) => s.user.role);
  const routing = useWorkspaceSettingsStore((s) => s.config.alerts.routing);
  const notify = useWorkspaceSettingsStore((s) => s.prefs.notify);
  const setPrefs = useWorkspaceSettingsStore((s) => s.setPrefs);
  const set = (ev: string, ch: 'inapp' | 'email', v: boolean) => {
    const cur = notify[ev] ?? { inapp: true, email: false };
    setPrefs({ notify: { ...notify, [ev]: { ...cur, [ch]: v } } });
  };

  return (
    <>
      <SectionHeader slug="notifications" actions={<span className="flex items-center gap-1.5 text-caption text-up"><Check className="size-3.5" aria-hidden />{t('settings.save.autosave')}</span>} />
      <div className="overflow-x-auto rounded-card border border-line bg-surface">
        <table className="mesta-table min-w-[560px]" style={{ tableLayout: 'fixed' }}>
          <caption className="sr-only">{t('settings.section.notifications.title')}</caption>
          <colgroup><col /><col style={{ width: 128 }} /><col style={{ width: 128 }} /></colgroup>
          <thead><tr><th scope="col" className="text-left">{t('settings.notif.event')}</th><th scope="col">{t('settings.notif.inapp')}</th><th scope="col">{t('settings.notif.email')}</th></tr></thead>
          <tbody>
            {NOTIFICATION_EVENTS.map((ev) => {
              const route = routing.find((r) => r.event === ev);
              const mandatory = !!route?.mandatory && route.recipients.includes(role);
              const cur = notify[ev] ?? { inapp: true, email: false };
              return (
                <tr key={ev}>
                  <th scope="row" className="text-left">
                    <span className="block font-medium text-fg">{t(`settings.event.${ev}`)}</span>
                    {mandatory && <span className="block text-caption text-faint">{t('settings.notif.mandatoryHint', { roles: route!.recipients.map((r) => t(`common.role.${r}`)).join(', ') })}</span>}
                  </th>
                  {(['inapp', 'email'] as const).map((ch) => {
                    const locked = mandatory && route!.channels.includes(ch);
                    return (
                      <td key={ch} className="text-center">
                        <input
                          type="checkbox" className="size-4 accent-brand disabled:cursor-not-allowed"
                          aria-label={`${t(`settings.event.${ev}`)} — ${t(`settings.notif.${ch}`)}${locked ? ` (${t('settings.notif.mandatory')})` : ''}`}
                          checked={locked || cur[ch]} disabled={locked} onChange={(e) => set(ev, ch, e.target.checked)}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

interface SavedView { id: string; name: string; query: string }
const TABLE_ROUTES: Record<string, string> = { catalog: '/catalog', audit: '/audit', signals: '/signals', deployment: '/deployment' };

/** SET-027 — every saved table view in one place, reopenable with its filters. */
export function ViewsSection() {
  const { t } = useTranslation();
  const [views, setViews] = useState<{ table: string; view: SavedView }[]>([]);
  useEffect(() => {
    const out: { table: string; view: SavedView }[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) ?? '';
        if (!key.startsWith('mesta-views-')) continue;
        const table = key.slice('mesta-views-'.length);
        for (const v of JSON.parse(localStorage.getItem(key) ?? '[]') as SavedView[]) out.push({ table, view: v });
      }
    } catch { /* storage unavailable */ }
    setViews(out);
  }, []);

  return (
    <>
      <SectionHeader slug="views" />
      {views.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong px-6 py-10 text-center text-body-sm text-muted">{t('settings.views.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="mesta-table min-w-[640px]" style={{ tableLayout: 'fixed' }}>
            <caption className="sr-only">{t('settings.section.views.title')}</caption>
            <colgroup><col style={{ width: 160 }} /><col style={{ width: 240 }} /><col /><col style={{ width: 112 }} /></colgroup>
            <thead><tr>
              <th scope="col" className="text-left">{t('settings.views.table')}</th>
              <th scope="col" className="text-left">{t('settings.views.name')}</th>
              <th scope="col" className="text-left">{t('settings.views.filters')}</th>
              <th scope="col" className="text-right"><span className="sr-only">{t('settings.views.open')}</span></th>
            </tr></thead>
            <tbody>
              {views.map(({ table, view }) => (
                <tr key={`${table}-${view.id}`}>
                  <td className="capitalize text-muted">{table}</td>
                  <td className="truncate font-medium text-fg">{view.name}</td>
                  <td className="truncate font-mono text-caption text-muted" title={view.query}>{view.query || t('settings.views.noFilters')}</td>
                  <td className="text-right">
                    <Link className="font-medium text-brand hover:underline" href={`${TABLE_ROUTES[table] ?? `/${table}`}${view.query ? `?${view.query}` : ''}`}>{t('settings.views.open')}</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export type Locale = 'id' | 'en';

const tag = (l: Locale) => (l === 'id' ? 'id-ID' : 'en-US');

export function formatPrice(value: number, locale: Locale = 'id'): string {
  return new Intl.NumberFormat(tag(locale), {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

/** `value` is a ratio (0.12 → 12%). */
export function formatPercent(value: number, locale: Locale = 'id', digits = 1): string {
  return new Intl.NumberFormat(tag(locale), {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDate(iso: string, locale: Locale = 'id'): string {
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

export function formatRelativeTime(iso: string, locale: Locale = 'id', now = Date.now()): string {
  const diffSec = Math.round((new Date(iso).getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: 'auto' });
  const abs = Math.abs(diffSec);
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour');
  return rtf.format(Math.round(diffSec / 86400), 'day');
}

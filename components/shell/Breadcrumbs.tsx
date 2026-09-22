'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { NAV } from './nav';

// Route prefix → nav key. Dynamic ids (SKU-1004, REC-3) render as raw tabular text.
const SECTION_LABEL = new Map(NAV.map((n) => [n.href.slice(1), n.key]));
const SUB_LABEL = new Set(['new', 'edit']);

function crumbLabel(seg: string, t: (k: string) => string): string {
  const navKey = SECTION_LABEL.get(seg);
  if (navKey) return t(`common.nav.${navKey}`);
  if (SUB_LABEL.has(seg)) return t(`common.crumb.${seg}`);
  return seg;
}

/** Contextual breadcrumb derived from the active route — always in sync, incl. nested detail pages. */
export function Breadcrumbs() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const segs = pathname.split('/').filter(Boolean);
  if (segs.length === 0) return null;

  return (
    <nav aria-label={t('common.a11y.breadcrumb')} className="hidden min-w-0 flex-1 md:block">
      <ol className="flex items-center gap-1 text-sm">
        {segs.map((seg, i) => {
          const last = i === segs.length - 1;
          const known = SECTION_LABEL.has(seg) || SUB_LABEL.has(seg);
          // Only segments that are real routes become links; ids stay text.
          const linkable = !last && SECTION_LABEL.has(seg);
          const href = `/${segs.slice(0, i + 1).join('/')}`;
          const body = (
            <span className={cn('truncate', !known && 'tabular', last ? 'font-medium text-fg' : 'text-muted', !last && linkable && 'transition-colors duration-fast hover:text-fg')}>
              {crumbLabel(seg, t)}
            </span>
          );
          return (
            <li key={href} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-faint" aria-hidden />}
              {linkable ? <Link href={href} className="truncate transition-colors duration-fast">{body}</Link> : body}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

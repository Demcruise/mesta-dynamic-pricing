'use client';

import { inputCls } from '@/components/ui/field';
import { useTranslation } from '@/lib/i18n';
import type { Role } from '@/lib/ontology';
import { ROLES } from '@/lib/rbac';
import { useSessionStore } from '@/lib/stores';

/** Dev-only role switcher — lives in the sidebar profile card and the topbar user menu. */
export function DevRoleSelect() {
  const { t } = useTranslation();
  const role = useSessionStore((s) => s.user.role);
  const setRole = useSessionStore((s) => s.setRole);
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-muted">
      <span>{t('common.role.switcher')}</span>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
        className={`${inputCls} h-8 w-28`}
      >
        {ROLES.map((r) => <option key={r} value={r}>{t(`common.role.${r}`)}</option>)}
      </select>
    </label>
  );
}

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_CONFIG, type SectionKey, type WorkspaceConfig } from '@/lib/settings-config';
import type { UserSession } from '../ontology';
import { useAuditStore } from './audit';

export interface SectionMeta { by: string; at: string; auditId: string }

export interface PersonalPrefs {
  timezone: string;
  dateFormat: 'medium' | 'iso' | 'dmy';
  currencyDisplay: 'code' | 'symbol';
  numberFormat: 'locale' | 'en' | 'id';
  landing: string;
  /** Personal delivery per notification event and channel (SET-020). */
  notify: Record<string, { inapp: boolean; email: boolean }>;
}

const DEFAULT_PREFS: PersonalPrefs = {
  timezone: 'Asia/Jakarta', dateFormat: 'medium', currencyDisplay: 'code', numberFormat: 'locale', landing: '/overview', notify: {},
};

interface WorkspaceSettingsState {
  config: WorkspaceConfig;
  meta: Partial<Record<SectionKey, SectionMeta>>;
  prefs: PersonalPrefs;
  /** Unsaved section drafts — kept while navigating between sections (SET-031), never persisted. */
  drafts: Partial<Record<SectionKey, unknown>>;
  setDraft: <K extends SectionKey>(key: K, value: WorkspaceConfig[K] | undefined) => void;
  /** Persists a section and appends an immutable `settings_change` audit event (SET-043). */
  save: <K extends SectionKey>(key: K, value: WorkspaceConfig[K], user: UserSession, note: string) => SectionMeta;
  setPrefs: (patch: Partial<PersonalPrefs>) => void;
  reset: () => void;
}

export const useWorkspaceSettingsStore = create<WorkspaceSettingsState>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      meta: {},
      prefs: DEFAULT_PREFS,
      drafts: {},
      setDraft: (key, value) => set((s) => {
        const drafts = { ...s.drafts };
        if (value === undefined) delete drafts[key]; else drafts[key] = value;
        return { drafts };
      }),
      save: (key, value, user, note) => {
        const ev = useAuditStore.getState().record({
          type: 'settings_change', actorId: user.userId, actorRole: user.role, entityType: 'settings',
          entityId: key, sku: null, source: 'ui', note,
        });
        const m: SectionMeta = { by: user.name, at: ev.timestamp, auditId: ev.id };
        set((s) => {
          const drafts = { ...s.drafts };
          delete drafts[key];
          return { config: { ...s.config, [key]: value }, meta: { ...s.meta, [key]: m }, drafts };
        });
        return m;
      },
      setPrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch } })),
      reset: () => set({ config: DEFAULT_CONFIG, meta: {}, prefs: DEFAULT_PREFS, drafts: {} }),
    }),
    {
      name: 'mesta-workspace-settings',
      version: 1,
      partialize: (s) => ({ config: s.config, meta: s.meta, prefs: s.prefs }),
      // New config keys ship with defaults even for workspaces saved by an older build.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<WorkspaceSettingsState>;
        const config = { ...current.config } as Record<string, unknown>;
        for (const [k, v] of Object.entries(p.config ?? {})) config[k] = { ...(current.config as unknown as Record<string, object>)[k], ...(v as object) };
        return { ...current, meta: p.meta ?? {}, prefs: { ...current.prefs, ...p.prefs }, config: config as unknown as WorkspaceConfig };
      },
    },
  ),
);

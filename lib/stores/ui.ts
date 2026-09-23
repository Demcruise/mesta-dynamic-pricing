import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Locale } from '../format';
import { ORG_SCOPE, type ScopeSelection } from '../scope';

export type Density = 'compact' | 'comfortable';
export type Theme = 'light' | 'dark';

interface UiState {
  density: Density;
  theme: Theme;
  locale: Locale;
  sidebarCollapsed: boolean;
  /** Org → Region → Store slice every scoped page filters by. */
  scope: ScopeSelection;
  /** Returning users dismiss setup; onboarding only reappears when explicitly opened. */
  onboardingDismissed: boolean;
  setDensity: (d: Density) => void;
  setTheme: (t: Theme) => void;
  setLocale: (l: Locale) => void;
  setScope: (s: ScopeSelection) => void;
  setOnboardingDismissed: (v: boolean) => void;
  toggleSidebar: () => void;
}

/**
 * Persisted with skipHydration so server and first client render agree;
 * BootstrapProvider calls rehydrate() after mount (avoids hydration mismatch).
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      density: 'comfortable',
      theme: 'light',
      locale: 'id',
      sidebarCollapsed: false,
      scope: ORG_SCOPE,
      onboardingDismissed: false,
      setDensity: (density) => set({ density }),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
      setScope: (scope) => set({ scope }),
      setOnboardingDismissed: (onboardingDismissed) => set({ onboardingDismissed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'mesta-ui', skipHydration: true },
  ),
);

/** Back-compat alias used by the backlog wording. */
export const useLocaleStore = useUiStore;

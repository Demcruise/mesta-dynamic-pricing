import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { AuthGate } from '@/components/shell/AuthGate';
import { Providers } from '@/components/shell/Providers';

/** Every application route is protected: no session → /login (AUTH-26), before any data loads. */
export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <Providers>
        <AppShell>{children}</AppShell>
      </Providers>
    </AuthGate>
  );
}

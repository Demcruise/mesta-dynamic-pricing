import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Providers } from '@/components/shell/Providers';

export default function ShellLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}

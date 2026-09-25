import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AuthProviders } from '@/features/auth/components';

export const metadata: Metadata = { title: 'Sign in · Mesta Dynamic Pricing' };

/** Public auth routes: no app shell, no demo-data bootstrap, no application data. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthProviders>{children}</AuthProviders>;
}

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mesta Dynamic Pricing',
  description: 'Human-in-the-loop dynamic pricing workspace for retail.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      {/* Browser extensions (e.g. ColorZilla) inject attributes into <body> before hydration. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

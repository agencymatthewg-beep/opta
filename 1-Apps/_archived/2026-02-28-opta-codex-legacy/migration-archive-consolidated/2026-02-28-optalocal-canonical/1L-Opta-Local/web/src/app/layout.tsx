import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppShell } from '@/components/shared/AppShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'Opta Local',
  description: 'Opta Local control surface',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

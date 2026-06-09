import type { Metadata } from 'next';
import AppShell from '@/components/layout/AppShell';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: { template: '%s — Bellezza Studio', default: 'Bellezza Studio' },
  description: 'Gestionale centro estetico',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

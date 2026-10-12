import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppLingvaProvider } from '../src/lingva/provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lingva Next.js Starter',
  description: 'Local-first Lingva starter for Next.js App Router.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppLingvaProvider>{children}</AppLingvaProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { JetBrains_Mono, Sora } from 'next/font/google';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'Opta Learn — Guides for Opta AI Activation and Execution',
  description: 'Guides for Opta, where Opta Local is the first public release. Learn how local LMX or cloud models power Opta AI across CLI and Code workflows.',
  icons: {
    icon: '/favicon.svg',
  },
  alternates: {
    canonical: 'https://learn.optalocal.com',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-void font-sora text-text-primary antialiased">{children}</body>
    </html>
  );
}

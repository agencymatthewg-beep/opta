import type { Metadata } from 'next';
import { Sora, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Opta Accounts — Sign In',
  description:
    'Sign in to your Opta account. One login for Opta Local, Life Manager, and all Opta apps.',
  openGraph: {
    title: 'Opta Accounts — Sign In',
    description: 'One login for all Opta apps.',
    url: 'https://accounts.optalocal.com',
    siteName: 'Opta Accounts',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sora.variable} ${jetbrainsMono.variable}`}>
      <body className="film-grain">{children}</body>
    </html>
  );
}

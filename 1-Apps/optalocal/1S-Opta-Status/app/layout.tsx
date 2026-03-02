import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { OptaRing } from '@/components/OptaRing'

export const metadata: Metadata = {
  title: 'Opta Status — Opta Local ecosystem health',
  description: 'Live status for the Opta Local ecosystem: Opta CLI, Opta Code Desktop, Opta LMX, and Opta management websites.',
  keywords: 'optalocal, status, uptime, LMX, Opta CLI, Opta Code Desktop, local AI',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'Opta Status',
    description: 'Live health and feature registry for the Opta Local ecosystem.',
    url: 'https://status.optalocal.com',
    siteName: 'Opta Status',
    locale: 'en_US',
    type: 'website',
  },
}

function NavBar() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--opta-border)] glass-subtle">
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="h-8 w-8 rounded-md overflow-hidden border border-border/60 bg-surface/70 flex items-center justify-center">
            <Image
              src="/opta-status-mark.svg"
              alt="Opta Status mark"
              width={24}
              height={24}
              className="h-6 w-6"
              priority
            />
          </span>
          <span
            className="text-sm font-semibold tracking-wide font-sora"
            style={{
              background: 'linear-gradient(135deg, var(--opta-primary) 0%, var(--opta-primary-glow) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Opta Status
          </span>
        </Link>

        {/* Nav links + live pulse */}
        <div className="flex items-center gap-5">
          <Link
            href="/features"
            className="text-xs text-text-muted hover:text-text-secondary transition-colors font-medium tracking-wide"
          >
            Features
          </Link>
          {/* Live pulse indicator */}
          <div className="flex items-center gap-1.5" title="Auto-refreshes every 30s">
            <OptaRing size={48} className="scale-[0.5] origin-center -mr-2" />
            <span className="text-xs text-text-muted font-mono hidden sm:block">live</span>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-void text-text-primary selection:bg-primary/30 selection:text-white">
        <NavBar />
        {children}
      </body>
    </html>
  )
}

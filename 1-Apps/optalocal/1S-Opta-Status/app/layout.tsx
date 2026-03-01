import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'
import { OptaRing } from '@/components/OptaRing'

export const metadata: Metadata = {
  title: 'Opta Status — Opta Local ecosystem health',
  description: 'Live status for the Opta Local ecosystem: Opta CLI, Opta Code, Opta LMX, and Opta management websites.',
  keywords: 'optalocal, status, uptime, LMX, Opta CLI, Opta Code, local AI',
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
    <nav className="sticky top-0 z-50 border-b border-[var(--color-border)] glass-subtle">
      <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Wordmark */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <span
            className="text-sm font-bold tracking-widest uppercase font-sora"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-glow) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            OPTA STATUS
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

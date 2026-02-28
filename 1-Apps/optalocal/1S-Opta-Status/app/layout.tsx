import './globals.css'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Opta Status — optalocal.com service health',
  description: 'Live status and feature completeness for the optalocal.com stack: LMX, CLI daemon, Opta Local, and more.',
  keywords: 'optalocal, status, uptime, LMX, Opta CLI, local AI',
  openGraph: {
    title: 'Opta Status',
    description: 'Live health and feature registry for the optalocal stack.',
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
            <div className="relative flex items-center justify-center w-2.5 h-2.5">
              <div className="w-2 h-2 rounded-full bg-neon-green" />
              <div className="absolute w-2 h-2 rounded-full bg-neon-green animate-ping opacity-50" />
            </div>
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

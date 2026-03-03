import './globals.css'
import type { Metadata } from 'next'
import localFont from 'next/font/local'

const jetbrains = localFont({
  src: [
    {
      path: '../public/fonts/JetBrainsMono-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/JetBrainsMono-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../public/fonts/JetBrainsMono-Bold.woff2',
      weight: '700',
      style: 'normal',
    }
  ],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Opta Initializer (Opta Init) \u2014 App manager and launcher for Opta Local',
  description: 'Manage Opta apps, updates, and daemon operations from one control surface. Opta Init (Opta Initializer) handles lifecycle operations while Opta Local platform powers day-to-day workflows.',
  keywords: 'Opta Initializer, Opta Init, app manager, updater, daemon control, local AI, Opta Local, macOS, Apple Silicon',
  openGraph: {
    title: 'Opta Initializer (Opta Init) \u2014 App manager for Opta Local',
    description: 'Use Opta Init (the Opta Initializer) to manage apps, updates, and daemon lifecycle for your Opta Local stack.',
    url: 'https://init.optalocal.com',
    siteName: 'Opta Init (Opta Initializer)',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Opta Initializer (Opta Init) \u2014 App manager for Opta Local',
    description: 'Manage apps, updates, and daemon lifecycle from one place.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={jetbrains.variable}>
      <body className="bg-void text-text-primary selection:bg-primary/30 selection:text-white">
        {children}
      </body>
    </html>
  )
}

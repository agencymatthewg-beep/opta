import './globals.css'
import type { Metadata } from 'next'
import { Sora } from 'next/font/google'
import localFont from 'next/font/local'

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
})

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
  title: {
    default: 'Opta Help — Activation and Operations Docs for Opta AI',
    template: '%s | Opta Help',
  },
  description: 'Technical documentation for Opta, where Opta Local is the first public release. Learn how to activate Opta AI with Opta LMX or cloud models and run through CLI and Code.',
  keywords: 'Opta, Opta AI, Opta Local, documentation, activation, CLI, Code, daemon, LMX, cloud models',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  openGraph: {
    title: 'Opta Help — Activation and Operations Docs for Opta AI',
    description: 'Technical docs for activating and operating Opta AI via local LMX or cloud runtimes across CLI and Code.',
    url: 'https://help.optalocal.com',
    siteName: 'Opta Help',
    locale: 'en_US',
    type: 'website',
  },
  alternates: {
    canonical: 'https://help.optalocal.com',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${sora.variable} ${jetbrains.variable}`}>
      <body className="bg-void text-text-primary selection:bg-primary/30 selection:text-white font-sora">
        {children}
      </body>
    </html>
  )
}

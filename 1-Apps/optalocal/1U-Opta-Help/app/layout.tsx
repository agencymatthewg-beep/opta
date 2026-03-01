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
    default: 'Opta Help — Documentation for the Opta Local stack',
    template: '%s | Opta Help',
  },
  description: 'Comprehensive documentation for the Opta Local private AI stack — CLI, Daemon, LMX, Local Web, Code Desktop, and more.',
  keywords: 'Opta, documentation, help, CLI, daemon, LMX, local AI, Apple Silicon, MLX',
  openGraph: {
    title: 'Opta Help — Documentation for the Opta Local stack',
    description: 'Comprehensive documentation for the Opta Local private AI stack.',
    url: 'https://help.optalocal.com',
    siteName: 'Opta Help',
    locale: 'en_US',
    type: 'website',
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

import './globals.css'
import type { Metadata } from 'next'
import { Sora, JetBrains_Mono } from 'next/font/google'

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
  weight: ['400', '500', '700'],
})

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${jetbrains.variable}`}>
      <body className="bg-void text-text-primary selection:bg-primary/30 selection:text-white">
        {children}
      </body>
    </html>
  )
}

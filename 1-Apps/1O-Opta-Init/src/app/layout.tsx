import type { Metadata } from 'next'
import { Sora, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Opta Init — Your Local AI Stack, Ready in Minutes',
  description:
    'Download and set up Opta CLI and Opta LMX for local AI inference on your Mac. Step-by-step guides, optimal usage tips, and instant access to your dashboard.',
  keywords: ['local AI', 'LLM', 'inference', 'macOS', 'Apple Silicon', 'MLX', 'Opta'],
  openGraph: {
    title: 'Opta Init — Your Local AI Stack, Ready in Minutes',
    description: 'Download and set up your local AI inference stack in minutes.',
    url: 'https://init.optalocal.com',
    siteName: 'Opta Init',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${sora.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}

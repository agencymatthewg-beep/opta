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
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  title: 'Opta Local — The complete local AI stack for developers',
  description: 'A unified ecosystem to serve, manage, and code with open-weight models. Drop-in OpenAI API compatibility, entirely on your own hardware.',
  keywords: 'local AI, LLM, inference, open-weight models, Opta LMX, Opta CLI, Opta Code, private AI, no cloud',
  openGraph: {
    title: 'Opta Local — The complete local AI stack for developers',
    description: 'A unified ecosystem to serve, manage, and code with open-weight models. Drop-in OpenAI API compatibility, entirely on your own hardware.',
    url: 'https://optalocal.com',
    siteName: 'Opta Local',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Opta Local — The complete local AI stack for developers',
    description: 'A unified ecosystem to serve, manage, and code with open-weight models.',
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

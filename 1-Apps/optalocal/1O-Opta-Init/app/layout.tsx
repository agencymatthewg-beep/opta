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
  title: 'Opta Init \u2014 Your local AI stack, ready in minutes',
  description: 'Download and set up Opta CLI and Opta LMX for local AI inference on your Mac. Step-by-step guides, optimal usage tips, and instant access to your dashboard.',
  keywords: 'local AI, LLM, inference, macOS, Apple Silicon, MLX, Opta',
  openGraph: {
    title: 'Opta Init \u2014 Your local AI stack, ready in minutes',
    description: 'Download and set up your local AI inference stack in minutes.',
    url: 'https://init.optalocal.com',
    siteName: 'Opta Init',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Opta Init \u2014 Your local AI stack, ready in minutes',
    description: 'Download and set up your local AI inference stack in minutes.',
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

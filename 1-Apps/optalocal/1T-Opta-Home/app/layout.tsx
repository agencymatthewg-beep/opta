import './globals.css'
import type { Metadata, Viewport } from 'next'
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
  metadataBase: new URL('https://optalocal.com'),
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  title: 'Opta Local | Production Control Plane for Opta AI',
  description: 'Opta Local operationalizes Opta AI with governed runtime selection, unified activation, and execution across Opta CLI and Opta Code.',
  keywords: 'Opta Local, Opta AI, Opta, Opta LMX, Opta CLI, Opta Code, local AI runtime, cloud AI runtime',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Opta Local | Production Control Plane for Opta AI',
    description: 'Unify runtime strategy, optimizer activation, and execution through Opta CLI and Opta Code with a production-grade operating model.',
    url: 'https://optalocal.com',
    siteName: 'Opta Local',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Opta Local | Production Control Plane for Opta AI',
    description: 'Run Opta AI through a governed workflow model across local or cloud runtimes, CLI, and Code.',
  },
  alternates: {
    canonical: 'https://optalocal.com',
  },
}

export const viewport: Viewport = {
  themeColor: '#09090b',
  colorScheme: 'dark',
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

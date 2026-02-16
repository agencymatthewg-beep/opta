import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Opta AI - LM Gateway',
  description: 'AI provider routing with user-managed API keys',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

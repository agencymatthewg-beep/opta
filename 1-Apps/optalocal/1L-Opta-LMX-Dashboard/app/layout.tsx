import './globals.css'
import type { Metadata } from 'next'

import { Providers } from '@/lib/providers'

export const metadata: Metadata = {
    title: 'Opta LMX Dashboard — Model Management & Inference',
    description:
        'The primary management surface for Opta LMX. Monitor models, memory, inference throughput, and manage your local AI inference stack.',
    keywords:
        'optalocal, LMX, dashboard, model management, inference, Apple Silicon, MLX, local AI',
    icons: {
        icon: '/favicon.svg',
        shortcut: '/favicon.svg',
        apple: '/favicon.svg',
    },
    openGraph: {
        title: 'Opta LMX Dashboard',
        description:
            'Monitor and manage your Opta LMX inference engine — models, memory, throughput, and more.',
        url: 'https://lmx.optalocal.com',
        siteName: 'Opta LMX Dashboard',
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
        <html lang="en">
            <body className="bg-void text-text-primary selection:bg-primary/30 selection:text-white">
                <Providers>{children}</Providers>
            </body>
        </html>
    )
}

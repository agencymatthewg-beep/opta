/**
 * /connect layout — minimal splash layout for the magic-link handoff page.
 * No header, no nav, no sidebars — just a clean connecting experience.
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Connecting — Opta LMX',
    description: 'Connecting to your Opta LMX inference engine.',
    robots: { index: false, follow: false },
}

export default function ConnectLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Deliberately minimal — no nav, no chrome
    return <>{children}</>
}

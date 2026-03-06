import { Suspense } from 'react'
import PairPageClient from './PairPageClient'

function PairPageFallback() {
  return (
    <main className="min-h-screen px-6 py-10 md:px-10 md:py-14">
      <div className="max-w-3xl mx-auto">
        <div className="config-panel text-sm font-mono text-text-secondary">Loading pairing session…</div>
      </div>
    </main>
  )
}

export default function PairPage() {
  return (
    <Suspense fallback={<PairPageFallback />}>
      <PairPageClient />
    </Suspense>
  )
}

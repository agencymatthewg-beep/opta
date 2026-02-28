import Link from 'next/link';

import { CodexDenseSurface } from '@/components/shared/CodexDenseSurface';

export default function RagPage() {
  return (
    <main className="codex-shell">
      <CodexDenseSurface
        title="RAG"
        subtitle="Collection ingest/query capabilities are available through Operations."
      >
        <p style={{ marginTop: 0 }}>Use endpoint runners to ingest, query, and inspect RAG collections.</p>
        <Link className="codex-secondary-btn" href="/operations">
          Open Operations
        </Link>
      </CodexDenseSurface>
    </main>
  );
}

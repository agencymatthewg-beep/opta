import Link from 'next/link';

import { CodexDenseSurface } from '@/components/shared/CodexDenseSurface';

export default function ModelsPage() {
  return (
    <main className="codex-shell">
      <CodexDenseSurface
        title="Models"
        subtitle="Model status and advanced admin operations."
      >
        <div className="flex flex-wrap gap-2">
          <Link className="codex-secondary-btn" href="/models/advanced">
            Advanced Model Ops
          </Link>
          <Link className="codex-secondary-btn" href="/operations">
            Open Operations
          </Link>
        </div>
      </CodexDenseSurface>
    </main>
  );
}

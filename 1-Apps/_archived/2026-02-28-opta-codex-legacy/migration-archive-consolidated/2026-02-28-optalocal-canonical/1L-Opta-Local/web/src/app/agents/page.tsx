import Link from 'next/link';

import { CodexDenseSurface } from '@/components/shared/CodexDenseSurface';

export default function AgentsPage() {
  return (
    <main className="codex-shell">
      <CodexDenseSurface
        title="Agents"
        subtitle="Minimal launch surface for agent workflows."
      >
        <div className="flex flex-wrap gap-2">
          <Link className="codex-secondary-btn" href="/agents/runs">
            Open Runs
          </Link>
          <Link className="codex-secondary-btn" href="/skills">
            Open Skills
          </Link>
          <Link className="codex-secondary-btn" href="/operations">
            Open Operations
          </Link>
        </div>
      </CodexDenseSurface>
    </main>
  );
}

import Link from 'next/link';

import { CodexDenseSurface } from '@/components/shared/CodexDenseSurface';

interface ChatSessionPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatSessionPage({ params }: ChatSessionPageProps) {
  const { id } = await params;

  return (
    <main className="codex-shell">
      <CodexDenseSurface
        title="Chat Session"
        subtitle="Focused view for a single conversation identifier."
      >
        <p className="codex-kv-mono" style={{ marginTop: 0 }}>
          Session ID: {id}
        </p>
        <Link className="codex-secondary-btn" href="/chat">
          Back to Chat
        </Link>
      </CodexDenseSurface>
    </main>
  );
}

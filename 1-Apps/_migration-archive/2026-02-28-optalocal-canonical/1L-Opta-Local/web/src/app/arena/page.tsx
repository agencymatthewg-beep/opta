import { CodexDenseSurface } from '@/components/shared/CodexDenseSurface';

export default function ArenaPage() {
  return (
    <main className="codex-shell">
      <CodexDenseSurface
        title="Arena"
        subtitle="Side-by-side model comparisons run from Operations."
      >
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Use the Operations console to run repeatable parity checks across model endpoints.
        </p>
      </CodexDenseSurface>
    </main>
  );
}

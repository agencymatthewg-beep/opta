export default function ApiReferencePage() {
  return (
    <main className="min-h-screen bg-void text-text-primary px-6 py-12 sm:px-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs uppercase tracking-[0.18em] text-primary">Opta Init</p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">API Reference</h1>
        <p className="mt-3 text-text-secondary">
          Canonical API surfaces used by Opta Init to coordinate the local stack.
        </p>

        <section className="mt-8 obsidian rounded-xl border border-white/10 p-6">
          <h2 className="text-xl font-semibold">Release Manifests</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Channel manifests consumed by Opta Init manager for promotion and rollout decisions.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a className="text-primary hover:text-primary-glow" href="/channels/stable.json">
                /channels/stable.json
              </a>
            </li>
            <li>
              <a className="text-primary hover:text-primary-glow" href="/channels/beta.json">
                /channels/beta.json
              </a>
            </li>
          </ul>
        </section>

        <section className="mt-6 obsidian rounded-xl border border-white/10 p-6">
          <h2 className="text-xl font-semibold">Opta CLI Daemon HTTP</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Local daemon orchestration endpoints used by Opta Code and manager workflows.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-text-secondary">
            <li>
              <code className="text-primary">GET /healthz</code> — daemon health probe
            </li>
            <li>
              <code className="text-primary">GET /v3/metrics</code> — runtime metrics
            </li>
            <li>
              <code className="text-primary">GET /v3/sessions</code> — session listing
            </li>
            <li>
              <code className="text-primary">GET /v3/sessions/:id/replay</code> — session replay
            </li>
          </ul>
        </section>

        <section className="mt-6 obsidian rounded-xl border border-white/10 p-6">
          <h2 className="text-xl font-semibold">Opta LMX API</h2>
          <p className="mt-2 text-sm text-text-secondary">
            OpenAI-compatible local inference endpoints managed by Opta LMX.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-text-secondary">
            <li>
              <code className="text-primary">POST /v1/chat/completions</code> — text generation
            </li>
            <li>
              <code className="text-primary">POST /v1/embeddings</code> — embedding vectors
            </li>
            <li>
              <code className="text-primary">GET /v1/models</code> — loaded model catalog
            </li>
          </ul>
          <p className="mt-4 text-sm">
            Full reference:{" "}
            <a className="text-primary hover:text-primary-glow" href="https://help.optalocal.com/docs/lmx/api/">
              help.optalocal.com/docs/lmx/api/
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}

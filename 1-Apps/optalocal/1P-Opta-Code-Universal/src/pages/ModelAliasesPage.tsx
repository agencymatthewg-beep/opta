import { useState } from "react";
import { useModelAliases } from "../hooks/useModelAliases";
import type { DaemonConnectionOptions, ModelAlias } from "../types";

interface ModelAliasesPageProps {
  connection: DaemonConnectionOptions;
}

export function ModelAliasesPage({ connection }: ModelAliasesPageProps) {
  const {
    aliases,
    health,
    library,
    loading,
    libraryLoading,
    healthLoading,
    saving,
    error,
    refreshAliases,
    refreshHealth,
    searchLibrary,
    setAlias,
    deleteAlias,
  } = useModelAliases(connection);

  const [newAlias, setNewAlias] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newProvider, setNewProvider] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [confirmDeleteAlias, setConfirmDeleteAlias] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"aliases" | "library" | "health">("aliases");

  const handleSave = async () => {
    if (!newAlias.trim() || !newTarget.trim()) {
      setSaveError("Alias and target are required.");
      return;
    }
    setSaveError(null);
    await setAlias(newAlias.trim(), newTarget.trim(), newProvider.trim() || undefined);
    setNewAlias("");
    setNewTarget("");
    setNewProvider("");
  };

  const handleDelete = async (alias: string) => {
    await deleteAlias(alias);
    setConfirmDeleteAlias(null);
  };

  const getHealthStatus = (modelId: string) => {
    return health.find((h) => h.modelId === modelId);
  };

  return (
    <div className="flex flex-col gap-4">
      {error && <div className="st-status-banner st-status-banner-error">{error}</div>}

      {/* Tab bar — design placeholder */}
      <div className="flex gap-1 border-b border-[var(--opta-border)] pb-2">
        {(["aliases", "library", "health"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1 text-xs rounded-md capitalize transition-colors ${
              activeTab === tab
                ? "bg-[var(--opta-primary)] text-white"
                : "text-zinc-400 hover:text-gray-50"
            }`}
          >
            {tab === "aliases" ? `Aliases (${aliases.length})` : tab === "library" ? "Browse Library" : "Health"}
          </button>
        ))}
      </div>

      {/* Aliases tab */}
      {activeTab === "aliases" && (
        <div className="flex flex-col gap-4">
          {/* Add alias form */}
          <div className="st-fieldset flex flex-col gap-2">
            <p className="st-label">Add alias</p>
            {saveError && <p className="text-xs text-red-400">{saveError}</p>}
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                placeholder="Alias name (e.g. best)"
                className="opta-studio-input flex-1 min-w-[120px]"
              />
              <input
                type="text"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder="Target model ID"
                className="opta-studio-input flex-[2] min-w-[200px]"
              />
              <input
                type="text"
                value={newProvider}
                onChange={(e) => setNewProvider(e.target.value)}
                placeholder="Provider (optional)"
                className="opta-studio-input w-32"
              />
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !newAlias.trim() || !newTarget.trim()}
                className="opta-studio-btn"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {/* Alias list */}
          <div className="flex flex-col gap-1">
            {loading && <p className="text-xs text-zinc-500">Loading aliases…</p>}
            {!loading && aliases.length === 0 && (
              <p className="text-xs text-zinc-500 py-4 text-center">No aliases configured.</p>
            )}
            {aliases.map((alias) => (
              <div
                key={alias.alias}
                className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-[var(--opta-border)]"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--opta-primary)]">{alias.alias}</span>
                    <span className="text-zinc-500">→</span>
                    <span className="text-sm text-gray-50 font-mono truncate">{alias.target}</span>
                  </div>
                  <div className="flex gap-3 text-xs text-zinc-500">
                    {alias.provider && <span>via {alias.provider}</span>}
                    {alias.description && <span>{alias.description}</span>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 ml-2">
                  {confirmDeleteAlias === alias.alias ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleDelete(alias.alias)}
                        disabled={saving}
                        className="opta-studio-btn text-xs text-red-400 border-red-500/30"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteAlias(null)}
                        className="opta-studio-btn-secondary text-xs"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAlias(alias.alias)}
                      disabled={saving}
                      className="opta-studio-btn-secondary text-xs text-red-400 border-red-500/30"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Library browser tab */}
      {activeTab === "library" && (
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={libraryQuery}
              onChange={(e) => setLibraryQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void searchLibrary(libraryQuery)}
              placeholder="Search HuggingFace library…"
              className="opta-studio-input flex-1"
            />
            <button
              type="button"
              onClick={() => void searchLibrary(libraryQuery)}
              disabled={libraryLoading}
              className="opta-studio-btn"
            >
              {libraryLoading ? "Searching…" : "Search"}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {library.length === 0 && !libraryLoading && (
              <p className="text-xs text-zinc-500 text-center py-6">Search for models to browse.</p>
            )}
            {library.map((model) => (
              <div
                key={model.repoId}
                className="p-3 rounded-lg bg-white/5 border border-[var(--opta-border)] flex justify-between items-start gap-3"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-sm font-semibold text-gray-50 font-mono truncate">{model.repoId}</span>
                  {model.description && (
                    <span className="text-xs text-zinc-400 line-clamp-2">{model.description}</span>
                  )}
                  <div className="flex gap-3 text-xs text-zinc-500">
                    {model.sizeHuman && <span>{model.sizeHuman}</span>}
                    {model.quantization && <span>{model.quantization}</span>}
                    {model.downloads && <span>{model.downloads.toLocaleString()} dl</span>}
                    {model.isLocal && <span className="text-emerald-400">Local</span>}
                    {model.isLoaded && <span className="text-[var(--opta-primary)]">Loaded</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setNewTarget(model.repoId);
                    setActiveTab("aliases");
                  }}
                  className="opta-studio-btn-secondary text-xs shrink-0"
                >
                  Use as target
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Health tab */}
      {activeTab === "health" && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <p className="text-xs text-zinc-500">Check latency and availability of configured models.</p>
            <button
              type="button"
              onClick={() => void refreshHealth()}
              disabled={healthLoading}
              className="opta-studio-btn-secondary text-xs"
            >
              {healthLoading ? "Checking…" : "Run health check"}
            </button>
          </div>

          {health.length === 0 && !healthLoading && (
            <p className="text-xs text-zinc-500 text-center py-6">Click "Run health check" to test models.</p>
          )}
          {health.map((check) => (
            <div
              key={check.modelId}
              className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-[var(--opta-border)]"
            >
              <span className="text-sm text-gray-50 font-mono">{check.modelId}</span>
              <div className="flex items-center gap-3 text-xs">
                {check.latencyMs !== undefined && (
                  <span className="text-zinc-400">{check.latencyMs}ms</span>
                )}
                <span
                  className={
                    check.status === "healthy"
                      ? "text-emerald-400"
                      : check.status === "degraded"
                        ? "text-amber-400"
                        : "text-red-400"
                  }
                >
                  {check.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

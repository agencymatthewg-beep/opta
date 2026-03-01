"use client";

/**
 * Models Page — focused model lifecycle hub.
 *
 * Keeps model-first actions in one place:
 * - Loaded models (load/unload)
 * - Available catalog (discover + load)
 * - Diagnostics (model runtime checks)
 *
 * Cross-domain features are routed to dedicated workflow pages.
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  AlertCircle,
  Layers,
  HardDrive,
  Activity,
  Settings2,
  Wrench,
  TerminalSquare,
  BarChart3,
  Network,
  FlaskConical,
  Package,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@opta/ui";

import { useConnectionContextSafe } from "@/components/shared/ConnectionProvider";
import { useModels } from "@/hooks/useModels";
import { ModelList } from "@/components/dashboard/ModelList";
import { ModelLoadDialog } from "@/components/dashboard/ModelLoadDialog";
import { AvailableModelsPanel } from "@/components/dashboard/AvailableModelsPanel";
import { DiagnosticsPanel } from "@/components/dashboard/DiagnosticsPanel";
import type { ModelLoadRequest } from "@/types/lmx";

type TabId = "loaded" | "catalog" | "diagnostics";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: "loaded", label: "Loaded", icon: <Layers className="h-3.5 w-3.5" /> },
  {
    id: "catalog",
    label: "Catalog",
    icon: <HardDrive className="h-3.5 w-3.5" />,
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    icon: <Activity className="h-3.5 w-3.5" />,
  },
];

interface WorkflowLink {
  label: string;
  href: string;
  description: string;
  icon: LucideIcon;
  accentClass: string;
}

const WORKFLOW_LINKS: WorkflowLink[] = [
  {
    label: "Presets",
    href: "/presets",
    description: "Tune model behavior profiles",
    icon: Settings2,
    accentClass: "text-neon-indigo",
  },
  {
    label: "Skills",
    href: "/skills",
    description: "Bind tools and execution skills",
    icon: Wrench,
    accentClass: "text-neon-cyan",
  },
  {
    label: "Operations",
    href: "/operations",
    description: "Run controlled daemon actions",
    icon: TerminalSquare,
    accentClass: "text-neon-amber",
  },
  {
    label: "Metrics",
    href: "/metrics",
    description: "Observe throughput and latency",
    icon: BarChart3,
    accentClass: "text-neon-green",
  },
  {
    label: "Stack",
    href: "/stack",
    description: "Review runtime topology",
    icon: Network,
    accentClass: "text-neon-cyan",
  },
  {
    label: "Benchmark",
    href: "/benchmark",
    description: "Measure model performance",
    icon: FlaskConical,
    accentClass: "text-neon-amber",
  },
  {
    label: "Quantize",
    href: "/quantize",
    description: "Compress and package artifacts",
    icon: Package,
    accentClass: "text-neon-pink",
  },
];

export default function ModelsPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;
  const { models, isLoading, refresh } = useModels(client);

  const [activeTab, setActiveTab] = useState<TabId>("loaded");
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [unloadingId, setUnloadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [prefillPath, setPrefillPath] = useState("");

  const handleLoad = useCallback(
    async (modelPath: string, quantization?: string) => {
      if (!client) return;
      setActionError(null);
      setIsLoadingModel(true);
      try {
        const req: ModelLoadRequest = { model_path: modelPath };
        if (quantization) req.quantization = quantization;
        await client.loadModel(req);
        refresh();
        setIsLoadDialogOpen(false);
      } finally {
        setIsLoadingModel(false);
      }
    },
    [client, refresh],
  );

  const handleUnload = useCallback(
    async (modelId: string) => {
      if (!client) return;
      setActionError(null);
      setUnloadingId(modelId);
      try {
        await client.unloadModel(modelId);
        refresh();
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Failed to unload model",
        );
      } finally {
        setUnloadingId(null);
      }
    },
    [client, refresh],
  );

  const handleLoadModelFromAvailable = useCallback((modelPath: string) => {
    setPrefillPath(modelPath);
    setActiveTab("loaded");
    setIsLoadDialogOpen(true);
  }, []);

  return (
    <main className="flex h-screen flex-col">
      <header className="glass flex shrink-0 items-center gap-4 border-b border-opta-border px-6 py-3">
        <Link
          href="/"
          className={cn(
            "rounded-lg p-1.5 text-text-secondary transition-colors",
            "hover:bg-primary/10 hover:text-text-primary",
          )}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Models</h1>
          <p className="text-xs text-text-muted">
            Load, inspect, and prepare models for the rest of your workflow.
          </p>
        </div>
      </header>

      <div className="glass-subtle shrink-0 overflow-x-auto border-b border-opta-border">
        <div className="flex min-w-max items-end px-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3.5 py-3 text-xs font-medium transition-colors",
                activeTab === tab.id
                  ? "text-text-primary"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {tab.icon}
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="active-model-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: "var(--opta-primary)" }}
                  transition={{ type: "spring", stiffness: 420, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {!client ? (
          <p className="pt-12 text-center text-sm text-text-muted">
            Not connected — check Settings to configure your server.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
            <section className="space-y-4">
              <AnimatePresence>
                {actionError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 rounded-lg border border-neon-red/20 bg-neon-red/10 px-3 py-2"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-neon-red" />
                    <p className="text-xs text-neon-red">{actionError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ type: "spring", stiffness: 320, damping: 30 }}
                  className="space-y-4"
                >
                  {activeTab === "loaded" && (
                    <>
                      <ModelLoadDialog
                        isOpen={isLoadDialogOpen}
                        isLoading={isLoadingModel}
                        onLoad={handleLoad}
                        onClose={() => {
                          setIsLoadDialogOpen(false);
                          setPrefillPath("");
                        }}
                        client={client}
                        prefillPath={prefillPath}
                      />
                      <ModelList
                        models={models}
                        onUnload={handleUnload}
                        isUnloading={unloadingId}
                        onLoad={() => setIsLoadDialogOpen(true)}
                      />
                      {isLoading && models.length === 0 && (
                        <p className="pt-2 text-center text-sm text-text-muted">
                          Loading models…
                        </p>
                      )}
                    </>
                  )}

                  {activeTab === "catalog" && (
                    <AvailableModelsPanel
                      client={client}
                      onLoadModel={handleLoadModelFromAvailable}
                    />
                  )}

                  {activeTab === "diagnostics" && (
                    <DiagnosticsPanel client={client} />
                  )}
                </motion.div>
              </AnimatePresence>
            </section>

            <aside className="glass-subtle h-fit rounded-2xl border border-opta-border/70 p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                  Next Steps
                </h2>
                <span className="text-[10px] text-text-muted">
                  {models.length} loaded
                </span>
              </div>
              <div className="space-y-1.5">
                {WORKFLOW_LINKS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-start gap-2 rounded-xl border border-opta-border/50 px-2.5 py-2 transition-colors",
                        "hover:bg-primary/10 hover:border-primary/30",
                      )}
                    >
                      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", item.accentClass)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-text-primary">
                          {item.label}
                        </p>
                        <p className="line-clamp-2 text-[11px] text-text-muted">
                          {item.description}
                        </p>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-80" />
                    </Link>
                  );
                })}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

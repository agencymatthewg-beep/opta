"use client";

/**
 * Models Page — LMX management hub.
 *
 * Tabbed interface for all LMX management panels:
 * Models | Available | Diagnostics | Metrics | Presets | Stack |
 * Benchmark | Quantize | Helpers | Logs
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  AlertCircle,
  Layers,
  HardDrive,
  Activity,
  BarChart3,
  Settings2,
  Network,
  FlaskConical,
  Package,
  Server,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@opta/ui";

import { useConnectionContextSafe } from "@/components/shared/ConnectionProvider";
import { useModels } from "@/hooks/useModels";
import { ModelList } from "@/components/dashboard/ModelList";
import { ModelLoadDialog } from "@/components/dashboard/ModelLoadDialog";
import { AvailableModelsPanel } from "@/components/dashboard/AvailableModelsPanel";
import { DiagnosticsPanel } from "@/components/dashboard/DiagnosticsPanel";
import { MetricsPanel } from "@/components/dashboard/MetricsPanel";
import { PresetsPanel } from "@/components/dashboard/PresetsPanel";
import { StackView } from "@/components/dashboard/StackView";
import { BenchmarkPanel } from "@/components/dashboard/BenchmarkPanel";
import { QuantizePanel } from "@/components/dashboard/QuantizePanel";
import { HelpersPanel } from "@/components/dashboard/HelpersPanel";
import { LogsBrowser } from "@/components/dashboard/LogsBrowser";
import type { ModelLoadRequest } from "@/types/lmx";

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId =
  | "models"
  | "available"
  | "diagnostics"
  | "metrics"
  | "presets"
  | "stack"
  | "benchmark"
  | "quantize"
  | "helpers"
  | "logs";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: Tab[] = [
  { id: "models", label: "Models", icon: <Layers className="w-3.5 h-3.5" /> },
  {
    id: "available",
    label: "Available",
    icon: <HardDrive className="w-3.5 h-3.5" />,
  },
  {
    id: "diagnostics",
    label: "Diagnostics",
    icon: <Activity className="w-3.5 h-3.5" />,
  },
  {
    id: "metrics",
    label: "Metrics",
    icon: <BarChart3 className="w-3.5 h-3.5" />,
  },
  {
    id: "presets",
    label: "Presets",
    icon: <Settings2 className="w-3.5 h-3.5" />,
  },
  { id: "stack", label: "Stack", icon: <Network className="w-3.5 h-3.5" /> },
  {
    id: "benchmark",
    label: "Benchmark",
    icon: <FlaskConical className="w-3.5 h-3.5" />,
  },
  {
    id: "quantize",
    label: "Quantize",
    icon: <Package className="w-3.5 h-3.5" />,
  },
  { id: "helpers", label: "Helpers", icon: <Server className="w-3.5 h-3.5" /> },
  { id: "logs", label: "Logs", icon: <FileText className="w-3.5 h-3.5" /> },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ModelsPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  const { models, isLoading, refresh } = useModels(client);

  const [activeTab, setActiveTab] = useState<TabId>("models");
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

  /** Called by AvailableModelsPanel — switch to Models tab + pre-fill path */
  const handleLoadModelFromAvailable = useCallback((modelPath: string) => {
    setPrefillPath(modelPath);
    setActiveTab("models");
    setIsLoadDialogOpen(true);
  }, []);

  const loadedModelIds = models.map((m) => m.id);

  return (
    <main className="flex flex-col h-screen">
      {/* ── Header ── */}
      <header className="glass border-b border-opta-border px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link
          href="/"
          className={cn(
            "p-1.5 rounded-lg transition-colors",
            "text-text-secondary hover:text-text-primary hover:bg-primary/10",
          )}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-semibold text-text-primary">Models</h1>
      </header>

      {/* ── Tab bar ── */}
      <div className="glass-subtle border-b border-opta-border flex-shrink-0 overflow-x-auto">
        <div className="flex items-end px-4 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3.5 py-3 text-xs font-medium whitespace-nowrap transition-colors",
                activeTab === tab.id
                  ? "text-text-primary"
                  : "text-text-muted hover:text-text-secondary",
              )}
            >
              {tab.icon}
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: "var(--opta-primary)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Error banner */}
        <AnimatePresence>
          {actionError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 rounded-lg bg-neon-red/10 border border-neon-red/20 px-3 py-2"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-neon-red" />
              <p className="text-xs text-neon-red">{actionError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Offline state */}
        {!client ? (
          <p className="text-sm text-text-muted text-center pt-12">
            Not connected — check Settings to configure your server.
          </p>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
            >
              {/* Models tab */}
              {activeTab === "models" && (
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
                    <p className="text-sm text-text-muted text-center pt-4">
                      Loading models…
                    </p>
                  )}
                </>
              )}

              {/* Available tab */}
              {activeTab === "available" && (
                <AvailableModelsPanel
                  client={client}
                  onLoadModel={handleLoadModelFromAvailable}
                />
              )}

              {/* Diagnostics tab */}
              {activeTab === "diagnostics" && (
                <DiagnosticsPanel client={client} />
              )}

              {/* Metrics tab */}
              {activeTab === "metrics" && <MetricsPanel client={client} />}

              {/* Presets tab */}
              {activeTab === "presets" && <PresetsPanel client={client} />}

              {/* Stack tab */}
              {activeTab === "stack" && <StackView client={client} />}

              {/* Benchmark tab */}
              {activeTab === "benchmark" && (
                <BenchmarkPanel
                  client={client}
                  loadedModelIds={loadedModelIds}
                />
              )}

              {/* Quantize tab */}
              {activeTab === "quantize" && <QuantizePanel client={client} />}

              {/* Helpers tab */}
              {activeTab === "helpers" && <HelpersPanel client={client} />}

              {/* Logs tab */}
              {activeTab === "logs" && <LogsBrowser client={client} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </main>
  );
}

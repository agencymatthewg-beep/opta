'use client';

/**
 * Models Page — Full-screen model management.
 *
 * Shows currently loaded models with unload controls (ModelList),
 * and a form to load a new model by HuggingFace path (ModelLoadDialog).
 * Reuses dashboard components. No new API calls needed.
 */

import { useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@opta/ui';

import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { useModels } from '@/hooks/useModels';
import { ModelList } from '@/components/dashboard/ModelList';
import { ModelLoadDialog } from '@/components/dashboard/ModelLoadDialog';
import type { ModelLoadRequest } from '@/types/lmx';

export default function ModelsPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;

  const { models, isLoading, refresh } = useModels(client);
  const [isLoadDialogOpen, setIsLoadDialogOpen] = useState(false);
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [unloadingId, setUnloadingId] = useState<string | null>(null);

  const handleLoad = useCallback(
    async (modelPath: string, quantization?: string) => {
      if (!client) return;
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
      setUnloadingId(modelId);
      try {
        await client.unloadModel(modelId);
        refresh();
      } finally {
        setUnloadingId(null);
      }
    },
    [client, refresh],
  );

  return (
    <main className="flex flex-col h-screen">
      {/* Header */}
      <header className="glass border-b border-opta-border px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <Link
          href="/"
          className={cn(
            'p-1.5 rounded-lg transition-colors',
            'text-text-secondary hover:text-text-primary hover:bg-primary/10',
          )}
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-semibold text-text-primary">Models</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {!client ? (
          <p className="text-sm text-text-muted text-center pt-12">
            Not connected — check Settings to configure your server.
          </p>
        ) : (
          <>
            <ModelLoadDialog
              isOpen={isLoadDialogOpen}
              isLoading={isLoadingModel}
              onLoad={handleLoad}
              onClose={() => setIsLoadDialogOpen(false)}
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
      </div>
    </main>
  );
}

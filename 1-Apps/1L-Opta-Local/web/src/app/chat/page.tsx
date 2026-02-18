'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@opta/ui';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { ModelPicker } from '@/components/chat/ModelPicker';
import { useModels } from '@/hooks/useModels';
import { createClient, getConnectionSettings } from '@/lib/connection';
import type { LMXClient } from '@/lib/lmx-client';

export default function ChatPage() {
  const [client, setClient] = useState<LMXClient | null>(null);
  const [selectedModel, setSelectedModel] = useState('');

  const { models, isLoading: modelsLoading } = useModels(client);

  // Initialize client for the model picker
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const settings = await getConnectionSettings();
        if (!cancelled) {
          setClient(createClient(settings));
        }
      } catch {
        // Client init errors are handled by ChatContainer
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-select first loaded model if none selected
  useEffect(() => {
    if (!selectedModel && models.length > 0) {
      setSelectedModel(models[0]!.id);
    }
  }, [models, selectedModel]);

  return (
    <main className="flex flex-col h-screen">
      {/* Header with nav and model picker */}
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

        <h1 className="text-lg font-semibold text-text-primary">
          Chat
        </h1>

        <div className="ml-auto">
          <ModelPicker
            models={models}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            isLoading={modelsLoading}
            disabled={false}
          />
        </div>
      </header>

      {/* Chat area fills remaining space */}
      <div className="flex-1 relative overflow-hidden">
        <ChatContainer model={selectedModel} />
      </div>
    </main>
  );
}

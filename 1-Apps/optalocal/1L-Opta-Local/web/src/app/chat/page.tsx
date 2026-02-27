'use client';

import { useEffect, useState } from 'react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { ModelPicker } from '@/components/chat/ModelPicker';
import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { OptaSurface } from '@/components/shared/OptaPrimitives';
import { useModels } from '@/hooks/useModels';

export default function ChatPage() {
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;
  const [selectedModel, setSelectedModel] = useState('');

  const { models, isLoading: modelsLoading } = useModels(client);

  // Auto-select first loaded model if none selected
  useEffect(() => {
    if (!selectedModel && models.length > 0) {
      setSelectedModel(models[0]!.id);
    }
  }, [models, selectedModel]);

  return (
    <main className="flex flex-col h-screen">
      {/* Header with nav and model picker */}
      <header className="border-b border-opta-border flex-shrink-0">
        <OptaSurface
          hierarchy="overlay"
          padding="none"
          className="rounded-none border-0 px-6 py-3 flex items-center justify-end"
        >

          <div className="ml-auto">
            <ModelPicker
              models={models}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              isLoading={modelsLoading}
              disabled={false}
            />
          </div>
        </OptaSurface>
      </header>

      {/* Chat area fills remaining space */}
      <div className="flex-1 relative overflow-hidden">
        <ChatContainer model={selectedModel} />
      </div>
    </main>
  );
}

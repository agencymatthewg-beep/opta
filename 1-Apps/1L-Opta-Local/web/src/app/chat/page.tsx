'use client';

import { ChatContainer } from '@/components/chat/ChatContainer';

// Default model — will be replaced by model picker in 02-02
const DEFAULT_MODEL = 'default';

export default function ChatPage() {
  return (
    <main className="flex flex-col h-screen">
      {/* Header */}
      <header className="glass border-b border-opta-border px-6 py-3 flex items-center gap-4 flex-shrink-0">
        <h1 className="text-lg font-semibold text-text-primary">
          Chat
        </h1>
        <span className="text-xs text-text-muted">
          Opta Local
        </span>
      </header>

      {/* Chat area fills remaining space */}
      <div className="flex-1 relative overflow-hidden">
        <ChatContainer model={DEFAULT_MODEL} />
      </div>
    </main>
  );
}

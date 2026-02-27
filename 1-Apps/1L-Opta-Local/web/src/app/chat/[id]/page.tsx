'use client';

/**
 * Session Resume Page — /chat/[id]
 *
 * Loads a CLI session by ID, displays its full message history, and
 * enables continued chatting. Reuses ChatContainer with pre-populated
 * messages from the CLI session.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Clock,
  Cpu,
  Hash,
  Info,
  Loader2,
  MessageSquare,
  TriangleAlert,
  Wrench,
} from 'lucide-react';
import { Badge, cn } from '@opta/ui';

import { ChatContainer } from '@/components/chat/ChatContainer';
import { ModelPicker } from '@/components/chat/ModelPicker';
import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { OptaStatusPill, OptaSurface } from '@/components/shared/OptaPrimitives';
import { useModels } from '@/hooks/useModels';
import { useSessionResume } from '@/hooks/useSessionResume';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format ISO date string to human-readable form. */
function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Count displayable messages (excludes system). */
function countDisplayable(messageCount: number): string {
  return `${messageCount} message${messageCount === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <main className="flex flex-col h-screen">
      <header className="border-b border-opta-border flex-shrink-0">
        <OptaSurface
          hierarchy="overlay"
          padding="none"
          className="rounded-none border-0 px-6 py-3 flex items-center gap-4"
        >
          <div className="w-8 h-8 rounded-lg glass-subtle animate-pulse" />
          <div className="h-5 w-32 rounded glass-subtle animate-pulse" />
          <div className="ml-auto h-8 w-40 rounded-lg glass-subtle animate-pulse" />
        </OptaSurface>
      </header>
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-text-secondary text-sm">Loading session...</p>
        </motion.div>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Error states
// ---------------------------------------------------------------------------

function NotFoundState() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm"
      >
        <OptaSurface hierarchy="raised" framed padding="lg" className="text-center">
          <div className="w-12 h-12 rounded-xl glass flex items-center justify-center mx-auto mb-4">
            <TriangleAlert className="w-6 h-6 text-neon-amber" />
          </div>
          <p className="mb-2 text-lg font-semibold text-text-primary">
            Session Not Found
          </p>
          <p className="mb-6 text-sm text-text-secondary">
            This session may have been deleted or the ID is incorrect.
          </p>
          <Link
            href="/sessions"
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
              'glass text-sm font-medium text-text-primary',
              'hover:bg-primary/10 transition-colors',
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sessions
          </Link>
        </OptaSurface>
      </motion.div>
    </main>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-sm"
      >
        <OptaSurface hierarchy="raised" framed padding="lg" className="text-center">
          <div className="w-12 h-12 rounded-xl glass flex items-center justify-center mx-auto mb-4">
            <TriangleAlert className="w-6 h-6 text-neon-red" />
          </div>
          <p className="mb-2 text-lg font-semibold text-text-primary">
            Error Loading Session
          </p>
          <p className="mb-6 text-sm text-text-secondary">{message}</p>
          <Link
            href="/sessions"
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
              'glass text-sm font-medium text-text-primary',
              'hover:bg-primary/10 transition-colors',
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sessions
          </Link>
        </OptaSurface>
      </motion.div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SessionResumePage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;
  const [selectedModel, setSelectedModel] = useState('');

  // Fetch session data
  const {
    session,
    messages: sessionMessages,
    isLoading,
    error,
    isNotFound,
    model: sessionModel,
  } = useSessionResume(client, sessionId);

  // Models for the picker
  const { models, isLoading: modelsLoading } = useModels(client);

  // Set model from session once loaded (or fallback to first loaded model)
  useEffect(() => {
    if (selectedModel) return;

    if (sessionModel) {
      setSelectedModel(sessionModel);
    } else if (models.length > 0) {
      setSelectedModel(models[0]!.id);
    }
  }, [sessionModel, models, selectedModel]);

  // Loading state
  if (isLoading) {
    return <LoadingSkeleton />;
  }

  // Not found
  if (isNotFound) {
    return <NotFoundState />;
  }

  // Other errors
  if (error) {
    return <ErrorState message={error.message} />;
  }

  return (
    <main className="flex flex-col h-screen">
      {/* Header with session metadata */}
      <header className="border-b border-opta-border flex-shrink-0">
        <OptaSurface
          hierarchy="overlay"
          padding="none"
          className="rounded-none border-0 px-6 py-3"
        >
          <div className="flex items-center gap-4">
            <Link
              href="/sessions"
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                'text-text-secondary hover:text-text-primary hover:bg-primary/10',
              )}
              aria-label="Back to sessions"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold text-text-primary truncate">
                {session?.title ?? 'Untitled Session'}
              </h1>

              {/* Session metadata row */}
              <div className="flex items-center gap-3 mt-0.5 text-xs text-text-muted">
                {session && (
                  <>
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      {session.model}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(session.created)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {countDisplayable(session.messages.length)}
                    </span>
                    {session.tool_call_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Wrench className="w-3 h-3" />
                        {session.tool_call_count} tool call
                        {session.tool_call_count === 1 ? '' : 's'}
                      </span>
                    )}
                    {session.tags.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {session.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="default" size="sm">
                            {tag}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Compacted indicator */}
            {session?.compacted && (
              <OptaStatusPill
                label="Compacted"
                status="warning"
                icon={<Info className="w-3.5 h-3.5" />}
              />
            )}

            {/* Model picker */}
            <div className="flex-shrink-0">
              <ModelPicker
                models={models}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                isLoading={modelsLoading}
                disabled={false}
              />
            </div>
          </div>
        </OptaSurface>
      </header>

      {/* Chat area with pre-populated messages */}
      <div className="flex-1 relative overflow-hidden">
        <ChatContainer
          model={selectedModel}
          sessionId={sessionId}
          initialMessages={sessionMessages}
        />
      </div>
    </main>
  );
}

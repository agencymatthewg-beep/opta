'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, GitBranch, MessageSquare, Sparkles } from 'lucide-react';
import { cn } from '@opta/ui';
import { useConnectionContextSafe } from '@/components/shared/ConnectionProvider';
import { useChatStream, type PermissionRequestPayload } from '@/hooks/useChatStream';
import { useScrollAnchor } from '@/hooks/useScrollAnchor';
import { useSessionPersist } from '@/hooks/useSessionPersist';
import { useTokenCost } from '@/hooks/useTokenCost';
import {
  forkSession,
  getBranches,
  getBranchTree,
  getBranchableSession,
  renameBranch,
} from '@/lib/branch-store';
import { OptaDaemonClient } from '@/lib/opta-daemon-client';
import type { BranchableSession, BranchNode } from '@/lib/branch-store';
import type { ChatMessage as ChatMessageType } from '@/types/lmx';
import { BranchIndicator } from './BranchIndicator';
import { BranchTree } from './BranchTree';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { TokenCostBar } from './TokenCostBar';
import { ToolCallBlock } from './ToolCallBlock';

interface ChatContainerProps {
  /** Currently selected model ID */
  model: string;
  /** Optional session ID to restore. If not provided, generates a new one on first message. */
  sessionId?: string;
  /** Pre-populated messages from a CLI session resume. Skips welcome state when provided. */
  initialMessages?: ChatMessageType[];
}

interface PermissionQueueItem extends PermissionRequestPayload {
  resolve: (decision: 'allow' | 'deny') => void;
}

const PROMPT_SUGGESTIONS = [
  'Explain quantum computing in simple terms',
  'Write a Python function to sort a list',
  'What are the benefits of local AI?',
  'Help me debug a TypeScript error',
];

/**
 * Main chat container integrating streaming, scroll behavior, session
 * persistence, and message UI.
 *
 * Uses the active LMXClient from ConnectionProvider, manages the streaming
 * chat flow via useChatStream, auto-saves sessions to IndexedDB via
 * useSessionPersist, and handles auto-scroll via useScrollAnchor.
 */
export function ChatContainer({ model, sessionId: initialSessionId, initialMessages }: ChatContainerProps) {
  const router = useRouter();
  const connection = useConnectionContextSafe();
  const client = connection?.client ?? null;
  const daemonClient = useMemo(() => {
    const baseUrl = process.env.NEXT_PUBLIC_OPTA_DAEMON_URL;
    const token = process.env.NEXT_PUBLIC_OPTA_DAEMON_TOKEN;
    if (!baseUrl || !token) return null;
    return new OptaDaemonClient({ baseUrl, token });
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [permissionQueue, setPermissionQueue] = useState<PermissionQueueItem[]>([]);
  const [sessionId, setSessionId] = useState<string>(
    initialSessionId ?? '',
  );
  const sessionInitialized = useRef(false);
  const initialMessagesApplied = useRef(false);

  // Branch state
  const [branchMeta, setBranchMeta] = useState<BranchableSession | null>(null);
  const [parentTitle, setParentTitle] = useState<string>('');
  const [siblings, setSiblings] = useState<BranchableSession[]>([]);
  const [branchTree, setBranchTree] = useState<BranchNode[]>([]);
  const [showBranchTree, setShowBranchTree] = useState(false);
  const [hasBranches, setHasBranches] = useState(false);

  const currentPermission = permissionQueue[0] ?? null;
  const activeClient = daemonClient ?? client;

  const handlePermissionRequest = useCallback((request: PermissionRequestPayload) => {
    return new Promise<'allow' | 'deny'>((resolve) => {
      setPermissionQueue((prev) => [...prev, { ...request, resolve }]);
    });
  }, []);

  const resolvePermission = useCallback((decision: 'allow' | 'deny') => {
    setPermissionQueue((prev) => {
      const [head, ...rest] = prev;
      if (head) {
        try {
          head.resolve(decision);
        } catch {
          // Ignore resolution failures for unmounted listeners.
        }
      }
      return rest;
    });
  }, []);

  const clearPermissionQueue = useCallback((decision: 'allow' | 'deny' = 'deny') => {
    setPermissionQueue((prev) => {
      for (const item of prev) {
        try {
          item.resolve(decision);
        } catch {
          // Ignore resolution failures for unmounted listeners.
        }
      }
      return [];
    });
  }, []);

  const { messages, setMessages, toolEvents, isStreaming, sendMessage, stop } = useChatStream({
    onError: (err) => setError(err.message),
    onPermissionRequest: handlePermissionRequest,
  });

  // Token cost estimation
  const { promptTokens, completionTokens, totalTokens, estimatedCosts } =
    useTokenCost(messages);

  const {
    containerRef,
    anchorRef,
    showScrollButton,
    scrollToBottom,
    autoScroll,
  } = useScrollAnchor();

  // Session persistence — auto-saves after streaming completes
  const { restore } = useSessionPersist(
    sessionId,
    messages,
    model,
    isStreaming,
  );

  // Hydrate initial messages from CLI session resume (takes priority over IndexedDB restore)
  useEffect(() => {
    if (!initialMessages || initialMessages.length === 0 || initialMessagesApplied.current) return;
    initialMessagesApplied.current = true;
    setMessages(initialMessages);
  }, [initialMessages, setMessages]);

  // Restore session from IndexedDB if ID was provided (skip if initialMessages were provided)
  useEffect(() => {
    if (initialMessages?.length || !initialSessionId || sessionInitialized.current) return;
    sessionInitialized.current = true;

    void (async () => {
      const session = await restore();
      if (session) {
        setMessages(session.messages);
      }
    })();
  }, [initialSessionId, initialMessages, restore, setMessages]);

  // Auto-scroll when messages change during streaming
  useEffect(() => {
    autoScroll();
  }, [messages, autoScroll]);

  // Load branch metadata when session ID is available
  useEffect(() => {
    if (!sessionId) return;

    void (async () => {
      // Check if current session is a branch (has parentId)
      const session = await getBranchableSession(sessionId);
      if (session?.parentId) {
        setBranchMeta(session);

        // Load parent title
        const parent = await getBranchableSession(session.parentId);
        setParentTitle(parent?.title ?? 'Unknown session');

        // Load sibling branches (same parent, same branch point, excluding self)
        const allBranches = await getBranches(session.parentId);
        setSiblings(
          allBranches.filter(
            (b) =>
              b.id !== sessionId &&
              b.branchPoint === session.branchPoint,
          ),
        );
      } else {
        setBranchMeta(null);
        setParentTitle('');
        setSiblings([]);
      }

      // Check if this session has child branches
      const children = await getBranches(sessionId);
      setHasBranches(children.length > 0);

      // Build the tree if needed
      const tree = await getBranchTree(sessionId);
      setBranchTree(tree);
    })();
  }, [sessionId]);

  // Fork handler — creates a new branch and navigates to it
  const handleFork = useCallback(
    async (atMessageIndex: number) => {
      if (!sessionId) return;

      try {
        const branch = await forkSession(sessionId, atMessageIndex);
        router.push(`/chat/${branch.id}`);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to fork conversation',
        );
      }
    },
    [sessionId, router],
  );

  // Navigate to a branch session
  const handleBranchNavigate = useCallback(
    (targetSessionId: string) => {
      router.push(`/chat/${targetSessionId}`);
    },
    [router],
  );

  // Rename branch label
  const handleBranchLabelChange = useCallback(
    async (label: string) => {
      if (!sessionId) return;
      try {
        await renameBranch(sessionId, label);
        setBranchMeta((prev) =>
          prev ? { ...prev, branchLabel: label } : prev,
        );
      } catch {
        // Silently ignore rename failures
      }
    },
    [sessionId],
  );

  const handleSend = useCallback(
    (content: string) => {
      if (!activeClient) {
        setError('Not connected. Check your connection settings.');
        return;
      }

      // Generate session ID on first message if not already set
      const nextSessionId = sessionId || crypto.randomUUID();
      if (!sessionId) setSessionId(nextSessionId);

      setError(null);
      clearPermissionQueue('deny');
      void sendMessage(activeClient, model, content, {
        sessionId: nextSessionId,
        onSessionId: setSessionId,
      });
    },
    [activeClient, clearPermissionQueue, model, sendMessage, sessionId],
  );

  const handlePromptSuggestion = useCallback(
    (prompt: string) => {
      handleSend(prompt);
    },
    [handleSend],
  );

  const toolResultsByAssistantIndex = useMemo(() => {
    const results = new Map<number, Map<string, string>>();
    let activeAssistantIndex: number | null = null;

    // Tool messages are emitted immediately after the assistant tool-call message.
    // Tracking the active assistant index avoids rescanning forward for each row.
    for (let i = 0; i < messages.length; i++) {
      const message = messages[i]!;

      if (message.role === 'assistant') {
        if (message.tool_calls?.length) {
          activeAssistantIndex = i;
          results.set(i, new Map<string, string>());
        } else {
          activeAssistantIndex = null;
        }
        continue;
      }

      if (message.role === 'tool') {
        if (activeAssistantIndex != null && message.tool_call_id) {
          results
            .get(activeAssistantIndex)
            ?.set(message.tool_call_id, message.content);
        }
        continue;
      }

      activeAssistantIndex = null;
    }

    return results;
  }, [messages]);

  const renderedMessages = useMemo(
    () => messages.map((msg, index) => {
      // Skip tool-role messages — their content is rendered inline
      // with the preceding assistant message's ToolCallBlock
      if (msg.role === 'tool') {
        return null;
      }

      // Assistant messages with tool_calls: render tool call blocks then content
      if (msg.role === 'assistant' && msg.tool_calls?.length) {
        const toolResults = toolResultsByAssistantIndex.get(index);

        return (
          <div key={msg.id} className="space-y-3">
            {msg.tool_calls.map((tc) => (
              <ToolCallBlock
                key={tc.id}
                toolCalls={[tc]}
                toolResult={toolResults?.get(tc.id)}
              />
            ))}
            {msg.content && (
              <ChatMessage
                content={msg.content}
                role="assistant"
                isStreaming={
                  isStreaming &&
                  index === messages.length - 1
                }
                messageIndex={index}
                onFork={handleFork}
              />
            )}
          </div>
        );
      }

      // Regular user/assistant messages
      return (
        <ChatMessage
          key={msg.id}
          content={msg.content}
          role={msg.role as 'user' | 'assistant'}
          isStreaming={
            isStreaming &&
            index === messages.length - 1 &&
            msg.role === 'assistant'
          }
          messageIndex={index}
          onFork={handleFork}
        />
      );
    }),
    [messages, toolResultsByAssistantIndex, isStreaming, handleFork],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Message area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto"
      >
        {/* Branch indicator — shown when viewing a forked session */}
        {branchMeta?.parentId != null && branchMeta.branchPoint != null && (
          <BranchIndicator
            parentId={branchMeta.parentId}
            parentTitle={parentTitle}
            branchPoint={branchMeta.branchPoint}
            siblings={siblings}
            currentBranchLabel={branchMeta.branchLabel}
            onLabelChange={handleBranchLabelChange}
            onNavigate={handleBranchNavigate}
          />
        )}

        {/* View branches toggle — shown when session has child branches */}
        {hasBranches && (
          <div className="px-4 mt-3 mb-1">
            <button
              type="button"
              onClick={() => setShowBranchTree((prev) => !prev)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs',
                'glass-subtle text-text-secondary hover:text-text-primary',
                'hover:bg-primary/10 transition-colors',
                showBranchTree && 'text-primary',
              )}
            >
              <GitBranch className="w-3.5 h-3.5" />
              {showBranchTree ? 'Hide branches' : 'View branches'}
            </button>
          </div>
        )}

        {/* Branch tree visualization */}
        <AnimatePresence>
          {showBranchTree && branchTree.length > 0 && (
            <BranchTree
              tree={branchTree}
              currentSessionId={sessionId}
              onNavigate={handleBranchNavigate}
            />
          )}
        </AnimatePresence>

        {hasMessages ? (
          <div className="px-4 py-6 space-y-6 max-w-4xl mx-auto">
            {renderedMessages}
            {toolEvents.length > 0 && (
              <div className="space-y-2">
                {toolEvents.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-xs',
                      event.status === 'error'
                        ? 'border-neon-red/30 bg-neon-red/10'
                        : event.status === 'done'
                          ? 'border-neon-green/25 bg-neon-green/10'
                          : 'border-primary/25 bg-primary/10',
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-text-primary">
                        Tool · {event.toolName}
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-text-secondary">
                        {event.status}
                      </span>
                    </div>
                    {event.args && (
                      <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-text-secondary">
                        {event.args}
                      </pre>
                    )}
                    {event.detail && (
                      <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] text-text-primary">
                        {event.detail}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Empty state — welcome + prompt suggestions */
          <div className="flex flex-col items-center justify-center h-full px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-lg"
            >
              <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold text-text-primary mb-2">
                Chat with your AI
              </h2>
              <p className="text-text-secondary mb-8">
                Running locally on your Mac Studio. Fast, private, and unlimited.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROMPT_SUGGESTIONS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handlePromptSuggestion(prompt)}
                    disabled={!activeClient}
                    className={cn(
                      'glass-subtle rounded-xl px-4 py-3 text-left text-sm',
                      'text-text-secondary hover:text-text-primary',
                      'transition-colors hover:border-primary/30',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'flex items-start gap-2',
                    )}
                  >
                    <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {/* Scroll anchor — must be inside the scrollable container */}
        <div ref={anchorRef} className="h-px" />
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={() => scrollToBottom()}
            className={cn(
              'absolute bottom-28 right-8 z-10',
              'glass rounded-full p-2 shadow-lg',
              'hover:bg-primary/10 transition-colors',
            )}
            aria-label="Scroll to bottom"
          >
            <ChevronDown className="w-5 h-5 text-text-primary" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 text-center text-sm text-neon-red bg-neon-red/10 border-t border-neon-red/20"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Permission prompt */}
      <AnimatePresence>
        {currentPermission && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-primary/20 bg-primary/10 px-4 py-3"
          >
            <div className="mx-auto max-w-4xl space-y-2">
              <div className="text-sm font-medium text-text-primary">
                Permission request: {currentPermission.toolName}
              </div>
              <pre className="max-h-40 overflow-auto rounded-lg bg-bg/60 p-2 text-xs text-text-secondary">
                {JSON.stringify(currentPermission.args, null, 2)}
              </pre>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => resolvePermission('deny')}
                  className="rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-1.5 text-xs text-neon-red hover:bg-neon-red/20"
                >
                  Deny
                </button>
                <button
                  type="button"
                  onClick={() => resolvePermission('allow')}
                  className="rounded-lg border border-neon-green/30 bg-neon-green/10 px-3 py-1.5 text-xs text-neon-green hover:bg-neon-green/20"
                >
                  Allow
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom docking area with gradient fade */}
      <div className="relative pt-6 pb-2 shrink-0">
        {/* Gradient fade to seamlessly blend messages behind the input area */}
        <div className="absolute inset-0 bg-gradient-to-t from-opta-bg via-opta-bg/90 to-transparent pointer-events-none -z-10" />

        {/* Token cost estimator */}
        <div className="mb-3">
          <TokenCostBar
            promptTokens={promptTokens}
            completionTokens={completionTokens}
            totalTokens={totalTokens}
            estimatedCosts={estimatedCosts}
            isStreaming={isStreaming}
          />
        </div>

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          onStop={stop}
          isStreaming={isStreaming}
          disabled={!activeClient}
        />
      </div>
    </div>
  );
}

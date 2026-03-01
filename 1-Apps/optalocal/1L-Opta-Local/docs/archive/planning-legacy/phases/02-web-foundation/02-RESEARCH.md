---
status: review
---

# Phase 2: Web Foundation - Research

**Researched:** 2026-02-18
**Domain:** Streaming chat UI, markdown rendering, chat persistence, model picker
**Confidence:** HIGH

<research_summary>
## Summary

Researched streaming chat UI patterns, markdown/code rendering, chat message state management, model picker UX, chat history persistence, and React 19 concurrent features for Phase 2 of Opta Local Web.

**Key finding: Streamdown over react-markdown.** Vercel's Streamdown (v2+) is a purpose-built drop-in replacement for react-markdown designed for AI streaming. It handles incomplete/unterminated markdown blocks gracefully during streaming (bold mid-word, unclosed code fences, partial links), uses Shiki for syntax highlighting via the `@streamdown/code` plugin, and supports per-word animated streaming with a caret indicator. The plugin architecture (`@streamdown/code`, `@streamdown/math`, `@streamdown/mermaid`) keeps the core bundle small -- only import what you need. This eliminates the #1 pain point of react-markdown in streaming contexts: garbled rendering of incomplete markdown.

**Key finding: IndexedDB via idb-keyval for chat history.** localStorage caps at 5-10MB and is synchronous (blocks UI during large reads). Chat history with code blocks grows fast. IndexedDB offers gigabytes of async storage. idb-keyval (< 600 bytes) wraps IndexedDB as a simple get/set API -- no schema management overhead. Use it for sessions; keep connection settings in encrypted localStorage (already implemented in Phase 1).

**Key finding: useTransition for non-blocking streaming.** React 19's `startTransition` wraps state updates as non-urgent, preventing streaming token appends from blocking user input. Combine with `useOptimistic` for instant "sending..." feedback on user messages before the stream starts.

**Primary recommendation:** Streamdown + @streamdown/code for markdown rendering, idb-keyval for chat history persistence, useTransition for non-blocking streaming updates, Radix Select for model picker, scroll-anchor pattern for auto-scroll behavior.
</research_summary>

<standard_stack>
## Standard Stack

### Core (already installed in Phase 1)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.1.6 | React framework | Phase 1 baseline |
| react | 19.2.3 | UI library | Phase 1 baseline |
| react-dom | 19.2.3 | React DOM renderer | Phase 1 baseline |
| tailwindcss | ^4 | Utility-first CSS | Phase 1 baseline |
| framer-motion | ^12 | Animation (mandatory) | Phase 1 baseline |
| lucide-react | ^0.563 | Icons (mandatory) | Phase 1 baseline |
| @opta/ui | workspace:* | Card, Button, Badge, cn() | Phase 1 baseline |
| swr | ^2.3 | Data fetching (model list) | Phase 1 baseline |

### New Dependencies for Phase 2
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| streamdown | ^2 | Streaming markdown renderer | Vercel-built, drop-in react-markdown replacement for AI streaming. Handles incomplete markdown blocks, memoized re-renders, animated caret. |
| @streamdown/code | ^2 | Syntax highlighting plugin | Shiki-powered, 200+ languages, lazy-loaded on demand. Separate package keeps core bundle small. |
| idb-keyval | ^6.2 | IndexedDB key-value store | < 600 bytes, promise-based, structured-clonable data support. Perfect for session persistence. |
| @radix-ui/react-select | ^2.2 | Accessible select/dropdown | Proven in AICompare Web, WAI-ARIA compliant, keyboard navigation, typeahead. |
| @radix-ui/react-tooltip | ^1.2 | Accessible tooltips | Model metadata hover tooltips (quantization, context length). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| streamdown | react-markdown + remark-gfm | react-markdown cannot handle incomplete/streaming markdown (garbled output mid-stream). Streamdown was built specifically for this. |
| streamdown | @magicul/react-chat-stream | Only handles word-by-word display, no markdown parsing. |
| @streamdown/code (Shiki) | rehype-highlight (highlight.js) | Shiki produces better output (TextMate grammars vs regex), but is larger. Lazy-loading via @streamdown/code mitigates this. |
| @streamdown/code (Shiki) | react-shiki | Good standalone, but Streamdown's code plugin integrates Shiki directly with streaming-aware rendering. No need for separate integration. |
| idb-keyval | localStorage | localStorage caps at 5-10MB, is synchronous (blocks UI), and chat history with code blocks grows fast. |
| idb-keyval | Dexie.js | Dexie is a full IndexedDB wrapper with querying/indexing (~40KB). Overkill for key-value session storage. |
| idb-keyval | localforage | localforage (~7KB) supports older browsers. Not needed -- target is modern browsers only. |
| @radix-ui/react-select | native HTML select | No styling control, no glass aesthetic, no typeahead. |
| @radix-ui/react-select | @headlessui/react | Radix already proven in the Opta ecosystem (AICompare uses it). |

**Installation:**
```bash
cd 1-Apps/1L-Opta-Local/web
npm install streamdown @streamdown/code idb-keyval @radix-ui/react-select @radix-ui/react-tooltip
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Streaming Chat Hook with useTransition
**What:** A `useChatStream` hook that wraps LMXClient.streamChat() with React 19's startTransition for non-blocking token appends
**When to use:** Every chat message streaming flow
**Why:** Without startTransition, rapid state updates from streaming tokens (20-100 tok/s) can block the input field and make the UI feel unresponsive. startTransition marks token-append updates as non-urgent so React can prioritize user input.
**Example:**
```typescript
'use client';
import { useState, useTransition, useCallback, useRef } from 'react';
import type { ChatMessage } from '@/types/lmx';

interface UseChatStreamOptions {
  onError?: (error: Error) => void;
}

export function useChatStream(options?: UseChatStreamOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    client: LMXClient,
    model: string,
    content: string,
  ) => {
    // 1. Add user message immediately (optimistic)
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    // 2. Add placeholder assistant message
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      model,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      // 3. Stream tokens, updating assistant message content
      const allMessages = [...messages, userMsg];
      for await (const token of client.streamChat(model, allMessages)) {
        // Wrap in startTransition so token appends don't block input
        startTransition(() => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === 'assistant') {
              updated[updated.length - 1] = {
                ...last,
                content: last.content + token,
              };
            }
            return updated;
          });
        });
      }
    } catch (error) {
      options?.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsStreaming(false);
    }
  }, [messages, startTransition, options]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, setMessages, isStreaming, isPending, sendMessage, stop };
}
```

### Pattern 2: Streamdown Markdown Rendering with Code Highlighting
**What:** Render streaming assistant messages with Streamdown + @streamdown/code for syntax highlighting
**When to use:** Every assistant message in the chat UI
**Why:** Streamdown handles incomplete markdown blocks mid-stream (unclosed code fences, partial bold, etc.) and only re-renders changed portions for performance. The code plugin uses Shiki with lazy-loaded languages.
**Example:**
```tsx
'use client';
import { Streamdown } from 'streamdown';
import { code, createCodePlugin } from '@streamdown/code';

// Custom code plugin with dark theme matching Opta design system
const optaCode = createCodePlugin({
  themes: ['github-dark-default', 'github-dark-default'], // [light, dark] — both dark for OLED
});

interface ChatMessageProps {
  content: string;
  role: 'user' | 'assistant';
  isStreaming?: boolean;
}

export function ChatMessage({ content, role, isStreaming }: ChatMessageProps) {
  if (role === 'user') {
    return (
      <div className="glass-subtle rounded-xl px-4 py-3 ml-12">
        <p className="text-text-primary whitespace-pre-wrap">{content}</p>
      </div>
    );
  }

  return (
    <div className="mr-12">
      <Streamdown
        plugins={{ code: optaCode }}
        caret={isStreaming ? 'block' : undefined}
        isAnimating={isStreaming}
      >
        {content}
      </Streamdown>
    </div>
  );
}
```

### Pattern 3: Scroll-to-Bottom with Anchor Element
**What:** Auto-scroll to latest message during streaming, but stop when user scrolls up
**When to use:** Chat message list container
**Why:** Users expect auto-scroll during streaming but must be able to scroll up to read history. The anchor pattern uses IntersectionObserver to detect if the bottom is visible — only auto-scroll when it is.
**Example:**
```tsx
'use client';
import { useRef, useEffect, useState, useCallback } from 'react';

export function useScrollAnchor() {
  const containerRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Track if user is at bottom
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setIsAtBottom(entry.isIntersecting);
          setShowScrollButton(!entry.isIntersecting);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(anchor);
    return () => observer.disconnect();
  }, []);

  // Scroll to bottom (smooth or instant)
  const scrollToBottom = useCallback((smooth = true) => {
    anchorRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'instant',
    });
  }, []);

  // Auto-scroll when at bottom and content changes
  const autoScroll = useCallback(() => {
    if (isAtBottom) {
      // Use requestAnimationFrame for smooth streaming scroll
      requestAnimationFrame(() => {
        anchorRef.current?.scrollIntoView({ behavior: 'instant' });
      });
    }
  }, [isAtBottom]);

  return { containerRef, anchorRef, isAtBottom, showScrollButton, scrollToBottom, autoScroll };
}
```

Usage in chat:
```tsx
function ChatMessages({ messages, isStreaming }) {
  const { containerRef, anchorRef, showScrollButton, scrollToBottom, autoScroll } = useScrollAnchor();

  // Auto-scroll on new tokens
  useEffect(() => {
    autoScroll();
  }, [messages, autoScroll]);

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      {messages.map(msg => <ChatMessage key={msg.id} {...msg} />)}
      <div ref={anchorRef} className="h-px" />
      {showScrollButton && (
        <button onClick={() => scrollToBottom()} className="fixed bottom-24 right-8 glass rounded-full p-2">
          <ChevronDown className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
```

### Pattern 4: Model Picker with Radix Select
**What:** Accessible dropdown showing loaded models with metadata (quantization, context length, VRAM)
**When to use:** Chat header, model selection before/during conversation
**Why:** Radix Select provides WAI-ARIA compliance, keyboard navigation, typeahead, and unstyled base for glass aesthetic. Model metadata (quantization, context length) shown inline.
**Example:**
```tsx
'use client';
import * as Select from '@radix-ui/react-select';
import { ChevronDown, Cpu } from 'lucide-react';
import type { LoadedModel } from '@/types/lmx';

interface ModelPickerProps {
  models: LoadedModel[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
}

export function ModelPicker({ models, selectedModel, onModelChange, disabled }: ModelPickerProps) {
  return (
    <Select.Root value={selectedModel} onValueChange={onModelChange} disabled={disabled}>
      <Select.Trigger className="glass-subtle rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
        <Cpu className="w-4 h-4 text-primary" />
        <Select.Value placeholder="Select model..." />
        <Select.Icon>
          <ChevronDown className="w-4 h-4 text-text-secondary" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content className="glass rounded-xl p-1 shadow-2xl border border-opta-border" position="popper" sideOffset={4}>
          <Select.Viewport>
            {models.map(model => (
              <Select.Item
                key={model.id}
                value={model.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer outline-none data-[highlighted]:bg-primary/10"
              >
                <Select.ItemText>{model.name}</Select.ItemText>
                <span className="text-xs text-text-muted ml-auto">
                  {model.quantization} | {(model.context_length / 1000).toFixed(0)}K
                </span>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
```

### Pattern 5: Chat History Persistence with idb-keyval
**What:** Save/load chat sessions to IndexedDB using idb-keyval's simple get/set API
**When to use:** Auto-save on every assistant message completion, load on page mount / session resume
**Why:** Chat sessions with code blocks can exceed localStorage's 5-10MB limit. idb-keyval provides async IndexedDB access in < 600 bytes with zero schema management.
**Example:**
```typescript
import { get, set, del, keys } from 'idb-keyval';
import type { Session } from '@/types/lmx';

const SESSION_PREFIX = 'opta-session:';

export async function saveSession(session: Session): Promise<void> {
  await set(`${SESSION_PREFIX}${session.id}`, session);
}

export async function getSession(id: string): Promise<Session | undefined> {
  return get(`${SESSION_PREFIX}${id}`);
}

export async function deleteSession(id: string): Promise<void> {
  await del(`${SESSION_PREFIX}${id}`);
}

export async function listSessions(): Promise<Session[]> {
  const allKeys = await keys();
  const sessionKeys = allKeys.filter(k =>
    typeof k === 'string' && k.startsWith(SESSION_PREFIX)
  );

  const sessions: Session[] = [];
  for (const key of sessionKeys) {
    const session = await get<Session>(key);
    if (session) sessions.push(session);
  }

  // Sort by updated_at descending (most recent first)
  return sessions.sort((a, b) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export async function generateSessionTitle(messages: ChatMessage[]): string {
  // Use first user message as title, truncated
  const firstUserMsg = messages.find(m => m.role === 'user');
  if (!firstUserMsg) return 'New Chat';
  return firstUserMsg.content.slice(0, 60) + (firstUserMsg.content.length > 60 ? '...' : '');
}
```

### Pattern 6: SWR for Model List with Auto-Refresh
**What:** Fetch loaded models from `/v1/models` via SWR with periodic refresh
**When to use:** Model picker, dashboard model list
**Why:** SWR handles caching, deduplication, and revalidation. Models can change when loaded/unloaded from other clients (CLI, other browser tabs).
**Example:**
```typescript
'use client';
import useSWR from 'swr';
import type { ModelsResponse, LoadedModel } from '@/types/lmx';

export function useModels(client: LMXClient | null) {
  const { data, error, isLoading, mutate } = useSWR<ModelsResponse>(
    client ? 'lmx:models' : null,
    () => client!.getModels(),
    {
      refreshInterval: 10_000, // Poll every 10s (models can change)
      revalidateOnFocus: true,
      errorRetryCount: 2,
    },
  );

  return {
    models: data?.data ?? [],
    isLoading,
    isError: !!error,
    refresh: () => mutate(),
  };
}
```

### Anti-Patterns to Avoid
- **Don't use react-markdown for streaming content.** It will garble incomplete markdown (unclosed code fences, partial bold) during streaming. Streamdown exists specifically for this.
- **Don't store chat history in localStorage.** 5-10MB limit, synchronous (blocks UI), no structured data support. Use idb-keyval for IndexedDB.
- **Don't update message state on every single token without startTransition.** At 100 tok/s, this creates 100 synchronous re-renders per second, making input laggy.
- **Don't force auto-scroll when user has scrolled up.** Use IntersectionObserver on an anchor element to detect bottom visibility.
- **Don't poll for models without SWR.** Raw `setInterval` + `fetch` creates duplicate requests, no deduplication, no cache, no error retry.
- **Don't use Vercel AI SDK's `useChat()` hook.** It requires a Next.js API route as intermediary. Opta Local connects directly to LMX from the browser -- no backend proxy.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming markdown rendering | Custom string-to-JSX parser | Streamdown | Handles incomplete blocks, memoized re-renders, streaming caret, GFM support |
| Code syntax highlighting | Custom regex-based highlighter | @streamdown/code (Shiki) | 200+ languages, TextMate grammars, lazy-loaded, integrates with Streamdown |
| Incomplete markdown completion | Buffer tokens until block closes | Streamdown's built-in `remend` | Automatically closes unclosed bold, code, links, math during streaming |
| Chat auto-scroll | Manual scrollTop calculations | IntersectionObserver on anchor element | Handles user-scrolled-up state, streaming scroll, requestAnimationFrame timing |
| Session persistence | Custom IndexedDB wrapper | idb-keyval | 600 bytes, promise-based, handles structured-clonable data |
| Model picker dropdown | Custom div-based dropdown | @radix-ui/react-select | WAI-ARIA, keyboard nav, typeahead, proven in Opta ecosystem |
| Non-blocking streaming updates | setTimeout batching | React 19 startTransition | Framework-native, interruptible rendering, priority scheduling |
| Optimistic user messages | Custom pending state | React 19 useOptimistic (future) or immediate state append | Framework-native pattern for instant feedback |
| Data fetching + caching (model list) | Custom useEffect + state | SWR (already installed) | Deduplication, caching, revalidation, error retry |
| Copy code button | Custom clipboard code | Streamdown's built-in copy button | Already included in @streamdown/code header |

**Key insight:** The Streamdown library eliminates the biggest technical risk in this phase -- rendering streaming markdown correctly. Without it, you'd need to build a custom incomplete-markdown parser (handling unclosed code fences, partial bold/italic, broken links mid-stream). This is the exact problem Vercel built Streamdown to solve.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Streaming Token Jank (Blocking Renders)
**What goes wrong:** Chat input becomes unresponsive during fast token streaming (50-100 tok/s)
**Why it happens:** Each token appends to message state via setState, triggering synchronous re-renders. At 100 tok/s, React spends all time rendering, blocking input event handlers.
**How to avoid:** Wrap token-append state updates in `startTransition()`. This marks them as non-urgent so React can interrupt rendering to handle user input. See Pattern 1 above.
**Warning signs:** Typing in input field is laggy or delayed while assistant message is streaming

### Pitfall 2: Streamdown Bundle Size Bloat
**What goes wrong:** Adding `streamdown` increases build size by 10+ MB
**Why it happens:** Streamdown v1 bundled Mermaid.js, KaTeX, and Shiki in the core package. v2 moved these to separate plugins.
**How to avoid:** Only install `streamdown` (core) + `@streamdown/code` (syntax highlighting). Do NOT install `@streamdown/mermaid` (~8MB) or `@streamdown/math` unless LMX models actually output mermaid/LaTeX. The core + code plugin is what we need for chat.
**Warning signs:** Build output shows unexpectedly large chunks, First Load JS exceeds 200KB target

### Pitfall 3: Auto-Scroll Fights User Scroll
**What goes wrong:** User scrolls up to read previous messages, but streaming tokens keep pulling scroll to bottom
**Why it happens:** Naive scroll-to-bottom implementations run on every state update, regardless of user scroll position
**How to avoid:** Use IntersectionObserver on a bottom anchor element. Only auto-scroll when the anchor is visible (user is at bottom). Show a "scroll to bottom" button when anchor is not visible. See Pattern 3 above.
**Warning signs:** Can't read previous messages while assistant is streaming, scroll jumps unexpectedly

### Pitfall 4: idb-keyval Transaction Overhead on List Operations
**What goes wrong:** Listing all sessions is slow when there are many sessions
**Why it happens:** Each `get()` call in idb-keyval opens a separate IndexedDB transaction. Listing 100 sessions = 100 transactions.
**How to avoid:** Keep a session index (id, title, model, updated_at) as a single idb-keyval entry that gets updated when sessions change. Only fetch full session data when opening a specific session. This reduces list operations from N transactions to 1.
**Warning signs:** Session list page takes >500ms to load, visible delay when switching to sessions view

### Pitfall 5: Model Picker Shows Stale Models
**What goes wrong:** Model list doesn't reflect models loaded/unloaded from CLI or other clients
**Why it happens:** Model list is fetched once and cached without refresh
**How to avoid:** Use SWR with `refreshInterval: 10_000` (poll every 10s). Also add `revalidateOnFocus: true` so switching tabs triggers a fresh fetch. In Phase 3, SSE dashboard events will provide real-time model change notifications.
**Warning signs:** Model picker shows a model that was unloaded, or doesn't show a newly loaded model

### Pitfall 6: Chat History Lost on Page Refresh
**What goes wrong:** Active chat session disappears on page refresh or accidental navigation
**Why it happens:** Messages stored only in React state, not persisted to IndexedDB
**How to avoid:** Auto-save session to idb-keyval after each completed assistant message. On mount, check URL for session ID and restore from IndexedDB. Use `beforeunload` event to save any in-progress streaming content.
**Warning signs:** Refreshing page shows empty chat, back button loses conversation

### Pitfall 7: Streamdown Component Flicker on Re-render
**What goes wrong:** Entire markdown output re-renders on each token, causing visible flicker
**Why it happens:** Parent component re-renders pass new children to Streamdown, which re-parses everything
**How to avoid:** Streamdown v2 has built-in memoization -- it only re-renders changed portions. Ensure you're not wrapping it in components that force unmount/remount (e.g., changing `key` prop on each token). Keep the same `key` for the entire message lifecycle.
**Warning signs:** Code blocks "flash" during streaming, syntax highlighting resets mid-stream
</common_pitfalls>

<code_examples>
## Code Examples

### Complete Chat Page Layout
```tsx
// Source: Architecture pattern combining all Phase 2 components
// app/chat/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardFooter } from '@opta/ui';
import { Send, Square, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ModelPicker } from '@/components/chat/ModelPicker';
import { useChatStream } from '@/hooks/useChatStream';
import { useModels } from '@/hooks/useModels';
import { useScrollAnchor } from '@/hooks/useScrollAnchor';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const { models } = useModels(client);
  const { messages, isStreaming, sendMessage, stop } = useChatStream();
  const { containerRef, anchorRef, showScrollButton, scrollToBottom, autoScroll } = useScrollAnchor();

  // Auto-select first model if none selected
  useEffect(() => {
    if (!selectedModel && models.length > 0) {
      setSelectedModel(models[0].id);
    }
  }, [models, selectedModel]);

  // Auto-scroll on new tokens
  useEffect(() => {
    autoScroll();
  }, [messages, autoScroll]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming || !selectedModel) return;
    sendMessage(client, selectedModel, input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header with model picker */}
      <header className="glass border-b border-opta-border px-4 py-3 flex items-center gap-4">
        <h1 className="text-lg font-semibold">Chat</h1>
        <ModelPicker
          models={models}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
          disabled={isStreaming}
        />
      </header>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map(msg => (
          <ChatMessage
            key={msg.id}
            content={msg.content}
            role={msg.role}
            isStreaming={isStreaming && msg === messages[messages.length - 1] && msg.role === 'assistant'}
          />
        ))}
        <div ref={anchorRef} className="h-px" />
      </div>

      {/* Scroll to bottom button */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => scrollToBottom()}
            className="fixed bottom-24 right-8 glass rounded-full p-2 shadow-lg"
          >
            <ChevronDown className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-opta-border px-4 py-3">
        <div className="glass-subtle rounded-xl flex items-center gap-2 px-4 py-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Message your AI..."
            className="flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-muted"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button type="button" onClick={stop} className="text-neon-red hover:text-neon-red/80">
              <Square className="w-5 h-5" />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="text-primary hover:text-primary-glow disabled:text-text-muted">
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
```

### Session Auto-Save Hook
```typescript
// Source: Pattern combining useChatStream with idb-keyval persistence
// hooks/useSessionPersist.ts

'use client';
import { useEffect, useRef, useCallback } from 'react';
import { saveSession, getSession } from '@/lib/sessions';
import type { ChatMessage, Session } from '@/types/lmx';

export function useSessionPersist(
  sessionId: string,
  messages: ChatMessage[],
  model: string,
  isStreaming: boolean,
) {
  const lastSavedRef = useRef<string>('');

  // Auto-save when streaming completes (not during -- too many writes)
  useEffect(() => {
    if (isStreaming || messages.length === 0) return;

    const serialized = JSON.stringify(messages);
    if (serialized === lastSavedRef.current) return; // No changes

    const session: Session = {
      id: sessionId,
      title: messages.find(m => m.role === 'user')?.content.slice(0, 60) ?? 'New Chat',
      messages,
      model,
      created_at: messages[0]?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    saveSession(session);
    lastSavedRef.current = serialized;
  }, [sessionId, messages, model, isStreaming]);

  // Save on page unload (catch mid-stream exits)
  useEffect(() => {
    const handleUnload = () => {
      if (messages.length > 0) {
        // Note: idb-keyval is async, but we can try -- best effort
        const session: Session = {
          id: sessionId,
          title: messages.find(m => m.role === 'user')?.content.slice(0, 60) ?? 'New Chat',
          messages,
          model,
          created_at: messages[0]?.created_at ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        saveSession(session); // Fire-and-forget
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [sessionId, messages, model]);

  // Restore session on mount
  const restore = useCallback(async (): Promise<ChatMessage[] | null> => {
    const session = await getSession(sessionId);
    if (session) {
      lastSavedRef.current = JSON.stringify(session.messages);
      return session.messages;
    }
    return null;
  }, [sessionId]);

  return { restore };
}
```

### Streaming Indicator Component
```tsx
// Source: Framer Motion animation pattern from Opta design system
// components/chat/StreamingIndicator.tsx

'use client';
import { motion } from 'framer-motion';

export function StreamingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary"
          animate={{
            opacity: [0.3, 1, 0.3],
            scale: [0.85, 1.15, 0.85],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
      <span className="text-xs text-text-secondary ml-1">Generating...</span>
    </div>
  );
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-markdown for chat | Streamdown (Vercel) | 2025 | Drop-in replacement that handles streaming incomplete markdown. Memoized re-renders. |
| highlight.js / Prism | Shiki (via @streamdown/code) | 2024-2025 | TextMate grammars, lazy-loaded languages, better output quality |
| localStorage for chat history | IndexedDB via idb-keyval | Ongoing (2024+) | Async, gigabyte storage, structured data support |
| Manual scroll management | IntersectionObserver anchor pattern | 2023+ standard | Cleaner than scrollTop calculations, handles streaming smoothly |
| useEffect batching | React 19 startTransition | React 19 (2024) | Framework-native non-blocking updates for streaming |
| Custom optimistic state | React 19 useOptimistic | React 19 (2024) | Framework-native optimistic UI pattern |
| Vercel AI SDK useChat() | Custom hook + direct LMX | N/A (architecture decision) | useChat() requires Next.js API route; Opta Local connects browser-direct |

**New tools/patterns to evaluate for future phases:**
- **React Activity:** Could keep chat WebSocket alive while on other routes (dashboard). Not needed in Phase 2 but relevant for Phase 3+.
- **React ViewTransitions:** Could animate route changes (chat -> sessions). Evaluate in Phase 5.
- **"use cache" directive (Next.js 16):** Could cache model list responses on the client. SWR already handles this -- evaluate if needed.
- **OPFS (Origin Private File System):** Even faster than IndexedDB for large data. Evaluate if chat history exceeds idb-keyval performance.
- **Streamdown animations (v2.2):** Per-word animated streaming for polished chat feel. Available now in Streamdown 2.2.

**Deprecated/outdated:**
- **react-markdown for streaming:** Renders incomplete markdown incorrectly. Use Streamdown.
- **Custom SSE parsing for chat:** LMX uses OpenAI-compatible `data:` format. LMXClient.streamChat() already handles this (Phase 1).
- **highlight.js in new projects:** Shiki produces better results with TextMate grammars.
- **localforage:** Unnecessary browser compatibility layer for modern-only target.
</sota_updates>

<open_questions>
## Open Questions

1. **Streamdown bundle size in practice**
   - What we know: Streamdown v2 uses plugin architecture. Core + @streamdown/code should be much smaller than v1's all-in-one bundle.
   - What's unclear: Exact gzipped bundle size of `streamdown` + `@streamdown/code` in a Next.js 16 build. The 200KB first-load JS target (from ARCHITECTURE.md) may be tight.
   - Recommendation: Install and build before writing components. Check `next build` output for chunk sizes. If over budget, evaluate react-markdown + @shikijs/rehype as fallback (lose streaming markdown completions but gain smaller bundle).

2. **Streamdown React 19 compatibility**
   - What we know: Streamdown lists React 18+ as peer dependency. React 19 is a superset.
   - What's unclear: Whether any Streamdown internals conflict with React 19's concurrent features (Suspense boundaries, startTransition interactions).
   - Recommendation: Test basic streaming rendering with React 19 before building the full chat UI. If issues arise, react-markdown is the fallback.

3. **idb-keyval beforeunload reliability**
   - What we know: `beforeunload` event fires on page close/refresh. idb-keyval operations are async (Promise-based).
   - What's unclear: Whether the async `set()` call completes before the page unloads. Browsers may kill the process before the IndexedDB write finishes.
   - Recommendation: Auto-save after each completed assistant message (not just on unload). The `beforeunload` save is a best-effort safety net, not the primary persistence mechanism.

4. **Abort controller for stream cancellation**
   - What we know: LMXClient.streamChat() uses `fetch` + `ReadableStream`. The user should be able to stop generation mid-stream.
   - What's unclear: Whether the current LMXClient implementation supports AbortController. The existing `streamChat()` method doesn't accept an AbortSignal.
   - Recommendation: In Plan 02-01, extend LMXClient.streamChat() to accept an optional AbortSignal parameter. Pass it to the fetch call.

5. **Session title generation strategy**
   - What we know: ChatGPT-style apps generate session titles from the first user message or via an LLM summarization call.
   - What's unclear: Whether to use first-message truncation (simple, free) or ask LMX to generate a title (better quality, costs a request).
   - Recommendation: Start with first-message truncation for v1. Add LLM-generated titles in a future phase if needed.
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [Streamdown by Vercel](https://github.com/vercel/streamdown) -- Drop-in react-markdown replacement for AI streaming. Plugin architecture, incomplete markdown handling, Shiki code highlighting.
- [Streamdown documentation](https://streamdown.ai/docs) -- Configuration, plugins, caret animation, remend (incomplete markdown completion).
- [@streamdown/code plugin](https://streamdown.ai/docs/code-blocks) -- Shiki integration, theme configuration, lazy language loading.
- [React 19 useTransition docs](https://react.dev/reference/react/useTransition) -- Non-blocking state updates via startTransition, concurrent rendering.
- [idb-keyval by Jake Archibald](https://github.com/jakearchibald/idb-keyval) -- < 600 byte IndexedDB key-value wrapper. v6.2.2 latest.
- [Radix Select component](https://www.radix-ui.com/primitives/docs/components/select) -- WAI-ARIA compliant select with keyboard navigation and typeahead.
- LMXClient source code (`web/src/lib/lmx-client.ts`) -- Existing streaming implementation using fetch + ReadableStream + SSE parsing.
- Phase 1 research (`01-RESEARCH.md`) -- Stack decisions, @opta/ui inventory, Tailwind 4 patterns.

### Secondary (MEDIUM confidence)
- [Streaming LLM Responses Web Guide](https://pockit.tools/blog/streaming-llm-responses-web-guide/) -- Patterns for SSE-based streaming in web applications.
- [Real-time AI in Next.js with Vercel AI SDK](https://blog.logrocket.com/nextjs-vercel-ai-sdk-streaming/) -- useChat() patterns (not directly applicable but informative for streaming UX).
- [RxDB: localStorage vs IndexedDB comparison](https://rxdb.info/articles/localstorage-indexeddb-cookies-opfs-sqlite-wasm.html) -- Storage limits, performance benchmarks, async vs sync tradeoffs.
- [Streaming chat scroll to bottom (Dave Lage)](https://davelage.com/posts/chat-scroll-react/) -- IntersectionObserver anchor pattern for auto-scroll.
- [Intuitive Scrolling for Chatbot Message Streaming](https://tuffstuff9.hashnode.dev/intuitive-scrolling-for-chatbot-message-streaming) -- ChatScrollAnchor pattern with useInView.
- [React 19 useOptimistic](https://react.dev/reference/react/useOptimistic) -- Optimistic UI pattern for instant message feedback.
- [Shiki syntax highlighter](https://shiki.style/guide/) -- TextMate grammars, lazy loading, React integration.

### Tertiary (LOW confidence - needs validation)
- Streamdown bundle size with React 19 / Next.js 16 -- needs actual build measurement
- idb-keyval `beforeunload` reliability -- needs testing across browsers
- LMXClient AbortController support -- needs code review / extension
</sources>

<metadata>
## Metadata

**Research scope:**
- Streaming chat UI: Token rendering, state management, non-blocking updates
- Markdown rendering: Streamdown vs react-markdown, code highlighting, incomplete block handling
- Chat architecture: Message list state, optimistic updates, scroll behavior
- Model picker: Radix Select, model metadata display, auto-selection
- Persistence: IndexedDB via idb-keyval, session auto-save, list optimization
- React 19: useTransition, startTransition, useOptimistic

**Confidence breakdown:**
- Standard stack: HIGH -- Streamdown is Vercel-maintained, idb-keyval is Jake Archibald-maintained, Radix proven in ecosystem
- Architecture: HIGH -- Patterns derived from existing LMXClient + working AICompare reference + React 19 docs
- Pitfalls: HIGH -- Identified from actual streaming UX problems (jank, scroll fights, bundle bloat, stale models)
- Code examples: MEDIUM -- Patterns derived from docs + existing codebase, not yet tested against LMX
- Bundle size: LOW -- Streamdown + @streamdown/code actual size needs measurement

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days -- Streamdown and React 19 ecosystem actively evolving)
</metadata>

---

*Phase: 02-web-foundation*
*Research completed: 2026-02-18*
*Ready for planning: yes*

/**
 * ChatInterface container component for AI assistant conversations.
 *
 * Provides the main chat UI with message history, input, LLM status,
 * and routing mode toggle for switching between local and cloud AI.
 * Auto-scrolls to bottom on new messages and handles error states gracefully.
 *
 * Follows DESIGN_SYSTEM.md Obsidian Standard:
 * - Obsidian glass surfaces with volumetric glow
 * - Framer Motion animations
 * - Lucide icons
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLlm } from '../hooks/useLlm';
import { useCommunicationStyle } from './CommunicationStyleContext';
import type { RoutingPreference } from '../types/llm';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import QuickActions from './QuickActions';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Cloud,
  Monitor,
  Zap,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from 'lucide-react';

/** Message type for local state */
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  backend?: 'local' | 'cloud';
}

/**
 * Status indicator component showing LLM connection state.
 */
function StatusIndicator({ running, error }: { running: boolean; error?: string | null }) {
  return (
    <motion.div
      className="flex items-center gap-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.span
        className={cn(
          'w-2 h-2 rounded-full',
          running
            ? 'bg-success shadow-[0_0_8px_hsl(var(--success)/0.6)]'
            : 'bg-danger shadow-[0_0_8px_hsl(var(--danger)/0.6)]'
        )}
        animate={running ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span className="text-xs text-muted-foreground">
        {running ? 'Connected' : error ? 'Disconnected' : 'Checking...'}
      </span>
    </motion.div>
  );
}

/**
 * Routing mode selector dropdown.
 */
function RoutingModeSelector({
  preference,
  onChange,
  disabled,
}: {
  preference: RoutingPreference;
  onChange: (pref: RoutingPreference) => void;
  disabled?: boolean;
}) {
  const labels: Record<RoutingPreference, string> = {
    auto: 'Auto',
    local: 'Local',
    cloud: 'Claude',
  };

  const descriptions: Record<RoutingPreference, string> = {
    auto: 'Smart routing based on query complexity',
    local: 'Always use local Ollama (free)',
    cloud: 'Always use Claude (costs API credits)',
  };

  const icons: Record<RoutingPreference, React.ReactNode> = {
    auto: <Zap className="w-3.5 h-3.5" strokeWidth={2} />,
    local: <Monitor className="w-3.5 h-3.5" strokeWidth={2} />,
    cloud: <Cloud className="w-3.5 h-3.5" strokeWidth={2} />,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 gap-1.5 text-xs px-2.5 rounded-lg',
            'bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05]',
            'transition-all duration-200'
          )}
        >
          {icons[preference]}
          <span>AI: {labels[preference]}</span>
          <ChevronDown className="w-3 h-3 opacity-50" strokeWidth={2} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 glass-strong border-white/[0.06]">
        {(Object.keys(labels) as RoutingPreference[]).map((pref) => (
          <DropdownMenuItem
            key={pref}
            onClick={() => onChange(pref)}
            className={cn(
              'flex flex-col items-start gap-0.5 py-2.5 cursor-pointer',
              'focus:bg-white/10',
              preference === pref && 'bg-primary/10'
            )}
          >
            <div className="flex items-center gap-2 font-medium text-foreground">
              <span className="text-primary">{icons[pref]}</span>
              {labels[pref]}
            </div>
            <span className="text-xs text-muted-foreground/70">{descriptions[pref]}</span>
            {pref === 'cloud' && (
              <span className="text-[10px] text-warning mt-0.5">Uses API credits</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Error state component when Ollama is not running.
 */
function NotConnectedState({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full p-8 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className={cn(
          'w-16 h-16 flex items-center justify-center rounded-full mb-5',
          'bg-warning/10 border-2 border-warning/30',
          'shadow-[0_0_24px_-4px_hsl(var(--warning)/0.4)]'
        )}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <AlertTriangle className="w-7 h-7 text-warning" strokeWidth={1.75} />
      </motion.div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Ollama Not Running</h3>
      <p className="text-sm text-muted-foreground/70 mb-6 max-w-[260px] leading-relaxed">
        Start Ollama to enable AI features. Make sure the llama3:8b model is installed.
      </p>
      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          onClick={onRetry}
          size="sm"
          className={cn(
            'gap-2 rounded-xl px-5',
            'bg-gradient-to-r from-primary to-accent',
            'shadow-[0_0_16px_-4px_hsl(var(--glow-primary)/0.5)]'
          )}
        >
          <RefreshCw className="w-4 h-4" strokeWidth={2} />
          Check Again
        </Button>
      </motion.div>
    </motion.div>
  );
}

/**
 * Welcome message component shown when chat is empty.
 */
function WelcomeMessage({
  onQuickAction,
  disabled,
}: {
  onQuickAction: (prompt: string, label: string) => void;
  disabled: boolean;
}) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full p-6 text-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div
        className={cn(
          'w-16 h-16 flex items-center justify-center rounded-full mb-5',
          'bg-gradient-to-br from-primary/20 to-accent/20',
          'border-2 border-primary/30',
          'shadow-[0_0_32px_-8px_hsl(var(--glow-primary)/0.5)]'
        )}
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Sparkles className="w-7 h-7 text-primary" strokeWidth={1.5} />
      </motion.div>
      <motion.h3
        className="text-lg font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        AI Assistant
      </motion.h3>
      <motion.p
        className="text-sm text-muted-foreground/70 max-w-[280px] mb-6 leading-relaxed"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Ask me about improving your PC's performance, managing resources, or optimizing settings.
      </motion.p>
      <QuickActions onAction={onQuickAction} disabled={disabled} className="max-w-xl" />
    </motion.div>
  );
}

export interface ChatInterfaceProps {
  /** Optional className for the container */
  className?: string;
}

/**
 * ChatInterface component providing the complete chat UI.
 */
function ChatInterface({ className }: ChatInterfaceProps) {
  const {
    status,
    loading,
    error,
    sendMessage,
    checkStatus,
    chatLoading,
    routingPreference,
    setRoutingPreference,
  } = useLlm();
  const { isVerbose } = useCommunicationStyle();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(0);

  /**
   * Generate system prompt based on communication style preference.
   */
  const systemPrompt = useMemo(() => {
    const basePrompt = `You are Opta, a helpful PC optimization assistant. You provide clear, actionable advice for improving system performance, managing resources, and optimizing settings for gaming and productivity.`;

    const styleInstructions = isVerbose
      ? `

Communication Style: Informative & Educational
- Provide detailed explanations
- Teach the user why each optimization works
- Include technical details when helpful
- Explain the reasoning behind recommendations
- Help users understand their system better`
      : `

Communication Style: Concise & Efficient
- Be concise and direct
- Give short, actionable answers
- Only elaborate if explicitly asked
- Skip lengthy explanations
- Focus on what to do, not why`;

    return basePrompt + styleInstructions + `

General Guidelines:
- Warn about potential risks when relevant
- Focus on Windows/macOS optimizations`;
  }, [isVerbose]);

  /**
   * Generate unique message ID.
   */
  const generateId = useCallback(() => {
    messageIdCounter.current += 1;
    return `msg-${messageIdCounter.current}`;
  }, []);

  /**
   * Scroll to bottom of message list.
   */
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  /**
   * Auto-scroll when messages change or typing state changes.
   */
  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  /**
   * Handle sending a message.
   * Includes communication style in system prompt for consistent responses.
   */
  const handleSend = useCallback(async (content: string) => {
    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      // Get response from LLM with backend info and communication style
      const result = await sendMessage(content, systemPrompt);

      // Add assistant message with backend info
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: result.content,
        backend: result.backend,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      // Add error message from assistant
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  }, [generateId, sendMessage, systemPrompt]);

  /**
   * Handle quick action button click - sends the preset prompt.
   */
  const handleQuickAction = useCallback((prompt: string, _label: string) => {
    handleSend(prompt);
  }, [handleSend]);

  // Show loading state while checking initial status
  if (loading) {
    return (
      <div className={cn('flex flex-col overflow-hidden', className)}>
        {/* Header */}
        <div className="py-3 px-4 border-b border-border/20 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" strokeWidth={1.5} />
              <span className="text-sm font-semibold">AI Assistant</span>
            </div>
            <StatusIndicator running={false} />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            className="flex items-center gap-3 text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Checking Ollama status...
          </motion.div>
        </div>
      </div>
    );
  }

  // Show not connected state if Ollama isn't running
  const isConnected = status?.running ?? false;

  return (
    <div className={cn('flex flex-col overflow-hidden', className)}>
      {/* Header */}
      <motion.div
        className="py-3 px-4 border-b border-border/20 shrink-0"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="w-5 h-5 text-primary" strokeWidth={1.5} />
            </motion.div>
            <span className="text-sm font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              AI Assistant
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isConnected && (
              <RoutingModeSelector
                preference={routingPreference}
                onChange={setRoutingPreference}
                disabled={chatLoading || isTyping}
              />
            )}
            <StatusIndicator running={isConnected} error={error} />
          </div>
        </div>
      </motion.div>

      {/* Content area */}
      {!isConnected ? (
        <div className="flex-1 p-0">
          <NotConnectedState onRetry={checkStatus} />
        </div>
      ) : (
        <>
          {/* Message area */}
          <ScrollArea className="flex-1">
            <div ref={scrollRef} className="p-4 min-h-full">
              <AnimatePresence mode="wait">
                {messages.length === 0 ? (
                  <WelcomeMessage
                    key="welcome"
                    onQuickAction={handleQuickAction}
                    disabled={chatLoading || isTyping}
                  />
                ) : (
                  <motion.div
                    key="messages"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {messages.map((msg) => (
                      <ChatMessage
                        key={msg.id}
                        role={msg.role}
                        content={msg.content}
                        backend={msg.backend}
                      />
                    ))}
                    {isTyping && (
                      <ChatMessage role="assistant" content="" isStreaming={true} />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>

          {/* Input area */}
          <ChatInput
            onSend={handleSend}
            disabled={chatLoading || isTyping}
            placeholder="Ask about PC optimization..."
          />
        </>
      )}
    </div>
  );
}

export default ChatInterface;

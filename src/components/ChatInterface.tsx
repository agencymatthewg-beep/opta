/**
 * ChatInterface container component for AI assistant conversations.
 *
 * Provides the main chat UI with message history, input, and LLM status.
 * Auto-scrolls to bottom on new messages and handles error states gracefully.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLlm } from '../hooks/useLlm';
import ChatMessage from './ChatMessage';
import ChatInput from './ChatInput';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

/** Message type for local state */
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Status indicator component showing LLM connection state.
 */
function StatusIndicator({ running, error }: { running: boolean; error?: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          running ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        )}
      />
      <span className="text-xs text-muted-foreground">
        {running ? 'Connected' : error ? 'Disconnected' : 'Checking...'}
      </span>
    </div>
  );
}

/**
 * AI assistant icon for the header.
 */
function AssistantIcon() {
  return (
    <svg
      className="w-5 h-5 text-primary"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}

/**
 * Error state component when Ollama is not running.
 */
function NotConnectedState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-16 h-16 flex items-center justify-center text-3xl font-bold text-warning bg-warning/10 border-2 border-warning rounded-full mb-4">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Ollama Not Running</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-[250px]">
        Start Ollama to enable AI features. Make sure the llama3:8b model is installed.
      </p>
      <Button onClick={onRetry} size="sm" className="glow-sm">
        Check Again
      </Button>
    </div>
  );
}

/**
 * Welcome message component shown when chat is empty.
 */
function WelcomeMessage() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="w-16 h-16 flex items-center justify-center text-primary bg-primary/10 border-2 border-primary/30 rounded-full mb-4">
        <AssistantIcon />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">AI Assistant</h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">
        Ask me about improving your PC's performance, managing resources, or optimizing settings.
      </p>
    </div>
  );
}

export interface ChatInterfaceProps {
  /** Optional className for the container */
  className?: string;
}

/**
 * ChatInterface component providing the complete chat UI.
 *
 * @example
 * ```tsx
 * <ChatInterface className="h-[500px]" />
 * ```
 */
function ChatInterface({ className }: ChatInterfaceProps) {
  const { status, loading, error, sendMessage, checkStatus, chatLoading } = useLlm();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageIdCounter = useRef(0);

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
      // Get response from LLM
      const response = await sendMessage(content);

      // Add assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: response,
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
  }, [generateId, sendMessage]);

  // Show loading state while checking initial status
  if (loading) {
    return (
      <Card className={cn('flex flex-col overflow-hidden', className)}>
        <CardHeader className="py-3 px-4 border-b border-border/50 shrink-0">
          <CardTitle className="flex items-center justify-between text-sm font-semibold">
            <div className="flex items-center gap-2">
              <AssistantIcon />
              <span>AI Assistant</span>
            </div>
            <StatusIndicator running={false} />
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center p-4">
          <div className="text-sm text-muted-foreground">Checking Ollama status...</div>
        </CardContent>
      </Card>
    );
  }

  // Show not connected state if Ollama isn't running
  const isConnected = status?.running ?? false;

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      {/* Header */}
      <CardHeader className="py-3 px-4 border-b border-border/50 shrink-0">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <div className="flex items-center gap-2">
            <AssistantIcon />
            <span>AI Assistant</span>
          </div>
          <StatusIndicator running={isConnected} error={error} />
        </CardTitle>
      </CardHeader>

      {/* Content area */}
      {!isConnected ? (
        <CardContent className="flex-1 p-0">
          <NotConnectedState onRetry={checkStatus} />
        </CardContent>
      ) : (
        <>
          {/* Message area */}
          <ScrollArea className="flex-1">
            <div ref={scrollRef} className="p-4 min-h-full">
              {messages.length === 0 ? (
                <WelcomeMessage />
              ) : (
                <>
                  {messages.map((msg) => (
                    <ChatMessage
                      key={msg.id}
                      role={msg.role}
                      content={msg.content}
                    />
                  ))}
                  {isTyping && (
                    <ChatMessage role="assistant" content="" isStreaming={true} />
                  )}
                </>
              )}
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
    </Card>
  );
}

export default ChatInterface;

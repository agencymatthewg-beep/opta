import { useEffect, type MutableRefObject } from 'react';
import type { TuiEmitter, TurnStats, PermissionRequest, TuiErrorEvent } from '../adapter.js';
import type { Insight } from '../../core/insights.js';
import type { PermissionDecision } from '../PermissionPrompt.js';
import type { ConnectionState } from '../utils.js';
import type { ActionEventKind, ActionEventStatus } from '../activity.js';
import type { BrowserPendingApprovalItem } from '../BrowserControlOverlay.js';
import type { SubAgentDisplayState, SubAgentProgressEvent } from '../../core/subagent-events.js';
import type { InsightEntry } from '../InsightBlock.js';
import type { ResponseIntentTone } from '../response-intent.js';
import type { TurnActivityItem, TuiMessage } from '../App.js';
import { sanitizeTerminalText, sanitizeTerminalTokenChunk } from '../../utils/text.js';
import { estimateTokens } from '../../utils/tokens.js';
import { extractBrowserSessionId } from '../../browser/approval-log.js';
import { evaluateBrowserPolicyAction } from '../../browser/policy-engine.js';
import {
  deriveResponseIntentOutcome,
  deriveResponseIntentSentence,
} from '../response-intent.js';
import type { DEFAULT_CONFIG } from '../../core/config.js';

/** Helper to normalize error events consistently across structured and string forms. */
function parseStructuredTurnError(message: string): { code?: string; message: string } {
  const match = message.match(/^\[([a-z0-9-]+)\]\s+([\s\S]*)$/i);
  if (!match) return { message };
  return { code: match[1]?.toLowerCase(), message: match[2] ?? '' };
}

function normalizeTurnError(error: TuiErrorEvent): { displayMessage: string; code?: string; message: string } {
  if (typeof error === 'string') {
    const displayMessage = sanitizeTerminalText(error);
    const parsed = parseStructuredTurnError(displayMessage);
    return {
      displayMessage,
      code: parsed.code,
      message: parsed.message,
    };
  }

  const rawMessage = typeof error.message === 'string' && error.message.length > 0
    ? error.message
    : 'Turn failed';
  const displayMessage = sanitizeTerminalText(rawMessage);
  const parsed = parseStructuredTurnError(displayMessage);
  const code = typeof error.code === 'string' && error.code.length > 0
    ? error.code.toLowerCase()
    : parsed.code;
  return {
    displayMessage,
    code,
    message: parsed.message,
  };
}

function isModelNotLoadedError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes('not loaded') && lower.includes('model');
}

function isStructuredModelUnavailableCode(code?: string): boolean {
  return code === 'no-model-loaded';
}

function isStructuredTransportFailureCode(code?: string): boolean {
  return code === 'lmx-ws-closed' || code === 'lmx-timeout' || code === 'lmx-connection-refused';
}

function isTransportFailureError(message: string): boolean {
  if (isModelNotLoadedError(message)) return false;

  const lower = message.toLowerCase();
  const markers = [
    'econnrefused',
    'econnaborted',
    'enotfound',
    'ehostunreach',
    'enetunreach',
    'etimedout',
    'connection refused',
    'connection reset',
    'connection closed',
    'connection timeout',
    'connect timeout',
    'read timeout',
    'network timeout',
    'network error',
    'fetch failed',
    'socket hang up',
    'socket closed',
    'websocket',
    'transport',
    'failed to connect',
    'unable to connect',
  ];

  const patterns = [
    /\bconnection[_\s-]?error\b/,
    /\btimed?\s*out\b/,
    /\btimeout\b/,
  ];

  return markers.some((marker) => lower.includes(marker)) || patterns.some((pattern) => pattern.test(lower));
}

function isBuildErrorFailure(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('cannot find module') ||
    lower.includes('err_module_not_found') ||
    lower.includes('cannot require')
  );
}

export interface UseStreamingEventsOptions {
  emitter: TuiEmitter | null;

  // Refs for accumulating streaming data without re-renders
  currentStreamingTextRef: MutableRefObject<string>;
  liveActivityRef: MutableRefObject<TurnActivityItem[]>;
  thinkingTextRef: MutableRefObject<string>;
  currentTurnPromptRef: MutableRefObject<string>;
  tokenFlushTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  tokenRateWindowRef: MutableRefObject<{ startedAt: number; chars: number }>;
  scrollRef: MutableRefObject<{ scrollToBottom(): void } | null>;

  // State setters for session state
  setIsLoading: (v: boolean) => void;
  setLiveActivity: React.Dispatch<React.SetStateAction<TurnActivityItem[]>>;
  setLiveStreamingText: React.Dispatch<React.SetStateAction<string>>;
  setLiveThinkingText: React.Dispatch<React.SetStateAction<string>>;
  setModelLoaded: (v: boolean) => void;
  setConnectionState: (v: ConnectionState) => void;
  setTurnPhase: (v: 'idle' | 'connecting' | 'waiting' | 'streaming' | 'tool-call' | 'done') => void;
  setToolCallCount: React.Dispatch<React.SetStateAction<number>>;
  setTokens: React.Dispatch<React.SetStateAction<number>>;
  setPromptTokens: React.Dispatch<React.SetStateAction<number>>;
  setCompletionTokens: React.Dispatch<React.SetStateAction<number>>;
  setElapsed: (v: number) => void;
  setSpeed: (v: number) => void;
  setFirstTokenLatency: (v: number | null) => void;
  setTurnSpeed: (v: number) => void;
  setTurnCompletionTokens: (v: number) => void;
  setSessionTitle: (v: string | undefined) => void;
  setMessages: React.Dispatch<React.SetStateAction<TuiMessage[]>>;
  setActiveAgents: React.Dispatch<React.SetStateAction<SubAgentDisplayState[]>>;
  setShowAgentPanel: React.Dispatch<React.SetStateAction<boolean>>;
  /** Tracks the Playwright tool name currently executing for the browser active-state indicator. */
  setActiveBrowserTool: React.Dispatch<React.SetStateAction<string | undefined>>;

  // State setters for UI chrome
  setStreamingLabel: (v: string) => void;
  setStatusActionLabel: (v: string) => void;
  setStatusActionIcon: (v: string) => void;
  setStatusActionStatus: (v: ActionEventStatus) => void;

  // State setters for insights
  setInsights: React.Dispatch<React.SetStateAction<InsightEntry[]>>;
  maxInsights: number;

  // State setters for permissions
  setPermissionPending: React.Dispatch<
    React.SetStateAction<(PermissionRequest & { resolve: (decision: PermissionDecision) => void }) | null>
  >;
  setPendingBrowserApprovals: React.Dispatch<React.SetStateAction<BrowserPendingApprovalItem[]>>;
  setAlwaysMessage: (v: string | null) => void;

  // Callbacks
  flushStreamingTextNow: () => void;
  scheduleTokenFlush: () => void;
  appendAction: (event: {
    kind: ActionEventKind;
    status?: ActionEventStatus;
    icon?: string;
    label: string;
    detail?: string;
  }) => void;
  summarizeToolArgs: (args?: Record<string, unknown>) => string | undefined;

  // Config values read during event handling
  browserPolicyConfig: typeof DEFAULT_CONFIG.browser.policy;
  responseIntentTone: ResponseIntentTone;
}

/**
 * Wires all TuiEmitter event listeners that drive the streaming agent loop
 * display. Attaches on mount (when emitter is present) and tears down on
 * unmount or when dependencies change.
 */
export function useStreamingEvents(options: UseStreamingEventsOptions): void {
  const {
    emitter,
    currentStreamingTextRef,
    liveActivityRef,
    thinkingTextRef,
    currentTurnPromptRef,
    tokenFlushTimerRef,
    tokenRateWindowRef,
    scrollRef,
    setIsLoading,
    setLiveActivity,
    setLiveStreamingText,
    setLiveThinkingText,
    setModelLoaded,
    setConnectionState,
    setTurnPhase,
    setToolCallCount,
    setTokens,
    setPromptTokens,
    setCompletionTokens,
    setElapsed,
    setSpeed,
    setFirstTokenLatency,
    setTurnSpeed,
    setTurnCompletionTokens,
    setSessionTitle,
    setMessages,
    setActiveAgents,
    setShowAgentPanel,
    setActiveBrowserTool,
    setStreamingLabel,
    setStatusActionLabel,
    setStatusActionIcon,
    setStatusActionStatus,
    setInsights,
    maxInsights,
    setPermissionPending,
    setPendingBrowserApprovals,
    setAlwaysMessage,
    flushStreamingTextNow,
    scheduleTokenFlush,
    appendAction,
    summarizeToolArgs,
    browserPolicyConfig,
    responseIntentTone,
  } = options;

  useEffect(() => {
    if (!emitter) return;

    // Track whether first token has been received this turn (for phase transition)
    let firstTokenReceived = false;
    let thinkingAnnounced = false;

    const onToken = (text: string) => {
      const safeText = sanitizeTerminalTokenChunk(text);
      if (!safeText) return;
      if (!firstTokenReceived) {
        firstTokenReceived = true;
        setModelLoaded(true);
        setConnectionState('connected');
        setTurnPhase('streaming');
        setStatusActionLabel('Streaming response');
        setStatusActionIcon('✍️');
        setStatusActionStatus('running');
      }
      currentStreamingTextRef.current += safeText;
      tokenRateWindowRef.current.chars += safeText.length;
      const windowAge = Date.now() - tokenRateWindowRef.current.startedAt;
      if (windowAge >= 500) {
        tokenRateWindowRef.current = { startedAt: Date.now(), chars: safeText.length };
      }

      if (safeText.includes('\n')) {
        flushStreamingTextNow();
      } else {
        scheduleTokenFlush();
      }
    };

    const onToolStart = (name: string, id: string, argsJson: string) => {
      flushStreamingTextNow();
      if (name.startsWith('browser_')) setActiveBrowserTool(name);
      setStreamingLabel(`running ${name}`);
      setTurnPhase('tool-call');
      let parsedArgs: Record<string, unknown> | undefined;
      try {
        parsedArgs = JSON.parse(argsJson) as Record<string, unknown>;
      } catch {
        // args may not be valid JSON
      }
      const item: TurnActivityItem = {
        type: 'tool',
        toolName: name,
        toolId: id,
        toolStatus: 'running',
        toolArgs: parsedArgs,
      };
      liveActivityRef.current = [...liveActivityRef.current, item];
      setLiveActivity([...liveActivityRef.current]);
      appendAction({
        kind: 'tool',
        status: 'running',
        icon: '🛠️',
        label: `Tool started: ${name}`,
        detail: summarizeToolArgs(parsedArgs),
      });
    };

    const onToolEnd = (name: string, id: string, result: string) => {
      flushStreamingTextNow();
      if (name.startsWith('browser_')) setActiveBrowserTool(undefined);
      setStreamingLabel('thinking');
      setTurnPhase('streaming');
      const failed = result.toLowerCase().includes('error') || result.toLowerCase().includes('failed');
      liveActivityRef.current = liveActivityRef.current.map(item =>
        item.type === 'tool' && item.toolId === id
          ? { ...item, toolStatus: failed ? 'error' as const : 'done' as const }
          : item
      );
      setLiveActivity([...liveActivityRef.current]);
      setToolCallCount(prev => prev + 1);
      appendAction({
        kind: 'tool',
        status: failed ? 'error' : 'ok',
        icon: failed ? '❌' : '✅',
        label: `Tool finished: ${name}`,
        detail: failed ? 'reported error' : 'ok',
      });
    };

    const onThinking = (text: string) => {
      const safeText = sanitizeTerminalTokenChunk(text);
      if (!safeText) return;
      thinkingTextRef.current += safeText;
      const nextThinking = thinkingTextRef.current;
      setLiveThinkingText((prev) => (prev === nextThinking ? prev : nextThinking));
      setStreamingLabel('thinking deeply');
      if (!thinkingAnnounced) {
        thinkingAnnounced = true;
        appendAction({
          kind: 'thinking',
          status: 'running',
          icon: '💭',
          label: 'Thinking deeply',
        });
      }
    };

    const onTurnStart = () => {
      setIsLoading(true);
      setActiveBrowserTool(undefined);
      liveActivityRef.current = [];
      setLiveActivity([]);
      currentStreamingTextRef.current = '';
      setLiveStreamingText('');
      thinkingTextRef.current = '';
      setLiveThinkingText('');
      firstTokenReceived = false;
      tokenRateWindowRef.current = { startedAt: Date.now(), chars: 0 };
      if (tokenFlushTimerRef.current) {
        clearTimeout(tokenFlushTimerRef.current);
        tokenFlushTimerRef.current = null;
      }
      setStreamingLabel('thinking');
      setTurnPhase('waiting');
      setFirstTokenLatency(null);
      setTurnCompletionTokens(0);
      setTurnSpeed(0);
      setInsights([]);
      thinkingAnnounced = false;
      appendAction({
        kind: 'turn',
        status: 'running',
        icon: '🧠',
        label: 'Turn started',
      });
    };

    const onTurnEnd = (stats: TurnStats) => {
      setIsLoading(false);
      setModelLoaded(true);
      setConnectionState('connected');
      setTurnPhase('done');
      setTimeout(() => setTurnPhase('idle'), 2000);

      flushStreamingTextNow();

      const finalText = currentStreamingTextRef.current;
      const finalThinking = thinkingTextRef.current;
      const toolsUsed = liveActivityRef.current.filter(a => a.type === 'tool');
      const failedToolCalls = toolsUsed.filter((tool) => tool.toolStatus === 'error').length;
      const completionTok = Math.max(
        stats.completionTokens,
        finalText ? estimateTokens(finalText) : 0,
      );
      const tokensPerSecond = stats.elapsed > 0 ? (completionTok / stats.elapsed) : 0;
      const intentOutcome = deriveResponseIntentOutcome({
        toolCallCount: toolsUsed.length,
        failedToolCallCount: failedToolCalls,
        hasVisibleOutput: finalText.trim().length > 0,
      });
      const promptIntent = deriveResponseIntentSentence({
        promptText: currentTurnPromptRef.current,
        tone: responseIntentTone,
        toolCallCount: toolsUsed.length,
        failedToolCallCount: failedToolCalls,
        hasVisibleOutput: finalText.trim().length > 0,
      });

      // Collapse live state into permanent messages (chronological order):
      // 1. Activity summary line (dim, lists tool calls + elapsed)
      // 2. Assistant response in purple box
      const newMessages: TuiMessage[] = [];

      if (toolsUsed.length > 0) {
        const byTool = new Map<string, { total: number; failed: number }>();
        for (const tool of toolsUsed) {
          const name = tool.toolName ?? 'tool';
          const prev = byTool.get(name) ?? { total: 0, failed: 0 };
          prev.total += 1;
          if (tool.toolStatus === 'error') prev.failed += 1;
          byTool.set(name, prev);
        }
        const parts = [...byTool.entries()].map(([name, info]) =>
          info.failed > 0
            ? `${name}\u00D7${info.total} (${info.failed} failed)`
            : `${name}\u00D7${info.total}`,
        );
        const suffix = failedToolCalls > 0 ? ` \u00B7 ${failedToolCalls} failed` : '';
        newMessages.push({
          role: 'activity-summary',
          content: `\u25C7 ${parts.join(' \u00B7 ')}  ${stats.elapsed.toFixed(1)}s${suffix}`,
        });
      }

      if (finalText || finalThinking) {
        const thinkTokens = finalThinking ? estimateTokens(finalThinking) : 0;
        newMessages.push({
          role: 'assistant',
          content: finalText,
          createdAt: Date.now(),
          responseMeta: {
            elapsedSec: stats.elapsed,
            tokensPerSecond,
            intent: promptIntent,
            intentTone: responseIntentTone,
            intentOutcome,
          },
          ...(finalThinking ? { thinking: { text: finalThinking, tokens: thinkTokens } } : {}),
          ...(toolsUsed.length > 0 ? { toolCalls: toolsUsed.length } : {}),
        });
      }

      if (newMessages.length > 0) {
        setMessages(prev => [...prev, ...newMessages]);
        // Scroll to bottom so new messages are visible
        setTimeout(() => scrollRef.current?.scrollToBottom(), 0);
      }

      // Clear live state
      setLiveActivity([]);
      setLiveStreamingText('');
      setLiveThinkingText('');
      currentStreamingTextRef.current = '';
      liveActivityRef.current = [];
      thinkingTextRef.current = '';
      currentTurnPromptRef.current = '';
      if (tokenFlushTimerRef.current) {
        clearTimeout(tokenFlushTimerRef.current);
        tokenFlushTimerRef.current = null;
      }

      setTokens(prev => prev + stats.tokens);
      setCompletionTokens(prev => prev + stats.completionTokens);
      setPromptTokens(prev => prev + stats.promptTokens);
      setElapsed(stats.elapsed);
      setSpeed(stats.speed);
      if (stats.firstTokenLatencyMs !== null) {
        setFirstTokenLatency(stats.firstTokenLatencyMs);
      }
      appendAction({
        kind: 'turn',
        status: 'ok',
        icon: '✅',
        label: 'Turn completed',
        detail: `${stats.elapsed.toFixed(1)}s \u00B7 ${stats.completionTokens} tok`,
      });
    };

    const onError = (error: TuiErrorEvent) => {
      setIsLoading(false);
      setTurnPhase('idle');
      // Clear any partial live state so it doesn't linger
      setLiveActivity([]);
      setLiveStreamingText('');
      setLiveThinkingText('');
      currentStreamingTextRef.current = '';
      liveActivityRef.current = [];
      thinkingTextRef.current = '';
      currentTurnPromptRef.current = '';
      if (tokenFlushTimerRef.current) {
        clearTimeout(tokenFlushTimerRef.current);
        tokenFlushTimerRef.current = null;
      }
      const normalizedError = normalizeTurnError(error);
      const modelNotLoaded = isStructuredModelUnavailableCode(normalizedError.code)
        || isModelNotLoadedError(normalizedError.message);
      const transportFailure = isStructuredTransportFailureCode(normalizedError.code)
        || isTransportFailureError(normalizedError.message);
      const buildFailure = isBuildErrorFailure(normalizedError.message);
      if (modelNotLoaded || transportFailure || buildFailure) {
        setModelLoaded(false);
      }
      if (modelNotLoaded || transportFailure || buildFailure) {
        setConnectionState('error');
      }
      setMessages(prev => [...prev, { role: 'error', content: normalizedError.displayMessage, createdAt: Date.now() }]);
      appendAction({
        kind: 'error',
        status: 'error',
        icon: '⛔',
        label: 'Turn error',
        detail: normalizedError.displayMessage.slice(0, 120),
      });
    };

    const onTitle = (title: string) => {
      setSessionTitle(title);
    };

    const onInsight = (insight: Insight) => {
      setInsights(prev => {
        const next = [...prev, insight];
        return next.length > maxInsights ? next.slice(-maxInsights) : next;
      });
    };

    const onConnectionStatus = (status: 'checking' | 'connected' | 'disconnected' | 'error' | 'reconnecting') => {
      setConnectionState(status);
      if (status === 'connected') {
        setModelLoaded(true);
      } else if (status === 'disconnected' || status === 'error' || status === 'reconnecting') {
        setModelLoaded(false);
      }
      if (status === 'disconnected' || status === 'error' || status === 'reconnecting') {
        appendAction({
          kind: 'info',
          status: status === 'error' ? 'error' : 'running',
          icon: status === 'error' ? '🚨' : '🔌',
          label: `Connection ${status}`,
        });
      }
    };

    const onFirstToken = (latencyMs: number) => {
      setFirstTokenLatency(latencyMs);
      appendAction({
        kind: 'turn',
        status: 'running',
        icon: '⚡',
        label: 'First token',
        detail: `${latencyMs}ms`,
      });
    };

    const onTurnProgress = (stats: { elapsed: number; speed: number; completionTokens: number }) => {
      setTurnSpeed(stats.speed);
      setTurnCompletionTokens(stats.completionTokens);
    };

    const onPermissionRequest = (request: PermissionRequest) => {
      flushStreamingTextNow();
      const isBrowserPermission = request.toolName.startsWith('browser_');
      const browserDecision = isBrowserPermission
        ? evaluateBrowserPolicyAction(browserPolicyConfig, {
          toolName: request.toolName,
          args: request.args,
        })
        : null;
      const requestedAt = new Date().toISOString();

      if (browserDecision) {
        const pendingItem: BrowserPendingApprovalItem = {
          requestId: request.id,
          toolName: request.toolName,
          sessionId: extractBrowserSessionId(request.args),
          requestedAt,
          risk: browserDecision.risk,
          actionKey: browserDecision.actionKey,
          targetHost: browserDecision.targetHost,
          targetOrigin: browserDecision.targetOrigin,
          policyReason: browserDecision.reason,
          riskEvidence: browserDecision.riskEvidence,
        };
        setPendingBrowserApprovals((prev) => [
          ...prev.filter((entry) => entry.requestId !== request.id),
          pendingItem,
        ]);
      }

      // Create a Promise-based bridge: the resolve function is stored in state
      // so the PermissionPrompt component can call it when the user decides.
      setPermissionPending({
        ...request,
        resolve: (decision: PermissionDecision) => {
          // Send the response back to the adapter (which unblocks the agent loop)
          emitter.emit('permission:response', request.id, decision);
          setPermissionPending(null);
          setPendingBrowserApprovals((prev) =>
            prev.filter((entry) => entry.requestId !== request.id),
          );

          // If "always" was chosen, persist the permission and show confirmation
          if (decision === 'always') {
            setAlwaysMessage(`${request.toolName} set to always allow`);
            // Clear the confirmation after 3 seconds
            setTimeout(() => setAlwaysMessage(null), 3000);
            // Persist to config asynchronously
            import('../../core/config.js').then(({ saveConfig }) => {
              saveConfig({ [`permissions.${request.toolName}`]: 'allow' }).catch(() => {
                // Config save failed — non-fatal
              });
            }).catch(() => {});
          }
        },
      });
      appendAction({
        kind: 'permission',
        status: 'running',
        icon: '🔐',
        label: `Permission requested: ${request.toolName}${browserDecision ? ` (${browserDecision.risk})` : ''}`,
      });
    };

    const onSubAgentSpawn = (state: SubAgentDisplayState) => {
      setActiveAgents(prev => [...prev.filter(a => a.id !== state.id), state]);
      setShowAgentPanel(true);
    };

    const onSubAgentProgress = (event: SubAgentProgressEvent) => {
      setActiveAgents(prev => prev.map(a =>
        a.id === event.agentId
          ? {
              ...a,
              phase: event.phase,
              currentTool: event.toolName,
              toolCallCount: event.toolCallCount,
              toolHistory: [...(a.toolHistory ?? []).slice(-4), ...(event.toolName ? [event.toolName] : [])],
            }
          : a
      ));
    };

    const onSubAgentDone = (agentId: string, result: string) => {
      setActiveAgents(prev => prev.map(a => a.id === agentId ? { ...a, phase: 'done' as const, result } : a));
      setTimeout(() => {
        setActiveAgents(prev => {
          const remaining = prev.filter(a => a.id !== agentId);
          if (remaining.length === 0) setShowAgentPanel(false);
          return remaining;
        });
      }, 3000);
    };

    emitter.on('token', onToken);
    emitter.on('tool:start', onToolStart);
    emitter.on('tool:end', onToolEnd);
    emitter.on('thinking', onThinking);
    emitter.on('turn:start', onTurnStart);
    emitter.on('turn:end', onTurnEnd);
    emitter.on('turn:first-token', onFirstToken);
    emitter.on('turn:progress', onTurnProgress);
    emitter.on('connection:status', onConnectionStatus);
    emitter.on('error', onError);
    emitter.on('permission:request', onPermissionRequest);
    emitter.on('title', onTitle);
    emitter.on('insight', onInsight);
    emitter.on('subagent:spawn', onSubAgentSpawn);
    emitter.on('subagent:progress', onSubAgentProgress);
    emitter.on('subagent:done', onSubAgentDone);

    return () => {
      emitter.off('token', onToken);
      emitter.off('tool:start', onToolStart);
      emitter.off('tool:end', onToolEnd);
      emitter.off('thinking', onThinking);
      emitter.off('turn:start', onTurnStart);
      emitter.off('turn:end', onTurnEnd);
      emitter.off('turn:first-token', onFirstToken);
      emitter.off('turn:progress', onTurnProgress);
      emitter.off('connection:status', onConnectionStatus);
      emitter.off('error', onError);
      emitter.off('permission:request', onPermissionRequest);
      emitter.off('title', onTitle);
      emitter.off('insight', onInsight);
      emitter.off('subagent:spawn', onSubAgentSpawn);
      emitter.off('subagent:progress', onSubAgentProgress);
      emitter.off('subagent:done', onSubAgentDone);
    };
  }, [emitter, flushStreamingTextNow, scheduleTokenFlush, appendAction, summarizeToolArgs, browserPolicyConfig, responseIntentTone, setActiveAgents, setActiveBrowserTool]);
}

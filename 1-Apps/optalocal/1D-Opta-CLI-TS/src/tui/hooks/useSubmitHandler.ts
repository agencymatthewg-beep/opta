import { useCallback, useEffect, useRef } from 'react';
import type { TuiMessage, WorkflowMode, SlashCommandResult } from '../App.js';
import type { ResponseIntentTone } from '../response-intent.js';
import type { TriggerModeDefinition } from '../trigger-router.js';
import type { ActiveOverlay } from './useOverlayManager.js';
import type { OptaMenuResultEntry } from '../OptaMenuOverlay.js';
import type { ActionEventKind, ActionEventStatus } from '../activity.js';
import { deriveResponseIntentOutcome, deriveResponseIntentSentence } from '../response-intent.js';
import { resolveTriggerRouting } from '../trigger-router.js';
import { SkillRuntime } from '../skill-runtime.js';
import { sanitizeTerminalText, trimDisplayTail } from '../../utils/text.js';
import { errorMessage } from '../../utils/errors.js';
import { estimateTokens } from '../../utils/tokens.js';

export interface SubmitResult {
  ok: boolean;
  kind: 'noop' | 'slash' | 'shell' | 'prompt';
  command?: string;
  summary: string;
  output?: string;
  error?: string;
}

interface SkillRuntimeSettings {
  dynamicLoading: boolean;
  unloadInactive: boolean;
  ttlMinutes: number;
  maxActiveSkills: number;
}

const MAX_OPTA_MENU_RESULTS = 32;

export interface UseSubmitHandlerOptions {
  appendAction: (event: {
    kind: ActionEventKind;
    status?: ActionEventStatus;
    icon?: string;
    label: string;
    detail?: string;
  }) => void;
  exit: () => void;
  isStreamingMode: boolean;
  modelLoaded: boolean;
  onMessage?: (text: string) => Promise<string>;
  onModeChange?: (mode: WorkflowMode) => void;
  onSlashCommand?: (input: string) => Promise<SlashCommandResult>;
  onSubmit?: (text: string) => void;
  requireLoadedModel: boolean;
  setWorkflowMode: React.Dispatch<React.SetStateAction<WorkflowMode>>;
  skillRuntimeSettings: SkillRuntimeSettings;
  triggerDefinitions: TriggerModeDefinition[];
  workflowMode: WorkflowMode;
  responseIntentTone: ResponseIntentTone;
  setActiveOverlay: (overlay: ActiveOverlay) => void;
  setMessages: React.Dispatch<React.SetStateAction<TuiMessage[]>>;
  setCurrentModel: (model: string) => void;
  setAutonomyLevel: (level: number) => void;
  setAutonomyMode: (mode: 'execution' | 'ceo') => void;
  setIsLoading: (loading: boolean) => void;
  setTurnPhase: (phase: 'done' | 'idle' | 'connecting' | 'waiting' | 'streaming' | 'tool-call') => void;
  setElapsed: (elapsed: number) => void;
  currentTurnPromptRef: React.MutableRefObject<string>;
  setOptaMenuResults: React.Dispatch<React.SetStateAction<OptaMenuResultEntry[]>>;
  emitter: unknown;
}

export interface UseSubmitHandlerReturn {
  handleSubmit: (text: string) => Promise<SubmitResult>;
  handleOptaMenuRunCommand: (command: string) => Promise<void>;
  upsertOptaMenuResult: (entry: OptaMenuResultEntry) => void;
}

export function useSubmitHandler(options: UseSubmitHandlerOptions): UseSubmitHandlerReturn {
  const {
    appendAction,
    exit,
    isStreamingMode,
    modelLoaded,
    onMessage,
    onModeChange,
    onSlashCommand,
    onSubmit,
    requireLoadedModel,
    setWorkflowMode,
    skillRuntimeSettings,
    triggerDefinitions,
    workflowMode,
    responseIntentTone,
    setActiveOverlay,
    setMessages,
    setCurrentModel,
    setAutonomyLevel,
    setAutonomyMode,
    setIsLoading,
    setTurnPhase,
    setElapsed,
    currentTurnPromptRef,
    setOptaMenuResults,
    emitter,
  } = options;

  const lastBrowserSessionIdRef = useRef<string | null>(null);
  const skillRuntimeRef = useRef<SkillRuntime>(new SkillRuntime());
  const optaMenuResultCounterRef = useRef(0);

  // Connection check on mount
  useEffect(() => {
    if (!emitter) return;
    import('../adapter.js').then(({ checkConnection: check }) => {
      void check;
    }).catch(() => {});
  }, [emitter]);

  const handleSubmit = useCallback(async (text: string): Promise<SubmitResult> => {
    const trimmed = text.trim();

    // Bare `/` opens the TUI command browser overlay instead of the inquirer-based browser
    if (trimmed === '/') {
      setActiveOverlay('command-browser');
      appendAction({ kind: 'slash', status: 'info', icon: '\u{1F9E9}', label: 'Opened Command Browser' });
      return {
        ok: true,
        kind: 'noop',
        summary: 'Opened command browser',
      };
    }

    // Route slash commands through the registry
    if (trimmed.startsWith('/')) {
      appendAction({ kind: 'slash', status: 'running', icon: '\u{1F9E9}', label: `Slash command: ${trimmed}` });
      if (onSlashCommand) {
        try {
          const cmdResult = await onSlashCommand(trimmed);

          // Show captured output as a system message
          const displayOutput = trimDisplayTail(sanitizeTerminalText(cmdResult.output));
          if (displayOutput.length > 0) {
            setMessages(prev => [...prev, { role: 'system', content: displayOutput, createdAt: Date.now() }]);
          }

          if (cmdResult.result === 'exit') {
            exit();
            return {
              ok: true,
              kind: 'slash',
              command: trimmed,
              summary: `Slash complete: ${trimmed}`,
              output: displayOutput,
            };
          }
          if (cmdResult.result === 'model-switched' && cmdResult.newModel) {
            setCurrentModel(cmdResult.newModel);
            appendAction({
              kind: 'model',
              status: 'ok',
              icon: '\u{1F9EC}',
              label: 'Model switched',
              detail: cmdResult.newModel,
            });
          }

          try {
            const { loadConfig } = await import('../../core/config.js');
            const refreshed = await loadConfig();
            setAutonomyLevel(refreshed.autonomy.level);
            setAutonomyMode(refreshed.autonomy.mode);
          } catch {
            // Non-fatal: keep current UI state if config refresh fails.
          }

          appendAction({ kind: 'slash', status: 'ok', icon: '\u2705', label: `Slash complete: ${trimmed}` });
          return {
            ok: true,
            kind: 'slash',
            command: trimmed,
            summary: `Slash complete: ${trimmed}`,
            output: displayOutput,
          };
        } catch {
          setMessages(prev => [...prev, { role: 'error', content: `Slash command failed: ${trimmed}`, createdAt: Date.now() }]);
          appendAction({ kind: 'slash', status: 'error', icon: '\u274C', label: `Slash failed: ${trimmed}` });
          return {
            ok: false,
            kind: 'slash',
            command: trimmed,
            summary: `Slash failed: ${trimmed}`,
            error: `Slash command failed: ${trimmed}`,
          };
        }
      }

      // Fallback: handle /exit and /quit directly if no onSlashCommand callback
      if (trimmed === '/exit' || trimmed === '/quit') {
        exit();
        return {
          ok: true,
          kind: 'slash',
          command: trimmed,
          summary: `Slash complete: ${trimmed}`,
        };
      }
    }

    // Shell command execution: !command runs asynchronously to avoid blocking TUI rendering.
    if (trimmed.startsWith('!')) {
      const cmd = trimmed.slice(1).trim();
      if (!cmd) {
        return {
          ok: true,
          kind: 'noop',
          command: trimmed,
          summary: 'Skipped empty shell command',
        };
      }
      appendAction({ kind: 'tool', status: 'running', icon: '\u{1F4BB}', label: `Shell: ${cmd}` });

      setMessages(prev => [...prev, { role: 'user', content: trimmed, createdAt: Date.now() }]);

      try {
        const { execa } = await import('execa');
        const proc = await execa('sh', ['-c', cmd], {
          cwd: process.cwd(),
          timeout: 30000,
          reject: false,
        });
        const parts: string[] = [`$ ${cmd}`];
        if (proc.stdout?.trim()) parts.push(proc.stdout.trim());
        if (proc.stderr?.trim()) parts.push(`[stderr] ${proc.stderr.trim()}`);
        parts.push(proc.exitCode === 0 ? '\u2714 exit 0' : `\u2718 exit ${proc.exitCode}`);
        const result = parts.join('\n');
        setMessages(prev => [...prev, { role: 'system', content: sanitizeTerminalText(result), createdAt: Date.now() }]);
        const ok = proc.exitCode === 0;
        appendAction({ kind: 'tool', status: ok ? 'ok' : 'error', icon: ok ? '\u2705' : '\u274C', label: `Shell finished: ${cmd}` });
        return {
          ok,
          kind: 'shell',
          command: trimmed,
          summary: ok ? `Shell finished: ${cmd}` : `Shell failed: ${cmd}`,
          output: sanitizeTerminalText(result),
        };
      } catch (err: unknown) {
        const e = err as { status?: number; stderr?: string; stdout?: string };
        const parts: string[] = [`$ ${cmd}`];
        if (e.stdout) parts.push(e.stdout.trim());
        if (e.stderr) parts.push(e.stderr.trim());
        parts.push(`\u2718 exit ${e.status ?? 1}`);
        const errorOutput = sanitizeTerminalText(parts.join('\n'));
        setMessages(prev => [...prev, { role: 'error', content: errorOutput, createdAt: Date.now() }]);
        appendAction({ kind: 'tool', status: 'error', icon: '\u274C', label: `Shell failed: ${cmd}` });
        return {
          ok: false,
          kind: 'shell',
          command: trimmed,
          summary: `Shell failed: ${cmd}`,
          output: errorOutput,
          error: `Shell failed: ${cmd}`,
        };
      }
    }

    if (requireLoadedModel && !modelLoaded) {
      const note = 'No Model Loaded - Use Opta Menu to begin (Shift+Space \u2192 Model Manager).';
      setMessages(prev => [...prev, { role: 'error', content: note, createdAt: Date.now() }]);
      appendAction({
        kind: 'error',
        status: 'error',
        icon: '\u{1F6D1}',
        label: 'Blocked prompt',
        detail: 'model not loaded',
      });
      return {
        ok: false,
        kind: 'prompt',
        summary: 'Prompt blocked: model not loaded',
        error: note,
      };
    }

    const routing = resolveTriggerRouting({
      prompt: text,
      currentMode: workflowMode,
      definitions: triggerDefinitions,
    });
    const effectiveMode = routing.effectiveMode;

    if (effectiveMode !== workflowMode) {
      setWorkflowMode(effectiveMode);
      onModeChange?.(effectiveMode);
      appendAction({
        kind: 'info',
        status: 'info',
        icon: '\u{1F9ED}',
        label: `Mode auto-shifted to ${effectiveMode}`,
        detail: `triggered by ${routing.matchedWords.join(', ')}`,
      });
    }

    const skillSync = skillRuntimeSettings.dynamicLoading
      ? skillRuntimeRef.current.reconcile(routing.requestedSkills, {
          unloadInactive: skillRuntimeSettings.unloadInactive,
          ttlMs: skillRuntimeSettings.ttlMinutes * 60_000,
          maxActiveSkills: skillRuntimeSettings.maxActiveSkills,
        })
      : skillRuntimeRef.current.reconcile(routing.requestedSkills, {
          unloadInactive: false,
          ttlMs: skillRuntimeSettings.ttlMinutes * 60_000,
          maxActiveSkills: skillRuntimeSettings.maxActiveSkills,
        });

    if (skillSync.loaded.length > 0 || skillSync.unloaded.length > 0 || skillSync.expired.length > 0) {
      const segments: string[] = [];
      if (skillSync.loaded.length > 0) segments.push(`+${skillSync.loaded.length} loaded`);
      if (skillSync.unloaded.length > 0) segments.push(`-${skillSync.unloaded.length} unloaded`);
      if (skillSync.expired.length > 0) segments.push(`${skillSync.expired.length} expired`);
      appendAction({
        kind: 'info',
        status: 'info',
        icon: '\u{1F9F0}',
        label: 'Skill runtime updated',
        detail: segments.join(' \u00B7 '),
      });
    }

    // Check for @image references and show indicator
    const imagePattern = /@\S+\.(png|jpg|jpeg|gif|webp)/gi;
    const imageMatches = [...text.matchAll(imagePattern)];
    const hasImages = imageMatches.length > 0;
    currentTurnPromptRef.current = text;
    let outboundText = text;
    let triggerRouterStatusMessage: TuiMessage | null = null;
    let browserTriggerStatusMessage: TuiMessage | null = null;
    const activeSkills = skillSync.activeSkills;

    if (routing.matchedWords.length > 0) {
      const matched = routing.matchedWords.join(', ');
      const capabilitySummary = routing.requestedCapabilities.length > 0
        ? routing.requestedCapabilities.join(', ')
        : 'none';
      const skillSummary = activeSkills.length > 0
        ? activeSkills.join(', ')
        : 'none';

      triggerRouterStatusMessage = {
        role: 'system',
        content: `Trigger stack matched: ${matched}. Effective mode: ${effectiveMode}. Capabilities: ${capabilitySummary}. Active skills: ${skillSummary}.`,
        createdAt: Date.now(),
      };

      outboundText = `${outboundText}\n\n[System: Trigger router resolved mode "${effectiveMode}". Matched triggers: ${matched}. Active capabilities: ${capabilitySummary}. Active skills: ${skillSummary}.]`;
    }

    const browserCapabilityRequested = routing.requestedCapabilities.includes('browser');
    if (browserCapabilityRequested) {
      try {
        const [{ loadConfig }, { ensureBrowserSessionForTriggeredPrompt }] = await Promise.all([
          import('../../core/config.js'),
          import('../../browser/trigger-session.js'),
        ]);
        const config = await loadConfig();
        const ensured = await ensureBrowserSessionForTriggeredPrompt({
          prompt: text,
          config,
          preferredSessionId: lastBrowserSessionIdRef.current ?? undefined,
        });

        if (ensured.triggered && ensured.ok && ensured.sessionId) {
          lastBrowserSessionIdRef.current = ensured.sessionId;
          const sessionMode = ensured.mode ?? config.browser.mode;
          const actionLabel = ensured.reused
            ? `Reusing Opta Browser session ${ensured.sessionId}`
            : `Started Opta Browser session ${ensured.sessionId}`;
          appendAction({
            kind: 'tool',
            status: 'ok',
            icon: '\u{1F310}',
            label: actionLabel,
            detail: `mode=${sessionMode}`,
          });
          browserTriggerStatusMessage = {
            role: 'system',
            content: ensured.reused
              ? `Browser trigger detected: continuing active Opta Browser session ${ensured.sessionId} (${sessionMode}).`
              : `Browser trigger detected: started active Opta Browser session ${ensured.sessionId} (${sessionMode}).`,
            createdAt: Date.now(),
          };
          outboundText = `${outboundText}\n\n[System: Browser trigger is active. Use browser session_id "${ensured.sessionId}" for browser_navigate/browser_click/browser_type/browser_snapshot/browser_screenshot. A visible Opta Browser session is already active.]`;
        } else if (ensured.triggered && !ensured.ok) {
          appendAction({
            kind: 'tool',
            status: 'error',
            icon: '\u26A0\uFE0F',
            label: 'Browser trigger preflight failed',
            detail: ensured.message.slice(0, 100),
          });
          browserTriggerStatusMessage = {
            role: 'error',
            content: ensured.message,
            createdAt: Date.now(),
          };
        }
      } catch (err) {
        const message = `Browser trigger preflight failed: ${sanitizeTerminalText(errorMessage(err))}`;
        appendAction({
          kind: 'tool',
          status: 'error',
          icon: '\u26A0\uFE0F',
          label: 'Browser trigger preflight failed',
          detail: message.slice(0, 100),
        });
        browserTriggerStatusMessage = {
          role: 'error',
          content: message,
          createdAt: Date.now(),
        };
      }
    }

    setMessages((prev) => {
      const next = [...prev, {
        role: 'user',
        content: text,
        createdAt: Date.now(),
        ...(hasImages ? { imageCount: imageMatches.length } : {}),
      } as TuiMessage];
      if (triggerRouterStatusMessage) {
        next.push(triggerRouterStatusMessage);
      }
      if (browserTriggerStatusMessage) {
        next.push(browserTriggerStatusMessage);
      }
      return next;
    });

    if (isStreamingMode && onSubmit) {
      // Streaming mode: emitter events will update messages
      setIsLoading(true);
      setTurnPhase('waiting');
      onSubmit(outboundText);
    } else if (onMessage) {
      // Legacy mode: wait for full response
      setIsLoading(true);
      const startTime = Date.now();
      const response = await onMessage(outboundText);
      const elapsedSec = (Date.now() - startTime) / 1000;
      const safeResponse = sanitizeTerminalText(response);
      const respCompletionTokens = estimateTokens(safeResponse);
      const tokensPerSecond = elapsedSec > 0 ? (respCompletionTokens / elapsedSec) : 0;
      const intentOutcome = deriveResponseIntentOutcome({
        toolCallCount: 0,
        failedToolCallCount: 0,
        hasVisibleOutput: safeResponse.trim().length > 0,
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: safeResponse,
        createdAt: Date.now(),
        responseMeta: {
          elapsedSec,
          tokensPerSecond,
          intent: deriveResponseIntentSentence({
            promptText: currentTurnPromptRef.current || text,
            tone: responseIntentTone,
            toolCallCount: 0,
            failedToolCallCount: 0,
            hasVisibleOutput: safeResponse.trim().length > 0,
          }),
          intentTone: responseIntentTone,
          intentOutcome,
        },
      }]);
      currentTurnPromptRef.current = '';
      setElapsed(elapsedSec);
      setIsLoading(false);
    }
    return {
      ok: true,
      kind: 'prompt',
      summary: 'Prompt submitted',
    };
  }, [
    appendAction,
    exit,
    isStreamingMode,
    modelLoaded,
    onMessage,
    onModeChange,
    onSlashCommand,
    onSubmit,
    requireLoadedModel,
    setWorkflowMode,
    skillRuntimeSettings,
    triggerDefinitions,
    workflowMode,
    responseIntentTone,
  ]);

  const upsertOptaMenuResult = useCallback((entry: OptaMenuResultEntry) => {
    setOptaMenuResults((prev) => {
      const next = [entry, ...prev.filter((item) => item.id !== entry.id)];
      next.sort((a, b) => b.at - a.at);
      return next.slice(0, MAX_OPTA_MENU_RESULTS);
    });
  }, [setOptaMenuResults]);

  const handleOptaMenuRunCommand = useCallback(async (command: string) => {
    const compactCommand = command.replace(/\s+/g, ' ').trim();
    const resultId = `menu-${Date.now()}-${++optaMenuResultCounterRef.current}`;
    upsertOptaMenuResult({
      id: resultId,
      at: Date.now(),
      command,
      status: 'running',
      summary: `Running ${compactCommand.slice(0, 48)}`,
    });

    const result = await handleSubmit(command);
    const normalizedOutput = result.output
      ? trimDisplayTail(sanitizeTerminalText(result.output))
      : '';
    const firstOutputLine = normalizedOutput
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    const summaryBase = result.summary.replace(/\s+/g, ' ').trim();
    const outputSuffix = firstOutputLine ? ` \u00B7 ${firstOutputLine}` : '';
    const summary = `${summaryBase}${outputSuffix}`.slice(0, 120);

    upsertOptaMenuResult({
      id: resultId,
      at: Date.now(),
      command,
      status: result.ok ? 'ok' : 'error',
      summary,
      outputSnippet: normalizedOutput ? normalizedOutput.slice(0, 900) : undefined,
    });
  }, [handleSubmit, upsertOptaMenuResult]);

  return {
    handleSubmit,
    handleOptaMenuRunCommand,
    upsertOptaMenuResult,
  };
}

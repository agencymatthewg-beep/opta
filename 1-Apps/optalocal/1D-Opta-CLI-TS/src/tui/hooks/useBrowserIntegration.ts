/**
 * useBrowserIntegration — Extracted from App.tsx.
 *
 * Encapsulates all browser control surface callbacks (start/pause/resume/stop/kill/status),
 * profile pruning, replay session selection and loading, and the auto-refresh effects
 * that fire when the browser-control overlay opens or when health is unknown.
 */

import { useCallback, useEffect, useMemo } from 'react';
import type { BrowserControlAction } from '../../browser/control-surface.js';
import type { UseBrowserStateReturn } from './useBrowserState.js';
import type { ActionEventKind, ActionEventStatus } from '../activity.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal action descriptor accepted by the appendAction helper in App. */
export interface AppendActionEvent {
  kind: ActionEventKind;
  status?: ActionEventStatus;
  icon?: string;
  label: string;
  detail?: string;
}

export interface UseBrowserIntegrationOptions {
  browserControlPane: UseBrowserStateReturn['browserControlPane'];
  setBrowserControlPane: UseBrowserStateReturn['setBrowserControlPane'];
  browserReplayPane: UseBrowserStateReturn['browserReplayPane'];
  setBrowserReplayPane: UseBrowserStateReturn['setBrowserReplayPane'];
  activeOverlay: string;
  appendAction: (action: AppendActionEvent) => void;
}

export interface UseBrowserIntegrationReturn {
  runBrowserControlPaneAction: (action: BrowserControlAction) => Promise<void>;
  pruneBrowserControlProfiles: () => Promise<void>;
  refreshBrowserControlPane: () => Promise<void>;
  browserReplaySessionIds: string[];
  handleReplaySelectSession: (sessionId: string) => void;
  handleReplaySelectStep: (index: number) => void;
  handleReplaySelectDiff: (index: number) => void;
  handleReplayLoadSession: (sessionId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useBrowserIntegration({
  browserControlPane,
  setBrowserControlPane,
  browserReplayPane,
  setBrowserReplayPane,
  activeOverlay,
  appendAction,
}: UseBrowserIntegrationOptions): UseBrowserIntegrationReturn {
  // ------------------------------------------------------------------
  // runBrowserControlPaneAction
  // ------------------------------------------------------------------

  const runBrowserControlPaneAction = useCallback(
    async (action: BrowserControlAction) => {
      const runningLabel =
        action === 'status'
          ? 'Refreshing browser runtime status...'
          : `Running browser ${action}...`;
      setBrowserControlPane((prev) => ({
        ...prev,
        loading: true,
        message: runningLabel,
        messageStatus: 'running',
        lastAction: action,
      }));

      try {
        const [
          { loadConfig },
          { runBrowserControlAction },
          { readRecentBrowserApprovalEvents },
          { listBrowserProfileDirs, resolveBrowserProfileRetentionPolicy },
        ] = await Promise.all([
          import('../../core/config.js'),
          import('../../browser/control-surface.js'),
          import('../../browser/approval-log.js'),
          import('../../browser/profile-store.js'),
        ]);

        const config = await loadConfig();
        const profilePolicy = resolveBrowserProfileRetentionPolicy({
          retentionDays: config.browser.runtime.profileRetentionDays,
          maxPersistedProfiles: config.browser.runtime.maxPersistedProfiles,
        });
        const [result, approvals, profiles] = await Promise.all([
          runBrowserControlAction(action, config),
          readRecentBrowserApprovalEvents(process.cwd(), 6),
          listBrowserProfileDirs(process.cwd()),
        ]);

        setBrowserControlPane({
          loading: false,
          health: result.health,
          approvals,
          message: result.message,
          messageStatus: result.ok ? 'ok' : 'error',
          lastAction: action,
          profileRetentionDays: profilePolicy.retentionDays,
          profileMaxPersistedProfiles: profilePolicy.maxPersistedProfiles,
          profilePersistedCount: profiles.length,
        });

        if (action !== 'status' || !result.ok) {
          appendAction({
            kind: 'tool',
            status: result.ok ? 'ok' : 'error',
            icon: result.ok ? '🌐' : '⛔',
            label: `Browser ${action}`,
            detail: result.message,
          });
        }
      } catch (err) {
        const { sanitizeTerminalText } = await import('../../utils/text.js');
        const { errorMessage } = await import('../../utils/errors.js');
        const message = sanitizeTerminalText(errorMessage(err));
        setBrowserControlPane((prev) => ({
          ...prev,
          loading: false,
          message: `Browser control failed: ${message}`,
          messageStatus: 'error',
        }));
        appendAction({
          kind: 'error',
          status: 'error',
          icon: '⛔',
          label: 'Browser control failed',
          detail: message.slice(0, 120),
        });
      }
    },
    [appendAction, setBrowserControlPane],
  );

  // ------------------------------------------------------------------
  // pruneBrowserControlProfiles
  // ------------------------------------------------------------------

  const pruneBrowserControlProfiles = useCallback(async () => {
    setBrowserControlPane((prev) => ({
      ...prev,
      loading: true,
      message: 'Pruning persisted browser profiles...',
      messageStatus: 'running',
    }));

    try {
      const [
        { loadConfig },
        { runBrowserControlAction },
        { readRecentBrowserApprovalEvents },
        {
          listBrowserProfileDirs,
          pruneBrowserProfileDirs,
          resolveBrowserProfileRetentionPolicy,
        },
      ] = await Promise.all([
        import('../../core/config.js'),
        import('../../browser/control-surface.js'),
        import('../../browser/approval-log.js'),
        import('../../browser/profile-store.js'),
      ]);

      const config = await loadConfig();
      const policy = resolveBrowserProfileRetentionPolicy({
        retentionDays: config.browser.runtime.profileRetentionDays,
        maxPersistedProfiles: config.browser.runtime.maxPersistedProfiles,
      });
      const pruneResult = await pruneBrowserProfileDirs({
        cwd: process.cwd(),
        policy,
      });
      const [statusResult, approvals, profiles] = await Promise.all([
        runBrowserControlAction('status', config),
        readRecentBrowserApprovalEvents(process.cwd(), 6),
        listBrowserProfileDirs(process.cwd()),
      ]);

      const prunedLabel = pruneResult.pruned.length === 1 ? 'profile' : 'profiles';
      const message =
        pruneResult.pruned.length > 0
          ? `Pruned ${pruneResult.pruned.length} ${prunedLabel}; kept ${pruneResult.kept.length}.`
          : 'No browser profiles matched the prune policy.';

      setBrowserControlPane({
        loading: false,
        health: statusResult.health,
        approvals,
        message,
        messageStatus: pruneResult.pruned.length > 0 ? 'ok' : 'info',
        lastAction: 'status',
        profileRetentionDays: policy.retentionDays,
        profileMaxPersistedProfiles: policy.maxPersistedProfiles,
        profilePersistedCount: profiles.length,
      });

      appendAction({
        kind: 'tool',
        status: pruneResult.pruned.length > 0 ? 'ok' : 'info',
        icon: '🧹',
        label: 'Browser profiles prune',
        detail: `${pruneResult.pruned.length} pruned · ${pruneResult.kept.length} kept`,
      });
    } catch (err) {
      const { sanitizeTerminalText } = await import('../../utils/text.js');
      const { errorMessage } = await import('../../utils/errors.js');
      const message = sanitizeTerminalText(errorMessage(err));
      setBrowserControlPane((prev) => ({
        ...prev,
        loading: false,
        message: `Browser profile prune failed: ${message}`,
        messageStatus: 'error',
      }));
      appendAction({
        kind: 'error',
        status: 'error',
        icon: '⛔',
        label: 'Browser profile prune failed',
        detail: message.slice(0, 120),
      });
    }
  }, [appendAction, setBrowserControlPane]);

  // ------------------------------------------------------------------
  // refreshBrowserControlPane
  // ------------------------------------------------------------------

  const refreshBrowserControlPane = useCallback(async () => {
    await runBrowserControlPaneAction('status');
  }, [runBrowserControlPaneAction]);

  // ------------------------------------------------------------------
  // Browser replay session IDs (derived from pane state)
  // ------------------------------------------------------------------

  const browserReplaySessionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const session of browserControlPane.health?.sessions ?? []) {
      if (session.sessionId) ids.add(session.sessionId);
    }
    for (const approval of browserControlPane.approvals) {
      if (approval.sessionId) ids.add(approval.sessionId);
    }
    if (browserReplayPane.selectedSessionId) ids.add(browserReplayPane.selectedSessionId);
    if (browserReplayPane.metadata?.sessionId) ids.add(browserReplayPane.metadata.sessionId);
    return [...ids].sort((left, right) => left.localeCompare(right));
  }, [
    browserControlPane.approvals,
    browserControlPane.health,
    browserReplayPane.metadata?.sessionId,
    browserReplayPane.selectedSessionId,
  ]);

  // ------------------------------------------------------------------
  // Replay callbacks
  // ------------------------------------------------------------------

  const handleReplaySelectSession = useCallback(
    (sessionId: string) => {
      setBrowserReplayPane((prev) =>
        prev.selectedSessionId === sessionId
          ? prev
          : {
              ...prev,
              selectedSessionId: sessionId,
            },
      );
    },
    [setBrowserReplayPane],
  );

  const handleReplaySelectStep = useCallback(
    (index: number) => {
      setBrowserReplayPane((prev) => {
        const maxIndex = Math.max(prev.steps.length - 1, 0);
        const clamped = Math.min(Math.max(index, 0), maxIndex);
        if (clamped === prev.selectedStepIndex) return prev;
        const step = prev.steps[clamped];
        return {
          ...prev,
          selectedStepIndex: clamped,
          stepPreview: null,
          message: step
            ? `Selected step #${step.sequence} ${step.actionType}.`
            : prev.message,
          messageStatus: 'info',
        };
      });
    },
    [setBrowserReplayPane],
  );

  const handleReplaySelectDiff = useCallback(
    (index: number) => {
      setBrowserReplayPane((prev) => {
        if (prev.visualDiffs.length === 0) return prev;
        const maxIndex = Math.max(prev.visualDiffs.length - 1, 0);
        const clamped = Math.min(Math.max(index, 0), maxIndex);
        if (clamped === prev.selectedDiffIndex) return prev;
        const diff = prev.visualDiffs[clamped];
        return {
          ...prev,
          selectedDiffIndex: clamped,
          message: diff
            ? `Selected diff #${clamped + 1}: #${diff.fromSequence} -> #${diff.toSequence} ${diff.status}.`
            : prev.message,
          messageStatus: 'info',
        };
      });
    },
    [setBrowserReplayPane],
  );

  const handleReplayLoadSession = useCallback(
    async (sessionId: string) => {
      const normalizedSessionId = sessionId.trim();
      if (!normalizedSessionId) return;

      setBrowserReplayPane((prev) => ({
        ...prev,
        loading: true,
        selectedSessionId: normalizedSessionId,
        selectedStepIndex: 0,
        selectedDiffIndex: 0,
        stepPreview: null,
        visualDiffs: [],
        message: `Loading replay for ${normalizedSessionId}...`,
        messageStatus: 'running',
      }));

      try {
        const {
          deriveBrowserReplayVisualDiffPairs,
          readBrowserReplay,
          readBrowserReplayStepArtifactPreview,
          readBrowserReplaySteps,
        } = await import('../../browser/replay.js');
        const [metadata, steps] = await Promise.all([
          readBrowserReplay(process.cwd(), normalizedSessionId),
          readBrowserReplaySteps(process.cwd(), normalizedSessionId),
        ]);
        const [stepPreview, visualDiffs] = await Promise.all([
          steps[0]
            ? readBrowserReplayStepArtifactPreview(
                process.cwd(),
                normalizedSessionId,
                steps[0],
                metadata,
              )
            : Promise.resolve(null),
          deriveBrowserReplayVisualDiffPairs(
            process.cwd(),
            normalizedSessionId,
            steps,
            metadata,
          ),
        ]);
        const hasReplay = Boolean(metadata) || steps.length > 0;
        const stepLabel = steps.length === 1 ? 'step' : 'steps';
        const message =
          steps.length > 0
            ? `Loaded ${steps.length} replay ${stepLabel} for ${normalizedSessionId}.`
            : metadata
              ? `No replay steps found for ${normalizedSessionId}.`
              : `No replay data found for ${normalizedSessionId}.`;

        setBrowserReplayPane((prev) => ({
          ...prev,
          loading: false,
          selectedSessionId: normalizedSessionId,
          metadata,
          steps,
          selectedStepIndex: 0,
          selectedDiffIndex: 0,
          stepPreview,
          visualDiffs,
          message,
          messageStatus: hasReplay ? 'ok' : 'info',
        }));

        appendAction({
          kind: 'info',
          status: hasReplay ? 'ok' : 'info',
          icon: '🎬',
          label: 'Loaded browser replay',
          detail: `${normalizedSessionId} · ${steps.length} step${steps.length === 1 ? '' : 's'}`,
        });
      } catch (err) {
        const { sanitizeTerminalText } = await import('../../utils/text.js');
        const { errorMessage } = await import('../../utils/errors.js');
        const message = sanitizeTerminalText(errorMessage(err));
        setBrowserReplayPane((prev) => ({
          ...prev,
          loading: false,
          message: `Replay load failed: ${message}`,
          messageStatus: 'error',
        }));
        appendAction({
          kind: 'error',
          status: 'error',
          icon: '⛔',
          label: 'Browser replay failed',
          detail: message.slice(0, 120),
        });
      }
    },
    [appendAction, setBrowserReplayPane],
  );

  // ------------------------------------------------------------------
  // Step artifact preview effect
  // ------------------------------------------------------------------

  useEffect(() => {
    const selectedSessionId = browserReplayPane.selectedSessionId;
    const selectedStep = browserReplayPane.steps[browserReplayPane.selectedStepIndex];
    if (!selectedSessionId || !selectedStep) {
      setBrowserReplayPane((prev) =>
        prev.stepPreview === null
          ? prev
          : {
              ...prev,
              stepPreview: null,
            },
      );
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const { readBrowserReplayStepArtifactPreview } = await import(
          '../../browser/replay.js'
        );
        const preview = await readBrowserReplayStepArtifactPreview(
          process.cwd(),
          selectedSessionId,
          selectedStep,
          browserReplayPane.metadata,
        );
        if (cancelled) return;
        setBrowserReplayPane((prev) => {
          const currentStep = prev.steps[prev.selectedStepIndex];
          if (!currentStep) return prev;
          if (prev.selectedSessionId !== selectedSessionId) return prev;
          if (currentStep.sequence !== selectedStep.sequence) return prev;
          return {
            ...prev,
            stepPreview: preview,
          };
        });
      } catch {
        if (cancelled) return;
        setBrowserReplayPane((prev) =>
          prev.stepPreview === null
            ? prev
            : {
                ...prev,
                stepPreview: null,
              },
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    browserReplayPane.metadata,
    browserReplayPane.selectedSessionId,
    browserReplayPane.selectedStepIndex,
    browserReplayPane.steps,
    setBrowserReplayPane,
  ]);

  // ------------------------------------------------------------------
  // Auto-refresh effects
  // ------------------------------------------------------------------

  useEffect(() => {
    if (activeOverlay !== 'browser-control') return;
    void refreshBrowserControlPane();
  }, [activeOverlay, refreshBrowserControlPane]);

  useEffect(() => {
    if (browserControlPane.health !== null) return;
    void refreshBrowserControlPane();
  }, [browserControlPane.health, refreshBrowserControlPane]);

  // ------------------------------------------------------------------
  // Return
  // ------------------------------------------------------------------

  return {
    runBrowserControlPaneAction,
    pruneBrowserControlProfiles,
    refreshBrowserControlPane,
    browserReplaySessionIds,
    handleReplaySelectSession,
    handleReplaySelectStep,
    handleReplaySelectDiff,
    handleReplayLoadSession,
  };
}

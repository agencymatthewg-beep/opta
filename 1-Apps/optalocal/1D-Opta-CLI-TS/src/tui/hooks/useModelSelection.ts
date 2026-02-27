/**
 * useModelSelection — Extracted from App.tsx.
 *
 * Encapsulates model picker open/close, model switch orchestration via LMX,
 * and the context-limit loading side-effect tied to model changes.
 */

import { useCallback, useEffect } from 'react';
import type { ModelSelection } from '../ModelPicker.js';
import type { ActionEventKind, ActionEventStatus } from '../activity.js';
import type { ConnectionState } from '../utils.js';
import type { TuiMessage } from '../App.js';

// ---------------------------------------------------------------------------
// Constants (mirrored from App.tsx to keep the hook self-contained)
// ---------------------------------------------------------------------------

const MODEL_PICKER_CLIENT_TIMEOUT_MS = 60_000;
const MODEL_PICKER_LOAD_TIMEOUT_MS = 300_000;

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

export interface UseModelSelectionOptions {
  currentModel: string;
  setCurrentModel: (v: string) => void;
  setModelLoaded: (v: boolean) => void;
  setConnectionState: (v: ConnectionState) => void;
  setContextLimit: (v: number) => void;
  connectionHost: string;
  connectionFallbackHosts: string[];
  connectionPort: number;
  connectionAdminKey: string | undefined;
  appendAction: (action: AppendActionEvent) => void;
  setActiveOverlay: (v: 'none' | 'model-picker' | 'help-browser') => void;
  setMessages: React.Dispatch<React.SetStateAction<TuiMessage[]>>;
  permissionPending: unknown;
  toggleOverlay: (overlay: 'model-picker' | 'help-browser') => void;
}

export interface UseModelSelectionReturn {
  handleHelp: () => void;
  handleModelSwitch: () => void;
  handleModelPickerSelect: (selection: ModelSelection) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useModelSelection({
  currentModel,
  setCurrentModel,
  setModelLoaded,
  setConnectionState,
  setContextLimit,
  connectionHost,
  connectionFallbackHosts,
  connectionPort,
  connectionAdminKey,
  appendAction,
  setMessages,
  permissionPending,
  toggleOverlay,
}: UseModelSelectionOptions): UseModelSelectionReturn {
  // Re-derive context limit when model changes
  useEffect(() => {
    import('../../core/models.js')
      .then(({ getContextLimit }) => {
        setContextLimit(getContextLimit(currentModel));
      })
      .catch(() => {});
  }, [currentModel, setContextLimit]);

  const handleHelp = useCallback(() => {
    if (permissionPending) return;
    toggleOverlay('help-browser');
    appendAction({ kind: 'info', status: 'info', icon: '📚', label: 'Opened Help Browser' });
  }, [permissionPending, toggleOverlay, appendAction]);

  const handleModelSwitch = useCallback(() => {
    if (permissionPending) return;
    toggleOverlay('model-picker');
    appendAction({ kind: 'model', status: 'info', icon: '🧬', label: 'Opened Model Picker' });
  }, [permissionPending, toggleOverlay, appendAction]);

  const handleModelPickerSelect = useCallback(
    async (selection: ModelSelection) => {
      appendAction({
        kind: 'model',
        status: 'running',
        icon: '🧬',
        label: 'Switching model',
        detail: selection.id,
      });

      try {
        const [
          { saveConfig },
          { LmxClient, lookupContextLimit },
          { ensureModelLoaded, findMatchingModelId, modelIdsEqual },
        ] = await Promise.all([
          import('../../core/config.js'),
          import('../../lmx/client.js'),
          import('../../lmx/model-lifecycle.js'),
        ]);

        const lmx = new LmxClient({
          host: connectionHost,
          fallbackHosts: connectionFallbackHosts,
          port: connectionPort,
          adminKey: connectionAdminKey,
          timeoutMs: MODEL_PICKER_CLIENT_TIMEOUT_MS,
        });

        let resolvedModel = selection.id;
        const loadedRes = await lmx.models().catch(() => ({ models: [] }));
        const loadedIds = loadedRes.models.map((model) => model.model_id);
        const loadedMatch = findMatchingModelId(selection.id, loadedIds);

        if (loadedMatch) {
          resolvedModel = loadedMatch;
        } else {
          try {
            resolvedModel = await ensureModelLoaded(lmx, selection.id, {
              timeoutMs: MODEL_PICKER_LOAD_TIMEOUT_MS,
            });
          } catch (err) {
            const code = (err as { code?: unknown })?.code;
            if (code === 'out_of_memory') {
              appendAction({
                kind: 'model',
                status: 'running',
                icon: '🧹',
                label: 'Memory pressure',
                detail: 'unloading other models',
              });
              for (const loadedId of loadedIds.filter(
                (id) => !modelIdsEqual(id, selection.id),
              )) {
                await lmx.unloadModel(loadedId).catch(() => null);
              }
              resolvedModel = await ensureModelLoaded(lmx, selection.id, {
                timeoutMs: MODEL_PICKER_LOAD_TIMEOUT_MS,
              });
            } else {
              throw err;
            }
          }
        }

        await saveConfig({
          model: {
            default: resolvedModel,
            contextLimit: lookupContextLimit(resolvedModel),
          },
        });

        setCurrentModel(resolvedModel);
        setModelLoaded(true);
        setConnectionState('connected');
        appendAction({
          kind: 'model',
          status: 'ok',
          icon: '✅',
          label: 'Model ready',
          detail: resolvedModel,
        });
      } catch (err) {
        const { sanitizeTerminalText } = await import('../../utils/text.js');
        const { errorMessage } = await import('../../utils/errors.js');
        const msg = sanitizeTerminalText(errorMessage(err));
        setMessages((prev) => [
          ...prev,
          {
            role: 'error',
            content: `Model switch failed: ${msg}`,
            createdAt: Date.now(),
          },
        ]);

        const lower = msg.toLowerCase();
        if (lower.includes('not loaded') && lower.includes('model')) {
          setModelLoaded(false);
        }

        appendAction({
          kind: 'model',
          status: 'error',
          icon: '⛔',
          label: 'Model switch failed',
          detail: msg.slice(0, 100),
        });
      }
    },
    [
      appendAction,
      connectionAdminKey,
      connectionFallbackHosts,
      connectionHost,
      connectionPort,
      setConnectionState,
      setCurrentModel,
      setMessages,
      setModelLoaded,
    ],
  );

  return {
    handleHelp,
    handleModelSwitch,
    handleModelPickerSelect,
  };
}

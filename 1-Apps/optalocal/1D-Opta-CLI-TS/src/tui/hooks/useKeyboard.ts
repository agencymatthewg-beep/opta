import { useInput } from 'ink';
import { mergeKeybindings, type KeybindingConfig, type KeyBinding, type KeybindingOverrides } from '../keybindings.js';

interface KeyboardActions {
  onExit?: () => void;
  onInterrupt?: () => void;
  onEscape?: () => void;
  onHelp?: () => void;
  onClear?: () => void;
  onSlashMenu?: () => void;
  onOpenOptaMenu?: () => void;
  onOpenActionHistory?: () => void;
  onToggleSidebar?: () => void;
  onExpandThinking?: () => void;
  onModelSwitch?: () => void;
  onToggleSafeMode?: () => void;
  onCycleMode?: () => void;
  onToggleBypass?: () => void;
  onToggleFollow?: () => void;
  onBrowserPause?: () => void;
  onBrowserKill?: () => void;
  onBrowserRefresh?: () => void;
  onScrollUp?: () => void;
  onScrollDown?: () => void;
  onOpenSettings?: () => void;
  onOpenOnboarding?: () => void;
  onToggleAgentPanel?: () => void;
  onOpenSessionBrowser?: () => void;
  onNextPanel?: () => void;
  onPreviousPanel?: () => void;
}

interface KeyboardOptions {
  bindings?: KeybindingConfig;
  overrides?: KeybindingOverrides;
}

interface ParsedCsiUKeyEvent {
  codepoint: number;
  ctrl: boolean;
  shift: boolean;
  meta: boolean;
}

function parseCsiUKeyEvent(input: string): ParsedCsiUKeyEvent | null {
  const match = input.match(/^\x1B\[(\d+);(\d+)u$/i);
  if (!match) return null;
  const codepoint = Number(match[1]);
  const modifier = Number(match[2]);
  if (!Number.isInteger(codepoint) || !Number.isInteger(modifier) || modifier < 1) return null;
  const modifierMask = modifier - 1;
  return {
    codepoint,
    shift: (modifierMask & 1) !== 0,
    meta: (modifierMask & 2) !== 0,
    ctrl: (modifierMask & 4) !== 0,
  };
}

/**
 * Check if a key event matches a keybinding string like "ctrl+c", "tab", "shift+tab", "escape"
 */
function matchesBinding(
  input: string,
  key: { ctrl: boolean; shift: boolean; tab: boolean; escape: boolean; meta: boolean },
  binding: KeyBinding
): boolean {
  const parts = binding.key.toLowerCase().split('+');
  const needsCtrl = parts.includes('ctrl');
  const needsShift = parts.includes('shift');
  const keyPart = parts.filter(p => p !== 'ctrl' && p !== 'shift')[0];
  const csiU = parseCsiUKeyEvent(input);
  const ctrlPressed = key.ctrl || Boolean(csiU?.ctrl);
  const shiftPressed = key.shift || Boolean(csiU?.shift);
  const tabPressed = key.tab || csiU?.codepoint === 9;
  const escapePressed = key.escape || csiU?.codepoint === 27;
  const normalizedInput = csiU ? String.fromCodePoint(csiU.codepoint) : input;

  if (needsCtrl !== ctrlPressed) return false;
  if (needsShift !== shiftPressed) return false;

  if (keyPart === 'tab') return tabPressed;
  if (keyPart === 'escape') return escapePressed;
  if (keyPart === 'space') return normalizedInput === ' ';
  if (keyPart) {
    if (normalizedInput.toLowerCase() === keyPart) return true;
    // Some terminals send control characters (e.g. Ctrl+S => \x13) instead of letters.
    if (
      needsCtrl &&
      keyPart.length === 1 &&
      keyPart >= 'a' &&
      keyPart <= 'z' &&
      input.length === 1 &&
      csiU === null
    ) {
      const expectedControlCode = keyPart.charCodeAt(0) - 96;
      return input.charCodeAt(0) === expectedControlCode;
    }
  }

  return false;
}

export function useKeyboard(actions: KeyboardActions, options?: KeyboardOptions): void {
  const bindings = options?.bindings ?? mergeKeybindings(options?.overrides);

  useInput((input, key) => {
    // Escape handling (overlay back / turn cancel). Keep distinct from Ctrl+C exit.
    if (key.escape) {
      actions.onEscape?.();
      return;
    }

    // Exit / Interrupt
    if (matchesBinding(input, key, bindings.exit)) {
      if (actions.onInterrupt) {
        actions.onInterrupt();
      } else {
        actions.onExit?.();
      }
      return;
    }

    // Clear
    if (matchesBinding(input, key, bindings.clear)) {
      actions.onClear?.();
      return;
    }
    // Help
    if (matchesBinding(input, key, bindings.help)) {
      actions.onHelp?.();
      return;
    }
    // Toggle sidebar
    if (matchesBinding(input, key, bindings.toggleSidebar)) {
      actions.onToggleSidebar?.();
      return;
    }
    // Scroll message list
    if (matchesBinding(input, key, bindings.scrollUp)) {
      actions.onScrollUp?.();
      return;
    }
    if (matchesBinding(input, key, bindings.scrollDown)) {
      actions.onScrollDown?.();
      return;
    }
    // Toggle thinking
    if (matchesBinding(input, key, bindings.expandThinking)) {
      actions.onExpandThinking?.();
      return;
    }
    // Slash menu
    if (matchesBinding(input, key, bindings.slashMenu)) {
      actions.onSlashMenu?.();
      return;
    }
    // Opta menu
    if (matchesBinding(input, key, bindings.openOptaMenu)) {
      actions.onOpenOptaMenu?.();
      return;
    }
    // Actions history
    if (matchesBinding(input, key, bindings.openActionHistory)) {
      actions.onOpenActionHistory?.();
      return;
    }
    // Model switch
    if (matchesBinding(input, key, bindings.modelSwitch)) {
      actions.onModelSwitch?.();
      return;
    }
    // Toggle safe-mode rendering
    if (matchesBinding(input, key, bindings.toggleSafeMode)) {
      actions.onToggleSafeMode?.();
      return;
    }
    // Cycle mode (Shift+Tab)
    if (matchesBinding(input, key, bindings.cycleMode)) {
      actions.onCycleMode?.();
      return;
    }
    // Toggle bypass
    if (matchesBinding(input, key, bindings.toggleBypass)) {
      actions.onToggleBypass?.();
      return;
    }
    // Toggle follow mode
    if (matchesBinding(input, key, bindings.toggleFollow)) {
      actions.onToggleFollow?.();
      return;
    }
    // Browser runtime controls (always-on rail shortcuts)
    if (matchesBinding(input, key, bindings.browserPause)) {
      actions.onBrowserPause?.();
      return;
    }
    if (matchesBinding(input, key, bindings.browserKill)) {
      actions.onBrowserKill?.();
      return;
    }
    if (matchesBinding(input, key, bindings.browserRefresh)) {
      actions.onBrowserRefresh?.();
      return;
    }
    if (matchesBinding(input, key, bindings.openSettings)) {
      actions.onOpenSettings?.();
      return;
    }
    if (matchesBinding(input, key, bindings.toggleAgentPanel)) {
      actions.onToggleAgentPanel?.();
      return;
    }
    if (matchesBinding(input, key, bindings.openSessionBrowser)) {
      actions.onOpenSessionBrowser?.();
      return;
    }
    if (matchesBinding(input, key, bindings.nextPanel)) {
      actions.onNextPanel?.();
      return;
    }
    if (matchesBinding(input, key, bindings.previousPanel)) {
      actions.onPreviousPanel?.();
      return;
    }
  });
}

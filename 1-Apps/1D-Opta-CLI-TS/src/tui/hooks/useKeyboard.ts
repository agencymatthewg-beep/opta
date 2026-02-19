import { useInput } from 'ink';
import { defaultKeybindings, type KeybindingConfig, type KeyBinding } from '../keybindings.js';

interface KeyboardActions {
  onExit?: () => void;
  onHelp?: () => void;
  onClear?: () => void;
  onSlashMenu?: () => void;
  onToggleSidebar?: () => void;
  onExpandThinking?: () => void;
  onModelSwitch?: () => void;
  onCycleMode?: () => void;
  onToggleBypass?: () => void;
}

interface KeyboardOptions {
  bindings?: KeybindingConfig;
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

  if (needsCtrl !== key.ctrl) return false;
  if (needsShift !== key.shift) return false;

  if (keyPart === 'tab') return key.tab;
  if (keyPart === 'escape') return key.escape;
  if (keyPart) return input === keyPart;

  return false;
}

export function useKeyboard(actions: KeyboardActions, options?: KeyboardOptions): void {
  const bindings = options?.bindings ?? defaultKeybindings();

  useInput((input, key) => {
    // Exit
    if (matchesBinding(input, key, bindings.exit)) {
      actions.onExit?.();
    }
    // Clear
    if (matchesBinding(input, key, bindings.clear)) {
      actions.onClear?.();
    }
    // Help
    if (matchesBinding(input, key, bindings.help)) {
      actions.onHelp?.();
    }
    // Toggle sidebar
    if (matchesBinding(input, key, bindings.toggleSidebar)) {
      actions.onToggleSidebar?.();
    }
    // Toggle thinking
    if (matchesBinding(input, key, bindings.expandThinking)) {
      actions.onExpandThinking?.();
    }
    // Slash menu
    if (matchesBinding(input, key, bindings.slashMenu)) {
      actions.onSlashMenu?.();
    }
    // Model switch
    if (matchesBinding(input, key, bindings.modelSwitch)) {
      actions.onModelSwitch?.();
    }
    // Cycle mode (Shift+Tab)
    if (matchesBinding(input, key, bindings.cycleMode)) {
      actions.onCycleMode?.();
    }
    // Toggle bypass
    if (matchesBinding(input, key, bindings.toggleBypass)) {
      actions.onToggleBypass?.();
    }
  });
}

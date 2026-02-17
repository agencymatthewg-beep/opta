import { useInput } from 'ink';

interface KeyboardActions {
  onExit?: () => void;
  onHelp?: () => void;
  onClear?: () => void;
  onSlashMenu?: () => void;
  onNextPanel?: () => void;
  onPreviousPanel?: () => void;
  onToggleSidebar?: () => void;
  onExpandThinking?: () => void;
}

export function useKeyboard(actions: KeyboardActions): void {
  useInput((input, key) => {
    // Ctrl+C -- exit
    if (key.ctrl && input === 'c') {
      actions.onExit?.();
    }
    // Ctrl+L -- clear
    if (key.ctrl && input === 'l') {
      actions.onClear?.();
    }
    // Ctrl+/ -- help
    if (key.ctrl && input === '/') {
      actions.onHelp?.();
    }
    // Ctrl+B -- toggle sidebar
    if (key.ctrl && input === 'b') {
      actions.onToggleSidebar?.();
    }
    // Ctrl+T -- toggle thinking
    if (key.ctrl && input === 't') {
      actions.onExpandThinking?.();
    }
    // Tab / Shift+Tab -- panel navigation
    if (key.tab) {
      if (key.shift) {
        actions.onPreviousPanel?.();
      } else {
        actions.onNextPanel?.();
      }
    }
    // Escape -- slash menu
    if (key.escape) {
      actions.onSlashMenu?.();
    }
  });
}

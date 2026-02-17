import { useInput } from 'ink';

interface KeyboardActions {
  onExit?: () => void;
  onHelp?: () => void;
  onClear?: () => void;
  onSlashMenu?: () => void;
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
    // Escape -- slash menu
    if (key.escape) {
      actions.onSlashMenu?.();
    }
  });
}

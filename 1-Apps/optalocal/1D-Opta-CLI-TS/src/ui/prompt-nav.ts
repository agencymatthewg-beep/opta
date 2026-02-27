import { emitKeypressEvents } from 'node:readline';

export type MenuPromptMode = 'select' | 'search';

interface KeypressLike {
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

interface BackKeyState {
  mode: MenuPromptMode;
  key?: KeypressLike;
  input?: string;
  searchTermLength: number;
}

interface BackKeyDecision {
  triggerBack: boolean;
  nextSearchTermLength: number;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isPrintableInput(input?: string): boolean {
  return Boolean(input && input.length > 0 && !input.startsWith('\u001b'));
}

function normalizeKeyName(key?: KeypressLike, input?: string): string | undefined {
  const name = key?.name?.toLowerCase();
  if (name) return name;
  if (!input) return undefined;

  // Some terminals emit raw escape sequences without key metadata.
  if (input === '\u001b[D') return 'left';
  if (input === '\u007f' || input === '\u0008') return 'backspace';
  if (input === '\u001b[3~') return 'delete';
  if (input === '\u001b') return 'escape';
  return undefined;
}

/**
 * Decide whether a keypress should move back to the previous menu and
 * update the tracked search-term length for search prompts.
 */
export function evaluateMenuBackKey(state: BackKeyState): BackKeyDecision {
  const keyName = normalizeKeyName(state.key, state.input);
  const hasModifier = Boolean(state.key?.ctrl || state.key?.meta);
  let nextSearchTermLength = state.searchTermLength;

  if (state.mode === 'search' && state.key?.ctrl && (keyName === 'u' || keyName === 'w')) {
    return { triggerBack: false, nextSearchTermLength: 0 };
  }

  if (state.mode === 'search' && !hasModifier && isPrintableInput(state.input)) {
    nextSearchTermLength += state.input!.length;
  }

  if (hasModifier) {
    return { triggerBack: false, nextSearchTermLength };
  }

  if (keyName === 'escape') {
    return { triggerBack: true, nextSearchTermLength: 0 };
  }

  if (keyName === 'left') {
    return { triggerBack: true, nextSearchTermLength };
  }

  if (keyName === 'backspace' || keyName === 'delete') {
    if (state.mode === 'search') {
      if (state.searchTermLength <= 0) {
        return { triggerBack: true, nextSearchTermLength: 0 };
      }
      return {
        triggerBack: false,
        nextSearchTermLength: Math.max(0, state.searchTermLength - 1),
      };
    }
    return { triggerBack: true, nextSearchTermLength };
  }

  return { triggerBack: false, nextSearchTermLength };
}

/**
 * Run an inquirer menu prompt with keyboard back-navigation:
 * - escape: cancel current menu / go back
 * - left arrow: go back to previous menu
 * - backspace/delete: go back for select menus
 * - backspace/delete: go back for search menus when search box is empty
 */
export async function runMenuPrompt<T>(
  runPrompt: (context: { signal: AbortSignal }) => Promise<T>,
  mode: MenuPromptMode,
): Promise<T | null> {
  if (!process.stdin.isTTY) {
    const controller = new AbortController();
    return runPrompt({ signal: controller.signal });
  }

  const input = process.stdin;
  const controller = new AbortController();
  let searchTermLength = 0;
  let abortedByBackKey = false;

  const onKeypress = (data: unknown, key: unknown): void => {
    const decision = evaluateMenuBackKey({
      mode,
      key: key as KeypressLike,
      input: isNonEmptyString(data) ? data : undefined,
      searchTermLength,
    });
    searchTermLength = decision.nextSearchTermLength;
    if (decision.triggerBack) {
      abortedByBackKey = true;
      controller.abort();
    }
  };

  emitKeypressEvents(input);
  input.on('keypress', onKeypress);
  try {
    return await runPrompt({ signal: controller.signal });
  } catch (err) {
    if (abortedByBackKey) return null;
    throw err;
  } finally {
    input.off('keypress', onKeypress);
  }
}

export interface KeyBinding {
  key: string;
  description: string;
}

export interface KeybindingConfig {
  exit: KeyBinding;
  toggleSidebar: KeyBinding;
  nextPanel: KeyBinding;
  previousPanel: KeyBinding;
  scrollUp: KeyBinding;
  scrollDown: KeyBinding;
  help: KeyBinding;
  clear: KeyBinding;
  slashMenu: KeyBinding;
  expandThinking: KeyBinding;
}

export function defaultKeybindings(): KeybindingConfig {
  return {
    exit: { key: 'ctrl+c', description: 'Exit Opta' },
    toggleSidebar: { key: 'ctrl+b', description: 'Toggle sidebar' },
    nextPanel: { key: 'tab', description: 'Next panel' },
    previousPanel: { key: 'shift+tab', description: 'Previous panel' },
    scrollUp: { key: 'up', description: 'Scroll up' },
    scrollDown: { key: 'down', description: 'Scroll down' },
    help: { key: 'ctrl+/', description: 'Show help' },
    clear: { key: 'ctrl+l', description: 'Clear screen' },
    slashMenu: { key: 'escape', description: 'Open command menu' },
    expandThinking: { key: 'ctrl+t', description: 'Toggle thinking' },
  };
}

export function getKeybinding(
  action: keyof KeybindingConfig,
  overrides?: Partial<Record<string, KeyBinding>>
): KeyBinding {
  const defaults = defaultKeybindings();
  if (overrides && overrides[action]) {
    return overrides[action]!;
  }
  return defaults[action];
}

export async function loadKeybindings(): Promise<Partial<Record<string, KeyBinding>>> {
  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const configPath = join(process.cwd(), '.opta', 'keybindings.json');
    const content = await readFile(configPath, 'utf-8');
    return JSON.parse(content) as Partial<Record<string, KeyBinding>>;
  } catch {
    return {};
  }
}

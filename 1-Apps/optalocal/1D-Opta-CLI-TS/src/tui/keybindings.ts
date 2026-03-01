export interface KeyBinding {
  key: string;
  description: string;
}

export interface KeybindingConfig {
  exit: KeyBinding;
  toggleSidebar: KeyBinding;
  scrollUp: KeyBinding;
  scrollDown: KeyBinding;
  help: KeyBinding;
  clear: KeyBinding;
  slashMenu: KeyBinding;
  openOptaMenu: KeyBinding;
  openActionHistory: KeyBinding;
  expandThinking: KeyBinding;
  modelSwitch: KeyBinding;
  toggleSafeMode: KeyBinding;
  cycleMode: KeyBinding;
  toggleBypass: KeyBinding;
  toggleFollow: KeyBinding;
  browserPause: KeyBinding;
  browserKill: KeyBinding;
  browserRefresh: KeyBinding;
  openSettings: KeyBinding;
  toggleAgentPanel: KeyBinding;
  openSessionBrowser: KeyBinding;
  nextPanel: KeyBinding;
  previousPanel: KeyBinding;
}

export type KeybindingOverrides = Partial<Record<keyof KeybindingConfig, KeyBinding>>;

export function defaultKeybindings(): KeybindingConfig {
  return {
    exit: { key: 'ctrl+c', description: 'Exit Opta' },
    toggleSidebar: { key: 'ctrl+b', description: 'Toggle sidebar' },
    scrollUp: { key: 'shift+up', description: 'Scroll message list up (plain ↑ = history nav)' },
    scrollDown: {
      key: 'shift+down',
      description: 'Scroll message list down (plain ↓ = history nav)',
    },
    help: { key: 'ctrl+/', description: 'Show help' },
    clear: { key: 'ctrl+l', description: 'Clear screen' },
    slashMenu: { key: 'ctrl+k', description: 'Open command palette' },
    openOptaMenu: { key: 'shift+space', description: 'Open Opta menu' },
    openActionHistory: { key: 'ctrl+e', description: 'Open actions history' },
    expandThinking: { key: 'ctrl+t', description: 'Toggle live thinking pane size' },
    modelSwitch: { key: 'ctrl+g', description: 'Switch model' },
    toggleSafeMode: { key: 'ctrl+n', description: 'Toggle safe rendering mode' },
    cycleMode: { key: 'shift+tab', description: 'Cycle mode (Code/Plan/Research/Review)' },
    toggleBypass: { key: 'ctrl+y', description: 'Toggle bypass permissions' },
    toggleFollow: { key: 'ctrl+f', description: 'Toggle follow mode (auto-scroll)' },
    browserPause: { key: 'ctrl+p', description: 'Pause or resume browser runtime' },
    browserKill: { key: 'ctrl+x', description: 'Kill browser runtime immediately' },
    browserRefresh: { key: 'ctrl+r', description: 'Refresh browser runtime telemetry' },
    openSettings: { key: 'ctrl+s', description: 'Open settings overlay' },
    toggleAgentPanel: { key: 'a', description: 'Toggle agent monitor panel' },
    openSessionBrowser: { key: 'ctrl+o', description: 'Open session browser' },
    nextPanel: { key: 'ctrl+]', description: 'Focus next panel (input → messages → sidebar)' },
    previousPanel: { key: 'ctrl+[', description: 'Focus previous panel' },
  };
}

export function mergeKeybindings(overrides?: KeybindingOverrides): KeybindingConfig {
  const defaults = defaultKeybindings();
  if (!overrides) return defaults;
  const next = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof KeybindingConfig>) {
    const override = overrides[key];
    if (!override) continue;
    if (!override.key || !override.description) continue;
    next[key] = override;
  }
  return next;
}

export function getKeybinding(
  action: keyof KeybindingConfig,
  overrides?: KeybindingOverrides
): KeyBinding {
  return mergeKeybindings(overrides)[action];
}

export async function loadKeybindings(): Promise<KeybindingOverrides> {
  try {
    const { readFile } = await import('node:fs/promises');
    const nodePath = await import('node:path');
    const configPath = nodePath.join(process.cwd(), '.opta', 'keybindings.json');
    const content = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content) as Partial<Record<string, KeyBinding>>;
    const defaults = defaultKeybindings();
    const overrides: KeybindingOverrides = {};
    for (const key of Object.keys(defaults) as Array<keyof KeybindingConfig>) {
      const maybe = parsed[key];
      if (!maybe || typeof maybe !== 'object') continue;
      if (typeof maybe.key !== 'string' || typeof maybe.description !== 'string') continue;
      overrides[key] = maybe;
    }
    return overrides;
  } catch {
    return {};
  }
}

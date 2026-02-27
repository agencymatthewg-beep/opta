import { afterEach, describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  defaultKeybindings,
  getKeybinding,
  loadKeybindings,
  mergeKeybindings,
} from '../../src/tui/keybindings.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('keybindings', () => {
  it('should have default keybindings', () => {
    const bindings = defaultKeybindings();
    expect(bindings.exit).toBeDefined();
    expect(bindings.toggleSidebar).toBeDefined();
    expect(bindings.cycleMode).toBeDefined();
  });

  it('should resolve keybinding', () => {
    const binding = getKeybinding('exit');
    expect(binding).toBeDefined();
    expect(binding.key).toBeDefined();
    expect(binding.description).toBeDefined();
  });

  it('should allow custom overrides', () => {
    const custom = { exit: { key: 'ctrl+q', description: 'Quit' } };
    const binding = getKeybinding('exit', custom);
    expect(binding.key).toBe('ctrl+q');
  });

  it('should fall back to defaults for missing overrides', () => {
    const custom = { exit: { key: 'ctrl+q', description: 'Quit' } };
    const binding = getKeybinding('toggleSidebar', custom);
    expect(binding.key).toBe('ctrl+b');
  });

  it('merges override sets safely', () => {
    const merged = mergeKeybindings({
      clear: { key: 'ctrl+o', description: 'Clear viewport' },
      openOptaMenu: { key: 'ctrl+m', description: 'Menu' },
    });
    expect(merged.clear.key).toBe('ctrl+o');
    expect(merged.openOptaMenu.key).toBe('ctrl+m');
    expect(merged.exit.key).toBe('ctrl+c');
  });

  it('should have descriptions for all bindings', () => {
    const bindings = defaultKeybindings();
    for (const [, binding] of Object.entries(bindings)) {
      expect(binding.description).toBeTruthy();
      expect(binding.key).toBeTruthy();
    }
  });

  it('should avoid duplicate default key assignments', () => {
    const bindings = defaultKeybindings();
    const keys = Object.values(bindings).map((binding) => binding.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('uses dedicated command palette shortcut', () => {
    const bindings = defaultKeybindings();
    expect(bindings.slashMenu.key).toBe('ctrl+k');
  });

  it('provides a runtime safe-mode toggle key', () => {
    const bindings = defaultKeybindings();
    expect(bindings.toggleSafeMode.key).toBe('ctrl+n');
  });

  it('provides Opta menu and actions history keys', () => {
    const bindings = defaultKeybindings();
    expect(bindings.openOptaMenu.key).toBe('shift+space');
    expect(bindings.openActionHistory.key).toBe('ctrl+e');
    expect(bindings.openSettings.key).toBe('ctrl+s');
  });

  it('loads only valid known keybinding overrides from config', async () => {
    const configDir = join(process.cwd(), '.opta');
    const configPath = join(configDir, 'keybindings.json');
    const backupPath = join(configDir, 'keybindings.json.__test_backup__');
    const hadExisting = existsSync(configPath);
    if (hadExisting) {
      await fs.copyFile(configPath, backupPath);
    }
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(configPath, JSON.stringify({
      clear: { key: 'ctrl+o', description: 'Clear viewport' },
      openOptaMenu: { key: 'ctrl+m', description: 'Menu remap' },
      unknownKey: { key: 'ctrl+1', description: 'ignored' },
      invalidShape: { key: 123, description: false },
    }));

    try {
      const overrides = await loadKeybindings();
      expect(overrides.clear?.key).toBe('ctrl+o');
      expect(overrides.openOptaMenu?.key).toBe('ctrl+m');
      expect((overrides as Record<string, unknown>)['unknownKey']).toBeUndefined();
      expect((overrides as Record<string, unknown>)['invalidShape']).toBeUndefined();
    } finally {
      if (hadExisting) {
        await fs.copyFile(backupPath, configPath);
        await fs.rm(backupPath, { force: true });
      } else {
        await fs.rm(configPath, { force: true });
      }
    }
  });

  it('matches configured Shift+Space via CSI-u input in keyboard hook', async () => {
    const handlers: Array<(input: string, key: {
      ctrl: boolean;
      shift: boolean;
      tab: boolean;
      escape: boolean;
      meta: boolean;
    }) => void> = [];

    vi.resetModules();
    vi.doMock('ink', () => ({
      useInput: (handler: (input: string, key: {
        ctrl: boolean;
        shift: boolean;
        tab: boolean;
        escape: boolean;
        meta: boolean;
      }) => void) => {
        handlers.push(handler);
      },
    }));

    try {
      const { useKeyboard } = await import('../../src/tui/hooks/useKeyboard.js');
      const onOpenOptaMenu = vi.fn();
      const bindings = defaultKeybindings();
      bindings.openOptaMenu = { key: 'shift+space', description: 'Open Opta menu' };

      useKeyboard({ onOpenOptaMenu }, { bindings });

      expect(handlers).toHaveLength(1);
      handlers[0]!('\u001B[32;2u', {
        ctrl: false,
        shift: false,
        tab: false,
        escape: false,
        meta: false,
      });
      expect(onOpenOptaMenu).toHaveBeenCalledTimes(1);
    } finally {
      vi.doUnmock('ink');
      vi.resetModules();
    }
  });
});

import { describe, it, expect } from 'vitest';
import { getKeybinding, defaultKeybindings } from '../../src/tui/keybindings.js';

describe('keybindings', () => {
  it('should have default keybindings', () => {
    const bindings = defaultKeybindings();
    expect(bindings.exit).toBeDefined();
    expect(bindings.toggleSidebar).toBeDefined();
    expect(bindings.nextPanel).toBeDefined();
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

  it('should have descriptions for all bindings', () => {
    const bindings = defaultKeybindings();
    for (const [, binding] of Object.entries(bindings)) {
      expect(binding.description).toBeTruthy();
      expect(binding.key).toBeTruthy();
    }
  });
});

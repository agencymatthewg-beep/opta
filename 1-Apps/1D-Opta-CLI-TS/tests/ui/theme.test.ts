import { describe, it, expect } from 'vitest';
import { getTheme, setTheme, listThemes } from '../../src/ui/theme.js';

describe('theme system', () => {
  it('should have default theme', () => {
    const theme = getTheme();
    expect(theme.name).toBe('opta');
    expect(theme.colors.primary).toBeDefined();
    expect(theme.colors.success).toBeDefined();
    expect(theme.colors.error).toBeDefined();
  });

  it('should list available themes', () => {
    const themes = listThemes();
    expect(themes.length).toBeGreaterThanOrEqual(3);
    expect(themes.map(t => t.name)).toContain('opta');
    expect(themes.map(t => t.name)).toContain('minimal');
    expect(themes.map(t => t.name)).toContain('solarized');
  });

  it('should switch themes', () => {
    setTheme('minimal');
    const theme = getTheme();
    expect(theme.name).toBe('minimal');
    setTheme('opta'); // reset
  });

  it('should apply theme colors', () => {
    const theme = getTheme();
    const styled = theme.primary('hello');
    expect(styled).toBeDefined();
    expect(typeof styled).toBe('string');
  });
});

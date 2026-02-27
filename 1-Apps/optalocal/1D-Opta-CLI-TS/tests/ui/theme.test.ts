import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  getTheme,
  setTheme,
  listThemes,
  resetThemes,
  validateThemeDef,
  loadCustomThemes,
  getCustomThemeDirs,
} from '../../src/ui/theme.js';

describe('theme system', () => {
  beforeEach(() => {
    resetThemes();
  });

  it('should have default theme', () => {
    const theme = getTheme();
    expect(theme.name).toBe('opta');
    expect(theme.colors.primary).toBeDefined();
    expect(theme.colors.success).toBeDefined();
    expect(theme.colors.error).toBeDefined();
  });

  it('should list available themes', () => {
    const themes = listThemes();
    expect(themes.length).toBeGreaterThanOrEqual(5);
    expect(themes.map(t => t.name)).toContain('opta');
    expect(themes.map(t => t.name)).toContain('minimal');
    expect(themes.map(t => t.name)).toContain('solarized');
    expect(themes.map(t => t.name)).toContain('dracula');
    expect(themes.map(t => t.name)).toContain('catppuccin');
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

  it('should ignore unknown theme name in setTheme', () => {
    setTheme('nonexistent-theme');
    expect(getTheme().name).toBe('opta');
  });

  it('should fallback to opta when current theme name is unknown', () => {
    const theme = getTheme();
    expect(theme.name).toBe('opta');
    expect(theme.colors.primary).toBe('#8B5CF6');
  });

  it('should return two directories from getCustomThemeDirs', () => {
    const dirs = getCustomThemeDirs();
    expect(dirs).toHaveLength(2);
    expect(dirs[0]).toContain('.config/opta/themes');
    expect(dirs[1]).toContain('.opta/themes');
  });
});

describe('validateThemeDef', () => {
  const validTheme = {
    description: 'Test theme',
    colors: {
      primary: '#FF0000',
      secondary: '#00FF00',
      success: '#0000FF',
      error: '#FF00FF',
      warning: '#FFFF00',
      info: '#00FFFF',
      muted: '#888888',
      text: '#FFFFFF',
      border: '#333333',
    },
  };

  it('should accept a valid theme definition', () => {
    const result = validateThemeDef(validTheme);
    expect(result).not.toBeNull();
    expect(result!.description).toBe('Test theme');
    expect(result!.colors.primary).toBe('#FF0000');
  });

  it('should reject null', () => {
    expect(validateThemeDef(null)).toBeNull();
  });

  it('should reject non-object', () => {
    expect(validateThemeDef('string')).toBeNull();
    expect(validateThemeDef(42)).toBeNull();
    expect(validateThemeDef(true)).toBeNull();
  });

  it('should reject missing description', () => {
    const { description: _, ...noDesc } = validTheme;
    expect(validateThemeDef(noDesc)).toBeNull();
  });

  it('should reject non-string description', () => {
    expect(validateThemeDef({ ...validTheme, description: 123 })).toBeNull();
  });

  it('should reject missing colors object', () => {
    expect(validateThemeDef({ description: 'x' })).toBeNull();
  });

  it('should reject non-object colors', () => {
    expect(validateThemeDef({ description: 'x', colors: 'red' })).toBeNull();
  });

  it('should reject missing color key', () => {
    const colors = { ...validTheme.colors };
    delete (colors as Record<string, string>)['primary'];
    expect(validateThemeDef({ description: 'x', colors })).toBeNull();
  });

  it('should reject invalid hex color format', () => {
    const colors = { ...validTheme.colors, primary: 'red' };
    expect(validateThemeDef({ description: 'x', colors })).toBeNull();
  });

  it('should reject 3-digit hex colors', () => {
    const colors = { ...validTheme.colors, primary: '#F00' };
    expect(validateThemeDef({ description: 'x', colors })).toBeNull();
  });

  it('should reject 8-digit hex colors (with alpha)', () => {
    const colors = { ...validTheme.colors, primary: '#FF0000FF' };
    expect(validateThemeDef({ description: 'x', colors })).toBeNull();
  });
});

describe('loadCustomThemes', () => {
  let testDir: string;

  const validThemeJson = JSON.stringify({
    description: 'My custom neon theme',
    colors: {
      primary: '#39FF14',
      secondary: '#FF6EC7',
      success: '#00FF00',
      error: '#FF0000',
      warning: '#FFD700',
      info: '#00CED1',
      muted: '#555555',
      text: '#EEEEEE',
      border: '#444444',
    },
  });

  beforeEach(async () => {
    resetThemes();
    testDir = join(tmpdir(), `opta-theme-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    resetThemes();
    await rm(testDir, { recursive: true, force: true });
  });

  it('should return built-in themes when no custom dirs exist', async () => {
    const result = await loadCustomThemes(true, [
      join(testDir, 'nonexistent1'),
      join(testDir, 'nonexistent2'),
    ]);
    expect(Object.keys(result)).toContain('opta');
    expect(Object.keys(result)).toContain('minimal');
    expect(Object.keys(result).length).toBe(5); // 5 built-in
  });

  it('should load a valid custom theme from directory', async () => {
    const themesDir = join(testDir, 'themes');
    await mkdir(themesDir, { recursive: true });
    await writeFile(join(themesDir, 'neon.json'), validThemeJson);

    const result = await loadCustomThemes(true, [themesDir]);
    expect(result['neon']).toBeDefined();
    expect(result['neon']!.description).toBe('My custom neon theme');
    expect(result['neon']!.colors.primary).toBe('#39FF14');
  });

  it('should skip invalid JSON files silently', async () => {
    const themesDir = join(testDir, 'themes');
    await mkdir(themesDir, { recursive: true });
    await writeFile(join(themesDir, 'bad.json'), '{ not valid json }}}');
    await writeFile(join(themesDir, 'good.json'), validThemeJson);

    const result = await loadCustomThemes(true, [themesDir]);
    expect(result['bad']).toBeUndefined();
    expect(result['good']).toBeDefined();
  });

  it('should skip files that fail validation silently', async () => {
    const themesDir = join(testDir, 'themes');
    await mkdir(themesDir, { recursive: true });
    await writeFile(join(themesDir, 'incomplete.json'), JSON.stringify({
      description: 'Missing color keys',
      colors: { primary: '#FF0000' },
    }));
    await writeFile(join(themesDir, 'valid.json'), validThemeJson);

    const result = await loadCustomThemes(true, [themesDir]);
    expect(result['incomplete']).toBeUndefined();
    expect(result['valid']).toBeDefined();
  });

  it('should skip non-json files', async () => {
    const themesDir = join(testDir, 'themes');
    await mkdir(themesDir, { recursive: true });
    await writeFile(join(themesDir, 'readme.txt'), 'not a theme');
    await writeFile(join(themesDir, 'neon.json'), validThemeJson);

    const result = await loadCustomThemes(true, [themesDir]);
    expect(result['readme']).toBeUndefined();
    expect(result['neon']).toBeDefined();
  });

  it('should allow custom theme to override a built-in theme', async () => {
    const themesDir = join(testDir, 'themes');
    await mkdir(themesDir, { recursive: true });
    const customOpta = JSON.stringify({
      description: 'Custom Opta override',
      colors: {
        primary: '#FF0000',
        secondary: '#00FF00',
        success: '#0000FF',
        error: '#FFFF00',
        warning: '#FF00FF',
        info: '#00FFFF',
        muted: '#111111',
        text: '#222222',
        border: '#333333',
      },
    });
    await writeFile(join(themesDir, 'opta.json'), customOpta);

    const result = await loadCustomThemes(true, [themesDir]);
    expect(result['opta']!.description).toBe('Custom Opta override');
    expect(result['opta']!.colors.primary).toBe('#FF0000');
  });

  it('should merge themes from multiple directories', async () => {
    const dir1 = join(testDir, 'global');
    const dir2 = join(testDir, 'project');
    await mkdir(dir1, { recursive: true });
    await mkdir(dir2, { recursive: true });

    await writeFile(join(dir1, 'neon.json'), validThemeJson);
    await writeFile(join(dir2, 'ocean.json'), JSON.stringify({
      description: 'Deep ocean theme',
      colors: {
        primary: '#0077B6',
        secondary: '#00B4D8',
        success: '#06D6A0',
        error: '#EF476F',
        warning: '#FFD166',
        info: '#118AB2',
        muted: '#495057',
        text: '#E9ECEF',
        border: '#343A40',
      },
    }));

    const result = await loadCustomThemes(true, [dir1, dir2]);
    expect(result['neon']).toBeDefined();
    expect(result['ocean']).toBeDefined();
  });

  it('should let project-level theme override global-level theme of same name', async () => {
    const globalDir = join(testDir, 'global');
    const projectDir = join(testDir, 'project');
    await mkdir(globalDir, { recursive: true });
    await mkdir(projectDir, { recursive: true });

    await writeFile(join(globalDir, 'custom.json'), JSON.stringify({
      description: 'Global custom',
      colors: {
        primary: '#111111',
        secondary: '#222222',
        success: '#333333',
        error: '#444444',
        warning: '#555555',
        info: '#666666',
        muted: '#777777',
        text: '#888888',
        border: '#999999',
      },
    }));
    await writeFile(join(projectDir, 'custom.json'), JSON.stringify({
      description: 'Project custom',
      colors: {
        primary: '#AAAAAA',
        secondary: '#BBBBBB',
        success: '#CCCCCC',
        error: '#DDDDDD',
        warning: '#EEEEEE',
        info: '#FFFFFF',
        muted: '#111111',
        text: '#222222',
        border: '#333333',
      },
    }));

    const result = await loadCustomThemes(true, [globalDir, projectDir]);
    // Project dir is second, so it wins
    expect(result['custom']!.description).toBe('Project custom');
    expect(result['custom']!.colors.primary).toBe('#AAAAAA');
  });

  it('should make custom themes available via setTheme/getTheme', async () => {
    const themesDir = join(testDir, 'themes');
    await mkdir(themesDir, { recursive: true });
    await writeFile(join(themesDir, 'neon.json'), validThemeJson);

    await loadCustomThemes(true, [themesDir]);
    setTheme('neon');
    const current = getTheme();
    expect(current.name).toBe('neon');
    expect(current.description).toBe('My custom neon theme');
    expect(current.colors.primary).toBe('#39FF14');
  });

  it('should mark custom themes in listThemes output', async () => {
    const themesDir = join(testDir, 'themes');
    await mkdir(themesDir, { recursive: true });
    await writeFile(join(themesDir, 'neon.json'), validThemeJson);

    await loadCustomThemes(true, [themesDir]);
    const themes = listThemes();
    const neon = themes.find(t => t.name === 'neon');
    const opta = themes.find(t => t.name === 'opta');
    expect(neon).toBeDefined();
    expect(neon!.custom).toBe(true);
    expect(opta).toBeDefined();
    expect(opta!.custom).toBeUndefined();
  });

  it('should not re-read from disk on second call without force', async () => {
    const themesDir = join(testDir, 'themes');
    await mkdir(themesDir, { recursive: true });
    await writeFile(join(themesDir, 'neon.json'), validThemeJson);

    await loadCustomThemes(true, [themesDir]); // force=true, first load
    expect(listThemes().find(t => t.name === 'neon')).toBeDefined();

    // Write a second theme file
    await writeFile(join(themesDir, 'ocean.json'), JSON.stringify({
      description: 'Ocean',
      colors: {
        primary: '#0077B6',
        secondary: '#00B4D8',
        success: '#06D6A0',
        error: '#EF476F',
        warning: '#FFD166',
        info: '#118AB2',
        muted: '#495057',
        text: '#E9ECEF',
        border: '#343A40',
      },
    }));

    // Without force, should not pick up the new file
    await loadCustomThemes(false, [themesDir]);
    expect(listThemes().find(t => t.name === 'ocean')).toBeUndefined();

    // With force, should pick it up
    await loadCustomThemes(true, [themesDir]);
    expect(listThemes().find(t => t.name === 'ocean')).toBeDefined();
  });

  it('should produce working chalk instances for custom themes', async () => {
    const themesDir = join(testDir, 'themes');
    await mkdir(themesDir, { recursive: true });
    await writeFile(join(themesDir, 'neon.json'), validThemeJson);

    await loadCustomThemes(true, [themesDir]);
    setTheme('neon');
    const theme = getTheme();

    // Verify all chalk instances work
    expect(typeof theme.primary('test')).toBe('string');
    expect(typeof theme.secondary('test')).toBe('string');
    expect(typeof theme.success('test')).toBe('string');
    expect(typeof theme.error('test')).toBe('string');
    expect(typeof theme.warning('test')).toBe('string');
    expect(typeof theme.info('test')).toBe('string');
    expect(typeof theme.muted('test')).toBe('string');
    expect(typeof theme.dim('test')).toBe('string');
  });
});

import chalk, { type ChalkInstance } from 'chalk';
import { join } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { getThemesDir } from '../platform/paths.js';

export interface ThemeColors {
  primary: string;
  secondary: string;
  success: string;
  error: string;
  warning: string;
  info: string;
  muted: string;
  text: string;
  border: string;
}

export interface Theme {
  name: string;
  description: string;
  colors: ThemeColors;
  primary: ChalkInstance;
  secondary: ChalkInstance;
  success: ChalkInstance;
  error: ChalkInstance;
  warning: ChalkInstance;
  info: ChalkInstance;
  muted: ChalkInstance;
  dim: ChalkInstance;
}

/** Raw theme definition before chalk instances are built. */
export interface ThemeDef {
  description: string;
  colors: ThemeColors;
}

const THEME_COLOR_KEYS: ReadonlyArray<keyof ThemeColors> = [
  'primary', 'secondary', 'success', 'error', 'warning',
  'info', 'muted', 'text', 'border',
];

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const BUILTIN_THEMES: Record<string, ThemeDef> = {
  opta: {
    description: 'Default Opta theme — Electric Violet accent',
    colors: {
      primary: '#A855F7',
      secondary: '#3B82F6',
      success: '#22C55E',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#06B6D4',
      muted: '#52525B',
      text: '#FAFAFA',
      border: '#3F3F46',
    },
  },
  minimal: {
    description: 'Minimal — muted grays, no color accents',
    colors: {
      primary: '#A1A1AA',
      secondary: '#71717A',
      success: '#A1A1AA',
      error: '#F87171',
      warning: '#FCD34D',
      info: '#A1A1AA',
      muted: '#52525B',
      text: '#E4E4E7',
      border: '#3F3F46',
    },
  },
  solarized: {
    description: 'Solarized Dark — warm tones',
    colors: {
      primary: '#268BD2',
      secondary: '#2AA198',
      success: '#859900',
      error: '#DC322F',
      warning: '#B58900',
      info: '#6C71C4',
      muted: '#586E75',
      text: '#FDF6E3',
      border: '#073642',
    },
  },
  dracula: {
    description: 'Dracula — purple and cyan',
    colors: {
      primary: '#BD93F9',
      secondary: '#8BE9FD',
      success: '#50FA7B',
      error: '#FF5555',
      warning: '#F1FA8C',
      info: '#8BE9FD',
      muted: '#6272A4',
      text: '#F8F8F2',
      border: '#44475A',
    },
  },
  catppuccin: {
    description: 'Catppuccin Mocha — pastel colors',
    colors: {
      primary: '#CBA6F7',
      secondary: '#89B4FA',
      success: '#A6E3A1',
      error: '#F38BA8',
      warning: '#F9E2AF',
      info: '#74C7EC',
      muted: '#585B70',
      text: '#CDD6F4',
      border: '#45475A',
    },
  },
};

/** Merged registry: built-in + custom themes. */
let themeRegistry: Record<string, ThemeDef> = { ...BUILTIN_THEMES };
let customThemesLoaded = false;
let currentThemeName = 'opta';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate that a parsed JSON value is a well-formed theme definition.
 * Returns the validated ThemeDef or null if invalid.
 */
export function validateThemeDef(value: unknown): ThemeDef | null {
  if (typeof value !== 'object' || value === null) return null;

  const obj = value as Record<string, unknown>;

  if (typeof obj['description'] !== 'string') return null;

  const colors = obj['colors'];
  if (typeof colors !== 'object' || colors === null) return null;

  const colorsObj = colors as Record<string, unknown>;
  for (const key of THEME_COLOR_KEYS) {
    const val = colorsObj[key];
    if (typeof val !== 'string' || !HEX_COLOR_RE.test(val)) return null;
  }

  return {
    description: obj['description'],
    colors: colorsObj as unknown as ThemeColors,
  };
}

// ---------------------------------------------------------------------------
// Custom theme loading
// ---------------------------------------------------------------------------

/**
 * Directories searched for custom theme JSON files (in order).
 * Later directories win on name conflicts; custom always overrides built-in.
 */
export function getCustomThemeDirs(): string[] {
  return [
    getThemesDir(),
    join(process.cwd(), '.opta', 'themes'),
  ];
}

/**
 * Read *.json files from a single directory and return validated theme defs.
 * Silently skips files that fail to parse or validate.
 */
async function loadThemesFromDir(
  dir: string,
): Promise<Record<string, ThemeDef>> {
  const result: Record<string, ThemeDef> = {};

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    // Directory does not exist or is inaccessible — not an error.
    return result;
  }

  const jsonFiles = entries.filter((f) => f.endsWith('.json'));
  for (const file of jsonFiles) {
    try {
      const raw = await readFile(join(dir, file), 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      const def = validateThemeDef(parsed);
      if (def) {
        // Theme name derived from filename without .json extension.
        const name = file.replace(/\.json$/, '');
        result[name] = def;
      }
    } catch {
      // Malformed JSON — skip silently.
    }
  }

  return result;
}

/**
 * Load custom themes from all theme directories and merge them with built-in
 * themes. Custom themes override built-in themes if names conflict.
 *
 * Safe to call multiple times — only reads from disk on the first call
 * (unless `force` is true).
 *
 * @param force  Re-read from disk even if already loaded.
 * @param dirs   Override the directories to scan (for testing).
 */
export async function loadCustomThemes(
  force = false,
  dirs?: string[],
): Promise<Record<string, ThemeDef>> {
  if (customThemesLoaded && !force) return themeRegistry;

  const merged: Record<string, ThemeDef> = { ...BUILTIN_THEMES };

  for (const dir of (dirs ?? getCustomThemeDirs())) {
    const custom = await loadThemesFromDir(dir);
    Object.assign(merged, custom);
  }

  themeRegistry = merged;
  customThemesLoaded = true;
  return merged;
}

/**
 * Initialize the theme system by loading custom themes. Call once during app
 * startup. If custom theme loading fails for any reason, the built-in themes
 * remain available.
 */
export async function initThemes(): Promise<void> {
  await loadCustomThemes();
}

// ---------------------------------------------------------------------------
// Theme access (synchronous — uses the last loaded registry)
// ---------------------------------------------------------------------------

function buildTheme(name: string): Theme {
  const def = themeRegistry[name] ?? themeRegistry['opta'] ?? BUILTIN_THEMES['opta']!;
  const colors = def.colors;

  return {
    name: themeRegistry[name] ? name : 'opta',
    description: def.description,
    colors,
    primary: chalk.hex(colors.primary),
    secondary: chalk.hex(colors.secondary),
    success: chalk.hex(colors.success),
    error: chalk.hex(colors.error),
    warning: chalk.hex(colors.warning),
    info: chalk.hex(colors.info),
    muted: chalk.hex(colors.muted),
    dim: chalk.dim,
  };
}

export function getTheme(): Theme {
  return buildTheme(currentThemeName);
}

export function setTheme(name: string): void {
  if (themeRegistry[name]) {
    currentThemeName = name;
  }
}

export function listThemes(): Array<{ name: string; description: string; custom?: boolean }> {
  return Object.entries(themeRegistry).map(([name, def]) => ({
    name,
    description: def.description,
    ...(BUILTIN_THEMES[name] ? {} : { custom: true }),
  }));
}

/**
 * Reset theme registry to built-in only and clear current selection.
 * Used for testing.
 */
export function resetThemes(): void {
  themeRegistry = { ...BUILTIN_THEMES };
  customThemesLoaded = false;
  currentThemeName = 'opta';
}

import chalk, { type ChalkInstance } from 'chalk';

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

const THEMES: Record<string, { description: string; colors: ThemeColors }> = {
  opta: {
    description: 'Default Opta theme — Electric Violet accent',
    colors: {
      primary: '#8B5CF6',
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

let currentThemeName = 'opta';

function buildTheme(name: string): Theme {
  const def = THEMES[name] ?? THEMES['opta']!;
  const colors = def.colors;

  return {
    name,
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
  if (THEMES[name]) {
    currentThemeName = name;
  }
}

export function listThemes(): Array<{ name: string; description: string }> {
  return Object.entries(THEMES).map(([name, def]) => ({
    name,
    description: def.description,
  }));
}

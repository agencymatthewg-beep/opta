/**
 * Command Registry - Opta Command Palette
 *
 * Defines all available commands for keyboard-first navigation and action execution.
 *
 * @see DESIGN_SYSTEM.md - Part 1: Brand Identity (Helpful, Efficient)
 */

import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Gauge,
  Gamepad2,
  Zap,
  Settings,
  Play,
  EyeOff,
  Target,
  Trophy,
} from 'lucide-react';

/**
 * Command action handlers interface.
 * These are provided by the app when creating commands.
 */
export interface CommandActions {
  runOptimization: () => void | Promise<void>;
  toggleStealth: () => void | Promise<void>;
}

/**
 * Command group types for organizing the palette.
 */
export type CommandGroup = 'navigation' | 'actions' | 'utilities';

/**
 * Individual command definition.
 */
export interface Command {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Keyboard shortcut hint (display only) */
  shortcut?: string;
  /** Command grouping */
  group: CommandGroup;
  /** Action to execute when selected */
  action: () => void | Promise<void>;
  /** Additional search keywords for fuzzy matching */
  keywords?: string[];
}

/**
 * Group labels for command sections.
 */
export const groupLabels: Record<CommandGroup, string> = {
  navigation: 'Navigation',
  actions: 'Actions',
  utilities: 'Utilities',
};

/**
 * Creates the complete command registry.
 *
 * @param navigate - Navigation function from the app
 * @param actions - Action handlers from the app
 * @returns Array of all available commands
 */
export function createCommands(
  navigate: (path: string) => void,
  actions: CommandActions
): Command[] {
  return [
    // Navigation commands
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      icon: Home,
      group: 'navigation',
      action: () => navigate('dashboard'),
      keywords: ['home', 'main', 'overview'],
    },
    {
      id: 'nav-score',
      label: 'Go to Score',
      icon: Trophy,
      group: 'navigation',
      action: () => navigate('score'),
      keywords: ['points', 'stats', 'performance'],
    },
    {
      id: 'nav-games',
      label: 'Go to Games',
      icon: Gamepad2,
      group: 'navigation',
      action: () => navigate('games'),
      keywords: ['library', 'titles', 'play'],
    },
    {
      id: 'nav-optimize',
      label: 'Go to Optimize',
      icon: Zap,
      group: 'navigation',
      action: () => navigate('optimize'),
      keywords: ['boost', 'tune', 'improve'],
    },
    {
      id: 'nav-pinpoint',
      label: 'Go to Pinpoint Optimize',
      icon: Target,
      group: 'navigation',
      action: () => navigate('pinpoint'),
      keywords: ['precision', 'specific', 'detailed'],
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      icon: Settings,
      group: 'navigation',
      action: () => navigate('settings'),
      shortcut: '\u2318,',
      keywords: ['preferences', 'config', 'options'],
    },

    // Action commands
    {
      id: 'action-optimize',
      label: 'Run Quick Optimization',
      icon: Play,
      group: 'actions',
      action: actions.runOptimization,
      shortcut: '\u2318\u21e7O',
      keywords: ['boost', 'improve', 'enhance', 'speed'],
    },
    {
      id: 'action-stealth',
      label: 'Toggle Stealth Mode',
      icon: EyeOff,
      group: 'actions',
      action: actions.toggleStealth,
      keywords: ['hide', 'invisible', 'background', 'quiet'],
    },

    // Utilities (can be expanded later)
    {
      id: 'util-score',
      label: 'View Optimization Score',
      icon: Gauge,
      group: 'utilities',
      action: () => navigate('score'),
      keywords: ['metrics', 'health', 'check'],
    },
  ];
}

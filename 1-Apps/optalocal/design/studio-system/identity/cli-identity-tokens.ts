/**
 * Opta CLI Feature Identity Tokens
 *
 * Drop-in additions to palette.ts in 1D-Opta-CLI-TS/src/tui/palette.ts.
 * These extend TUI_COLORS with the three canonical feature identities.
 *
 * Source of truth: design/studio-system/identity/ECOSYSTEM-IDENTITY.md
 */

/**
 * The three feature identity colours to ADD to TUI_COLORS in palette.ts.
 * These match exactly the CSS tokens in ecosystem-identity-tokens.css.
 */
export const FEATURE_IDENTITY_COLORS = {
  // Opta Browser — cyan #22d3ee
  // Use for: browser menu items, localhost status, web session indicators,
  //          browser control overlay border, browser rail accent
  browser: '#22d3ee',

  // Opta Models — soft violet #a78bfa
  // Use for: model picker active selection, LMX status indicator,
  //          settings "Models" page tab colour, model list highlights
  //          Note: distinct from #8b5cf6 (brand) and #a855f7 (glow)
  models: '#a78bfa',

  // Opta Atpo — pink #f472b6
  // Use for: Atpo menu items, app management indicators,
  //          settings "Atpo" page tab colour, fleet status
  //          FIX: was incorrectly #c084fc — corrected to #f472b6
  atpo: '#f472b6',
} as const;

/**
 * Updated PAGES array for SettingsOverlay.tsx.
 *
 * CHANGES FROM CURRENT:
 *   - atpo:     #c084fc → #f472b6  (Atpo is pink, not light purple)
 *   - advanced: #22d3ee → #94a3b8  (cyan freed, reserved for browser)
 *
 * When a dedicated browser settings page is added, add:
 *   { id: 'browser', label: 'Browser', color: '#22d3ee' }
 */
export const SETTINGS_PAGES_CANONICAL = [
  { id: 'connection', label: 'Connection', color: '#10b981' },  // emerald — unchanged
  { id: 'models',     label: 'Models',     color: '#a78bfa' },  // ✓ models violet — already correct
  { id: 'safety',     label: 'Safety',     color: '#f59e0b' },  // amber — unchanged
  { id: 'system',     label: 'System',     color: '#38bdf8' },  // sky blue — unchanged
  { id: 'advanced',   label: 'Advanced',   color: '#94a3b8' },  // slate — was cyan (freed)
  { id: 'atpo',       label: 'Atpo',       color: '#f472b6' },  // FIX: was #c084fc, now pink
  { id: 'actions',    label: 'Actions',    color: '#ec4899' },  // unchanged
  { id: 'account',    label: 'Account',    color: '#60a5fa' },  // blue — slight adjust for pink conflict
] as const;

/**
 * ANSI/chalk equivalents for terminal rendering.
 *
 * chalk.hex() is the standard in the CLI codebase (uses chalk v5).
 * These are safe to use anywhere chalk is imported.
 */
export const FEATURE_CHALK = {
  browser: (text: string) => `\x1b[38;2;34;211;238m${text}\x1b[0m`,   // #22d3ee
  models:  (text: string) => `\x1b[38;2;167;139;250m${text}\x1b[0m`,  // #a78bfa
  atpo:    (text: string) => `\x1b[38;2;244;114;182m${text}\x1b[0m`,  // #f472b6
} as const;

// Usage with chalk (preferred in codebase):
// import chalk from 'chalk';
// chalk.hex(FEATURE_IDENTITY_COLORS.browser)('Opta Browser')
// chalk.hex(FEATURE_IDENTITY_COLORS.models)('Opta Models')
// chalk.hex(FEATURE_IDENTITY_COLORS.atpo)('Opta Atpo')

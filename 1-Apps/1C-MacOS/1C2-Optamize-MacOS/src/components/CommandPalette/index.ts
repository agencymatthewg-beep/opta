/**
 * CommandPalette - Opta's Keyboard-First Command Interface
 *
 * Opens with Cmd+K (macOS) or Ctrl+K (Windows/Linux).
 *
 * Features:
 * - Fuzzy search across all commands
 * - Navigation shortcuts to any page
 * - Action execution (optimize, stealth mode)
 * - ARIA-compliant for accessibility
 *
 * @example
 * ```tsx
 * import { CommandPalette } from '@/components/CommandPalette';
 *
 * function App() {
 *   return (
 *     <CommandPalette
 *       navigate={(page) => setActivePage(page)}
 *       actions={{
 *         runOptimization: () => console.log('Optimizing...'),
 *         toggleStealth: () => setStealthMode((s) => !s),
 *       }}
 *     />
 *   );
 * }
 * ```
 *
 * @module CommandPalette
 */

export { CommandPalette, default } from './CommandPalette';
export type { CommandPaletteProps } from './CommandPalette';
export { createCommands, groupLabels } from './commands';
export type { Command, CommandGroup, CommandActions } from './commands';

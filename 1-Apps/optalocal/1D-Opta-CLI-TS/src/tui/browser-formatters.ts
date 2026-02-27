import type { BrowserRiskLevel } from '../browser/policy-engine.js';
import { TUI_COLORS } from './palette.js';

/** Returns the Ink color string for a given browser risk level. */
export function riskColor(level: BrowserRiskLevel): string {
  switch (level) {
    case 'high':
      return TUI_COLORS.danger;
    case 'medium':
      return TUI_COLORS.warning;
    default:
      return TUI_COLORS.success;
  }
}

/** Returns a numeric sort priority for a given browser risk level (higher = more urgent). */
export function riskPriority(level: BrowserRiskLevel): number {
  switch (level) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

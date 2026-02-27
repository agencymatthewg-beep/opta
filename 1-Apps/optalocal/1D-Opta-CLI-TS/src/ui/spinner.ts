import { isTTY } from './output.js';
import { colorizeOptaWord } from './brand.js';

/** Shared Opta-themed orbit animation used across CLI + TUI status elements. */
export const OPTA_ORBIT_FRAMES = ['◌', '◔', '◑', '◕', '●', '◕', '◑', '◔'] as const;

export interface Spinner {
  start(text: string): void;
  succeed(text: string): void;
  fail(text: string): void;
  stop(): void;
}

export async function createSpinner(): Promise<Spinner> {
  if (!isTTY) {
    return {
      start(text: string) { console.log(`[working] ${colorizeOptaWord(text)}`); },
      succeed(text: string) { console.log(`[done] ${colorizeOptaWord(text)}`); },
      fail(text: string) { console.error(`[error] ${colorizeOptaWord(text)}`); },
      stop() {},
    };
  }

  const { default: ora } = await import('ora');
  const spinner = ora({
    color: 'magenta',
    spinner: {
      interval: 90,
      frames: [...OPTA_ORBIT_FRAMES],
    },
  });

  return {
    start(text: string) { spinner.start(colorizeOptaWord(text)); },
    succeed(text: string) { spinner.succeed(colorizeOptaWord(text)); },
    fail(text: string) { spinner.fail(colorizeOptaWord(text)); },
    stop() { spinner.stop(); },
  };
}

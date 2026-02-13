import { isTTY } from './output.js';

export interface Spinner {
  start(text: string): void;
  succeed(text: string): void;
  fail(text: string): void;
  stop(): void;
}

export async function createSpinner(): Promise<Spinner> {
  if (!isTTY) {
    return {
      start(text: string) { console.log(`[working] ${text}`); },
      succeed(text: string) { console.log(`[done] ${text}`); },
      fail(text: string) { console.error(`[error] ${text}`); },
      stop() {},
    };
  }

  const { default: ora } = await import('ora');
  const spinner = ora();

  return {
    start(text: string) { spinner.start(text); },
    succeed(text: string) { spinner.succeed(text); },
    fail(text: string) { spinner.fail(text); },
    stop() { spinner.stop(); },
  };
}

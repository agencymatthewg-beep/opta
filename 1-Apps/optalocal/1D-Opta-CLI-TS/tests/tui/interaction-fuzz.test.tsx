import { EventEmitter } from 'node:events';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from '../../src/tui/App.js';
import { createTuiEmitter } from '../../src/tui/adapter.js';
import { sanitizeTerminalText, visibleTextWidth } from '../../src/utils/text.js';

class MockStdout extends EventEmitter {
  columns: number;
  rows: number;
  isTTY = true;

  constructor(columns: number, rows: number) {
    super();
    this.columns = columns;
    this.rows = rows;
  }

  write(): boolean {
    return true;
  }
}

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function randomInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[randomInt(rand, 0, items.length - 1)]!;
}

const KEYS = [
  'a',
  'b',
  '/',
  '\r',
  '\x1B',
  '\x1B[A',
  '\x1B[B',
  '\x1B[C',
  '\x1B[D',
  '\t',
  '\x0F', // Ctrl+O command browser
  '\x0E', // Ctrl+N safe-mode toggle
] as const;

const STREAM_CHUNKS = [
  'hello ',
  'working? ',
  '### heading\n',
  '```ts\nconst x = 1;\n```\n',
  '┌ box ┐\n│ row │\n└─────┘\n',
  'glm ',
  'kimi-k2.5 ',
  '✅ done\n',
] as const;

const flush = (ms = 8) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function assertFrameIntegrity(frame: string, width: number): void {
  const normalized = sanitizeTerminalText(frame);
  expect(normalized).not.toContain('undefined');
  expect(normalized).not.toContain('NaN');
  expect(normalized).not.toContain('Infinity');
  expect(normalized).not.toContain('�');
  expect(normalized).not.toMatch(/[\u0000-\u0008\u000B-\u001F\u007F]/);

  const hardCap = Math.max(220, width + 120);
  for (const line of normalized.split('\n')) {
    expect(visibleTextWidth(line)).toBeLessThanOrEqual(hardCap);
  }
}

describe('TUI interaction fuzzer', () => {
  it('handles random key sequences, resizes, and stream chunks without frame corruption', { timeout: 20_000 }, async () => {
    const rand = createRng(1337420);
    const stdout = new MockStdout(112, 34) as unknown as NodeJS.WriteStream;
    const emitter = createTuiEmitter();

    const { stdin, lastFrame, unmount } = render(
      <App
        model="MiniMax-M2.5-4bit"
        sessionId="fuzz1234"
        emitter={emitter}
        onSubmit={() => {}}
      />,
      { stdout },
    );

    await flush(40);
    emitter.emit('turn:start');

    for (let i = 0; i < 220; i++) {
      const action = randomInt(rand, 0, 3);

      if (action === 0) {
        stdin.write(pick(rand, KEYS));
      } else if (action === 1) {
        const cols = randomInt(rand, 58, 136);
        const rows = randomInt(rand, 18, 42);
        (stdout as unknown as { columns: number }).columns = cols;
        (stdout as unknown as { rows: number }).rows = rows;
        (stdout as unknown as EventEmitter).emit('resize');
      } else if (action === 2) {
        emitter.emit('token', pick(rand, STREAM_CHUNKS));
      } else {
        const id = `tool-${i}`;
        emitter.emit('tool:start', 'search_files', id, JSON.stringify({ q: 'opta tui' }));
        if (rand() > 0.3) {
          emitter.emit('tool:end', 'search_files', id, '{"ok":true}');
        }
      }

      await flush();
      const frame = lastFrame() ?? '';
      const width = (stdout as unknown as { columns: number }).columns;
      assertFrameIntegrity(frame, width);
    }

    emitter.emit('turn:end', {
      tokens: 340,
      promptTokens: 120,
      completionTokens: 220,
      toolCalls: 10,
      elapsed: 5.2,
      speed: 42.3,
      firstTokenLatencyMs: 180,
    });

    await flush(30);
    const finalFrame = lastFrame() ?? '';
    const finalWidth = (stdout as unknown as { columns: number }).columns;
    assertFrameIntegrity(finalFrame, finalWidth);

    unmount();
  });
});

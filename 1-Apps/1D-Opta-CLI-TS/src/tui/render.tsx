import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import type { TuiEmitter } from './adapter.js';

/** Legacy render options — waits for full response before display. */
interface LegacyRenderOptions {
  model: string;
  sessionId: string;
  onMessage: (text: string) => Promise<string>;
}

/** Streaming render options — event-driven real-time display. */
interface StreamingRenderOptions {
  model: string;
  sessionId: string;
  emitter: TuiEmitter;
  onSubmit: (text: string) => void;
}

type RenderOptions = LegacyRenderOptions | StreamingRenderOptions;

function isStreamingOptions(opts: RenderOptions): opts is StreamingRenderOptions {
  return 'emitter' in opts;
}

export async function renderTUI(options: RenderOptions): Promise<void> {
  // Enter alternate buffer (full-screen mode)
  process.stdout.write('\x1b[?1049h');
  // Hide cursor
  process.stdout.write('\x1b[?25l');

  const appProps = isStreamingOptions(options)
    ? {
        model: options.model,
        sessionId: options.sessionId,
        emitter: options.emitter,
        onSubmit: options.onSubmit,
      }
    : {
        model: options.model,
        sessionId: options.sessionId,
        onMessage: options.onMessage,
      };

  const { waitUntilExit } = render(
    <App {...appProps} />,
    {
      exitOnCtrlC: true,
    }
  );

  await waitUntilExit();

  // Restore normal buffer
  process.stdout.write('\x1b[?25h'); // Show cursor
  process.stdout.write('\x1b[?1049l'); // Leave alternate buffer
}

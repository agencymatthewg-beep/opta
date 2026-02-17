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

// ANSI escape sequences for alternate screen buffer management
const ANSI_ENTER_ALT_BUFFER = '\x1b[?1049h';
const ANSI_LEAVE_ALT_BUFFER = '\x1b[?1049l';
const ANSI_HIDE_CURSOR = '\x1b[?25l';
const ANSI_SHOW_CURSOR = '\x1b[?25h';

function isStreamingOptions(opts: RenderOptions): opts is StreamingRenderOptions {
  return 'emitter' in opts;
}

export async function renderTUI(options: RenderOptions): Promise<void> {
  process.stdout.write(ANSI_ENTER_ALT_BUFFER);
  process.stdout.write(ANSI_HIDE_CURSOR);

  const { model, sessionId } = options;
  const appProps = isStreamingOptions(options)
    ? { model, sessionId, emitter: options.emitter, onSubmit: options.onSubmit }
    : { model, sessionId, onMessage: options.onMessage };

  const { waitUntilExit } = render(
    <App {...appProps} />,
    {
      exitOnCtrlC: true,
    }
  );

  await waitUntilExit();

  process.stdout.write(ANSI_SHOW_CURSOR);
  process.stdout.write(ANSI_LEAVE_ALT_BUFFER);
}

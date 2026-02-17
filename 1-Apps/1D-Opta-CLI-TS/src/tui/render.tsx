import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

interface RenderOptions {
  model: string;
  sessionId: string;
  onMessage: (text: string) => Promise<string>;
}

export async function renderTUI(options: RenderOptions): Promise<void> {
  // Enter alternate buffer (full-screen mode)
  process.stdout.write('\x1b[?1049h');
  // Hide cursor
  process.stdout.write('\x1b[?25l');

  const { waitUntilExit } = render(
    <App
      model={options.model}
      sessionId={options.sessionId}
      onMessage={options.onMessage}
    />,
    {
      exitOnCtrlC: true,
    }
  );

  await waitUntilExit();

  // Restore normal buffer
  process.stdout.write('\x1b[?25h'); // Show cursor
  process.stdout.write('\x1b[?1049l'); // Leave alternate buffer
}

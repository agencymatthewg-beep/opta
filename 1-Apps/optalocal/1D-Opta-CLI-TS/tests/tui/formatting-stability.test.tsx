import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'node:events';
import React from 'react';
import { render } from 'ink-testing-library';
import { MessageList } from '../../src/tui/MessageList.js';
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

const WIDTHS = [72, 96, 128] as const;

const OUTPUT_MATRIX = [
  {
    name: 'dense-prose',
    messages: [
      {
        role: 'assistant',
        content: 'PipelineStatus: parseInput,buildExecutionPlan,runValidation,collectArtifacts,publishSummary. NextStepRequiresFurtherVerificationBeforeFinalDelivery and should remain readable.',
      },
    ],
  },
  {
    name: 'table',
    messages: [
      {
        role: 'assistant',
        content: '## Matrix\n\n| Tool | Status | Notes |\n| --- | --- | --- |\n| read_file | ok | loaded |\n| write_file | ok | stable |\n| run_command | ask | guarded |',
      },
    ],
  },
  {
    name: 'code-fence',
    messages: [
      {
        role: 'assistant',
        content: '```json\n{"status":"ok","records":[{"id":1,"result":"pass"},{"id":2,"result":"pass"}]}\n```',
      },
    ],
  },
  {
    name: 'mixed-turn',
    messages: [
      {
        role: 'user',
        content: 'Please evaluate long formatting behavior for multi-output responses with safety and spacing checks.',
      },
      {
        role: 'assistant',
        content: 'Working through checks now. ResultSummary: formattingStable,spacingStable,wrapStable,tablesAligned.',
      },
      {
        role: 'system',
        content: '┌───────────────┐\n│ runtime check │\n└───────────────┘',
      },
    ],
  },
  {
    name: 'long-unbroken-token',
    messages: [
      {
        role: 'assistant',
        content: `ExecutionBlob: ${'x'.repeat(220)}`,
      },
    ],
  },
] as const;

function buildLongSessionMessages(turns = 30): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (let turn = 1; turn <= turns; turn++) {
    messages.push({
      role: 'user',
      content: `Turn ${turn}: validate resilient formatting for dense multi-step output blocks and long conversational memory.`,
    });

    const denseParagraph = `ExecutionSummary${turn}: parseInput,compileContext,validateSpacing,renderMarkdown,estimateViewportRows,persistHistory,refreshHints,finalizeTurn,emitDiagnostics.`;
    const tableBlock = turn % 5 === 0
      ? '\n\n| Check | Status | Notes |\n| --- | --- | --- |\n| wrap | pass | bounded |\n| timestamp | pass | isolated |\n| separators | pass | stable |'
      : '';
    messages.push({
      role: 'assistant',
      content: `${denseParagraph}${tableBlock}`,
    });
  }
  return messages;
}

function isLineWithinViewport(line: string, width: number): boolean {
  const stripped = line.replace(/\s+$/, '');
  if (!stripped) return true;
  return visibleTextWidth(stripped) <= width;
}

describe('formatting stability matrix', () => {
  for (const width of WIDTHS) {
    for (const scenario of OUTPUT_MATRIX) {
      it(`keeps lines bounded at ${width} cols for ${scenario.name}`, () => {
        const stdout = new MockStdout(width, 40) as unknown as NodeJS.WriteStream;
        const { lastFrame, unmount } = render(
          <MessageList
            messages={[...scenario.messages]}
            terminalWidth={width}
            height={24}
            thinkingExpanded={false}
          />,
          { stdout },
        );

        const frame = sanitizeTerminalText(lastFrame() ?? '');
        const lines = frame.split('\n');
        const viewportWidth = visibleTextWidth((lines[0] ?? '').replace(/\s+$/, ''));
        expect(viewportWidth).toBeGreaterThan(0);
        expect(lines.every((line) => isLineWithinViewport(line, viewportWidth))).toBe(true);
        unmount();
      });
    }
  }

  it('splits dense expansion output into readable multi-line chunks', () => {
    const stdout = new MockStdout(96, 40) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <MessageList
        messages={[
          {
            role: 'assistant',
            content: 'PipelineStatus: parseInput,buildExecutionPlan,runValidation,collectArtifacts,publishSummary,verifyTrace,compareDiffs,finalizeReport,archiveRun,notifyOperator.',
          },
        ]}
        terminalWidth={96}
        height={24}
        thinkingExpanded={false}
      />,
      { stdout },
    );

    const frame = sanitizeTerminalText(lastFrame() ?? '');
    expect(frame).toContain('parse Input,');
    expect(frame).toContain('build Execution Plan,');
    expect(frame).not.toContain('parseInput,buildExecutionPlan');
    unmount();
  });

  it('keeps assistant message body separate from timestamp rows', () => {
    const stdout = new MockStdout(96, 40) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <MessageList
        messages={[
          { role: 'assistant', content: 'Investigate long formatting outputs under stress and confirm layout stability.' },
        ]}
        terminalWidth={96}
        height={24}
        thinkingExpanded={false}
      />,
      { stdout },
    );

    const frame = sanitizeTerminalText(lastFrame() ?? '');
    const lines = frame.split('\n');
    const timestampInContentLine = lines.some((line) =>
      /(?:am|pm)/i.test(line)
      && /investigate long formatting|layout stability/i.test(line),
    );
    expect(timestampInContentLine).toBe(false);
    expect(frame.toLowerCase()).toContain('investigate long formatting');
    expect(frame.toLowerCase()).toContain('layout stability');
    unmount();
  });

  it('preserves code fence payload readability for structured output', () => {
    const stdout = new MockStdout(96, 40) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <MessageList
        messages={[
          {
            role: 'assistant',
            content: '```json\n{\"status\":\"ok\",\"records\":[{\"id\":1,\"result\":\"pass\"}]}\n```',
          },
        ]}
        terminalWidth={96}
        height={24}
        thinkingExpanded={false}
      />,
      { stdout },
    );

    const frame = sanitizeTerminalText(lastFrame() ?? '');
    expect(frame).toContain('"status":"ok"');
    expect(frame).toContain('"result":"pass"');
    unmount();
  });

  for (const width of WIDTHS) {
    it(`keeps long-session output bounded at ${width} cols`, () => {
      const stdout = new MockStdout(width, 42) as unknown as NodeJS.WriteStream;
      const { lastFrame, unmount } = render(
        <MessageList
          messages={buildLongSessionMessages(30)}
          terminalWidth={width}
          height={26}
          thinkingExpanded={false}
        />,
        { stdout },
      );

      const frame = sanitizeTerminalText(lastFrame() ?? '');
      const lines = frame.split('\n');
      const viewportWidth = visibleTextWidth((lines[0] ?? '').replace(/\s+$/, ''));
      expect(viewportWidth).toBeGreaterThan(0);
      expect(lines.every((line) => isLineWithinViewport(line, viewportWidth))).toBe(true);
      // Latest response should remain stable/readable at the tail of deep sessions.
      expect(frame).toContain('Execution Summary30');
      unmount();
    });
  }

  it('keeps live streaming bubble bounded with deep chat history', () => {
    const stdout = new MockStdout(96, 42) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <MessageList
        messages={buildLongSessionMessages(24)}
        terminalWidth={96}
        height={24}
        thinkingExpanded={false}
        liveStreamingText={'StreamingDiagnostics: validateViewportAlignment,checkTokenSpacing,confirmNoBorderBreaks,finalize.'}
      />,
      { stdout },
    );

    const frame = sanitizeTerminalText(lastFrame() ?? '');
    const lines = frame.split('\n');
    const viewportWidth = visibleTextWidth((lines[0] ?? '').replace(/\s+$/, ''));
    expect(lines.every((line) => isLineWithinViewport(line, viewportWidth))).toBe(true);
    expect(frame).toContain('streaming');
    unmount();
  });

  it('caps turn separator width so turn indicators stay readable on wide terminals', () => {
    const stdout = new MockStdout(160, 42) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <MessageList
        messages={[
          { role: 'user', content: 'Turn one' },
          { role: 'assistant', content: 'Response one' },
          { role: 'user', content: 'Turn two' },
          { role: 'assistant', content: 'Response two' },
        ]}
        terminalWidth={160}
        thinkingExpanded={false}
      />,
      { stdout },
    );

    const frame = sanitizeTerminalText(lastFrame() ?? '');
    const separatorLine = frame.split('\n').find((line) => line.includes('Turn 2'));
    expect(separatorLine).toBeDefined();
    expect(visibleTextWidth((separatorLine ?? '').trim())).toBeLessThanOrEqual(84);
    unmount();
  });
});

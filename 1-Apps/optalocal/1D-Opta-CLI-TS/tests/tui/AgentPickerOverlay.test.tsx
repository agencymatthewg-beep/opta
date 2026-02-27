import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { AgentPickerOverlay, AGENT_PROFILES } from '../../src/tui/AgentPickerOverlay.js';
import type { SubAgentDisplayState } from '../../src/core/subagent-events.js';

const flush = (ms = 20) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function makeAgent(overrides: Partial<SubAgentDisplayState> = {}): SubAgentDisplayState {
  return {
    id: 'test-agent-1',
    label: 'Research task',
    phase: 'thinking',
    spawnedAtMs: Date.now() - 5000,
    toolCallCount: 3,
    currentTool: 'read_file',
    toolHistory: ['read_file', 'search_files', 'read_file'],
    ...overrides,
  };
}

describe('AgentPickerOverlay', () => {
  it('renders all agent profiles with labels', async () => {
    const { lastFrame, unmount } = render(
      <AgentPickerOverlay
        activeAgents={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await flush();
    const frame = lastFrame();

    expect(frame).toContain('Agent Picker');
    expect(frame).toContain('Profiles');

    for (const profile of AGENT_PROFILES) {
      expect(frame).toContain(profile.label);
    }

    unmount();
  });

  it('shows profile description when focused', async () => {
    const { lastFrame, unmount } = render(
      <AgentPickerOverlay
        activeAgents={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await flush();
    const frame = lastFrame();

    // First profile (Researcher) should have its description visible
    expect(frame).toContain(AGENT_PROFILES[0]!.description);

    unmount();
  });

  it('navigates with arrow keys and selects on Enter', async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    const { stdin, lastFrame, unmount } = render(
      <AgentPickerOverlay
        activeAgents={[]}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    await flush();

    // Move down to Coder (index 1)
    stdin.write('\u001B[B'); // down arrow
    await flush();

    const frame = lastFrame();
    expect(frame).toContain(AGENT_PROFILES[1]!.description);

    // Select with Enter
    stdin.write('\r');
    await flush();

    expect(onSelect).toHaveBeenCalledWith({
      profile: AGENT_PROFILES[1],
    });

    unmount();
  });

  it('navigates with j/k keys', async () => {
    const onSelect = vi.fn();

    const { stdin, lastFrame, unmount } = render(
      <AgentPickerOverlay
        activeAgents={[]}
        onSelect={onSelect}
        onClose={vi.fn()}
      />,
    );

    await flush();

    // Move down with j to Coder
    stdin.write('j');
    await flush();
    expect(lastFrame()).toContain(AGENT_PROFILES[1]!.description);

    // Move back up with k to Researcher
    stdin.write('k');
    await flush();
    expect(lastFrame()).toContain(AGENT_PROFILES[0]!.description);

    unmount();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();

    const { stdin, unmount } = render(
      <AgentPickerOverlay
        activeAgents={[]}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );

    await flush();
    stdin.write('\u001B'); // escape
    await flush();

    expect(onClose).toHaveBeenCalled();

    unmount();
  });

  it('closes on left arrow', async () => {
    const onClose = vi.fn();

    const { stdin, unmount } = render(
      <AgentPickerOverlay
        activeAgents={[]}
        onSelect={vi.fn()}
        onClose={onClose}
      />,
    );

    await flush();
    stdin.write('\u001B[D'); // left arrow
    await flush();

    expect(onClose).toHaveBeenCalled();

    unmount();
  });

  it('shows active agents count in tab header', async () => {
    const agents = [
      makeAgent({ id: 'a1', label: 'Research task', phase: 'thinking' }),
      makeAgent({ id: 'a2', label: 'Code task', phase: 'done', result: 'Done' }),
    ];

    const { lastFrame, unmount } = render(
      <AgentPickerOverlay
        activeAgents={agents}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await flush();
    const frame = lastFrame();

    expect(frame).toContain('Active (1)');
    expect(frame).toContain('+ 1 done');

    unmount();
  });

  it('switches to active tab on Tab key', async () => {
    const agents = [
      makeAgent({ id: 'a1', label: 'Running research', phase: 'reading' }),
    ];

    const { stdin, lastFrame, unmount } = render(
      <AgentPickerOverlay
        activeAgents={agents}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await flush();

    // Switch to active tab
    stdin.write('\t');
    await flush();

    const frame = lastFrame();
    expect(frame).toContain('Running research');
    expect(frame).toContain('READING');
    expect(frame).toContain('3 calls');

    unmount();
  });

  it('shows tool history for focused active agent', async () => {
    const agents = [
      makeAgent({
        id: 'a1',
        label: 'Deep research',
        phase: 'searching',
        toolHistory: ['read_file', 'search_files', 'list_dir'],
      }),
    ];

    const { stdin, lastFrame, unmount } = render(
      <AgentPickerOverlay
        activeAgents={agents}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await flush();

    // Switch to active tab
    stdin.write('\t');
    await flush();

    const frame = lastFrame();
    expect(frame).toContain('read_file');
    expect(frame).toContain('search_files');

    unmount();
  });

  it('does not switch tabs when no active agents', async () => {
    const { stdin, lastFrame, unmount } = render(
      <AgentPickerOverlay
        activeAgents={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await flush();

    // Tab should be noop when no agents
    stdin.write('\t');
    await flush();

    const frame = lastFrame();
    // Should still show profiles section
    expect(frame).toContain('Researcher');

    unmount();
  });

  it('shows footer summary with agent counts', async () => {
    const agents = [
      makeAgent({ id: 'a1', phase: 'reading' }),
      makeAgent({ id: 'a2', phase: 'done', result: 'ok' }),
    ];

    const { lastFrame, unmount } = render(
      <AgentPickerOverlay
        activeAgents={agents}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await flush();
    const frame = lastFrame();

    expect(frame).toContain(`Profiles: ${AGENT_PROFILES.length}`);
    expect(frame).toContain('Active: 1');
    expect(frame).toContain('Done: 1');

    unmount();
  });

  it('shows budget and mode metadata for each profile', async () => {
    const { lastFrame, unmount } = render(
      <AgentPickerOverlay
        activeAgents={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await flush();
    const frame = lastFrame();

    // First profile is focused (Researcher)
    expect(frame).toContain('mode=research');
    expect(frame).toContain('budget=20 calls');

    unmount();
  });

  it('shows tools list for focused profile', async () => {
    const { lastFrame, unmount } = render(
      <AgentPickerOverlay
        activeAgents={[]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await flush();
    const frame = lastFrame();

    // First profile (Researcher) tools
    expect(frame).toContain('tools:');
    expect(frame).toContain('read_file');
    expect(frame).toContain('search_files');

    unmount();
  });
});

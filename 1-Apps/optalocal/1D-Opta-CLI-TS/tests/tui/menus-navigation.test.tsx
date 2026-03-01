import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { CommandBrowser } from '../../src/tui/CommandBrowser.js';
import { OptaMenuOverlay } from '../../src/tui/OptaMenuOverlay.js';
import { HelpBrowserOverlay } from '../../src/tui/HelpBrowserOverlay.js';
import { ActionHistoryOverlay } from '../../src/tui/ActionHistoryOverlay.js';
import type { ActionEvent } from '../../src/tui/activity.js';
import type { SlashCommandDef } from '../../src/commands/slash/index.js';
import { sanitizeTerminalText, visibleTextWidth } from '../../src/utils/text.js';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 50));
const ARROW_RIGHT = '\u001B[C';
const ARROW_LEFT = '\u001B[D';

const COMMANDS: SlashCommandDef[] = [
  {
    command: 'help',
    description: 'Show commands',
    category: 'info',
    handler: async () => 'handled',
  },
];

describe('interactive menu back navigation', () => {
  it('CommandBrowser closes on Left arrow', async () => {
    const onClose = vi.fn();
    const { stdin, unmount } = render(
      <CommandBrowser commands={COMMANDS} onSelect={() => {}} onClose={onClose} />,
    );
    await flush();
    stdin.write(ARROW_LEFT);
    await flush();
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('CommandBrowser closes on Backspace when query is empty', async () => {
    const onClose = vi.fn();
    const { stdin, unmount } = render(
      <CommandBrowser commands={COMMANDS} onSelect={() => {}} onClose={onClose} />,
    );
    await flush();
    stdin.write('\x7f');
    await flush();
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('OptaMenuOverlay closes on Backspace', async () => {
    const onClose = vi.fn();
    const { stdin, unmount } = render(
      <OptaMenuOverlay
        workflowMode="normal"
        currentModel="test-model"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        sidebarVisible={false}
        safeMode={false}
        bypassPermissions={false}
        followMode={true}
        onClose={onClose}
        onOpenModelPicker={() => {}}
        onOpenCommandBrowser={() => {}}
        onOpenHelpBrowser={() => {}}
        onOpenBrowserControl={() => {}}
        onOpenActionHistory={() => {}}
        onRunCommand={() => {}}
        onToggleSidebar={() => {}}
        onToggleSafeMode={() => {}}
        onToggleBypass={() => {}}
        onToggleFollow={() => {}}
      />,
    );
    await flush();
    stdin.write('\x7f');
    await flush();
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('OptaMenuOverlay opens Settings from Operations page', async () => {
    const onOpenSettings = vi.fn();
    const { stdin, lastFrame, unmount } = render(
      <OptaMenuOverlay
        workflowMode="normal"
        currentModel="test-model"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        sidebarVisible={false}
        safeMode={false}
        bypassPermissions={false}
        followMode={true}
        studioConnectivity="reachable"
        onClose={() => {}}
        onOpenModelPicker={() => {}}
        onOpenCommandBrowser={() => {}}
        onOpenHelpBrowser={() => {}}
        onOpenBrowserControl={() => {}}
        onOpenActionHistory={() => {}}
        onOpenSettings={onOpenSettings}
        onOpenOnboarding={() => {}}
        onRunCommand={() => {}}
        onToggleSidebar={() => {}}
        onToggleSafeMode={() => {}}
        onToggleBypass={() => {}}
        onToggleFollow={() => {}}
      />,
    );
    await flush();
    stdin.write(ARROW_RIGHT);
    await flush();
    expect(lastFrame()).toContain('Operations');

    // Operations item order places Settings at index 6 (0-based) in this menu.
    for (let i = 0; i < 6; i += 1) {
      stdin.write('j');
      await flush();
    }
    stdin.write('\r');
    await flush();
    expect(onOpenSettings).toHaveBeenCalled();
    unmount();
  });

  it('OptaMenuOverlay runs Account Sign In from Simple Settings page', async () => {
    const onRunCommand = vi.fn();
    const { stdin, lastFrame, unmount } = render(
      <OptaMenuOverlay
        workflowMode="normal"
        currentModel="test-model"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        sidebarVisible={false}
        safeMode={false}
        bypassPermissions={false}
        followMode={true}
        studioConnectivity="reachable"
        onClose={() => {}}
        onOpenModelPicker={() => {}}
        onOpenCommandBrowser={() => {}}
        onOpenHelpBrowser={() => {}}
        onOpenBrowserControl={() => {}}
        onOpenActionHistory={() => {}}
        onOpenSettings={() => {}}
        onOpenOnboarding={() => {}}
        onRunCommand={onRunCommand}
        onToggleSidebar={() => {}}
        onToggleSafeMode={() => {}}
        onToggleBypass={() => {}}
        onToggleFollow={() => {}}
      />,
    );
    await flush();

    stdin.write('7');
    await flush();
    expect(lastFrame()).toContain('Simple Settings');
    expect(lastFrame()).toContain('Account Sign In');

    // Second item is Account Sign In.
    stdin.write('j');
    await flush();
    stdin.write('\r');
    await flush();

    expect(onRunCommand).toHaveBeenCalledWith('!opta account login --oauth-opta-browser --timeout 300');
    unmount();
  });

  it('OptaMenuOverlay shows opening animation shell before full content is ready', async () => {
    const { lastFrame, unmount } = render(
      <OptaMenuOverlay
        workflowMode="normal"
        currentModel="test-model"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        sidebarVisible={false}
        safeMode={false}
        bypassPermissions={false}
        followMode={true}
        animationPhase="opening"
        animationProgress={0.2}
        onClose={() => {}}
        onOpenModelPicker={() => {}}
        onOpenCommandBrowser={() => {}}
        onOpenHelpBrowser={() => {}}
        onOpenBrowserControl={() => {}}
        onOpenActionHistory={() => {}}
        onRunCommand={() => {}}
        onToggleSidebar={() => {}}
        onToggleSafeMode={() => {}}
        onToggleBypass={() => {}}
        onToggleFollow={() => {}}
      />,
    );
    await flush();
    expect(lastFrame()).toContain('Opening Opta Menu');
    expect(lastFrame()).toContain('Stabilising menu layout');
    expect(lastFrame()).not.toContain('Benchmark Suite');
    unmount();
  });

  it('OptaMenuOverlay keeps transition focus locked until close key during closing animation', async () => {
    const onClose = vi.fn();
    const onRunCommand = vi.fn();
    const { stdin, lastFrame, unmount } = render(
      <OptaMenuOverlay
        workflowMode="normal"
        currentModel="test-model"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        sidebarVisible={false}
        safeMode={false}
        bypassPermissions={false}
        followMode={true}
        animationPhase="closing"
        animationProgress={0.8}
        onClose={onClose}
        onOpenModelPicker={() => {}}
        onOpenCommandBrowser={() => {}}
        onOpenHelpBrowser={() => {}}
        onOpenBrowserControl={() => {}}
        onOpenActionHistory={() => {}}
        onRunCommand={onRunCommand}
        onToggleSidebar={() => {}}
        onToggleSafeMode={() => {}}
        onToggleBypass={() => {}}
        onToggleFollow={() => {}}
      />,
    );
    await flush();
    expect(lastFrame()).toContain('Closing Opta Menu');

    stdin.write('\r');
    await flush();
    expect(onRunCommand).not.toHaveBeenCalled();

    stdin.write('q');
    await flush();
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('OptaMenuOverlay switches pages and shows page-scoped actions', async () => {
    const onClose = vi.fn();
    const { stdin, lastFrame, unmount } = render(
      <OptaMenuOverlay
        workflowMode="normal"
        currentModel="test-model"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        sidebarVisible={false}
        safeMode={false}
        bypassPermissions={false}
        followMode={true}
        studioConnectivity="reachable"
        onClose={onClose}
        onOpenModelPicker={() => {}}
        onOpenCommandBrowser={() => {}}
        onOpenHelpBrowser={() => {}}
        onOpenBrowserControl={() => {}}
        onOpenActionHistory={() => {}}
        onRunCommand={() => {}}
        onToggleSidebar={() => {}}
        onToggleSafeMode={() => {}}
        onToggleBypass={() => {}}
        onToggleFollow={() => {}}
      />,
    );
    await flush();
    expect(lastFrame()).toContain('Benchmark + Info');
    expect(lastFrame()).toContain('Benchmark Suite');

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(lastFrame()).toContain('Operations');
    expect(lastFrame()).toContain('Update Local');

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(lastFrame()).toContain('Connectivity');
    expect(lastFrame()).toContain('API Key Show');

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(lastFrame()).toContain('Models');
    expect(lastFrame()).toContain('Model Manager');

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(lastFrame()).toContain('LMX Ops');
    expect(lastFrame()).toContain('Health Probe');

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(lastFrame()).toContain('Runtime');
    expect(lastFrame()).toContain('Toggle Sidebar');

    stdin.write(ARROW_LEFT);
    await flush();
    expect(lastFrame()).toContain('LMX Ops');
    unmount();
  });

  it('OptaMenuOverlay provides educational info controls from benchmark hub', async () => {
    const onRunCommand = vi.fn();
    const { stdin, lastFrame, unmount } = render(
      <OptaMenuOverlay
        workflowMode="normal"
        currentModel="test-model"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        sidebarVisible={false}
        safeMode={false}
        bypassPermissions={false}
        followMode={true}
        studioConnectivity="reachable"
        onClose={() => {}}
        onOpenModelPicker={() => {}}
        onOpenCommandBrowser={() => {}}
        onOpenHelpBrowser={() => {}}
        onOpenBrowserControl={() => {}}
        onOpenActionHistory={() => {}}
        onRunCommand={onRunCommand}
        onToggleSidebar={() => {}}
        onToggleSafeMode={() => {}}
        onToggleBypass={() => {}}
        onToggleFollow={() => {}}
      />,
    );
    await flush();
    expect(lastFrame()).toContain('1-9 pages');
    expect(lastFrame()).toContain('Info: Launch the full benchmark experience');
    expect(lastFrame()).toContain('Shift+I runs: !opta benchmark --serve --force');

    stdin.write('i');
    await flush();
    expect(lastFrame()).toContain('Info panel hidden');

    stdin.write('i');
    await flush();
    expect(lastFrame()).toContain('Info: Launch the full benchmark experience');

    stdin.write('I');
    await flush();
    expect(onRunCommand).toHaveBeenCalledWith('!opta benchmark --serve --force');
    unmount();
  });

  it('OptaMenuOverlay runs guided destructive flow for RAG delete with confirmation', async () => {
    const onRunCommand = vi.fn();
    const { stdin, lastFrame, unmount } = render(
      <OptaMenuOverlay
        workflowMode="normal"
        currentModel="test-model"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        sidebarVisible={false}
        safeMode={false}
        bypassPermissions={false}
        followMode={true}
        studioConnectivity="reachable"
        onClose={() => {}}
        onOpenModelPicker={() => {}}
        onOpenCommandBrowser={() => {}}
        onOpenHelpBrowser={() => {}}
        onOpenBrowserControl={() => {}}
        onOpenActionHistory={() => {}}
        onRunCommand={onRunCommand}
        onToggleSidebar={() => {}}
        onToggleSafeMode={() => {}}
        onToggleBypass={() => {}}
        onToggleFollow={() => {}}
      />,
    );
    await flush();

    // Jump to Advanced Autist page.
    for (let i = 0; i < 8; i += 1) {
      stdin.write(ARROW_RIGHT);
      await flush();
    }
    expect(lastFrame()).toContain('Advanced Autist');

    // Move to "RAG Delete (Guided)" and open guided prompt.
    // Index 26 in advancedAutistItems (0-based).
    for (let i = 0; i < 26; i += 1) {
      stdin.write('j');
      await flush();
    }
    stdin.write('\r');
    await flush();
    expect(lastFrame()).toContain('Delete RAG collection');

    // Provide collection, trigger confirm, then accept.
    stdin.write('scratch');
    await flush();
    stdin.write('\r');
    await flush();
    expect(lastFrame()).toContain('Confirm destructive action?');
    stdin.write('y');
    await flush();

    expect(onRunCommand).toHaveBeenCalledWith('/rag delete scratch');
    unmount();
  });

  it('OptaMenuOverlay runs guided non-destructive flow for Agent Start', async () => {
    const onRunCommand = vi.fn();
    const { stdin, lastFrame, unmount } = render(
      <OptaMenuOverlay
        workflowMode="normal"
        currentModel="test-model"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        sidebarVisible={false}
        safeMode={false}
        bypassPermissions={false}
        followMode={true}
        studioConnectivity="reachable"
        onClose={() => {}}
        onOpenModelPicker={() => {}}
        onOpenCommandBrowser={() => {}}
        onOpenHelpBrowser={() => {}}
        onOpenBrowserControl={() => {}}
        onOpenActionHistory={() => {}}
        onRunCommand={onRunCommand}
        onToggleSidebar={() => {}}
        onToggleSafeMode={() => {}}
        onToggleBypass={() => {}}
        onToggleFollow={() => {}}
      />,
    );
    await flush();

    // Jump to Advanced Autist page.
    for (let i = 0; i < 8; i += 1) {
      stdin.write(ARROW_RIGHT);
      await flush();
    }
    expect(lastFrame()).toContain('Advanced Autist');

    // Move to "Agent Start (Guided)" and submit a prompt.
    // Index 16 in advancedAutistItems (0-based).
    for (let i = 0; i < 16; i += 1) {
      stdin.write('j');
      await flush();
    }
    stdin.write('\r');
    await flush();
    expect(lastFrame()).toContain('Start agent run');

    stdin.write('Draft incident triage');
    await flush();
    stdin.write('\r');
    await flush();

    expect(onRunCommand).toHaveBeenCalledWith('/agents start --prompt "Draft incident triage"');
    unmount();
  });

  it('OptaMenuOverlay runs guided destructive flow for Skill MCP Call with confirmation', async () => {
    const onRunCommand = vi.fn();
    const { stdin, lastFrame, unmount } = render(
      <OptaMenuOverlay
        workflowMode="normal"
        currentModel="test-model"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        sidebarVisible={false}
        safeMode={false}
        bypassPermissions={false}
        followMode={true}
        studioConnectivity="reachable"
        onClose={() => {}}
        onOpenModelPicker={() => {}}
        onOpenCommandBrowser={() => {}}
        onOpenHelpBrowser={() => {}}
        onOpenBrowserControl={() => {}}
        onOpenActionHistory={() => {}}
        onRunCommand={onRunCommand}
        onToggleSidebar={() => {}}
        onToggleSafeMode={() => {}}
        onToggleBypass={() => {}}
        onToggleFollow={() => {}}
      />,
    );
    await flush();

    // Jump to Advanced Autist page.
    for (let i = 0; i < 8; i += 1) {
      stdin.write(ARROW_RIGHT);
      await flush();
    }
    expect(lastFrame()).toContain('Advanced Autist');

    // Move to "Skill MCP Call (Guided)", then confirm.
    // Index 21 in advancedAutistItems (0-based).
    for (let i = 0; i < 21; i += 1) {
      stdin.write('j');
      await flush();
    }
    stdin.write('\r');
    await flush();
    expect(lastFrame()).toContain('Call MCP tool');

    stdin.write('linear.search_issues');
    await flush();
    stdin.write('\r');
    await flush();
    expect(lastFrame()).toContain('Confirm destructive action?');
    stdin.write('y');
    await flush();

    expect(onRunCommand).toHaveBeenCalledWith('/lmx-skills mcp-call linear.search_issues');
    unmount();
  });

  it('OptaMenuOverlay renders in-menu command results for benchmark operations', async () => {
    const { lastFrame, unmount } = render(
      <OptaMenuOverlay
        workflowMode="normal"
        currentModel="test-model"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        sidebarVisible={false}
        safeMode={false}
        bypassPermissions={false}
        followMode={true}
        studioConnectivity="reachable"
        menuResults={[
          {
            id: 'r1',
            at: Date.now(),
            command: '!opta benchmark --serve --force',
            status: 'ok',
            summary: 'Benchmark suite generated successfully',
            outputSnippet: 'Generated benchmark suite at apps/opta-benchmark-suite',
          },
          {
            id: 'r2',
            at: Date.now() - 1000,
            command: '/scan',
            status: 'ok',
            summary: 'Scan refreshed model inventory',
          },
        ]}
        onClose={() => {}}
        onOpenModelPicker={() => {}}
        onOpenCommandBrowser={() => {}}
        onOpenHelpBrowser={() => {}}
        onOpenBrowserControl={() => {}}
        onOpenActionHistory={() => {}}
        onRunCommand={() => {}}
        onToggleSidebar={() => {}}
        onToggleSafeMode={() => {}}
        onToggleBypass={() => {}}
        onToggleFollow={() => {}}
      />,
    );
    await flush();
    expect(lastFrame()).toContain('Recent Scans + Benchmarks');
    expect(lastFrame()).toContain('Latest Result: Benchmark suite generated successfully');
    unmount();
  });

  it('OptaMenuOverlay prioritizes local recovery when studio ssh is unavailable', async () => {
    const onClose = vi.fn();
    const { stdin, lastFrame, unmount } = render(
      <OptaMenuOverlay
        workflowMode="normal"
        currentModel="test-model"
        connectionHost="127.0.0.1"
        connectionPort={1234}
        sidebarVisible={false}
        safeMode={false}
        bypassPermissions={false}
        followMode={true}
        studioConnectivity="unreachable"
        onClose={onClose}
        onOpenModelPicker={() => {}}
        onOpenCommandBrowser={() => {}}
        onOpenHelpBrowser={() => {}}
        onOpenBrowserControl={() => {}}
        onOpenActionHistory={() => {}}
        onRunCommand={() => {}}
        onToggleSidebar={() => {}}
        onToggleSafeMode={() => {}}
        onToggleBypass={() => {}}
        onToggleFollow={() => {}}
      />,
    );
    await flush();
    expect(lastFrame()).toContain('Benchmark + Info');
    expect(lastFrame()).toContain('Studio SSH unavailable');

    stdin.write(ARROW_RIGHT);
    await flush();
    expect(lastFrame()).toContain('Operations');
    expect(lastFrame()).toContain('Status Check');
    expect(lastFrame()).toContain('Doctor Check');
    expect(lastFrame()).toContain('Update Local');
    expect(lastFrame()).toContain('recommended');
    expect(lastFrame()).not.toContain('Update Studio');
    expect(lastFrame()).not.toContain('Update Both');
    unmount();
  });

  it('HelpBrowserOverlay uses Left to back out then close', async () => {
    const onClose = vi.fn();
    const { stdin, unmount } = render(
      <HelpBrowserOverlay commands={COMMANDS} onClose={onClose} />,
    );
    await flush();
    stdin.write(ARROW_RIGHT); // Right: move into command pane
    await flush();
    stdin.write(ARROW_LEFT); // Left: back to area pane, not close
    await flush();
    expect(onClose).not.toHaveBeenCalled();
    stdin.write(ARROW_LEFT); // Left again from area pane closes
    await flush();
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('ActionHistoryOverlay closes on Backspace', async () => {
    const onClose = vi.fn();
    const history: ActionEvent[] = [{
      id: 'a1',
      at: Date.now(),
      sessionId: 'session-1',
      kind: 'tool',
      status: 'ok',
      icon: '✅',
      label: 'Tool finished',
      detail: 'done',
    }];
    const { stdin, unmount } = render(
      <ActionHistoryOverlay history={history} onClose={onClose} />,
    );
    await flush();
    stdin.write('\x7f'); // Backspace
    await flush();
    expect(onClose).toHaveBeenCalled();
    unmount();
  });

  it('ActionHistoryOverlay uses Backspace to edit query before closing', async () => {
    const onClose = vi.fn();
    const history: ActionEvent[] = [
      {
        id: 'a1',
        at: Date.now(),
        sessionId: 'session-1',
        kind: 'tool',
        status: 'ok',
        icon: '✅',
        label: 'Tool finished',
        detail: 'done',
      },
      {
        id: 'a2',
        at: Date.now(),
        sessionId: 'session-1',
        kind: 'info',
        status: 'info',
        icon: 'ℹ️',
        label: 'Session ready',
      },
    ];
    const { stdin, lastFrame, unmount } = render(
      <ActionHistoryOverlay history={history} onClose={onClose} />,
    );
    await flush();

    stdin.write('tool');
    await flush();
    expect(lastFrame()).toContain('tool');
    expect(onClose).not.toHaveBeenCalled();

    stdin.write('\x7f');
    await flush();
    expect(onClose).not.toHaveBeenCalled();

    stdin.write('\x7f');
    await flush();
    stdin.write('\x7f');
    await flush();
    stdin.write('\x7f');
    await flush();
    expect(onClose).not.toHaveBeenCalled();

    stdin.write('\x7f');
    await flush();
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('ActionHistoryOverlay uses Left arrow to close only when query is empty', async () => {
    const onClose = vi.fn();
    const history: ActionEvent[] = [{
      id: 'a1',
      at: Date.now(),
      sessionId: 'session-1',
      kind: 'tool',
      status: 'ok',
      icon: '✅',
      label: 'Tool finished',
      detail: 'done',
    }];
    const { stdin, unmount } = render(
      <ActionHistoryOverlay history={history} onClose={onClose} />,
    );
    await flush();

    stdin.write('a');
    await flush();
    stdin.write(ARROW_LEFT);
    await flush();
    expect(onClose).not.toHaveBeenCalled();

    stdin.write('\x7f');
    await flush();
    stdin.write(ARROW_LEFT);
    await flush();
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('ActionHistoryOverlay respects maxWidth when message pane is narrow', async () => {
    const history: ActionEvent[] = [{
      id: 'a1',
      at: Date.now(),
      sessionId: 'session-1',
      kind: 'tool',
      status: 'ok',
      icon: '✅',
      label: 'Tool finished',
      detail: 'done',
    }];
    const { lastFrame, unmount } = render(
      <ActionHistoryOverlay history={history} maxWidth={58} onClose={() => {}} />,
      { stdout: { columns: 220, rows: 40 } as NodeJS.WriteStream },
    );
    await flush();
    const frame = sanitizeTerminalText(lastFrame() ?? '');
    const maxLineWidth = Math.max(...frame.split('\n').map((line) => visibleTextWidth(line)));
    expect(maxLineWidth).toBeLessThanOrEqual(58);
    unmount();
  });

  it('HelpBrowserOverlay respects maxWidth when sidebar shrinks the pane', async () => {
    const { lastFrame, unmount } = render(
      <HelpBrowserOverlay commands={COMMANDS} maxWidth={60} onClose={() => {}} />,
      { stdout: { columns: 220, rows: 40 } as NodeJS.WriteStream },
    );
    await flush();
    const frame = sanitizeTerminalText(lastFrame() ?? '');
    const maxLineWidth = Math.max(...frame.split('\n').map((line) => visibleTextWidth(line)));
    expect(maxLineWidth).toBeLessThanOrEqual(60);
    unmount();
  });
});

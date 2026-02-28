import { EventEmitter } from 'node:events';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Box } from 'ink';
import { InkStatusBar } from '../../src/tui/StatusBar.js';
import { MessageList } from '../../src/tui/MessageList.js';
import { InputBox } from '../../src/tui/InputBox.js';
import { Sidebar } from '../../src/tui/Sidebar.js';
import { OptaMenuOverlay } from '../../src/tui/OptaMenuOverlay.js';
import { PermissionPrompt } from '../../src/tui/PermissionPrompt.js';
import { sanitizeTerminalText } from '../../src/utils/text.js';

// Mock fast-glob to prevent real filesystem calls from InputBox @-autocomplete
vi.mock('fast-glob', () => ({
  default: vi.fn().mockResolvedValue([]),
}));

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

const flush = (ms = 50) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function normalizedFrame(getFrame: () => string): string {
  return sanitizeTerminalText(getFrame() ?? '');
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// 1. StatusBar
// ---------------------------------------------------------------------------
describe('StatusBar visual snapshots', () => {
  it('renders connected state with model name and account email', () => {
    const { lastFrame, unmount } = render(
      <InkStatusBar
        model="mlx-community/Qwen2.5-72B-4bit"
        tokens={4200}
        cost="$0.03"
        tools={5}
        speed={42}
        connectionState="connected"
        accountUser={{ email: 'matt@optamize.biz' }}
      />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('statusbar-connected');
    unmount();
  });

  it('renders disconnected state with fallback indicator', () => {
    const { lastFrame, unmount } = render(
      <InkStatusBar
        model="mlx-community/Qwen2.5-72B-4bit"
        tokens={1200}
        cost="$0.01"
        tools={2}
        speed={0}
        connectionState="disconnected"
        activeHost="api.anthropic.com"
        primaryHost="192.168.188.11"
      />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('statusbar-disconnected-fallback');
    unmount();
  });

  it('renders active streaming phase with context bar', () => {
    const { lastFrame, unmount } = render(
      <InkStatusBar
        model="Qwen2.5-72B"
        tokens={8000}
        cost="$0.06"
        tools={3}
        speed={35}
        connectionState="connected"
        turnPhase="streaming"
        streamingLabel="thinking"
        contextUsed={45000}
        contextTotal={128000}
        promptTokens={6000}
        completionTokens={2000}
        turnCompletionTokens={512}
      />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('statusbar-streaming-with-context');
    unmount();
  });

  it('renders compact mode with minimal stats', () => {
    const { lastFrame, unmount } = render(
      <InkStatusBar
        model="GLM-5-4.8B"
        tokens={500}
        cost="$0.00"
        tools={0}
        speed={0}
        compact={true}
        connectionState="connected"
      />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('statusbar-compact');
    unmount();
  });

  it('renders safe mode and bypass permissions indicators', () => {
    const { lastFrame, unmount } = render(
      <InkStatusBar
        model="test-model"
        tokens={1000}
        cost="$0.01"
        tools={1}
        speed={10}
        safeMode={true}
        bypassPermissions={true}
        actionCount={7}
        actionLabel="Running edit_file"
        actionIcon="⚙"
        actionStatus="warning"
      />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('statusbar-safe-bypass');
    unmount();
  });

  it('renders pending browser approvals with risk levels', () => {
    const { lastFrame, unmount } = render(
      <InkStatusBar
        model="test-model"
        tokens={2000}
        cost="$0.02"
        tools={4}
        speed={25}
        actionCount={3}
        pendingApprovals={5}
        highRiskPendingApprovals={2}
        mediumRiskPendingApprovals={1}
        highestPendingApprovalRisk="high"
      />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('statusbar-pending-approvals');
    unmount();
  });
});

// ---------------------------------------------------------------------------
// 2. MessageList
// ---------------------------------------------------------------------------
describe('MessageList visual snapshots', () => {
  it('renders user and assistant messages', () => {
    const messages = [
      { role: 'user', content: 'Explain how tools work', createdAt: Date.UTC(2026, 1, 22, 6, 0) },
      {
        role: 'assistant',
        content: 'Tools are functions the agent can call during execution.\n\n- **read_file** reads a file\n- **edit_file** modifies a file\n- **run_command** executes shell commands',
        createdAt: Date.UTC(2026, 1, 22, 6, 1),
        toolCalls: 3,
      },
    ];
    const { lastFrame, unmount } = render(
      <MessageList messages={messages} terminalWidth={100} height={20} thinkingExpanded={false} />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('messages-user-assistant');
    unmount();
  });

  it('renders tool call messages', () => {
    const messages = [
      { role: 'user', content: 'Read the config file', createdAt: Date.UTC(2026, 1, 22, 7, 0) },
      {
        role: 'tool',
        content: '{"host": "192.168.188.11", "port": 1234}',
        toolName: 'read_file',
        toolStatus: 'done' as const,
        toolArgs: { path: '/etc/opta/config.json' },
        createdAt: Date.UTC(2026, 1, 22, 7, 0),
      },
      {
        role: 'assistant',
        content: 'The config file shows host 192.168.188.11 on port 1234.',
        createdAt: Date.UTC(2026, 1, 22, 7, 1),
      },
    ];
    const { lastFrame, unmount } = render(
      <MessageList messages={messages} terminalWidth={100} height={20} thinkingExpanded={false} />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('messages-with-tool-call');
    unmount();
  });

  it('renders thinking blocks in assistant messages', () => {
    const messages = [
      {
        role: 'assistant',
        content: 'After careful analysis, the approach is correct.',
        createdAt: Date.UTC(2026, 1, 22, 8, 0),
        thinkingTokens: 245,
        thinking: { text: 'Let me consider the edge cases here...', tokens: 245 },
      },
    ];
    const { lastFrame, unmount } = render(
      <MessageList messages={messages} terminalWidth={100} height={20} thinkingExpanded={true} />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('messages-with-thinking');
    unmount();
  });

  it('renders multi-turn conversation with separators', () => {
    const messages = [
      { role: 'user', content: 'First question', createdAt: Date.UTC(2026, 1, 22, 9, 0) },
      { role: 'assistant', content: 'First answer.', createdAt: Date.UTC(2026, 1, 22, 9, 1) },
      { role: 'user', content: 'Follow-up question', createdAt: Date.UTC(2026, 1, 22, 9, 2) },
      { role: 'assistant', content: 'Follow-up answer.', createdAt: Date.UTC(2026, 1, 22, 9, 3) },
    ];
    const { lastFrame, unmount } = render(
      <MessageList messages={messages} terminalWidth={100} height={24} thinkingExpanded={false} />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('messages-multi-turn');
    unmount();
  });

  it('renders welcome screen when no messages exist', () => {
    const { lastFrame, unmount } = render(
      <MessageList
        messages={[]}
        connectionState="connected"
        model="Qwen2.5-72B"
        contextTotal={128000}
        toolCount={8}
      />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('messages-welcome-screen');
    unmount();
  });

  it('renders system messages with preformatted content', () => {
    const messages = [
      {
        role: 'system',
        content: '┌────────────┐\n│ model scan │\n└────────────┘\nLoaded: 3 models on 192.168.188.11:1234',
        createdAt: Date.UTC(2026, 1, 22, 10, 0),
      },
    ];
    const { lastFrame, unmount } = render(
      <MessageList messages={messages} terminalWidth={100} height={16} thinkingExpanded={false} />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('messages-system-preformatted');
    unmount();
  });
});

// ---------------------------------------------------------------------------
// 3. InputBox
// ---------------------------------------------------------------------------
describe('InputBox visual snapshots', () => {
  it('renders default prompt in normal mode', () => {
    const { lastFrame, unmount } = render(
      <InputBox onSubmit={() => {}} mode="normal" />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('inputbox-normal');
    unmount();
  });

  it('renders plan workflow mode badge', () => {
    const { lastFrame, unmount } = render(
      <InputBox onSubmit={() => {}} mode="normal" workflowMode="plan" />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('inputbox-plan-mode');
    unmount();
  });

  it('renders research workflow mode badge', () => {
    const { lastFrame, unmount } = render(
      <InputBox onSubmit={() => {}} mode="normal" workflowMode="research" />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('inputbox-research-mode');
    unmount();
  });

  it('renders loading state with default label', () => {
    const { lastFrame, unmount } = render(
      <InputBox onSubmit={() => {}} mode="normal" isLoading={true} />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('inputbox-loading');
    unmount();
  });

  it('renders loading state with custom label', () => {
    const { lastFrame, unmount } = render(
      <InputBox onSubmit={() => {}} mode="normal" isLoading={true} loadingLabel="running edit_file" />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('inputbox-loading-custom');
    unmount();
  });

  it('renders with bypass permissions indicator and red border', () => {
    const { lastFrame, unmount } = render(
      <InputBox onSubmit={() => {}} mode="normal" bypassPermissions={true} />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('inputbox-bypass');
    unmount();
  });

  it('renders with typed text', async () => {
    const { lastFrame, stdin, unmount } = render(
      <InputBox onSubmit={() => {}} mode="normal" />,
    );
    await flush();
    stdin.write('hello world');
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('inputbox-with-text');
    unmount();
  });
});

// ---------------------------------------------------------------------------
// 4. Sidebar
// ---------------------------------------------------------------------------
describe('Sidebar visual snapshots', () => {
  it('renders full session info with tokens and cost', () => {
    const { lastFrame, unmount } = render(
      <Sidebar
        model="mlx-community/Qwen2.5-72B-4bit"
        sessionId="a1b2c3d4e5f6"
        tokens={{ prompt: 3200, completion: 1800, total: 5000 }}
        tools={7}
        cost="$0.04"
        mode="normal"
        elapsed={45.2}
        speed={38}
        connectionState="connected"
      />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('sidebar-full-session');
    unmount();
  });

  it('renders with context usage bar', () => {
    const { lastFrame, unmount } = render(
      <Sidebar
        model="Qwen2.5-72B"
        sessionId="deadbeef1234"
        tokens={{ prompt: 40000, completion: 8000, total: 48000 }}
        tools={12}
        cost="$0.22"
        mode="auto"
        elapsed={120.5}
        speed={42}
        connectionState="connected"
        contextUsage={{ used: 96000, total: 128000 }}
      />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('sidebar-with-context');
    unmount();
  });

  it('renders plan mode indicator', () => {
    const { lastFrame, unmount } = render(
      <Sidebar
        model="test-model"
        sessionId="plan12345678"
        tokens={{ prompt: 500, completion: 200, total: 700 }}
        tools={2}
        cost="$0.01"
        mode="plan"
        elapsed={8.3}
      />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('sidebar-plan-mode');
    unmount();
  });

  it('renders with active live thinking', () => {
    const { lastFrame, unmount } = render(
      <Sidebar
        model="test-model"
        sessionId="think1234567"
        tokens={{ prompt: 1000, completion: 400, total: 1400 }}
        tools={3}
        cost="$0.02"
        mode="normal"
        elapsed={15.7}
        liveThinkingText="Analyzing the codebase structure to identify the optimal refactoring approach."
        liveThinkingTokens={87}
        thinkingExpanded={true}
        thinkingActive={true}
      />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('sidebar-live-thinking');
    unmount();
  });

  it('renders disconnected state', () => {
    const { lastFrame, unmount } = render(
      <Sidebar
        model="test-model"
        sessionId="disc12345678"
        tokens={{ prompt: 0, completion: 0, total: 0 }}
        tools={0}
        cost="$0.00"
        mode="normal"
        elapsed={0}
        connectionState="disconnected"
      />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('sidebar-disconnected');
    unmount();
  });

  it('renders with session title', () => {
    const { lastFrame, unmount } = render(
      <Sidebar
        model="GLM-5-4.8B"
        sessionId="titled123456"
        tokens={{ prompt: 2000, completion: 800, total: 2800 }}
        tools={4}
        cost="$0.03"
        mode="normal"
        elapsed={22.1}
        title="Refactor StatusBar"
      />,
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('sidebar-with-title');
    unmount();
  });
});

// ---------------------------------------------------------------------------
// 5. OptaMenuOverlay
// ---------------------------------------------------------------------------
describe('OptaMenuOverlay visual snapshots', () => {
  const menuNoop = () => {};
  const menuNoopAsync = async () => {};

  const baseMenuProps = {
    workflowMode: 'normal' as const,
    currentModel: 'mlx-community/Qwen2.5-72B-4bit',
    connectionHost: '192.168.188.11',
    connectionPort: 1234,
    sidebarVisible: false,
    safeMode: false,
    bypassPermissions: false,
    followMode: true,
    studioConnectivity: 'reachable' as const,
    onClose: menuNoop,
    onOpenModelPicker: menuNoop,
    onOpenCommandBrowser: menuNoop,
    onOpenHelpBrowser: menuNoop,
    onOpenBrowserControl: menuNoop,
    onOpenActionHistory: menuNoop,
    onRunCommand: menuNoopAsync,
    onToggleSidebar: menuNoop,
    onToggleSafeMode: menuNoop,
    onToggleBypass: menuNoop,
    onToggleFollow: menuNoop,
  };

  it('renders benchmark page with page tabs and action items', async () => {
    const stdout = new MockStdout(120, 50) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <OptaMenuOverlay {...baseMenuProps} />,
      { stdout },
    );
    await flush();
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('menu-benchmark-page');
    unmount();
  });

  it('renders operations page after navigation', async () => {
    const stdout = new MockStdout(120, 50) as unknown as NodeJS.WriteStream;
    const { stdin, lastFrame, unmount } = render(
      <OptaMenuOverlay {...baseMenuProps} />,
      { stdout },
    );
    await flush();
    stdin.write('\u001B[C'); // Right arrow
    await flush();
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('menu-operations-page');
    unmount();
  });

  it('renders with autonomy level and CEO mode', async () => {
    const stdout = new MockStdout(120, 50) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <OptaMenuOverlay
        {...baseMenuProps}
        autonomyLevel={4}
        autonomyMode="ceo"
      />,
      { stdout },
    );
    await flush();
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('menu-autonomy-ceo');
    unmount();
  });

  it('renders studio unreachable with local recovery focus', async () => {
    const stdout = new MockStdout(120, 50) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <OptaMenuOverlay
        {...baseMenuProps}
        studioConnectivity="unreachable"
      />,
      { stdout },
    );
    await flush();
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('menu-studio-unreachable');
    unmount();
  });

  it('renders opening animation phase', async () => {
    const stdout = new MockStdout(120, 50) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <OptaMenuOverlay
        {...baseMenuProps}
        animationPhase="opening"
        animationProgress={0.3}
      />,
      { stdout },
    );
    await flush();
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('menu-opening-animation');
    unmount();
  });

  it('renders with menu result entries', async () => {
    const stdout = new MockStdout(120, 50) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <OptaMenuOverlay
        {...baseMenuProps}
        menuResults={[
          {
            id: 'r1',
            at: Date.now(),
            command: '!opta benchmark --serve --force',
            status: 'ok',
            summary: 'Benchmark suite generated successfully',
            outputSnippet: 'Generated 3 apps at apps/opta-benchmark-suite',
          },
        ]}
      />,
      { stdout },
    );
    await flush();
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('menu-with-results');
    unmount();
  });
});

// ---------------------------------------------------------------------------
// P0-09 Visual Golden Snapshots (VG-)
// Five captures required by the codex desktop parity spec at target widths.
// ---------------------------------------------------------------------------

const menuNoop = () => {};
const menuNoopAsync = async () => {};
const baseMenuPropsVG = {
  workflowMode: 'normal' as const,
  currentModel: 'mlx-community/Qwen2.5-72B-4bit',
  connectionHost: '192.168.188.11',
  connectionPort: 1234,
  sidebarVisible: false,
  safeMode: false,
  bypassPermissions: false,
  followMode: true,
  studioConnectivity: 'reachable' as const,
  onClose: menuNoop,
  onOpenModelPicker: menuNoop,
  onOpenCommandBrowser: menuNoop,
  onOpenHelpBrowser: menuNoop,
  onOpenBrowserControl: menuNoop,
  onOpenActionHistory: menuNoop,
  onRunCommand: menuNoopAsync,
  onToggleSidebar: menuNoop,
  onToggleSafeMode: menuNoop,
  onToggleBypass: menuNoop,
  onToggleFollow: menuNoop,
};

describe('P0-09 VG visual golden snapshots', () => {
  // -------------------------------------------------------------------------
  // VG-APP-IDLE: Full App shell (StatusBar + MessageList + InputBox) at three
  // target widths.  Tests protect alternate-buffer shell layout regressions.
  // -------------------------------------------------------------------------

  it('VG-APP-IDLE at 72x30 — narrow terminal app shell', () => {
    const stdout = new MockStdout(72, 30) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <Box flexDirection="column">
        <InkStatusBar
          model="mlx-community/Qwen2.5-72B-4bit"
          tokens={0}
          cost="$0.00"
          tools={8}
          speed={0}
          connectionState="connected"
        />
        <MessageList
          messages={[]}
          connectionState="connected"
          model="Qwen2.5-72B"
          contextTotal={128000}
          toolCount={8}
        />
        <InputBox onSubmit={() => {}} mode="normal" />
      </Box>,
      { stdout },
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('VG-APP-IDLE-72x30');
    unmount();
  });

  it('VG-APP-IDLE at 96x34 — standard terminal app shell', () => {
    const stdout = new MockStdout(96, 34) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <Box flexDirection="column">
        <InkStatusBar
          model="mlx-community/Qwen2.5-72B-4bit"
          tokens={0}
          cost="$0.00"
          tools={8}
          speed={0}
          connectionState="connected"
        />
        <MessageList
          messages={[]}
          connectionState="connected"
          model="Qwen2.5-72B"
          contextTotal={128000}
          toolCount={8}
        />
        <InputBox onSubmit={() => {}} mode="normal" />
      </Box>,
      { stdout },
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('VG-APP-IDLE-96x34');
    unmount();
  });

  it('VG-APP-IDLE at 128x40 — wide terminal app shell', () => {
    const stdout = new MockStdout(128, 40) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <Box flexDirection="column">
        <InkStatusBar
          model="mlx-community/Qwen2.5-72B-4bit"
          tokens={0}
          cost="$0.00"
          tools={8}
          speed={0}
          connectionState="connected"
        />
        <MessageList
          messages={[]}
          connectionState="connected"
          model="Qwen2.5-72B"
          contextTotal={128000}
          toolCount={8}
        />
        <InputBox onSubmit={() => {}} mode="normal" />
      </Box>,
      { stdout },
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('VG-APP-IDLE-128x40');
    unmount();
  });

  // -------------------------------------------------------------------------
  // VG-APP-SAFE: App shell with safe-mode badge enabled.
  // Protects safety-state visibility — badge must remain visible across changes.
  // -------------------------------------------------------------------------

  it('VG-APP-SAFE at 96x34 — safe mode badge visible', () => {
    const stdout = new MockStdout(96, 34) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <Box flexDirection="column">
        <InkStatusBar
          model="mlx-community/Qwen2.5-72B-4bit"
          tokens={1200}
          cost="$0.01"
          tools={8}
          speed={22}
          connectionState="connected"
          safeMode={true}
          bypassPermissions={false}
        />
        <MessageList
          messages={[
            { role: 'user', content: 'Are you in safe mode?', createdAt: Date.UTC(2026, 1, 28, 9, 0) },
            { role: 'assistant', content: 'Yes — safe mode is active. Destructive tools require explicit confirmation.', createdAt: Date.UTC(2026, 1, 28, 9, 1) },
          ]}
          connectionState="connected"
          model="Qwen2.5-72B"
          contextTotal={128000}
          toolCount={8}
        />
        <InputBox onSubmit={() => {}} mode="normal" safeMode={true} />
      </Box>,
      { stdout },
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('VG-APP-SAFE-96x34');
    unmount();
  });

  // -------------------------------------------------------------------------
  // VG-OVERLAY-MENU: Opta menu overlay at narrow and wide widths.
  // Guards overlay geometry regressions — alignment must be centred at both sizes.
  // -------------------------------------------------------------------------

  it('VG-OVERLAY-MENU at 72x30 — narrow overlay alignment', async () => {
    const stdout = new MockStdout(72, 30) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <OptaMenuOverlay {...baseMenuPropsVG} />,
      { stdout },
    );
    await flush();
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('VG-OVERLAY-MENU-72x30');
    unmount();
  });

  it('VG-OVERLAY-MENU at 128x30 — wide overlay alignment', async () => {
    const stdout = new MockStdout(128, 30) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <OptaMenuOverlay {...baseMenuPropsVG} />,
      { stdout },
    );
    await flush();
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('VG-OVERLAY-MENU-128x30');
    unmount();
  });

  // -------------------------------------------------------------------------
  // VG-PERMISSION: Permission prompt with countdown timer at 96x30.
  // Guards safety decision UX — tool name, args, and countdown must be visible.
  // -------------------------------------------------------------------------

  it('VG-PERMISSION at 96x30 — edit_file permission prompt', () => {
    const stdout = new MockStdout(96, 30) as unknown as NodeJS.WriteStream;
    const { lastFrame, unmount } = render(
      <PermissionPrompt
        toolName="edit_file"
        args={{
          path: 'src/tui/App.tsx',
          old_text: 'const foo = 1;',
          new_text: 'const foo = 2;',
        }}
        onDecision={vi.fn()}
      />,
      { stdout },
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('VG-PERMISSION-96x30');
    unmount();
  });

  // -------------------------------------------------------------------------
  // VG-SCROLL-DEEP: Long message list with scrollbar thumb state at 96x34.
  // Guards scroll rendering parity — thumb must appear when content overflows.
  // -------------------------------------------------------------------------

  it('VG-SCROLL-DEEP at 96x34 — long message list scroll state', () => {
    const stdout = new MockStdout(96, 34) as unknown as NodeJS.WriteStream;
    const messages = Array.from({ length: 14 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: i % 2 === 0
        ? `Question ${Math.floor(i / 2) + 1}: What is the optimal strategy for reducing context window usage in long sessions?`
        : `Answer ${Math.floor(i / 2) + 1}: The optimal strategy combines compaction triggers at 70% context usage, semantic summarisation of completed turns, and selective retention of tool call results that future turns are likely to reference.`,
      createdAt: Date.UTC(2026, 1, 28, 10, i),
    }));
    const { lastFrame, unmount } = render(
      <MessageList
        messages={messages}
        terminalWidth={96}
        height={28}
        thinkingExpanded={false}
        connectionState="connected"
        model="Qwen2.5-72B"
        contextTotal={128000}
        toolCount={8}
      />,
      { stdout },
    );
    expect(normalizedFrame(lastFrame)).toMatchSnapshot('VG-SCROLL-DEEP-96x34');
    unmount();
  });
});

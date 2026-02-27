# Phase 2: Ink Migration — Full-Screen TUI

> **Status: SUPERSEDED** — Ink/React TUI fully implemented (App.tsx + 25+ components, alternate buffer, StatusBar, responsive layout). Verified 2026-02-27.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Opta CLI from inline print-to-stdout REPL to a full-screen terminal UI using Ink 5 (React for terminals), enabling alternate buffer mode, persistent status bar, responsive resize handling, and component-based architecture.

**Architecture:** Ink 5 provides a React-like component model for terminal UIs. The migration wraps the existing agent loop and session management in Ink components. The entry point (`opta chat`) renders an `<App>` component that manages layout, input, and output as React state. All existing `console.log` output migrates to Ink `<Text>` components.

**Tech Stack:** Ink 5, ink-text-input, React 18 (peer dep of Ink), chalk (existing)

**Gaps Closed:** G01, G02, G04, G06

**Prerequisites:** Phase 1A, 1B, 1C complete (all tests green, all pre-Ink enhancements in place)

---

### Task 1: Add Ink 5 and React dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Ink and React**

Run:
```bash
npm install ink@5 ink-text-input react@18
npm install -D @types/react@18
```

**Step 2: Verify installation**

Run: `npm run typecheck`
Expected: No type errors from new deps

**Step 3: Update tsconfig if needed**

Ensure `tsconfig.json` has `"jsx": "react-jsx"` for JSX support:
```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

**Step 4: Commit**

```bash
git add package.json package-lock.json tsconfig.json
git commit -m "feat(cli): add Ink 5 and React 18 dependencies (G01)"
```

---

### Task 2: Create base App component

**Files:**
- Create: `src/tui/App.tsx`
- Test: `src/__tests__/tui/App.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/__tests__/tui/App.test.tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../../tui/App.js';

describe('App component', () => {
  it('should render without crashing', () => {
    const { lastFrame } = render(<App model="test-model" sessionId="abc123" />);
    expect(lastFrame()).toBeDefined();
  });

  it('should show model name', () => {
    const { lastFrame } = render(<App model="Qwen2.5-72B" sessionId="abc123" />);
    expect(lastFrame()).toContain('Qwen2.5-72B');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/tui/App.test.tsx`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```tsx
// src/tui/App.tsx
import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';

interface AppProps {
  model: string;
  sessionId: string;
}

export function App({ model, sessionId }: AppProps) {
  const { exit } = useApp();
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  return (
    <Box flexDirection="column" width="100%">
      {/* Header */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="cyan">Opta</Text>
        <Text dimColor> │ </Text>
        <Text>{model}</Text>
        <Text dimColor> │ </Text>
        <Text dimColor>{sessionId.slice(0, 8)}</Text>
      </Box>

      {/* Message area */}
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {messages.length === 0 && (
          <Text dimColor>Type a message to start. Ctrl+C to exit.</Text>
        )}
        {messages.map((msg, i) => (
          <Box key={i} marginY={0}>
            <Text color={msg.role === 'user' ? 'cyan' : 'green'}>
              {msg.role === 'user' ? '› ' : '  '}
            </Text>
            <Text>{msg.content}</Text>
          </Box>
        ))}
      </Box>

      {/* Status bar */}
      <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
        <Text dimColor>0 tokens</Text>
        <Text dimColor>$0.00</Text>
      </Box>
    </Box>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/tui/App.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/tui/App.tsx src/__tests__/tui/App.test.tsx
git commit -m "feat(cli): create base Ink App component (G01)"
```

---

### Task 3: Create MessageList component

**Files:**
- Create: `src/tui/MessageList.tsx`
- Test: `src/__tests__/tui/MessageList.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/__tests__/tui/MessageList.test.tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { MessageList } from '../../tui/MessageList.js';

describe('MessageList', () => {
  it('should render messages', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    const { lastFrame } = render(<MessageList messages={messages} />);
    expect(lastFrame()).toContain('Hello');
    expect(lastFrame()).toContain('Hi there!');
  });

  it('should show empty state', () => {
    const { lastFrame } = render(<MessageList messages={[]} />);
    expect(lastFrame()).toContain('Start typing');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/tui/MessageList.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
// src/tui/MessageList.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface Message {
  role: string;
  content: string;
  toolCalls?: number;
  thinkingTokens?: number;
}

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text dimColor>Start typing to begin a conversation.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {messages.map((msg, i) => (
        <Box key={i} flexDirection="column" marginBottom={1}>
          <Box>
            <Text color={msg.role === 'user' ? 'cyan' : 'green'} bold>
              {msg.role === 'user' ? '› you' : '  opta'}
            </Text>
            {msg.toolCalls ? (
              <Text dimColor> ({msg.toolCalls} tool calls)</Text>
            ) : null}
            {msg.thinkingTokens ? (
              <Text dimColor> (⚙ {msg.thinkingTokens} thinking)</Text>
            ) : null}
          </Box>
          <Box paddingLeft={2}>
            <Text wrap="wrap">{msg.content}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/tui/MessageList.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/tui/MessageList.tsx src/__tests__/tui/MessageList.test.tsx
git commit -m "feat(cli): create MessageList Ink component"
```

---

### Task 4: Create StatusBar component (G04)

**Files:**
- Create: `src/tui/StatusBar.tsx`
- Test: `src/__tests__/tui/StatusBar.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/__tests__/tui/StatusBar.test.tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { InkStatusBar } from '../../tui/StatusBar.js';

describe('InkStatusBar', () => {
  it('should show model name', () => {
    const { lastFrame } = render(
      <InkStatusBar model="Qwen2.5-72B" tokens={0} cost="$0.00" tools={0} speed={0} />
    );
    expect(lastFrame()).toContain('Qwen2.5-72B');
  });

  it('should show token count', () => {
    const { lastFrame } = render(
      <InkStatusBar model="test" tokens={1500} cost="$0.00" tools={3} speed={45} />
    );
    expect(lastFrame()).toContain('1.5K');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/tui/StatusBar.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
// src/tui/StatusBar.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface InkStatusBarProps {
  model: string;
  tokens: number;
  cost: string;
  tools: number;
  speed: number;
  mode?: string;
  sessionId?: string;
}

function fmtTokens(n: number): string {
  if (n >= 100_000) return `${(n / 1000).toFixed(0)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function InkStatusBar({ model, tokens, cost, tools, speed, mode, sessionId }: InkStatusBarProps) {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
      width="100%"
    >
      <Box>
        <Text color="green">●</Text>
        <Text> {model}</Text>
        {mode && mode !== 'normal' && (
          <>
            <Text dimColor> │ </Text>
            <Text color={mode === 'plan' ? 'magenta' : 'yellow'}>{mode}</Text>
          </>
        )}
      </Box>
      <Box>
        <Text dimColor>~{fmtTokens(tokens)} tokens</Text>
        <Text dimColor> │ </Text>
        <Text dimColor>{tools} tools</Text>
        {speed > 0 && (
          <>
            <Text dimColor> │ </Text>
            <Text dimColor>{speed.toFixed(0)} t/s</Text>
          </>
        )}
        <Text dimColor> │ </Text>
        <Text color="green">{cost}</Text>
      </Box>
    </Box>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/tui/StatusBar.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/tui/StatusBar.tsx src/__tests__/tui/StatusBar.test.tsx
git commit -m "feat(cli): create persistent Ink StatusBar component (G04)"
```

---

### Task 5: Create InputBox component with multiline support

**Files:**
- Create: `src/tui/InputBox.tsx`
- Test: `src/__tests__/tui/InputBox.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/__tests__/tui/InputBox.test.tsx
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { InputBox } from '../../tui/InputBox.js';

describe('InputBox', () => {
  it('should render with prompt', () => {
    const { lastFrame } = render(<InputBox onSubmit={() => {}} mode="normal" />);
    expect(lastFrame()).toContain('›');
  });

  it('should show mode indicator', () => {
    const { lastFrame } = render(<InputBox onSubmit={() => {}} mode="plan" />);
    expect(lastFrame()).toContain('plan');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/__tests__/tui/InputBox.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```tsx
// src/tui/InputBox.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

interface InputBoxProps {
  onSubmit: (text: string) => void;
  mode: 'normal' | 'plan' | 'shell' | 'auto';
  isLoading?: boolean;
}

export function InputBox({ onSubmit, mode, isLoading }: InputBoxProps) {
  const [value, setValue] = useState('');

  const handleSubmit = (text: string) => {
    if (!text.trim()) return;
    onSubmit(text);
    setValue('');
  };

  const modeIndicator = (() => {
    switch (mode) {
      case 'plan': return <Text color="magenta">plan</Text>;
      case 'shell': return <Text color="yellow">!</Text>;
      case 'auto': return <Text color="yellow">auto</Text>;
      default: return null;
    }
  })();

  if (isLoading) {
    return (
      <Box paddingX={1}>
        <Text color="cyan">⠋</Text>
        <Text dimColor> thinking...</Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1}>
      {modeIndicator && <>{modeIndicator}<Text dimColor> </Text></>}
      <Text color="cyan">›</Text>
      <Text> </Text>
      <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
    </Box>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/__tests__/tui/InputBox.test.tsx`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/tui/InputBox.tsx src/__tests__/tui/InputBox.test.tsx
git commit -m "feat(cli): create InputBox Ink component with mode indicator"
```

---

### Task 6: Create Header component

**Files:**
- Create: `src/tui/Header.tsx`

**Step 1: Write minimal implementation**

```tsx
// src/tui/Header.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface HeaderProps {
  model: string;
  sessionId: string;
  connectionStatus: boolean;
  title?: string;
}

export function Header({ model, sessionId, connectionStatus, title }: HeaderProps) {
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
      width="100%"
    >
      <Box>
        <Text bold color="cyan">Opta</Text>
        <Text dimColor> │ </Text>
        <Text color={connectionStatus ? 'green' : 'red'}>●</Text>
        <Text> {model}</Text>
      </Box>
      <Box>
        {title && <Text dimColor>{title.slice(0, 30)}</Text>}
        <Text dimColor> │ </Text>
        <Text dimColor>{sessionId.slice(0, 8)}</Text>
      </Box>
    </Box>
  );
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tui/Header.tsx
git commit -m "feat(cli): create Header Ink component"
```

---

### Task 7: Assemble full-screen App layout (G02)

**Files:**
- Modify: `src/tui/App.tsx`

**Step 1: Compose all components into full-screen layout**

```tsx
// src/tui/App.tsx — updated
import React, { useState, useCallback } from 'react';
import { Box, useApp, useStdout } from 'ink';
import { Header } from './Header.js';
import { MessageList } from './MessageList.js';
import { InputBox } from './InputBox.js';
import { InkStatusBar } from './StatusBar.js';

interface AppProps {
  model: string;
  sessionId: string;
  connectionStatus?: boolean;
  onMessage?: (text: string) => Promise<string>;
}

export function App({ model, sessionId, connectionStatus = true, onMessage }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const height = stdout?.rows ?? 24;

  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'normal' | 'plan' | 'shell' | 'auto'>('normal');
  const [tokens, setTokens] = useState(0);
  const [tools, setTools] = useState(0);

  const handleSubmit = useCallback(async (text: string) => {
    // Handle slash commands
    if (text === '/exit' || text === '/quit') {
      exit();
      return;
    }

    // Handle shell mode
    if (text.startsWith('!')) {
      setMode('shell');
    }

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    if (onMessage) {
      const response = await onMessage(text);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    }

    setIsLoading(false);
    setMode('normal');
  }, [onMessage, exit]);

  // Calculate message area height (total - header - statusbar - input)
  const messageAreaHeight = Math.max(height - 6, 10);

  return (
    <Box flexDirection="column" height={height} width="100%">
      <Header
        model={model}
        sessionId={sessionId}
        connectionStatus={connectionStatus}
      />

      <Box flexDirection="column" height={messageAreaHeight} overflow="hidden">
        <MessageList messages={messages} />
      </Box>

      <InputBox onSubmit={handleSubmit} mode={mode} isLoading={isLoading} />

      <InkStatusBar
        model={model}
        tokens={tokens}
        cost="$0.00"
        tools={tools}
        speed={0}
        mode={mode}
      />
    </Box>
  );
}
```

**Step 2: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/tui/App.tsx
git commit -m "feat(cli): assemble full-screen Ink layout with header, messages, input, statusbar (G02)"
```

---

### Task 8: Create alternate buffer entry point

**Files:**
- Create: `src/tui/render.tsx`

**Step 1: Write the Ink render entry point**

```tsx
// src/tui/render.tsx
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
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/tui/render.tsx
git commit -m "feat(cli): create alternate buffer entry point for full-screen TUI (G02)"
```

---

### Task 9: Add resize handling (G06)

**Files:**
- Create: `src/tui/hooks/useTerminalSize.ts`

**Step 1: Write the resize hook**

```typescript
// src/tui/hooks/useTerminalSize.ts
import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

export function useTerminalSize(): { width: number; height: number } {
  const { stdout } = useStdout();

  const [size, setSize] = useState({
    width: stdout?.columns ?? 80,
    height: stdout?.rows ?? 24,
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: stdout?.columns ?? 80,
        height: stdout?.rows ?? 24,
      });
    };

    stdout?.on('resize', handleResize);
    return () => {
      stdout?.off('resize', handleResize);
    };
  }, [stdout]);

  return size;
}
```

**Step 2: Wire into App component**

Replace hardcoded height with `useTerminalSize()` hook.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/tui/hooks/useTerminalSize.ts src/tui/App.tsx
git commit -m "feat(cli): add terminal resize handling hook (G06)"
```

---

### Task 10: Wire TUI into chat command

**Files:**
- Modify: `src/commands/chat.ts`

**Step 1: Add --tui flag to chat command**

Add a `--tui` flag that switches from inline REPL to full-screen Ink rendering:

```typescript
// In startChat, after session setup:
if (opts.tui) {
  const { renderTUI } = await import('../tui/render.js');
  await renderTUI({
    model: config.model.default,
    sessionId: session.id,
    onMessage: async (text) => {
      const result = await agentLoop(text, config, {
        existingMessages: session.messages,
        sessionId: session.id,
        silent: true,
      });
      session.messages = result.messages;
      await saveSession(session);
      const last = result.messages.filter(m => m.role === 'assistant').pop();
      return typeof last?.content === 'string' ? last.content : '';
    },
  });
  return;
}

// Existing REPL code continues below for non-TUI mode...
```

**Step 2: Add flag to commander definition in index.ts**

```typescript
.option('--tui', 'Use full-screen terminal UI')
```

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/commands/chat.ts src/index.ts
git commit -m "feat(cli): wire Ink TUI into chat command with --tui flag (G01)"
```

---

### Task 11: Add keyboard shortcut handling

**Files:**
- Create: `src/tui/hooks/useKeyboard.ts`

**Step 1: Write keyboard handler hook**

```typescript
// src/tui/hooks/useKeyboard.ts
import { useInput } from 'ink';

interface KeyboardActions {
  onExit?: () => void;
  onHelp?: () => void;
  onClear?: () => void;
  onSlashMenu?: () => void;
}

export function useKeyboard(actions: KeyboardActions): void {
  useInput((input, key) => {
    // Ctrl+C — exit
    if (key.ctrl && input === 'c') {
      actions.onExit?.();
    }
    // Ctrl+L — clear
    if (key.ctrl && input === 'l') {
      actions.onClear?.();
    }
    // Ctrl+/ — help
    if (key.ctrl && input === '/') {
      actions.onHelp?.();
    }
    // Escape — slash menu
    if (key.escape) {
      actions.onSlashMenu?.();
    }
  });
}
```

**Step 2: Wire into App component**

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/tui/hooks/useKeyboard.ts src/tui/App.tsx
git commit -m "feat(cli): add keyboard shortcut hook for TUI"
```

---

### Task 12: Add loading/streaming indicator

**Files:**
- Create: `src/tui/StreamingIndicator.tsx`

**Step 1: Write streaming indicator**

```tsx
// src/tui/StreamingIndicator.tsx
import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function StreamingIndicator({ label = 'thinking' }: { label?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text color="cyan">
      {FRAMES[frame]} <Text dimColor>{label}...</Text>
    </Text>
  );
}
```

**Step 2: Wire into App (show during agent loop execution)**

**Step 3: Commit**

```bash
git add src/tui/StreamingIndicator.tsx src/tui/App.tsx
git commit -m "feat(cli): add streaming indicator component"
```

---

### Task 13: Ensure backward compatibility (inline mode still works)

**Files:**
- Modify: `src/commands/chat.ts`

**Step 1: Verify that `opta chat` (without --tui) still uses inline REPL**

The `--tui` flag is opt-in. Default behavior remains inline REPL.

**Step 2: Run full test suite**

Run: `npm run typecheck && npm test`
Expected: All existing tests pass (no regressions)

**Step 3: Commit**

```bash
git add src/commands/chat.ts
git commit -m "fix(cli): ensure backward compatibility with inline REPL mode"
```

---

### Task 14: Add `opta config set tui.default true` for TUI default

**Files:**
- Modify: `src/core/config.ts`

**Step 1: Add tui config option**

Add to config schema:
```typescript
tui: z.object({
  default: z.boolean().default(false),
}).default({}),
```

In chat command, use `config.tui.default` to determine whether to use TUI mode.

**Step 2: Run typecheck and tests**

Run: `npm run typecheck && npm test`
Expected: All pass

**Step 3: Commit**

```bash
git add src/core/config.ts src/commands/chat.ts
git commit -m "feat(cli): add tui.default config option"
```

---

### Task 15: Install ink-testing-library for TUI tests

**Files:**
- Modify: `package.json`

**Step 1: Install test dependency**

```bash
npm install -D ink-testing-library
```

**Step 2: Run all TUI tests**

Run: `npm test -- src/__tests__/tui/`
Expected: All pass

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(cli): add ink-testing-library for TUI component tests"
```

---

### Task 16: Run full test suite and verify build

**Step 1: Run all checks**

Run: `npm run typecheck && npm test && npm run build && npm run lint`
Expected: All pass

**Step 2: Manual verification**

Run: `npm run dev -- chat --tui`
Expected: Full-screen TUI renders with header, empty message area, input box, status bar

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(cli): complete Phase 2 Ink migration — full-screen TUI mode (G01, G02, G04, G06)"
```

---

## Summary

| Task | Gap | What It Does |
|------|-----|-------------|
| 1 | G01 | Install Ink 5 + React 18 |
| 2 | G01 | Base App component |
| 3 | — | MessageList component |
| 4 | G04 | Persistent StatusBar component |
| 5 | — | InputBox component with mode |
| 6 | — | Header component |
| 7 | G02 | Full-screen layout composition |
| 8 | G02 | Alternate buffer entry point |
| 9 | G06 | Terminal resize handling hook |
| 10 | G01 | Wire TUI into chat command |
| 11 | — | Keyboard shortcut hook |
| 12 | — | Streaming/loading indicator |
| 13 | — | Backward compatibility check |
| 14 | — | TUI default config option |
| 15 | — | Install ink-testing-library |
| 16 | — | Full test suite verification |

**Total:** 16 tasks, 4 gaps closed (G01, G02, G04, G06)

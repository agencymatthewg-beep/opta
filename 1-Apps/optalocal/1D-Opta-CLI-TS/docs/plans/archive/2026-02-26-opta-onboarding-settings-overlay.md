---
status: archived
---

# Opta Onboarding & Settings Overlays Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build two TUI overlays — `OnboardingOverlay` (step-by-step setup wizard) and `SettingsOverlay` (live config browser) — both using the exact visual design, animation system, and keyboard model of OptaMenuOverlay.

**Architecture:**
- `OnboardingOverlay`: 9-step wizard using ink-text-input for text fields, OptaMenuOverlay border/color scheme, progress indicator, LMX connection testing
- `SettingsOverlay`: Clone of OptaMenuOverlay's 5-page structure with settings pages (Connection, Models, Safety, Paths, Advanced), shows current values, inline editing on Enter
- Both wired into App.tsx via existing `activeOverlay` state pattern; accessible from OptaMenuOverlay's Operations page

**Tech Stack:** TypeScript ESM, Ink 5 + React 18, ink-text-input, existing `loadConfig`/`saveConfig` from core/config.ts, animation system from OptaMenuOverlay

---

## Design Reference: OptaMenuOverlay Exact Patterns

These are the constants to replicate faithfully across both new overlays:

```typescript
// Animation: staggered content reveal
const showCoreContent = normalizedProgress >= 0.28;
const showActionsList = normalizedProgress >= 0.55;
const infoPanelVisibleByAnimation = normalizedProgress >= 0.75;

// Layout
const visualRows = Math.max(10, Math.floor(rows * (0.45 + (0.55 * normalizedProgress))));
const animatedWidth = Math.max(40, Math.floor(width * (0.55 + (0.45 * normalizedProgress))));

// Colors (page-specific)
const PAGE_COLORS = {
  connection: '#10b981',   // Green
  models:     '#a78bfa',   // Violet
  safety:     '#f59e0b',   // Amber
  paths:      '#38bdf8',   // Sky blue
  advanced:   '#22d3ee',   // Cyan
};

// Onboarding step colors
const STEP_COLORS = ['#38bdf8','#22d3ee','#10b981','#a78bfa','#f59e0b','#38bdf8','#22d3ee','#10b981','#a78bfa'];
```

---

## Task 1: Extend ActiveOverlay type + add keybinding stubs

**Files:**
- Modify: `src/tui/App.tsx` line ~207
- Modify: `src/tui/keybindings.ts`
- Modify: `src/tui/hooks/useKeyboard.ts`

**Step 1:** In `src/tui/App.tsx`, extend `ActiveOverlay` union:
```typescript
type ActiveOverlay =
  | 'none'
  | 'model-picker'
  | 'command-browser'
  | 'help-browser'
  | 'opta-menu'
  | 'browser-control'
  | 'action-history'
  | 'onboarding'   // ← ADD
  | 'settings';    // ← ADD
```

**Step 2:** In `src/tui/keybindings.ts`, add to `KeybindingConfig` interface and `defaultKeybindings()`:
```typescript
// In interface:
openSettings: KeyBinding;
openOnboarding: KeyBinding;

// In defaultKeybindings():
openSettings:    { key: 'ctrl+shift+,', description: 'Open settings' },
openOnboarding:  { key: 'ctrl+shift+o', description: 'Open onboarding wizard' },
```

**Step 3:** In `src/tui/hooks/useKeyboard.ts`, add to `KeyboardActions` interface:
```typescript
onOpenSettings?: () => void;
onOpenOnboarding?: () => void;
```
And add handlers in the `useInput` block (after existing bindings):
```typescript
if (matchesBinding(input, key, bindings.openSettings)) {
  actions.onOpenSettings?.();
  return;
}
if (matchesBinding(input, key, bindings.openOnboarding)) {
  actions.onOpenOnboarding?.();
  return;
}
```

**Step 4:** Run `npm run typecheck` — must pass.

**Step 5:** Commit:
```bash
git add src/tui/App.tsx src/tui/keybindings.ts src/tui/hooks/useKeyboard.ts
git commit -m "feat(tui): extend overlay types and keybindings for settings and onboarding"
```

---

## Task 2: Create OnboardingOverlay

**Files:**
- Create: `src/tui/OnboardingOverlay.tsx`
- Create: `tests/tui/OnboardingOverlay.test.tsx`

**Design:** 9-step wizard. Each step has a `title`, `description`, one or two input fields (or a selection), and a status indicator. Uses OptaMenuOverlay's exact border/animation/color system. `ink-text-input` handles text entry.

**Step 1:** Write the failing test:

```typescript
// tests/tui/OnboardingOverlay.test.tsx
import { render } from 'ink-testing-library';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { OnboardingOverlay } from '../../src/tui/OnboardingOverlay.js';

describe('OnboardingOverlay', () => {
  it('renders step 1 (Welcome) with correct header', () => {
    const { lastFrame } = render(
      <OnboardingOverlay
        animationPhase="open"
        animationProgress={1}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    expect(lastFrame()).toContain('Opta Setup');
    expect(lastFrame()).toContain('Step 1');
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    const { stdin } = render(
      <OnboardingOverlay
        animationPhase="open"
        animationProgress={1}
        onClose={onClose}
        onComplete={vi.fn()}
      />
    );
    stdin.write('\x1b'); // ESC
    expect(onClose).toHaveBeenCalled();
  });

  it('shows LMX connection step after Tab', () => {
    const { lastFrame, stdin } = render(
      <OnboardingOverlay
        animationPhase="open"
        animationProgress={1}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    stdin.write('\r'); // Enter to advance past welcome
    expect(lastFrame()).toContain('Step 2');
    expect(lastFrame()).toContain('LMX Connection');
  });

  it('calls onComplete with partial config on finish', () => {
    const onComplete = vi.fn();
    const { stdin } = render(
      <OnboardingOverlay
        animationPhase="open"
        animationProgress={1}
        onClose={vi.fn()}
        onComplete={onComplete}
        initialStep={8} // Start on final step
      />
    );
    stdin.write('\r'); // Enter to save
    expect(onComplete).toHaveBeenCalledWith(expect.any(Object));
  });
});
```

**Step 2:** Run test to confirm failure:
```bash
npm test -- tests/tui/OnboardingOverlay.test.tsx
```
Expected: FAIL (module not found)

**Step 3:** Create `src/tui/OnboardingOverlay.tsx`:

```typescript
import React, { useState, useCallback } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import type { PartialDeep } from 'type-fest';
import type { OptaConfig } from '../core/config.js';

// --- TYPES ---

export type OnboardingStep =
  | 'welcome'
  | 'lmx'
  | 'model'
  | 'provider'
  | 'research'
  | 'ssh'
  | 'paths'
  | 'preferences'
  | 'done';

const STEP_ORDER: OnboardingStep[] = [
  'welcome', 'lmx', 'model', 'provider', 'research', 'ssh', 'paths', 'preferences', 'done',
];

const STEP_COLORS: Record<OnboardingStep, string> = {
  welcome:     '#38bdf8',
  lmx:         '#22d3ee',
  model:       '#10b981',
  provider:    '#a78bfa',
  research:    '#f59e0b',
  ssh:         '#38bdf8',
  paths:       '#22d3ee',
  preferences: '#10b981',
  done:        '#a78bfa',
};

const STEP_TITLES: Record<OnboardingStep, string> = {
  welcome:     'Welcome to Opta CLI',
  lmx:         'LMX Connection',
  model:       'Default Model',
  provider:    'AI Provider (optional)',
  research:    'Research Providers (optional)',
  ssh:         'Remote SSH (optional)',
  paths:       'File Paths',
  preferences: 'Preferences',
  done:        'Setup Complete',
};

const STEP_DESCRIPTIONS: Record<OnboardingStep, string> = {
  welcome:     'Answer a few questions to configure Opta for your device. Press Enter to advance, Esc to close.',
  lmx:         'Set the host and port of your Opta-LMX inference server.',
  model:       'Set the default model to use for all chat sessions.',
  provider:    'Add an Anthropic API key if you want cloud fallback when LMX is unreachable.',
  research:    'Enable web research providers and add their API keys.',
  ssh:         'Configure SSH access to your remote LMX server (Mac Studio).',
  paths:       'Customize where Opta stores session logs and update records.',
  preferences: 'Set your preferred autonomy level and default mode.',
  done:        'Your settings have been saved. You can change any setting later via the Opta Menu → Settings.',
};

export interface OnboardingOverlayProps {
  animationPhase?: 'opening' | 'open' | 'closing';
  animationProgress?: number;
  maxWidth?: number;
  maxHeight?: number;
  initialStep?: number;
  onClose: () => void;
  onComplete: (config: Record<string, unknown>) => void;
}

// --- COMPONENT ---

export function OnboardingOverlay({
  animationPhase = 'open',
  animationProgress = 1,
  maxWidth,
  maxHeight,
  initialStep = 0,
  onClose,
  onComplete,
}: OnboardingOverlayProps): React.ReactElement {
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? process.stdout.columns ?? 120;
  const stdoutRows = stdout?.rows ?? process.stdout.rows ?? 36;

  const normalizedProgress = Math.max(0, Math.min(1, Number.isFinite(animationProgress) ? animationProgress : 1));
  const rows = Math.max(14, Math.min(stdoutRows, maxHeight ?? stdoutRows));
  const hardMax = Math.max(24, Math.min(columns - 4, maxWidth ?? columns - 8));
  const preferred = Math.max(70, Math.min(100, columns - 8));
  const width = Math.min(preferred, hardMax);
  const animatedWidth = Math.max(40, Math.floor(width * (0.55 + (0.45 * normalizedProgress))));

  const transitionActive = animationPhase !== 'open' || normalizedProgress < 0.95;
  const showContent = normalizedProgress >= 0.28;

  const [stepIndex, setStepIndex] = useState(Math.min(initialStep, STEP_ORDER.length - 1));
  const [lmxHost, setLmxHost] = useState('192.168.188.11');
  const [lmxPort, setLmxPort] = useState('1234');
  const [defaultModel, setDefaultModel] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [sshUser, setSshUser] = useState('opta');
  const [sshKey, setSshKey] = useState('~/.ssh/id_ed25519');
  const [sessionLogsDir, setSessionLogsDir] = useState('12-Session-Logs');
  const [updateLogsDir, setUpdateLogsDir] = useState('updates');
  const [autonomyLevel, setAutonomyLevel] = useState('2');
  const [lmxTestStatus, setLmxTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [focusedField, setFocusedField] = useState<'primary' | 'secondary'>('primary');

  const step = STEP_ORDER[stepIndex] ?? 'welcome';
  const stepColor = STEP_COLORS[step];
  const stepNumber = stepIndex + 1;
  const totalSteps = STEP_ORDER.length;

  const testLmxConnection = useCallback(async () => {
    setLmxTestStatus('testing');
    try {
      const resp = await fetch(`http://${lmxHost}:${lmxPort}/v1/models`, {
        signal: AbortSignal.timeout(3000),
      });
      setLmxTestStatus(resp.ok ? 'ok' : 'fail');
    } catch {
      setLmxTestStatus('fail');
    }
  }, [lmxHost, lmxPort]);

  const advance = useCallback(() => {
    if (stepIndex >= STEP_ORDER.length - 1) {
      // Collect and emit config
      const collected: Record<string, unknown> = {
        'connection.host': lmxHost,
        'connection.port': parseInt(lmxPort, 10),
        'model.default': defaultModel,
        'connection.ssh.user': sshUser,
        'connection.ssh.identityFile': sshKey,
        'journal.sessionLogsDir': sessionLogsDir,
        'journal.updateLogsDir': updateLogsDir,
        'autonomy.level': parseInt(autonomyLevel, 10),
      };
      if (anthropicKey) {
        collected['provider.anthropic.apiKey'] = anthropicKey;
        collected['provider.fallbackOnFailure'] = true;
      }
      onComplete(collected);
      return;
    }
    // Auto-test LMX when leaving lmx step
    if (step === 'lmx' && lmxTestStatus === 'idle') {
      void testLmxConnection();
    }
    setStepIndex(prev => prev + 1);
    setFocusedField('primary');
  }, [stepIndex, step, lmxHost, lmxPort, defaultModel, anthropicKey, sshUser, sshKey,
      sessionLogsDir, updateLogsDir, autonomyLevel, lmxTestStatus, testLmxConnection, onComplete]);

  const goBack = useCallback(() => {
    if (stepIndex === 0) { onClose(); return; }
    setStepIndex(prev => prev - 1);
    setFocusedField('primary');
  }, [stepIndex, onClose]);

  useInput((input, key) => {
    if (key.escape || (input === 'q' && !key.ctrl && !key.meta && step === 'welcome')) {
      onClose(); return;
    }
    if (key.return) { advance(); return; }
    if (key.leftArrow || key.backspace) { goBack(); return; }
    if (key.tab) {
      setFocusedField(prev => prev === 'primary' ? 'secondary' : 'primary');
      return;
    }
    // LMX step: Ctrl+T to test connection
    if (key.ctrl && input === 't' && step === 'lmx') {
      void testLmxConnection(); return;
    }
  }, { isActive: true });

  const progressBar = '█'.repeat(stepIndex) + '░'.repeat(totalSteps - stepIndex - 1);

  const renderStepContent = (): React.ReactElement => {
    switch (step) {
      case 'welcome':
        return (
          <Box flexDirection="column" marginTop={1}>
            <Text color={stepColor}>Press Enter to begin setup, or Esc to skip.</Text>
            <Text dimColor marginTop={1}>
              This wizard configures your LMX connection, default model, and optional integrations.
            </Text>
            <Text dimColor>All settings can be changed later via the Opta Menu → Settings.</Text>
          </Box>
        );

      case 'lmx':
        return (
          <Box flexDirection="column" marginTop={1}>
            <Box>
              <Text dimColor>Host: </Text>
              <TextInput value={lmxHost} onChange={setLmxHost} focus={focusedField === 'primary'} />
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Port: </Text>
              <TextInput value={lmxPort} onChange={setLmxPort} focus={focusedField === 'secondary'} />
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Tab switches fields · Ctrl+T to test · Enter to continue</Text>
            </Box>
            {lmxTestStatus !== 'idle' && (
              <Box marginTop={1}>
                <Text color={lmxTestStatus === 'ok' ? '#10b981' : lmxTestStatus === 'fail' ? '#ef4444' : '#22d3ee'}>
                  {lmxTestStatus === 'testing' ? '◔ Testing connection...'
                    : lmxTestStatus === 'ok' ? `✓ Connected to ${lmxHost}:${lmxPort}`
                    : `✗ Cannot reach ${lmxHost}:${lmxPort} — check host and port`}
                </Text>
              </Box>
            )}
          </Box>
        );

      case 'model':
        return (
          <Box flexDirection="column" marginTop={1}>
            <Box>
              <Text dimColor>Default model name: </Text>
              <TextInput value={defaultModel} onChange={setDefaultModel} focus />
            </Box>
            <Text dimColor marginTop={1}>e.g. qwen2.5-72b-instruct, deepseek-r1:70b, mlx-community/Qwen2.5-Coder-32B</Text>
            <Text dimColor>Run: opta models list — to see available models on your LMX server</Text>
          </Box>
        );

      case 'provider':
        return (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Anthropic API key (leave blank to skip):</Text>
            <TextInput value={anthropicKey} onChange={setAnthropicKey} mask="*" focus />
            <Text dimColor marginTop={1}>When set, Opta falls back to Claude when LMX is unreachable.</Text>
            <Text dimColor>Get a key at: console.anthropic.com</Text>
          </Box>
        );

      case 'research':
        return (
          <Box flexDirection="column" marginTop={1}>
            <Text color={stepColor}>Research provider setup is available in Settings → Advanced.</Text>
            <Text dimColor>Supports: Brave, Exa, Tavily, Gemini, Groq</Text>
            <Text dimColor marginTop={1}>Press Enter to continue to SSH setup.</Text>
          </Box>
        );

      case 'ssh':
        return (
          <Box flexDirection="column" marginTop={1}>
            <Box>
              <Text dimColor>SSH user (default: opta): </Text>
              <TextInput value={sshUser} onChange={setSshUser} focus={focusedField === 'primary'} />
            </Box>
            <Box marginTop={1}>
              <Text dimColor>SSH key path: </Text>
              <TextInput value={sshKey} onChange={setSshKey} focus={focusedField === 'secondary'} />
            </Box>
            <Text dimColor marginTop={1}>Tab switches fields · Leave defaults if you use standard ~/.ssh/id_ed25519</Text>
          </Box>
        );

      case 'paths':
        return (
          <Box flexDirection="column" marginTop={1}>
            <Box>
              <Text dimColor>Session logs dir: </Text>
              <TextInput value={sessionLogsDir} onChange={setSessionLogsDir} focus={focusedField === 'primary'} />
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Update logs dir: </Text>
              <TextInput value={updateLogsDir} onChange={setUpdateLogsDir} focus={focusedField === 'secondary'} />
            </Box>
            <Text dimColor marginTop={1}>Relative to project root or absolute path. Defaults work for the Opta monorepo.</Text>
          </Box>
        );

      case 'preferences':
        return (
          <Box flexDirection="column" marginTop={1}>
            <Box>
              <Text dimColor>Autonomy level (1–5, default 2): </Text>
              <TextInput value={autonomyLevel} onChange={setAutonomyLevel} focus />
            </Box>
            <Box marginTop={1}>
              <Text dimColor>{'['}{'■'.repeat(parseInt(autonomyLevel)||0)}{'□'.repeat(Math.max(0,5-(parseInt(autonomyLevel)||0)))}]</Text>
              <Text dimColor> 1=safe · 3=balanced · 5=maximum</Text>
            </Box>
          </Box>
        );

      case 'done':
        return (
          <Box flexDirection="column" marginTop={1}>
            <Text color={stepColor} bold>✓ Setup complete!</Text>
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>LMX: {lmxHost}:{lmxPort}</Text>
              <Text dimColor>Model: {defaultModel || '(not set)'}</Text>
              <Text dimColor>Anthropic fallback: {anthropicKey ? 'enabled' : 'disabled'}</Text>
              <Text dimColor>Autonomy: L{autonomyLevel}/5</Text>
            </Box>
            <Text dimColor marginTop={1}>Press Enter to save and close.</Text>
            <Text dimColor>Open the Opta Menu → Settings to change any setting.</Text>
          </Box>
        );

      default:
        return <Text dimColor>Unknown step</Text>;
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={stepColor}
      width={animatedWidth}
      paddingX={2}
      paddingY={1}
      overflow="hidden"
    >
      {/* HEADER */}
      <Box justifyContent="space-between">
        <Text color={stepColor} bold>
          Opta Setup{transitionActive ? ' · ◔' : ''}
        </Text>
        <Text dimColor>Step {stepNumber}/{totalSteps} · Esc close</Text>
      </Box>

      {/* PROGRESS BAR */}
      <Box marginTop={1}>
        <Text color={stepColor}>[</Text>
        <Text color={stepColor}>{progressBar}</Text>
        <Text color={stepColor}>]</Text>
        <Text dimColor> {STEP_TITLES[step]}</Text>
      </Box>

      {/* CONTENT */}
      {showContent ? (
        <Box flexDirection="column">
          <Box marginTop={1}>
            <Text dimColor>{STEP_DESCRIPTIONS[step]}</Text>
          </Box>
          {renderStepContent()}
          {/* FOOTER */}
          <Box marginTop={2}>
            <Text dimColor>
              {stepIndex > 0 ? '← Back' : 'Esc close'} · Enter{stepIndex < totalSteps - 1 ? ' next' : ' save'} · Opta Menu → Settings to revisit
            </Text>
          </Box>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text dimColor>◔ Loading setup wizard...</Text>
        </Box>
      )}
    </Box>
  );
}
```

**Step 4:** Run the test:
```bash
npm test -- tests/tui/OnboardingOverlay.test.tsx
```
Expected: PASS (all 4 tests)

**Step 5:** Commit:
```bash
git add src/tui/OnboardingOverlay.tsx tests/tui/OnboardingOverlay.test.tsx
git commit -m "feat(tui): add OnboardingOverlay — 9-step setup wizard matching OptaMenuOverlay design"
```

---

## Task 3: Create SettingsOverlay

**Files:**
- Create: `src/tui/SettingsOverlay.tsx`
- Create: `tests/tui/SettingsOverlay.test.tsx`

**Design:** Clone of OptaMenuOverlay's 5-page structure. Each item shows current value inline. Pressing Enter opens inline editor using ink-text-input. Items have ✓/⚠/✗ status badges.

**Step 1:** Write failing tests:

```typescript
// tests/tui/SettingsOverlay.test.tsx
import { render } from 'ink-testing-library';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { SettingsOverlay } from '../../src/tui/SettingsOverlay.js';

const baseProps = {
  animationPhase: 'open' as const,
  animationProgress: 1,
  config: {
    connection: { host: 'localhost', port: 1234 },
    model: { default: 'test-model' },
  } as Record<string, unknown>,
  onClose: vi.fn(),
  onSave: vi.fn(),
};

describe('SettingsOverlay', () => {
  it('renders Connection page by default', () => {
    const { lastFrame } = render(<SettingsOverlay {...baseProps} />);
    expect(lastFrame()).toContain('Settings');
    expect(lastFrame()).toContain('Connection');
  });

  it('shows all 5 page tabs', () => {
    const { lastFrame } = render(<SettingsOverlay {...baseProps} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Connection');
    expect(frame).toContain('Models');
    expect(frame).toContain('Safety');
    expect(frame).toContain('Paths');
    expect(frame).toContain('Advanced');
  });

  it('shows current value for host setting', () => {
    const { lastFrame } = render(<SettingsOverlay {...baseProps} />);
    expect(lastFrame()).toContain('localhost');
  });

  it('closes on Esc', () => {
    const onClose = vi.fn();
    const { stdin } = render(<SettingsOverlay {...baseProps} onClose={onClose} />);
    stdin.write('\x1b');
    expect(onClose).toHaveBeenCalled();
  });
});
```

**Step 2:** Run test to confirm failure:
```bash
npm test -- tests/tui/SettingsOverlay.test.tsx
```

**Step 3:** Create `src/tui/SettingsOverlay.tsx`:

```typescript
import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';

// --- TYPES ---

type SettingsPageId = 'connection' | 'models' | 'safety' | 'paths' | 'advanced';

interface SettingsPage { id: SettingsPageId; label: string; color: string; }

interface SettingsItem {
  label: string;
  description: string;
  configKey: string;
  defaultValue: string;
  sensitive?: boolean;      // Mask value with ***
  validate?: (v: string) => string | null; // Return error string or null
  hint?: string;            // Extra help below input
}

export interface SettingsOverlayProps {
  animationPhase?: 'opening' | 'open' | 'closing';
  animationProgress?: number;
  maxWidth?: number;
  maxHeight?: number;
  config?: Record<string, unknown>; // Flat dot-notation config snapshot
  onClose: () => void;
  onSave: (changes: Record<string, unknown>) => void;
}

// --- CONSTANTS ---

const PAGES: SettingsPage[] = [
  { id: 'connection', label: 'Connection',  color: '#10b981' },
  { id: 'models',     label: 'Models',      color: '#a78bfa' },
  { id: 'safety',     label: 'Safety',      color: '#f59e0b' },
  { id: 'paths',      label: 'Paths',       color: '#38bdf8' },
  { id: 'advanced',   label: 'Advanced',    color: '#22d3ee' },
];

const PAGE_INDEX = PAGES.reduce<Record<SettingsPageId, number>>((acc, p, i) => {
  acc[p.id] = i; return acc;
}, { connection: 0, models: 1, safety: 2, paths: 3, advanced: 4 });

const PAGE_ITEMS: Record<SettingsPageId, SettingsItem[]> = {
  connection: [
    { label: 'LMX Host',            configKey: 'connection.host',              defaultValue: 'localhost',           description: 'Hostname or IP of LMX inference server',                  hint: 'e.g. 192.168.188.11 or localhost' },
    { label: 'LMX Port',            configKey: 'connection.port',              defaultValue: '1234',                description: 'Port number for LMX API',                                  hint: 'Default: 1234' },
    { label: 'LMX API Key',         configKey: 'connection.apiKey',            defaultValue: 'opta-lmx',            description: 'API key for LMX (if auth enabled)', sensitive: true,      hint: 'Default: opta-lmx (no auth)' },
    { label: 'Fallback Hosts',      configKey: 'connection.fallbackHosts',     defaultValue: '',                    description: 'Comma-separated fallback LMX hosts',                       hint: 'e.g. 10.0.0.2:1234,10.0.0.3:1234' },
    { label: 'SSH User',            configKey: 'connection.ssh.user',          defaultValue: 'opta',                description: 'SSH username for remote LMX server',                       hint: 'User on the Mac Studio' },
    { label: 'SSH Key Path',        configKey: 'connection.ssh.identityFile',  defaultValue: '~/.ssh/id_ed25519',   description: 'Path to SSH private key',                                  hint: 'Full path or ~ expansion' },
    { label: 'Remote LMX Path',     configKey: 'connection.ssh.lmxPath',       defaultValue: '/Users/Shared/312/Opta/1-Apps/1M-Opta-LMX', description: 'LMX install path on remote host', hint: 'Absolute path on Mac Studio' },
    { label: 'Inference Timeout',   configKey: 'connection.inferenceTimeout',  defaultValue: '120000',              description: 'Max ms to wait for model response',                        hint: 'In milliseconds (120000 = 2 min)' },
  ],
  models: [
    { label: 'Default Model',       configKey: 'model.default',                defaultValue: '',                    description: 'Model loaded by default in new sessions',                  hint: 'Run: opta models list' },
    { label: 'Context Limit',       configKey: 'model.contextLimit',           defaultValue: '32768',               description: 'Token context window override',                            hint: 'Tokens (default: 32768)' },
    { label: 'Active Provider',     configKey: 'provider.active',              defaultValue: 'lmx',                 description: 'Primary provider: lmx or anthropic',                       hint: 'lmx = local, anthropic = cloud' },
    { label: 'Anthropic Key',       configKey: 'provider.anthropic.apiKey',    defaultValue: '', sensitive: true,    description: 'Anthropic API key for cloud fallback',                     hint: 'console.anthropic.com' },
    { label: 'Anthropic Model',     configKey: 'provider.anthropic.model',     defaultValue: 'claude-sonnet-4-5-20250929', description: 'Anthropic model for fallback',                hint: 'claude-opus-4-6 | claude-sonnet-4-6' },
    { label: 'Fallback on Failure', configKey: 'provider.fallbackOnFailure',   defaultValue: 'false',               description: 'Auto-fallback to Anthropic if LMX fails',                  hint: 'true or false' },
  ],
  safety: [
    { label: 'Autonomy Level',      configKey: 'autonomy.level',               defaultValue: '2',                   description: 'Default autonomy level (1–5)',                              hint: '1=safe 2=standard 3=extended 4=delegation 5=max', validate: v => (parseInt(v)<1||parseInt(v)>5)?'Must be 1–5':null },
    { label: 'Default Mode',        configKey: 'defaultMode',                  defaultValue: 'safe',                description: 'Default chat mode on session start',                       hint: 'safe | auto | plan | review | research' },
    { label: 'Autonomy Mode',       configKey: 'autonomy.mode',                defaultValue: 'execution',           description: 'Autonomy profile: execution or ceo',                       hint: 'execution (default) | ceo' },
    { label: 'Max Tool Calls',      configKey: 'safety.circuitBreaker.pauseAt',defaultValue: '40',                  description: 'Pause after this many tool calls in one loop',              hint: 'Default: 40' },
    { label: 'Hard Stop At',        configKey: 'safety.circuitBreaker.hardStopAt', defaultValue: '100',             description: 'Hard-stop tool loop after this many calls',                hint: 'Default: 100' },
    { label: 'Compact At (%)',      configKey: 'safety.compactAt',             defaultValue: '0.7',                 description: 'Compact context at this fill fraction',                    hint: '0.7 = 70% of context limit' },
  ],
  paths: [
    { label: 'Session Logs Dir',    configKey: 'journal.sessionLogsDir',       defaultValue: '12-Session-Logs',     description: 'Where session log files are written',                      hint: 'Relative to project root' },
    { label: 'Update Logs Dir',     configKey: 'journal.updateLogsDir',        defaultValue: 'updates',             description: 'Where update record files are written',                    hint: 'Relative to project root' },
    { label: 'Journal Author',      configKey: 'journal.author',               defaultValue: '',                    description: 'Name used in journal entries',                              hint: 'Defaults to $USER' },
    { label: 'Journal Timezone',    configKey: 'journal.timezone',             defaultValue: 'local',               description: 'Timezone for journal timestamps',                          hint: 'local or IANA tz (e.g. Australia/Sydney)' },
    { label: 'Learning Ledger',     configKey: 'learning.ledgerPath',          defaultValue: '.opta/learning/ledger.jsonl', description: 'Path to learning reinforcement ledger',        hint: 'Relative or absolute' },
    { label: 'Policy Audit Log',    configKey: 'policy.audit.path',            defaultValue: '.opta/policy/audit.jsonl',   description: 'Path to policy audit log',                    hint: 'Relative or absolute' },
  ],
  advanced: [
    { label: 'Browser Enabled',     configKey: 'browser.enabled',              defaultValue: 'false',               description: 'Enable Playwright browser automation',                     hint: 'true or false' },
    { label: 'Browser Mode',        configKey: 'browser.mode',                 defaultValue: 'isolated',            description: 'Browser session mode',                                    hint: 'isolated | attach' },
    { label: 'Max Browser Sessions',configKey: 'browser.runtime.maxSessions',  defaultValue: '3',                   description: 'Max concurrent browser sessions',                          hint: '1–20' },
    { label: 'Research Provider',   configKey: 'research.defaultProvider',     defaultValue: 'auto',                description: 'Default research provider',                               hint: 'auto | tavily | exa | brave | gemini | groq' },
    { label: 'SearXNG URL',         configKey: 'search.searxngUrl',            defaultValue: 'http://localhost:8081', description: 'SearXNG instance URL',                                hint: 'Self-hosted or remote' },
    { label: 'TUI Default',         configKey: 'tui.default',                  defaultValue: 'false',               description: 'Launch TUI automatically on opta chat',                   hint: 'true or false' },
    { label: 'Brave API Key',       configKey: 'research.providers.brave.apiKey',    defaultValue: '', sensitive: true, description: 'Brave Search API key', hint: 'api.search.brave.com' },
    { label: 'Exa API Key',         configKey: 'research.providers.exa.apiKey',      defaultValue: '', sensitive: true, description: 'Exa neural search API key', hint: 'exa.ai' },
    { label: 'Tavily API Key',      configKey: 'research.providers.tavily.apiKey',   defaultValue: '', sensitive: true, description: 'Tavily AI search API key', hint: 'tavily.com' },
    { label: 'Gemini API Key',      configKey: 'research.providers.gemini.apiKey',   defaultValue: '', sensitive: true, description: 'Google Gemini API key', hint: 'aistudio.google.com' },
  ],
};

// --- HELPERS ---

function getConfigValue(config: Record<string, unknown> | undefined, key: string, defaultVal: string): string {
  if (!config) return defaultVal;
  const val = config[key];
  if (val === undefined || val === null) return defaultVal;
  return String(val);
}

function statusGlyph(value: string, defaultVal: string, sensitive?: boolean): string {
  if (!value || value === defaultVal) return sensitive ? '⚠' : '○';
  return '✓';
}

function statusColor(value: string, defaultVal: string, sensitive?: boolean): string {
  if (!value || value === defaultVal) return sensitive ? '#f59e0b' : '#4b5563';
  return '#10b981';
}

// --- COMPONENT ---

export function SettingsOverlay({
  animationPhase = 'open',
  animationProgress = 1,
  maxWidth,
  maxHeight,
  config,
  onClose,
  onSave,
}: SettingsOverlayProps): React.ReactElement {
  const { stdout } = useStdout();
  const columns = stdout?.columns ?? process.stdout.columns ?? 120;
  const stdoutRows = stdout?.rows ?? process.stdout.rows ?? 36;

  const normalizedProgress = Math.max(0, Math.min(1, Number.isFinite(animationProgress) ? animationProgress : 1));
  const rows = Math.max(14, Math.min(stdoutRows, maxHeight ?? stdoutRows));
  const hardMax = Math.max(24, Math.min(columns - 4, maxWidth ?? columns - 8));
  const preferred = Math.max(70, Math.min(120, columns - 8));
  const width = Math.min(preferred, hardMax);
  const animatedWidth = Math.max(40, Math.floor(width * (0.55 + (0.45 * normalizedProgress))));
  const visualRows = Math.max(10, Math.floor(rows * (0.45 + (0.55 * normalizedProgress))));

  const transitionActive = animationPhase !== 'open' || normalizedProgress < 0.95;
  const showContent = normalizedProgress >= 0.28;
  const showItems = normalizedProgress >= 0.55;

  const [selectedPage, setSelectedPage] = useState<SettingsPageId>('connection');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [changes, setChanges] = useState<Record<string, unknown>>({});

  const items = PAGE_ITEMS[selectedPage];
  const pageMeta = PAGES.find(p => p.id === selectedPage);
  const pageColor = pageMeta?.color ?? '#0ea5e9';

  const itemViewportRows = Math.max(4, Math.min(items.length, visualRows - 18));
  const itemWindow = useMemo(() => {
    if (items.length <= itemViewportRows) return { start: 0, end: items.length };
    const half = Math.floor(itemViewportRows / 2);
    let start = Math.max(0, selectedIndex - half);
    let end = start + itemViewportRows;
    if (end > items.length) { end = items.length; start = Math.max(0, end - itemViewportRows); }
    return { start, end };
  }, [itemViewportRows, items.length, selectedIndex]);

  const setPage = useCallback((id: SettingsPageId) => {
    setSelectedPage(id); setSelectedIndex(0); setEditingKey(null);
  }, []);

  const currentValue = useCallback((item: SettingsItem): string => {
    const pendingVal = changes[item.configKey];
    if (pendingVal !== undefined) return String(pendingVal);
    return getConfigValue(config, item.configKey, item.defaultValue);
  }, [changes, config]);

  const commitEdit = useCallback(() => {
    if (!editingKey) return;
    setChanges(prev => ({ ...prev, [editingKey]: editValue }));
    setEditingKey(null);
  }, [editingKey, editValue]);

  useInput((input, key) => {
    // If editing a field, only handle Enter/Esc
    if (editingKey) {
      if (key.return) { commitEdit(); return; }
      if (key.escape) { setEditingKey(null); return; }
      return;
    }

    if (key.escape || (input === 'q' && !key.ctrl && !key.meta)) {
      onClose(); return;
    }

    if (key.leftArrow || input === 'h') {
      const prev = (PAGE_INDEX[selectedPage] + PAGES.length - 1) % PAGES.length;
      setPage(PAGES[prev]!.id); return;
    }
    if (key.rightArrow || input === 'l') {
      const next = (PAGE_INDEX[selectedPage] + 1) % PAGES.length;
      setPage(PAGES[next]!.id); return;
    }
    if (key.upArrow || input === 'k') {
      setSelectedIndex(prev => (prev - 1 + items.length) % items.length); return;
    }
    if (key.downArrow || input === 'j') {
      setSelectedIndex(prev => (prev + 1) % items.length); return;
    }

    // Number shortcuts for pages
    const num = Number(input);
    if (!key.ctrl && !key.meta && !Number.isNaN(num) && num >= 1 && num <= PAGES.length) {
      setPage(PAGES[num - 1]!.id); return;
    }

    // Ctrl+S = save all changes
    if (key.ctrl && input === 's') {
      onSave(changes); onClose(); return;
    }

    // Enter = open inline editor for selected item
    if (key.return) {
      const item = items[selectedIndex];
      if (!item) return;
      setEditingKey(item.configKey);
      setEditValue(currentValue(item));
      return;
    }
  });

  const unsavedCount = Object.keys(changes).length;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={pageColor}
      width={animatedWidth}
      paddingX={2}
      paddingY={1}
      overflow="hidden"
    >
      {/* HEADER */}
      <Box justifyContent="space-between">
        <Text color={pageColor} bold>
          Opta Settings{unsavedCount > 0 ? ` (${unsavedCount} unsaved)` : ''}
        </Text>
        <Text dimColor>Ctrl+S save · Esc close</Text>
      </Box>

      {showContent ? (
        <>
          {/* HINT */}
          <Box marginTop={1}>
            <Text dimColor>←/→ or h/l switch page · ↑/↓ navigate · Enter edit · 1-5 jump · Ctrl+S save all</Text>
          </Box>

          {/* PAGE TABS */}
          <Box marginTop={1} marginBottom={1}>
            {PAGES.map((page, i) => (
              <Box key={page.id} marginRight={2}>
                <Text
                  color={selectedPage === page.id ? page.color : undefined}
                  bold={selectedPage === page.id}
                >
                  {selectedPage === page.id ? '[x]' : '[ ]'} {i + 1}. {page.label}
                </Text>
              </Box>
            ))}
          </Box>

          <Text color={pageColor} bold>{pageMeta?.label ?? 'Settings'}</Text>

          {/* EDITING PANEL */}
          {editingKey ? (
            <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor={pageColor} paddingX={1}>
              <Text color={pageColor} bold>Editing: {editingKey}</Text>
              {(() => {
                const item = items.find(i => i.configKey === editingKey);
                return (
                  <>
                    <Box marginTop={1}>
                      <Text dimColor>Value: </Text>
                      <TextInput
                        value={editValue}
                        onChange={setEditValue}
                        mask={item?.sensitive ? '*' : undefined}
                        focus
                      />
                    </Box>
                    {item?.hint && <Text dimColor>{item.hint}</Text>}
                    <Text dimColor marginTop={1}>Enter to save · Esc to cancel</Text>
                  </>
                );
              })()}
            </Box>
          ) : null}

          {/* ITEMS LIST */}
          {showItems && !editingKey ? (
            <>
              {itemWindow.start > 0 && <Text dimColor>… {itemWindow.start} above …</Text>}
              {items.slice(itemWindow.start, itemWindow.end).map((item, idx) => {
                const abs = itemWindow.start + idx;
                const active = abs === selectedIndex;
                const val = currentValue(item);
                const displayVal = item.sensitive && val && val !== item.defaultValue
                  ? '●●●●●'
                  : (val || '(not set)');
                const glyph = statusGlyph(val, item.defaultValue, item.sensitive);
                const glyphColor = statusColor(val, item.defaultValue, item.sensitive);
                const changed = changes[item.configKey] !== undefined;

                return (
                  <Box key={item.configKey}>
                    <Text color={active ? pageColor : undefined}>{active ? '▶ ' : '  '}</Text>
                    <Text color={active ? pageColor : undefined} bold={active}>{item.label}</Text>
                    <Text color={glyphColor}> {glyph}</Text>
                    {changed && <Text color="#f59e0b"> *</Text>}
                    <Text dimColor>  {displayVal}</Text>
                    {active && <Text dimColor>  — {item.description}</Text>}
                  </Box>
                );
              })}
              {itemWindow.end < items.length && <Text dimColor>… {items.length - itemWindow.end} below …</Text>}
            </>
          ) : !editingKey ? (
            <Box marginTop={1}><Text dimColor>◔ Loading settings...</Text></Box>
          ) : null}
        </>
      ) : (
        <Box marginTop={1}><Text dimColor>◔ Opening settings...</Text></Box>
      )}
    </Box>
  );
}
```

**Step 4:** Run tests:
```bash
npm test -- tests/tui/SettingsOverlay.test.tsx
```
Expected: PASS

**Step 5:** Commit:
```bash
git add src/tui/SettingsOverlay.tsx tests/tui/SettingsOverlay.test.tsx
git commit -m "feat(tui): add SettingsOverlay — 5-page config browser matching OptaMenuOverlay design"
```

---

## Task 4: Wire both overlays into App.tsx

**Files:**
- Modify: `src/tui/App.tsx`

**Step 1:** Add imports at top of App.tsx:
```typescript
import { OnboardingOverlay } from './OnboardingOverlay.js';
import { SettingsOverlay } from './SettingsOverlay.js';
```

**Step 2:** Find the `ActiveOverlay` type (line ~207) and extend it (already done in Task 1).

**Step 3:** Find where `useKeyboard` is called and add handlers:
```typescript
// In the useKeyboard call, add:
onOpenSettings: () => {
  if (permissionPending) return;
  setActiveOverlay('settings');
},
onOpenOnboarding: () => {
  if (permissionPending) return;
  setActiveOverlay('onboarding');
},
```

**Step 4:** Add `handleSettingsSave` callback near other handlers:
```typescript
const handleSettingsSave = useCallback(async (changes: Record<string, unknown>) => {
  try {
    const { saveConfig } = await import('../core/config.js');
    await saveConfig(changes);
  } catch { /* silent — user sees unsaved indicator */ }
}, []);
```

**Step 5:** Find the overlay render block (where `activeOverlay === 'opta-menu'` etc. are rendered) and add the new cases:

```tsx
{activeOverlay === 'onboarding' ? (
  <OnboardingOverlay
    animationPhase={optaMenuAnimationPhase}
    animationProgress={optaMenuAnimationProgress}
    maxWidth={overlayMaxWidth}
    maxHeight={overlayMaxHeight}
    onClose={closeOverlay}
    onComplete={async (config) => {
      await handleSettingsSave(config);
      closeOverlay();
    }}
  />
) : activeOverlay === 'settings' ? (
  <SettingsOverlay
    animationPhase={optaMenuAnimationPhase}
    animationProgress={optaMenuAnimationProgress}
    maxWidth={overlayMaxWidth}
    maxHeight={overlayMaxHeight}
    config={flatConfig}      // flat dot-notation config snapshot — see Step 6
    onClose={closeOverlay}
    onSave={handleSettingsSave}
  />
) : null}
```

**Step 6:** Compute `flatConfig` from existing config state (add this near the top of App.tsx's render):
```typescript
const flatConfig = useMemo<Record<string, unknown>>(() => ({
  'connection.host': connectionHost,
  'connection.port': connectionPort,
  'model.default': currentModel,
  // Add other values as needed from existing App.tsx state
}), [connectionHost, connectionPort, currentModel]);
```

**Step 7:** Run typecheck:
```bash
npm run typecheck
```
Expected: PASS

**Step 8:** Run TUI tests:
```bash
npm run test:tui
```
Expected: All pass.

**Step 9:** Commit:
```bash
git add src/tui/App.tsx
git commit -m "feat(tui): wire OnboardingOverlay and SettingsOverlay into App.tsx"
```

---

## Task 5: Add Settings + Onboarding items to OptaMenuOverlay

**Files:**
- Modify: `src/tui/OptaMenuOverlay.tsx`

**Step 1:** Add new action types to the `MenuAction` union in OptaMenuOverlay.tsx:
```typescript
type MenuAction =
  // ... existing ...
  | 'open-settings'
  | 'open-onboarding';
```

**Step 2:** Add callbacks to `OptaMenuOverlayProps`:
```typescript
onOpenSettings?: () => void;
onOpenOnboarding?: () => void;
```

**Step 3:** In the `useInput` handler, add dispatch for new actions:
```typescript
else if (item.action === 'open-settings') onOpenSettings?.();
else if (item.action === 'open-onboarding') onOpenOnboarding?.();
```

**Step 4:** Add items to the `operationsItems` array (in `pageItems` useMemo):
```typescript
// Add near the top of operationsItems array:
{
  action: 'open-settings',
  label: 'Settings',
  description: 'Edit all Opta configuration settings',
  color: '#10b981',
  recommended: false,
  infoTitle: 'Opta Settings',
  infoBody: 'Opens the full settings menu — 5 pages covering Connection, Models, Safety, Paths, and Advanced options. Changes are saved to ~/.config/opta/config.json.',
},
{
  action: 'open-onboarding',
  label: 'Onboarding / Setup Wizard',
  description: 'Re-run the setup wizard to reconfigure connection and preferences',
  color: '#38bdf8',
  infoTitle: 'Setup Wizard',
  infoBody: 'Steps through LMX connection, default model, SSH, paths, and autonomy preferences. Safe to re-run — only saves changes you confirm.',
},
```

**Step 5:** In App.tsx, pass the new callbacks to `<OptaMenuOverlay>`:
```tsx
onOpenSettings={() => setActiveOverlay('settings')}
onOpenOnboarding={() => setActiveOverlay('onboarding')}
```

**Step 6:** Run test suite:
```bash
npm run test:tui
```
Expected: all pass.

**Step 7:** Commit:
```bash
git add src/tui/OptaMenuOverlay.tsx src/tui/App.tsx
git commit -m "feat(tui): add Settings and Onboarding items to Opta Menu Operations page"
```

---

## Task 6: Auto-trigger onboarding on first run

**Files:**
- Modify: `src/commands/onboard.ts`
- Modify: `src/commands/chat.ts`

**Step 1:** In `src/commands/onboard.ts`, `runOnboarding()` already exists for CLI mode. Add a TUI mode path:
```typescript
export async function runOnboardingTUI(): Promise<void> {
  const { render } = await import('../tui/render.js');
  const { OnboardingOverlay } = await import('../tui/OnboardingOverlay.js');
  // Launch minimal TUI with just the OnboardingOverlay visible
  // ... (integrate with existing render.tsx entry)
}
```

**Step 2:** In `src/commands/chat.ts`, add first-run check before launching TUI:
```typescript
import { isFirstRun, markOnboarded } from './onboard.js';

// In startChat():
if (await isFirstRun() && options.tui) {
  // Set activeOverlay to 'onboarding' when App.tsx renders
  chatState.initialOverlay = 'onboarding';
}
```

**Step 3:** Add `initialOverlay` prop to App.tsx:
```typescript
// In App props interface:
initialOverlay?: ActiveOverlay;

// In useState:
const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay>(
  props.initialOverlay ?? 'none'
);
```

**Step 4:** In `onComplete` handler of OnboardingOverlay in App.tsx, mark as onboarded:
```typescript
onComplete={async (config) => {
  await handleSettingsSave(config);
  const { markOnboarded } = await import('../commands/onboard.js');
  await markOnboarded();
  closeOverlay();
}}
```

**Step 5:** Run typecheck + test:
```bash
npm run typecheck && npm test
```
Expected: PASS

**Step 6:** Commit:
```bash
git add src/commands/onboard.ts src/commands/chat.ts src/tui/App.tsx
git commit -m "feat(cli): auto-trigger OnboardingOverlay on first TUI launch"
```

---

## Task 7: Add `opta config settings` alias

**Files:**
- Modify: `src/commands/config.ts`

**Step 1:** In `config.ts`, the existing `opta config menu` / `opta config interactive` subcommand opens a pane-based menu. Add `settings` as an alias that launches the TUI with SettingsOverlay active:

```typescript
program
  .command('settings')
  .description('Open TUI settings overlay (alias for opta chat --tui --settings)')
  .action(async () => {
    const { startChat } = await import('./chat.js');
    await startChat({ tui: true, initialOverlay: 'settings' });
  });
```

**Step 2:** Run typecheck:
```bash
npm run typecheck
```
Expected: PASS

**Step 3:** Commit:
```bash
git add src/commands/config.ts
git commit -m "feat(cli): add opta config settings — opens TUI SettingsOverlay directly"
```

---

## Verification

After all tasks complete:

```bash
# 1. Confirm all tests pass
npm test

# 2. Confirm types pass
npm run typecheck

# 3. Manual smoke test
npm run dev -- chat --tui
# Ctrl+S → Opta Menu → Operations → Settings should open SettingsOverlay
# Ctrl+S → Opta Menu → Operations → Onboarding should open OnboardingOverlay
```

---

## Files Changed Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/tui/OnboardingOverlay.tsx` | Create | 9-step setup wizard |
| `src/tui/SettingsOverlay.tsx` | Create | 5-page settings browser |
| `src/tui/App.tsx` | Modify | Wire overlays + first-run detection |
| `src/tui/keybindings.ts` | Modify | Add openSettings, openOnboarding keys |
| `src/tui/hooks/useKeyboard.ts` | Modify | Register new keyboard handlers |
| `src/tui/OptaMenuOverlay.tsx` | Modify | Add Settings + Onboarding menu items |
| `src/commands/onboard.ts` | Modify | Add TUI mode path + first-run auto-trigger |
| `src/commands/chat.ts` | Modify | Pass initialOverlay from first-run check |
| `src/commands/config.ts` | Modify | Add `opta config settings` alias |
| `tests/tui/OnboardingOverlay.test.tsx` | Create | Wizard tests |
| `tests/tui/SettingsOverlay.test.tsx` | Create | Settings overlay tests |

import React, { useState, useCallback } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import TextInput from 'ink-text-input';
import { InlineSelect, InlineSlider } from './InlineSelect.js';

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
  const [autonomyLevel, setAutonomyLevel] = useState(2);
  const [defaultMode, setDefaultMode] = useState('safe');
  const [lmxTestStatus, setLmxTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [focusedField, setFocusedField] = useState<'primary' | 'secondary'>('primary');

  const step = STEP_ORDER[stepIndex] ?? 'welcome';
  // Whether the preferences step is using inline selection (arrow keys handled by child)
  const prefsUsingInlineInput = step === 'preferences';
  const stepColor = STEP_COLORS[step];
  const stepNumber = stepIndex + 1;
  const totalSteps = STEP_ORDER.length;

  // Suppress unused variable warning for rows
  void rows;

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
        'autonomy.level': autonomyLevel,
        'defaultMode': defaultMode,
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
  }, [stepIndex, step, lmxHost, lmxPort, defaultModel, defaultMode, anthropicKey, sshUser, sshKey,
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
    // On the preferences step, arrow keys are handled by InlineSlider/InlineSelect
    // Only Enter (to advance) and Escape (to close) are handled here
    if (prefsUsingInlineInput) {
      if (key.return) { advance(); return; }
      if (key.backspace) { goBack(); return; }
      // Tab switches between autonomy slider and mode selector
      if (key.tab) {
        setFocusedField(prev => prev === 'primary' ? 'secondary' : 'primary');
        return;
      }
      return;
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
            <Box marginTop={1}>
              <Text dimColor>This wizard configures your LMX connection, default model, and optional integrations.</Text>
            </Box>
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
            <Box marginTop={1}><Text dimColor>e.g. qwen2.5-72b-instruct, deepseek-r1:70b, mlx-community/Qwen2.5-Coder-32B</Text></Box>
            <Text dimColor>Run: opta models list — to see available models on your LMX server</Text>
          </Box>
        );

      case 'provider':
        return (
          <Box flexDirection="column" marginTop={1}>
            <Text dimColor>Anthropic API key (leave blank to skip):</Text>
            <TextInput value={anthropicKey} onChange={setAnthropicKey} mask="*" focus />
            <Box marginTop={1}><Text dimColor>When set, Opta falls back to Claude when LMX is unreachable.</Text></Box>
            <Text dimColor>Get a key at: console.anthropic.com</Text>
          </Box>
        );

      case 'research':
        return (
          <Box flexDirection="column" marginTop={1}>
            <Text color={stepColor}>Research provider setup is available in Settings → Advanced.</Text>
            <Text dimColor>Supports: Brave, Exa, Tavily, Gemini, Groq</Text>
            <Box marginTop={1}><Text dimColor>Press Enter to continue to SSH setup.</Text></Box>
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
            <Box marginTop={1}><Text dimColor>Tab switches fields · Leave defaults if you use standard ~/.ssh/id_ed25519</Text></Box>
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
            <Box marginTop={1}><Text dimColor>Relative to project root or absolute path. Defaults work for the Opta monorepo.</Text></Box>
          </Box>
        );

      case 'preferences':
        return (
          <Box flexDirection="column" marginTop={1}>
            <InlineSlider
              min={1}
              max={5}
              value={autonomyLevel}
              onSelect={(v) => { setAutonomyLevel(v); setFocusedField('secondary'); }}
              onCancel={goBack}
              color={stepColor}
              label="Autonomy Level"
              labels={{ 1: 'safe', 2: 'standard', 3: 'extended', 4: 'delegation', 5: 'maximum' }}
              focus={focusedField === 'primary'}
            />
            <Box marginTop={1}>
              <InlineSelect
                options={[
                  { label: 'Safe',     value: 'safe',     description: 'Conservative — asks before acting' },
                  { label: 'Auto',     value: 'auto',     description: 'Balanced autonomy with guardrails' },
                  { label: 'Plan',     value: 'plan',     description: 'Plans before executing' },
                  { label: 'Review',   value: 'review',   description: 'Code review focus' },
                  { label: 'Research', value: 'research', description: 'Web research focus' },
                ]}
                value={defaultMode}
                onSelect={(v) => { setDefaultMode(v); }}
                onCancel={goBack}
                color={stepColor}
                label="Default Mode"
                focus={focusedField === 'secondary'}
              />
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Tab to switch between Autonomy Level and Default Mode · Enter to continue</Text>
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
              <Text dimColor>Autonomy: L{autonomyLevel}/5 · Mode: {defaultMode}</Text>
            </Box>
            <Box marginTop={1}><Text dimColor>Press Enter to save and close.</Text></Box>
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

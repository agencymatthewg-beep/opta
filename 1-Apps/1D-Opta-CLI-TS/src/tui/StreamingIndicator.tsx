import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

// Smooth Braille spinner frames
const BRAILLE_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

// Legacy spinner frames (kept for backward compat rendering)
const LEGACY_FRAMES = ['*', '~', '*', '~', '*', '~', '*', '~', '*', '~'];

// --- Types ---

export interface StreamingIndicatorProps {
  /** Current phase of the turn */
  phase: 'idle' | 'connecting' | 'waiting' | 'streaming' | 'tool-call' | 'done';
  /** Elapsed seconds for current turn (ticking) */
  elapsed: number;
  /** Current tokens/second rate */
  speed: number;
  /** Completion tokens generated so far */
  completionTokens: number;
  /** Contextual label (e.g. "thinking", "running read_file") */
  label: string;
  /** Time in ms from submit to first token, null if no token yet */
  firstTokenLatency: number | null;
}

type OldProps = { label?: string };
type Props = OldProps | StreamingIndicatorProps;

function isNewProps(props: Props): props is StreamingIndicatorProps {
  return 'phase' in props;
}

// --- Legacy component (backward compat) ---

function LegacyIndicator({ label = 'thinking' }: OldProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % LEGACY_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text color="cyan">
      {LEGACY_FRAMES[frame]} <Text dimColor>{label}...</Text>
    </Text>
  );
}

// --- Rich multi-phase component ---

function RichIndicator({
  phase,
  elapsed,
  speed,
  completionTokens,
  label,
  firstTokenLatency,
}: StreamingIndicatorProps) {
  const [frame, setFrame] = useState(0);

  // Animate spinner for all active phases (not idle, not done)
  const isAnimating = phase !== 'idle' && phase !== 'done';

  useEffect(() => {
    if (!isAnimating) return;
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % BRAILLE_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, [isAnimating]);

  // idle: render nothing
  if (phase === 'idle') {
    return null;
  }

  // done: static green indicator
  if (phase === 'done') {
    return (
      <Box paddingX={1}>
        <Text color="green">● </Text>
        <Text color="green">Done</Text>
        <Text dimColor>  {elapsed.toFixed(1)}s</Text>
        {completionTokens > 0 && (
          <>
            <Text dimColor> │ </Text>
            <Text>{completionTokens} tokens</Text>
          </>
        )}
        {speed > 0 && (
          <>
            <Text dimColor> │ </Text>
            <Text color="green">{speed.toFixed(1)} tok/s</Text>
          </>
        )}
      </Box>
    );
  }

  // Active phases: connecting, waiting, streaming, tool-call
  const spinner = BRAILLE_FRAMES[frame];

  let phaseLabel: string;
  switch (phase) {
    case 'connecting':
      phaseLabel = 'Connecting to LMX...';
      break;
    case 'waiting':
      phaseLabel = 'Waiting for first token...';
      break;
    case 'streaming':
      phaseLabel = 'Streaming';
      break;
    case 'tool-call':
      phaseLabel = label ? `Running ${label}...` : 'Running tool...';
      break;
    default:
      phaseLabel = label || 'Working...';
  }

  return (
    <Box paddingX={1}>
      <Text color="cyan">{spinner} </Text>
      <Text>{phaseLabel}</Text>
      <Text dimColor>  {elapsed.toFixed(1)}s</Text>
      {completionTokens > 0 && (
        <>
          <Text dimColor> │ </Text>
          <Text>{completionTokens} tokens</Text>
        </>
      )}
      {speed > 0 && phase === 'streaming' && (
        <>
          <Text dimColor> │ </Text>
          <Text color="green">{speed.toFixed(0)} tok/s</Text>
        </>
      )}
      {firstTokenLatency !== null && (
        <>
          <Text dimColor> │ </Text>
          <Text dimColor>TTFT {(firstTokenLatency / 1000).toFixed(1)}s</Text>
        </>
      )}
    </Box>
  );
}

// --- Exported component: supports both old and new prop signatures ---

export function StreamingIndicator(props: Props) {
  if (isNewProps(props)) {
    return <RichIndicator {...props} />;
  }
  return <LegacyIndicator {...props} />;
}

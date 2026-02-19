import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

// Braille spinner (thinking)
const BRAILLE = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
// Pulsing circle (connecting)
const PULSE = ['⦿', '◎', '○', '◎'];
// Rotating arrow (reading)
const ROTATE = ['↻', '↺'];
// Filling square (deep thinking)
const FILL = ['◧', '◩', '◪', '◨'];

export interface StreamingIndicatorProps {
  phase: 'idle' | 'connecting' | 'waiting' | 'streaming' | 'tool-call' | 'done';
  elapsed: number;
  speed: number;
  completionTokens: number;
  label: string;
  firstTokenLatency: number | null;
}

type OldProps = { label?: string };
type Props = OldProps | StreamingIndicatorProps;

function isNewProps(props: Props): props is StreamingIndicatorProps {
  return 'phase' in props;
}

function LegacyIndicator({ label = 'thinking' }: OldProps) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setFrame(f => (f + 1) % BRAILLE.length), 80);
    return () => clearInterval(t);
  }, []);
  return (
    <Text color="cyan">{BRAILLE[frame]} <Text dimColor>{label}...</Text></Text>
  );
}

function useAnimatedFrame(frames: string[], interval: number, active: boolean): string {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setFrame(f => (f + 1) % frames.length), interval);
    return () => clearInterval(t);
  }, [active, frames.length, interval]);
  return frames[frame] ?? frames[0] ?? '';
}

function RichIndicator({ phase, elapsed, speed, completionTokens, label, firstTokenLatency }: StreamingIndicatorProps) {
  const isActive = phase !== 'idle' && phase !== 'done';

  const braille = useAnimatedFrame(BRAILLE, 80, isActive && (phase === 'waiting' || phase === 'streaming'));
  const pulse = useAnimatedFrame(PULSE, 200, isActive && phase === 'connecting');
  const rotate = useAnimatedFrame(ROTATE, 200, isActive && phase === 'tool-call');
  const fill = useAnimatedFrame(FILL, 300, isActive && label === 'thinking deeply');

  if (phase === 'idle') return null;

  if (phase === 'done') {
    return (
      <Box paddingX={1}>
        <Text color="green">✔ </Text>
        <Text color="green">Done</Text>
        <Text dimColor>  {elapsed.toFixed(1)}s</Text>
        {completionTokens > 0 && <><Text dimColor> │ </Text><Text dimColor>{completionTokens} tok</Text></>}
        {speed > 0 && <><Text dimColor> │ </Text><Text color="green">{speed.toFixed(0)} t/s</Text></>}
      </Box>
    );
  }

  // Determine symbol + color + text based on phase/label
  let symbol: string;
  let symbolColor: string;
  let phaseText: string;

  if (phase === 'connecting') {
    symbol = pulse;
    symbolColor = 'yellow';
    phaseText = 'Connecting to LMX...';
  } else if (phase === 'waiting' || (phase === 'streaming' && label === 'thinking deeply')) {
    symbol = label === 'thinking deeply' ? fill : braille;
    symbolColor = label === 'thinking deeply' ? 'magenta' : 'cyan';
    phaseText = label === 'thinking deeply' ? 'Thinking deeply...' : 'Thinking...';
  } else if (phase === 'tool-call') {
    // Pick symbol based on tool type
    const toolName = label.replace(/^running\s+/, '');
    if (toolName.includes('run_command') || toolName.includes('bg_start')) {
      symbol = '⚡';
      symbolColor = 'yellow';
      phaseText = `Running ${toolName.replace(/^running\s+/, '')}`;
    } else if (toolName.includes('edit_file') || toolName.includes('write_file') || toolName.includes('multi_edit')) {
      symbol = rotate;
      symbolColor = 'yellow';
      phaseText = `Writing ${toolName.replace(/^(edit_file|write_file|multi_edit)\s*/,'').replace(/running\s+/, '')}`;
    } else {
      // read/search/list/find
      symbol = rotate;
      symbolColor = 'cyan';
      phaseText = label.startsWith('running ') ? label.slice(8) : label;
    }
  } else {
    // streaming / writing response
    symbol = '→';
    symbolColor = 'green';
    phaseText = 'Writing response...';
  }

  return (
    <Box paddingX={1}>
      <Text color={symbolColor}>{symbol} </Text>
      <Text dimColor>{phaseText}</Text>
      {elapsed > 0 && <Text dimColor>  {elapsed.toFixed(1)}s</Text>}
      {completionTokens > 0 && <><Text dimColor> │ </Text><Text dimColor>{completionTokens} tok</Text></>}
      {speed > 0 && phase === 'streaming' && <><Text dimColor> │ </Text><Text color="green">{speed.toFixed(0)} t/s</Text></>}
      {firstTokenLatency !== null && phase !== 'streaming' && (
        <><Text dimColor> │ </Text><Text dimColor>TTFT {(firstTokenLatency / 1000).toFixed(1)}s</Text></>
      )}
    </Box>
  );
}

export function StreamingIndicator(props: Props) {
  if (isNewProps(props)) return <RichIndicator {...props} />;
  return <LegacyIndicator {...props} />;
}

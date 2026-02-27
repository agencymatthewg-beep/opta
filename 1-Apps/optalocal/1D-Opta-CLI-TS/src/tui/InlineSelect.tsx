import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

export interface SelectOption {
  label: string;
  value: string;
  description?: string;
}

export interface InlineSelectProps {
  options: SelectOption[];
  value: string;
  onSelect: (value: string) => void;
  onCancel: () => void;
  color?: string;
  label?: string;
  focus?: boolean;
}

/**
 * Arrow-key navigable inline select. Up/Down to move, Enter to confirm, Esc to cancel.
 * Space also confirms for consistency with multi-select conventions.
 */
export function InlineSelect({
  options,
  value,
  onSelect,
  onCancel,
  color = '#0ea5e9',
  label,
  focus = true,
}: InlineSelectProps): React.ReactElement {
  const initialIndex = Math.max(0, options.findIndex(o => o.value === value));
  const [cursor, setCursor] = useState(initialIndex);

  // Keep cursor in bounds if options change
  useEffect(() => {
    setCursor(prev => Math.min(prev, Math.max(options.length - 1, 0)));
  }, [options.length]);

  useInput((input, key) => {
    if (!focus) return;
    if (key.escape) { onCancel(); return; }
    if (key.return || input === ' ') {
      const selected = options[cursor];
      if (selected) onSelect(selected.value);
      return;
    }
    if (key.upArrow || input === 'k') {
      setCursor(prev => (prev - 1 + options.length) % options.length);
      return;
    }
    if (key.downArrow || input === 'j') {
      setCursor(prev => (prev + 1) % options.length);
      return;
    }
  }, { isActive: focus });

  return (
    <Box flexDirection="column">
      {label && <Text color={color} bold>{label}</Text>}
      {options.map((opt, i) => {
        const active = i === cursor;
        const isCurrent = opt.value === value;
        return (
          <Box key={opt.value}>
            <Text color={active ? color : undefined}>{active ? '▶ ' : '  '}</Text>
            <Text color={active ? color : undefined} bold={active}>
              {opt.label}
            </Text>
            {isCurrent && <Text dimColor> (current)</Text>}
            {active && opt.description && <Text dimColor>  — {opt.description}</Text>}
          </Box>
        );
      })}
      <Box marginTop={1}>
        <Text dimColor>↑/↓ navigate · Enter select · Esc cancel</Text>
      </Box>
    </Box>
  );
}

export interface InlineSliderProps {
  min: number;
  max: number;
  value: number;
  step?: number;
  onSelect: (value: number) => void;
  onCancel: () => void;
  color?: string;
  label?: string;
  labels?: Record<number, string>;
  focus?: boolean;
}

/**
 * Arrow-key numeric slider. Left/Right or Up/Down to adjust, Enter to confirm, Esc to cancel.
 */
export function InlineSlider({
  min,
  max,
  value,
  step = 1,
  onSelect,
  onCancel,
  color = '#0ea5e9',
  label,
  labels,
  focus = true,
}: InlineSliderProps): React.ReactElement {
  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max]);
  const [current, setCurrent] = useState(clamp(value));

  useInput((input, key) => {
    if (!focus) return;
    if (key.escape) { onCancel(); return; }
    if (key.return || input === ' ') { onSelect(current); return; }
    if (key.leftArrow || key.upArrow || input === 'h' || input === 'k') {
      setCurrent(prev => clamp(prev - step));
      return;
    }
    if (key.rightArrow || key.downArrow || input === 'l' || input === 'j') {
      setCurrent(prev => clamp(prev + step));
      return;
    }
    // Direct number input for single-digit ranges
    const num = Number(input);
    if (!Number.isNaN(num) && num >= min && num <= max) {
      setCurrent(num);
      return;
    }
  }, { isActive: focus });

  const range = max - min;
  const filled = current - min;
  const bar = '\u25A0'.repeat(filled) + '\u25A1'.repeat(range - filled);
  const levelLabel = labels?.[current] ?? '';

  return (
    <Box flexDirection="column">
      {label && <Text color={color} bold>{label}</Text>}
      <Box>
        <Text color={color}>[{bar}]</Text>
        <Text color={color} bold> {current}</Text>
        <Text dimColor>/{max}</Text>
        {levelLabel && <Text dimColor>  {levelLabel}</Text>}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>←/→ adjust · Enter confirm · Esc cancel{range <= 9 ? ' · or press number' : ''}</Text>
      </Box>
    </Box>
  );
}

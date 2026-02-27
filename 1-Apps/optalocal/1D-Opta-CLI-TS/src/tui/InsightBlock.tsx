/**
 * InsightBlock — Renders ★ Insight lines inline with chat messages.
 *
 * Displays real-time observability data from the local model inference:
 * performance metrics, context usage, tool selection, and connection events.
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { InsightCategory } from '../core/insights.js';

export interface InsightEntry {
  category: InsightCategory;
  text: string;
  ts: number;
}

const CATEGORY_COLORS: Record<InsightCategory, string> = {
  perf: 'cyan',
  context: 'yellow',
  tool: 'magenta',
  connection: 'red',
  summary: 'green',
};

const CATEGORY_ICONS: Record<InsightCategory, string> = {
  perf: '\u26A1',      // ⚡
  context: '\u25CB',    // ○
  tool: '\u25B6',       // ▶
  connection: '\u25C6', // ◆
  summary: '\u2605',    // ★
};

export function InsightLine({ insight }: { insight: InsightEntry }) {
  const color = CATEGORY_COLORS[insight.category];
  const icon = CATEGORY_ICONS[insight.category];

  return (
    <Box paddingLeft={2}>
      <Text color={color} dimColor>
        {icon} {insight.text}
      </Text>
    </Box>
  );
}

export function InsightBlock({ insights }: { insights: InsightEntry[] }) {
  if (insights.length === 0) return null;

  return (
    <Box flexDirection="column" marginTop={0} marginBottom={0}>
      {insights.map((insight, i) => (
        <InsightLine key={`${insight.ts}-${i}`} insight={insight} />
      ))}
    </Box>
  );
}

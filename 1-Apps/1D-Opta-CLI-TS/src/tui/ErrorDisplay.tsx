/**
 * ErrorDisplay — Structured error rendering for the TUI.
 *
 * Parses error messages for known patterns (connection, API, permission)
 * and shows categorized messages with actionable suggestions.
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface ErrorDisplayProps {
  message: string;
  timestamp?: number;
}

interface ErrorCategory {
  label: string;
  color: string;
  suggestion: string;
}

function categorizeError(message: string): ErrorCategory {
  const lower = message.toLowerCase();

  if (lower.includes('econnrefused') || lower.includes('econnreset') || lower.includes('fetch failed')) {
    return {
      label: 'Connection Error',
      color: 'red',
      suggestion: 'Run `opta doctor` to diagnose, or check if LMX is running',
    };
  }

  if (lower.includes('timeout') || lower.includes('etimedout') || lower.includes('aborted')) {
    return {
      label: 'Timeout',
      color: 'yellow',
      suggestion: 'The server may be overloaded. Try again or check `opta status`',
    };
  }

  if (lower.includes('permission denied') || lower.includes('permission')) {
    return {
      label: 'Permission Denied',
      color: 'yellow',
      suggestion: 'Check tool permissions with `opta config list`',
    };
  }

  if (lower.includes('api key') || lower.includes('unauthorized') || lower.includes('401') || lower.includes('403')) {
    return {
      label: 'Authentication Error',
      color: 'red',
      suggestion: 'Check your API key configuration',
    };
  }

  if (lower.includes('rate limit') || lower.includes('429') || lower.includes('too many')) {
    return {
      label: 'Rate Limited',
      color: 'yellow',
      suggestion: 'Wait a moment and try again',
    };
  }

  if (lower.includes('model') && (lower.includes('not found') || lower.includes('404'))) {
    return {
      label: 'Model Not Found',
      color: 'red',
      suggestion: 'Check available models with `opta models`',
    };
  }

  return {
    label: 'Error',
    color: 'red',
    suggestion: '',
  };
}

export function ErrorDisplay({ message, timestamp }: ErrorDisplayProps) {
  const category = categorizeError(message);
  const time = timestamp
    ? new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()
    : undefined;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={category.color} bold>  {'\u2718'} {category.label}</Text>
        {time && <Text dimColor>  {time}</Text>}
      </Box>
      <Box paddingLeft={4}>
        <Text color={category.color} wrap="wrap">{message}</Text>
      </Box>
      {category.suggestion && (
        <Box paddingLeft={4} marginTop={0}>
          <Text dimColor>{'\u21B3'} {category.suggestion}</Text>
        </Box>
      )}
    </Box>
  );
}

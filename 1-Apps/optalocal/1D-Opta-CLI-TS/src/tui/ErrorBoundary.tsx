/**
 * ErrorBoundary — React class-based error boundary for the Opta TUI.
 *
 * Catches synchronous render errors thrown by any descendant component
 * and displays a graceful inline error box instead of crashing the whole app.
 *
 * Usage:
 *   <ErrorBoundary label="OptaMenu">
 *     <OptaMenuOverlay ... />
 *   </ErrorBoundary>
 *
 * Wrap the root App in render.tsx to prevent full app crashes, and also wrap
 * individual overlays so that one failing overlay doesn't kill everything else.
 */

import React from 'react';
import { Box, Text } from 'ink';
import { TUI_COLORS } from './palette.js';

interface Props {
  children: React.ReactNode;
  /** Human-readable label for the component section (used in error message). */
  label?: string;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, componentStack: null };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.setState({
      error,
      componentStack: info.componentStack ?? null,
    });
  }

  override render(): React.ReactNode {
    const { error, componentStack } = this.state;

    if (error) {
      // Extract the first meaningful line from the component stack
      const stackHint = componentStack
        ? componentStack.split('\n').find((l) => l.trim().startsWith('at '))?.trim() ?? ''
        : '';

      return (
        <Box
          flexDirection="column"
          borderStyle="round"
          borderColor={TUI_COLORS.danger}
          paddingX={2}
          paddingY={1}
        >
          <Text color={TUI_COLORS.danger} bold>
            {this.props.label ? `${this.props.label} crashed` : 'Component crashed'}
          </Text>
          <Text color={TUI_COLORS.warning}>{error.message}</Text>
          {stackHint ? <Text dimColor>{stackHint}</Text> : null}
          <Text dimColor>Press Esc to dismiss overlay, or Ctrl+C to exit.</Text>
        </Box>
      );
    }

    return this.props.children;
  }
}

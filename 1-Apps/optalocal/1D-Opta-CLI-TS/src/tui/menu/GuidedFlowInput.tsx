import { Box, Text } from 'ink';
import { TUI_COLORS } from '../palette.js';
import type { GuidedFlowState } from './types.js';
import { guidedFlowPrompt } from './helpers.js';

export interface GuidedFlowInputProps {
  guidedFlow: GuidedFlowState;
  guidedCommandPreview: string;
}

export function GuidedFlowInput({ guidedFlow, guidedCommandPreview }: GuidedFlowInputProps) {
  const guidedMeta = guidedFlowPrompt(guidedFlow.kind);

  return (
    <Box marginBottom={1} flexDirection="column" borderStyle="round" borderColor="#f59e0b" paddingX={1}>
      <Text color="#f59e0b" bold>{guidedMeta.title}</Text>
      {guidedFlow.phase === 'input' ? (
        <>
          <Text dimColor>{guidedMeta.placeholder}</Text>
          <Text>
            <Text color="#22d3ee">Input:</Text>{' '}
            {guidedFlow.value ? guidedFlow.value : <Text dimColor>(type and press Enter)</Text>}
          </Text>
          {guidedCommandPreview ? <Text dimColor>{`Command: ${guidedCommandPreview}`}</Text> : null}
          {guidedFlow.error ? (
            <Text color={TUI_COLORS.danger}>⚠ {guidedFlow.error}</Text>
          ) : null}
          <Text dimColor>Esc cancel</Text>
        </>
      ) : (
        <>
          <Text color="#ef4444">Confirm destructive action?</Text>
          <Text dimColor>{guidedCommandPreview}</Text>
          <Box marginTop={1}>
            <Text color="#ef4444" bold>[y] Confirm</Text>
            <Text dimColor>  </Text>
            <Text dimColor bold>[n/Esc] Cancel</Text>
          </Box>
        </>
      )}
    </Box>
  );
}

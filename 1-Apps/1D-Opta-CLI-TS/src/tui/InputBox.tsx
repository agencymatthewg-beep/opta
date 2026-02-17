import React, { useState } from 'react';
import { Box, Text } from 'ink';
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
        <Text color="cyan">*</Text>
        <Text dimColor> thinking...</Text>
      </Box>
    );
  }

  return (
    <Box paddingX={1}>
      {modeIndicator && <>{modeIndicator}<Text dimColor> </Text></>}
      <Text color="cyan">&gt;</Text>
      <Text> </Text>
      <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
    </Box>
  );
}

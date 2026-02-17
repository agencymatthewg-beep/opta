import React, { useState, useCallback } from 'react';
import { Box, useApp, useStdout } from 'ink';
import { Header } from './Header.js';
import { MessageList } from './MessageList.js';
import { InputBox } from './InputBox.js';
import { InkStatusBar } from './StatusBar.js';

interface AppProps {
  model: string;
  sessionId: string;
  connectionStatus?: boolean;
  onMessage?: (text: string) => Promise<string>;
}

export function App({ model, sessionId, connectionStatus = true, onMessage }: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const height = stdout?.rows ?? 24;

  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'normal' | 'plan' | 'shell' | 'auto'>('normal');
  const [tokens, setTokens] = useState(0);
  const [tools, setTools] = useState(0);

  const handleSubmit = useCallback(async (text: string) => {
    // Handle slash commands
    if (text === '/exit' || text === '/quit') {
      exit();
      return;
    }

    // Handle shell mode
    if (text.startsWith('!')) {
      setMode('shell');
    }

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setIsLoading(true);

    if (onMessage) {
      const response = await onMessage(text);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    }

    setIsLoading(false);
    setMode('normal');
  }, [onMessage, exit]);

  // Calculate message area height (total - header - statusbar - input)
  const messageAreaHeight = Math.max(height - 6, 10);

  return (
    <Box flexDirection="column" height={height} width="100%">
      <Header
        model={model}
        sessionId={sessionId}
        connectionStatus={connectionStatus}
      />

      <Box flexDirection="column" height={messageAreaHeight} overflow="hidden">
        <MessageList messages={messages} />
      </Box>

      <InputBox onSubmit={handleSubmit} mode={mode} isLoading={isLoading} />

      <InkStatusBar
        model={model}
        tokens={tokens}
        cost="$0.00"
        tools={tools}
        speed={0}
        mode={mode}
      />
    </Box>
  );
}

import React, { useState, useCallback } from 'react';
import { Box, useApp } from 'ink';
import { Header } from './Header.js';
import { MessageList } from './MessageList.js';
import { InputBox } from './InputBox.js';
import { InkStatusBar } from './StatusBar.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import { StreamingIndicator } from './StreamingIndicator.js';
import { FocusProvider, useFocusPanel } from './FocusContext.js';

interface AppProps {
  model: string;
  sessionId: string;
  connectionStatus?: boolean;
  onMessage?: (text: string) => Promise<string>;
}

function AppInner({ model, sessionId, connectionStatus = true, onMessage }: AppProps) {
  const { exit } = useApp();
  const { height } = useTerminalSize();
  const { activePanel, nextPanel, previousPanel } = useFocusPanel();

  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'normal' | 'plan' | 'shell' | 'auto'>('normal');
  const [tokens, setTokens] = useState(0);
  const [tools, setTools] = useState(0);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  useKeyboard({
    onExit: () => exit(),
    onClear: () => setMessages([]),
    onNextPanel: nextPanel,
    onPreviousPanel: previousPanel,
    onToggleSidebar: () => setSidebarVisible(prev => !prev),
  });

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
        {isLoading && <StreamingIndicator />}
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

export function App(props: AppProps) {
  return (
    <FocusProvider>
      <AppInner {...props} />
    </FocusProvider>
  );
}

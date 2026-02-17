import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

const FRAMES = ['*', '~', '*', '~', '*', '~', '*', '~', '*', '~'];

export function StreamingIndicator({ label = 'thinking' }: { label?: string }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text color="cyan">
      {FRAMES[frame]} <Text dimColor>{label}...</Text>
    </Text>
  );
}

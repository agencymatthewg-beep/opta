import React from 'react';
import { Box } from 'ink';

interface SplitPaneProps {
  main: React.ReactNode;
  sidebar: React.ReactNode;
  sidebarWidth?: number;
  sidebarVisible?: boolean;
  sidebarPosition?: 'left' | 'right';
}

export function SplitPane({
  main,
  sidebar,
  sidebarWidth = 28,
  sidebarVisible = true,
  sidebarPosition = 'right',
}: SplitPaneProps) {
  if (!sidebarVisible) {
    return (
      <Box flexGrow={1} flexDirection="column" width="100%">
        {main}
      </Box>
    );
  }

  const mainPane = <Box flexGrow={1} flexDirection="column">{main}</Box>;
  const sidePane = (
    <Box
      width={sidebarWidth}
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
    >
      {sidebar}
    </Box>
  );

  return (
    <Box flexDirection="row" width="100%">
      {sidebarPosition === 'left' ? (
        <>{sidePane}{mainPane}</>
      ) : (
        <>{mainPane}{sidePane}</>
      )}
    </Box>
  );
}

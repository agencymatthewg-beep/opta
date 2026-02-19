/**
 * ModelPicker — Overlay for switching models in TUI mode.
 *
 * Fetches available models from LMX and renders a selectable list.
 * Pressing Escape or selecting a model dismisses the overlay.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { errorMessage } from '../utils/errors.js';

export interface ModelPickerProps {
  currentModel: string;
  connectionHost: string;
  connectionPort: number;
  onSelect: (model: string) => void;
  onClose: () => void;
}

interface ModelEntry {
  id: string;
  active: boolean;
}

export function ModelPicker({ currentModel, connectionHost, connectionPort, onSelect, onClose }: ModelPickerProps) {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch models on mount
  useEffect(() => {
    const url = `http://${connectionHost}:${connectionPort}/v1/models`;
    fetch(url, { signal: AbortSignal.timeout(5000) })
      .then(res => res.json() as Promise<{ data?: Array<{ id: string }> }>)
      .then((data) => {
        const entries = (data.data ?? []).map(m => ({
          id: m.id,
          active: m.id === currentModel,
        }));
        setModels(entries);
        // Set initial selection to current model
        const currentIdx = entries.findIndex(m => m.active);
        if (currentIdx >= 0) setSelectedIdx(currentIdx);
        setLoading(false);
      })
      .catch(err => {
        setError(errorMessage(err));
        setLoading(false);
      });
  }, [connectionHost, connectionPort, currentModel]);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.return && models.length > 0) {
      const selected = models[selectedIdx];
      if (selected && selected.id !== currentModel) {
        onSelect(selected.id);
      }
      onClose();
      return;
    }

    if (key.upArrow && selectedIdx > 0) {
      setSelectedIdx(prev => prev - 1);
    }
    if (key.downArrow && selectedIdx < models.length - 1) {
      setSelectedIdx(prev => prev + 1);
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={2}
      paddingY={1}
    >
      <Box marginBottom={1}>
        <Text bold color="magenta">Switch Model</Text>
        <Text dimColor>  (Enter to select, Esc to cancel)</Text>
      </Box>

      {loading && <Text dimColor>Loading models...</Text>}
      {error && <Text color="red">Failed to load models: {error}</Text>}

      {!loading && !error && models.length === 0 && (
        <Text dimColor>No models available</Text>
      )}

      {models.map((model, i) => (
        <Box key={model.id}>
          <Text color={i === selectedIdx ? 'magenta' : undefined}>
            {i === selectedIdx ? '\u25B6 ' : '  '}
            {model.id}
          </Text>
          {model.active && <Text color="green"> (current)</Text>}
        </Box>
      ))}
    </Box>
  );
}

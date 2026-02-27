/**
 * ModelPicker — Overlay for switching models in TUI mode.
 *
 * Uses LMX admin inventory when available so selection can distinguish
 * loaded vs on-disk models and switch robustly.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import { errorMessage } from '../utils/errors.js';

const MODEL_INVENTORY_TIMEOUT_MS = 60_000;
const MODEL_CATALOG_TIMEOUT_MS = 20_000;

export type ModelSelectionSource = 'loaded' | 'disk' | 'catalog';

export interface ModelSelection {
  id: string;
  source: ModelSelectionSource;
  loaded: boolean;
}

export interface ModelPickerProps {
  currentModel: string;
  connectionHost: string;
  connectionFallbackHosts?: string[];
  connectionPort: number;
  connectionAdminKey?: string;
  onSelect: (selection: ModelSelection) => void | Promise<void>;
  onClose: () => void;
}

interface ModelEntry {
  id: string;
  active: boolean;
  loaded: boolean;
  source: ModelSelectionSource;
}

function isTimeoutError(err: unknown): boolean {
  const message = errorMessage(err).toLowerCase();
  return message.includes('timed out') || message.includes('timeout') || message.includes('aborted');
}

function listCandidateHosts(primaryHost: string, fallbackHosts: readonly string[]): string[] {
  const seen = new Set<string>();
  const hosts: string[] = [];
  for (const host of [primaryHost, ...fallbackHosts]) {
    const value = host.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    hosts.push(value);
  }
  return hosts.length > 0 ? hosts : [primaryHost];
}

function formatModelPickerLoadError(err: unknown, host: string, port: number, fallbackHosts: readonly string[]): string {
  const candidates = listCandidateHosts(host, fallbackHosts);
  const hostLabel = candidates.length > 1
    ? `${host}:${port} (fallbacks: ${candidates.slice(1).join(', ')})`
    : `${host}:${port}`;
  if (isTimeoutError(err)) {
    return `connection to ${hostLabel} timed out while loading model inventory`;
  }
  return errorMessage(err);
}

export function ModelPicker({
  currentModel,
  connectionHost,
  connectionFallbackHosts,
  connectionPort,
  connectionAdminKey,
  onSelect,
  onClose,
}: ModelPickerProps) {
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { stdout } = useStdout();
  const fallbackHostsKey = (connectionFallbackHosts ?? [])
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0)
    .join('\u0001');
  const fallbackHosts = useMemo(
    () => (fallbackHostsKey.length > 0 ? fallbackHostsKey.split('\u0001') : []),
    [fallbackHostsKey],
  );

  const maxVisibleItems = Math.max(6, Math.min(14, (stdout?.rows ?? 24) - 10));

  // Fetch model inventory on mount.
  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      setLoading(true);
      setError(null);
      try {
        const [{ LmxClient }, { normalizeModelIdKey }] = await Promise.all([
          import('../lmx/client.js'),
          import('../lmx/model-lifecycle.js'),
        ]);

        const client = new LmxClient({
          host: connectionHost,
          fallbackHosts,
          port: connectionPort,
          adminKey: connectionAdminKey,
          timeoutMs: MODEL_INVENTORY_TIMEOUT_MS,
          maxRetries: 0,
        });

        const [loadedResult, availableResult] = await Promise.allSettled([
          client.models(),
          client.available(),
        ]);
        const loadedRes = loadedResult.status === 'fulfilled' ? loadedResult.value : { models: [] };
        const availableRes = availableResult.status === 'fulfilled' ? availableResult.value : [];

        const loadedEntries: ModelEntry[] = loadedRes.models
          .map((model) => ({
            id: model.model_id,
            active: normalizeModelIdKey(model.model_id) === normalizeModelIdKey(currentModel),
            loaded: true,
            source: 'loaded' as const,
          }))
          .sort((a, b) => a.id.localeCompare(b.id));

        const loadedKeys = new Set(loadedEntries.map((entry) => normalizeModelIdKey(entry.id)));
        const onDiskEntries: ModelEntry[] = availableRes
          .filter((model) => !loadedKeys.has(normalizeModelIdKey(model.repo_id)))
          .map((model) => ({
            id: model.repo_id,
            active: normalizeModelIdKey(model.repo_id) === normalizeModelIdKey(currentModel),
            loaded: false,
            source: 'disk' as const,
          }))
          .sort((a, b) => a.id.localeCompare(b.id));

        let entries = [...loadedEntries, ...onDiskEntries];

        if (loadedResult.status === 'rejected' && availableResult.status === 'rejected') {
          throw loadedResult.reason;
        }

        // Fallback to OpenAI-compatible /v1/models listing when admin inventory is unavailable.
        if (entries.length === 0) {
          const catalogHosts = listCandidateHosts(client.getActiveHost(), fallbackHosts);
          let lastCatalogError: unknown = null;
          for (const catalogHost of catalogHosts) {
            try {
              const res = await fetch(`http://${catalogHost}:${connectionPort}/v1/models`, {
                signal: AbortSignal.timeout(MODEL_CATALOG_TIMEOUT_MS),
              });
              const data = (await res.json()) as { data?: Array<{ id: string }> };
              entries = (data.data ?? [])
                .map((model) => ({
                  id: model.id,
                  active: normalizeModelIdKey(model.id) === normalizeModelIdKey(currentModel),
                  loaded: false,
                  source: 'catalog' as const,
                }))
                .sort((a, b) => a.id.localeCompare(b.id));
              if (entries.length > 0 || res.ok) {
                break;
              }
            } catch (err) {
              lastCatalogError = err;
            }
          }
          if (entries.length === 0 && lastCatalogError) {
            throw lastCatalogError;
          }
        }

        if (cancelled) return;
        setModels(entries);

        const currentIdx = entries.findIndex((entry) => entry.active);
        setSelectedIdx(currentIdx >= 0 ? currentIdx : 0);
      } catch (err) {
        if (cancelled) return;
        setError(formatModelPickerLoadError(err, connectionHost, connectionPort, fallbackHosts));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, [connectionAdminKey, connectionHost, fallbackHosts, connectionPort, currentModel]);

  useEffect(() => {
    setSelectedIdx((prev) => {
      if (models.length === 0) return 0;
      return Math.min(prev, models.length - 1);
    });
  }, [models.length]);

  const visibleRange = useMemo(() => {
    if (models.length <= maxVisibleItems) {
      return { start: 0, end: models.length };
    }

    const half = Math.floor(maxVisibleItems / 2);
    let start = Math.max(0, selectedIdx - half);
    let end = start + maxVisibleItems;

    if (end > models.length) {
      end = models.length;
      start = Math.max(0, end - maxVisibleItems);
    }

    return { start, end };
  }, [models.length, selectedIdx, maxVisibleItems]);

  useInput((input, key) => {
    if (switching) return;

    if (key.escape) {
      onClose();
      return;
    }
    if (key.leftArrow || key.backspace || key.delete) {
      onClose();
      return;
    }

    if (key.return && models.length > 0) {
      const selected = models[selectedIdx];
      if (!selected) {
        onClose();
        return;
      }
      if (selected.id === currentModel && selected.loaded) {
        onClose();
        return;
      }

      setSwitching(true);
      void Promise.resolve(
        onSelect({
          id: selected.id,
          source: selected.source,
          loaded: selected.loaded,
        }),
      ).finally(() => {
        onClose();
        setSwitching(false);
      });
      return;
    }

    if (key.upArrow && selectedIdx > 0) {
      setSelectedIdx((prev) => prev - 1);
    }
    if (key.downArrow && selectedIdx < models.length - 1) {
      setSelectedIdx((prev) => prev + 1);
    }
    if (input.toLowerCase() === 'j' && selectedIdx < models.length - 1) {
      setSelectedIdx((prev) => prev + 1);
    }
    if (input.toLowerCase() === 'k' && selectedIdx > 0) {
      setSelectedIdx((prev) => prev - 1);
    }
  });

  const visibleModels = models.slice(visibleRange.start, visibleRange.end);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={2}
      paddingY={1}
      width="100%"
    >
      <Box marginBottom={1}>
        <Text bold color="magenta">Model Picker</Text>
        <Text dimColor>  (Enter to switch, Esc/←/Backspace to close)</Text>
      </Box>
      <Box marginBottom={1}>
        <Text dimColor>Loaded first, then on-disk. Selecting an on-disk model will auto-load it.</Text>
      </Box>

      {loading && <Text dimColor>Loading model inventory...</Text>}
      {switching && <Text color="cyan">Switching model…</Text>}
      {error && <Text color="red">Failed to load models: {error}</Text>}

      {!loading && !error && models.length === 0 && (
        <Text dimColor>No models available</Text>
      )}

      {!loading && !error && visibleRange.start > 0 && (
        <Box marginBottom={1}>
          <Text dimColor>  … {visibleRange.start} above …</Text>
        </Box>
      )}

      {visibleModels.map((model, i) => {
        const idx = visibleRange.start + i;
        const focused = idx === selectedIdx;
        const marker = focused ? '▶ ' : '  ';
        const stateDot = model.loaded ? '●' : '○';
        const stateColor: 'green' | 'cyan' | 'gray' = model.loaded
          ? 'green'
          : model.source === 'disk'
            ? 'cyan'
            : 'gray';
        const stateText = model.loaded
          ? 'loaded'
          : model.source === 'disk'
            ? 'on disk'
            : 'listed';

        return (
          <Box key={`${model.source}:${model.id}`}>
            <Text color={focused ? 'magenta' : undefined}>{marker}</Text>
            <Text color={stateColor}>{stateDot}</Text>
            <Text> </Text>
            <Text color={focused ? 'cyan' : undefined}>{model.id}</Text>
            <Text dimColor>  {stateText}</Text>
            {model.active && <Text color="green">  (current)</Text>}
          </Box>
        );
      })}

      {!loading && !error && visibleRange.end < models.length && (
        <Box marginTop={1}>
          <Text dimColor>  … {models.length - visibleRange.end} below …</Text>
        </Box>
      )}
    </Box>
  );
}

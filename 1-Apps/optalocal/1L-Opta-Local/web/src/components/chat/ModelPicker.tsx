'use client';

import * as Select from '@radix-ui/react-select';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ChevronDown, Cpu, Loader2, AlertCircle } from 'lucide-react';
import { Badge, cn } from '@opta/ui';
import type { LoadedModel } from '@/types/lmx';

interface ModelPickerProps {
  models: LoadedModel[];
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

/**
 * Model selection dropdown using Radix Select.
 *
 * Shows loaded models with metadata: quantization badge, context length,
 * and VRAM usage. Tooltip on each option shows the full model path/ID.
 * Empty state links to dashboard. Loading state shows skeleton.
 */
export function ModelPicker({
  models,
  selectedModel,
  onModelChange,
  isLoading,
  disabled,
}: ModelPickerProps) {
  // Loading state: skeleton placeholder
  if (isLoading) {
    return (
      <div className="glass-subtle rounded-lg px-3 py-2 flex items-center gap-2 text-sm animate-pulse">
        <Loader2 className="w-4 h-4 text-primary animate-spin" />
        <span className="text-text-muted">Loading models...</span>
      </div>
    );
  }

  // Empty state: no models loaded
  if (models.length === 0) {
    return (
      <div className="glass-subtle rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
        <AlertCircle className="w-4 h-4 text-neon-amber" />
        <span className="text-text-secondary">No models loaded</span>
      </div>
    );
  }

  // Find the selected model's display name
  const selectedModelData = models.find((m) => m.id === selectedModel);
  const displayName = selectedModelData?.name ?? 'Select model...';

  return (
    <Tooltip.Provider delayDuration={300}>
      <Select.Root
        value={selectedModel}
        onValueChange={onModelChange}
        disabled={disabled}
      >
        <Select.Trigger
          className={cn(
            'glass-subtle rounded-lg px-3 py-2 flex items-center gap-2 text-sm',
            'outline-none transition-colors max-w-[280px]',
            'hover:border-primary/40',
            'data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
            'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-opta-bg',
          )}
          aria-label="Select model"
        >
          <Cpu className="w-4 h-4 text-primary flex-shrink-0" />
          <Select.Value placeholder="Select model...">
            <span className="truncate">{displayName}</span>
          </Select.Value>
          <Select.Icon className="ml-auto">
            <ChevronDown className="w-4 h-4 text-text-secondary" />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            className={cn(
              'glass rounded-xl p-1 shadow-2xl border border-transparent',
              'z-50 min-w-[260px] max-w-[360px]',
              'animate-in fade-in-0 zoom-in-95',
            )}
            position="popper"
            sideOffset={4}
            align="start"
          >
            <Select.Viewport className="p-1">
              {models.map((model) => (
                <Tooltip.Root key={model.id}>
                  <Tooltip.Trigger asChild>
                    <Select.Item
                      value={model.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer outline-none',
                        'text-text-primary text-sm',
                        'data-[highlighted]:bg-primary/10 data-[highlighted]:text-text-primary',
                        'data-[state=checked]:bg-primary/15',
                        'transition-colors',
                      )}
                    >
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <Select.ItemText>
                          <span className="truncate font-medium">
                            {model.name}
                          </span>
                        </Select.ItemText>
                        <div className="flex items-center gap-2">
                          {model.quantization && (
                            <Badge variant="purple" size="sm">
                              {model.quantization}
                            </Badge>
                          )}
                          {model.context_length != null && (
                            <span className="text-xs text-text-muted">
                              {formatContextLength(model.context_length)}
                            </span>
                          )}
                          {model.vram_gb != null && (
                            <span className="text-xs text-text-muted">
                              {model.vram_gb.toFixed(1)}GB
                            </span>
                          )}
                        </div>
                      </div>
                    </Select.Item>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className={cn(
                        'glass rounded-lg px-3 py-2 text-xs text-text-secondary',
                        'shadow-lg max-w-[300px] z-[60]',
                        'animate-in fade-in-0 zoom-in-95',
                      )}
                      side="right"
                      sideOffset={8}
                    >
                      <p className="font-mono break-all">{model.id}</p>
                      <p className="text-text-muted mt-1">
                        Loaded {formatRelativeTime(model.loaded_at)}
                      </p>
                      <Tooltip.Arrow className="fill-opta-border" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </Tooltip.Provider>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format context length as human-readable: 32768 -> "32K" */
function formatContextLength(contextLength: number): string {
  if (contextLength >= 1_000_000) {
    return `${(contextLength / 1_000_000).toFixed(1)}M`;
  }
  if (contextLength >= 1_000) {
    return `${(contextLength / 1_000).toFixed(0)}K`;
  }
  return String(contextLength);
}

/** Format ISO date as relative time: "5 minutes ago", "2 hours ago" */
function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

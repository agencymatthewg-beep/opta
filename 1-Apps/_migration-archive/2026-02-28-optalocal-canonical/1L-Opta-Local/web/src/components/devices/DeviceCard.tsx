'use client';

import { useMemo, useState } from 'react';
import { Button, cn } from '@opta/ui';
import { Server, Monitor, ToggleLeft, ToggleRight } from 'lucide-react';

import type { Device } from '@/types/cloud';

interface DeviceCardProps {
  device: Device;
  onToggleHelper?: (deviceId: string, enabled: boolean) => Promise<void>;
}

function formatLastSeen(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;

  const minutes = Math.floor((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DeviceCard({ device, onToggleHelper }: DeviceCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [helperEnabled, setHelperEnabled] = useState(Boolean(device.helper_enabled));

  const Icon = device.role === 'llm_host' ? Server : Monitor;

  const statusTone = device.is_online
    ? 'border-neon-green/25 bg-neon-green/10 text-neon-green'
    : 'border-opta-border bg-opta-surface/40 text-text-muted';

  const roleLabel = device.role === 'llm_host' ? 'LLM Host' : 'Workstation';

  const endpoint = useMemo(() => {
    if (!device.lan_ip || !device.lan_port) return 'N/A';
    return `${device.lan_ip}:${device.lan_port}`;
  }, [device.lan_ip, device.lan_port]);

  const toggleHelper = async () => {
    if (!onToggleHelper || isUpdating) return;
    const next = !helperEnabled;

    setIsUpdating(true);
    try {
      await onToggleHelper(device.id, next);
      setHelperEnabled(next);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <article className="glass-subtle rounded-xl border border-opta-border p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-text-primary">{device.name}</h3>
          <p className="text-xs text-text-muted">{roleLabel}</p>
        </div>

        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
            statusTone,
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          {device.is_online ? 'Online' : 'Offline'}
        </span>
      </header>

      <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
        <span className="text-text-muted">Host</span>
        <span className="truncate text-text-secondary">{device.hostname ?? 'Unknown'}</span>
        <span className="text-text-muted">Endpoint</span>
        <span className="truncate text-text-secondary">{endpoint}</span>
        <span className="text-text-muted">Last seen</span>
        <span className="text-text-secondary">{formatLastSeen(device.last_seen_at)}</span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1 text-[11px] text-text-muted">
          <Icon className="h-3.5 w-3.5" />
          Device ID: {device.id.slice(0, 8)}
        </span>

        {onToggleHelper ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void toggleHelper();
            }}
            disabled={isUpdating}
          >
            {helperEnabled ? (
              <>
                <ToggleRight className="mr-1.5 h-4 w-4" />
                Helper On
              </>
            ) : (
              <>
                <ToggleLeft className="mr-1.5 h-4 w-4" />
                Helper Off
              </>
            )}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

/**
 * DeviceCard — Displays a single device in the device dashboard.
 *
 * Shows device name, role, online status, capabilities,
 * and action buttons (Chat, Dashboard, Toggle Helper).
 */

'use client';

import { motion } from 'framer-motion';
import {
  Server,
  Monitor,
  Cpu,
  Wifi,
  WifiOff,
  ExternalLink,
  MessageSquare,
  LayoutDashboard,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { cn } from '@opta/ui';
import type { Device } from '@/types/cloud';
import { formatDistanceToNow } from 'date-fns';

interface DeviceCardProps {
  device: Device;
  onToggleHelper?: (deviceId: string, enabled: boolean) => void;
}

export function DeviceCard({ device, onToggleHelper }: DeviceCardProps) {
  const isHost = device.role === 'llm_host';
  const roleLabel = isHost
    ? 'LLM Host'
    : device.helper_enabled
      ? 'Workstation + Helper'
      : 'Workstation';

  const RoleIcon = isHost ? Server : Monitor;
  const lastSeenText = device.is_online
    ? 'Online now'
    : `Last seen ${formatDistanceToNow(new Date(device.last_seen_at), { addSuffix: true })}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="glass-subtle rounded-xl p-5 border border-opta-border"
    >
      {/* Header: status dot + name + role */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <RoleIcon className="h-5 w-5 text-text-secondary" />
            <span
              className={cn(
                'absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-opta-bg',
                device.is_online ? 'bg-neon-green' : 'bg-text-muted',
              )}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {device.name}
            </h3>
            <p className="text-xs text-text-muted">{roleLabel}</p>
          </div>
        </div>
        <span
          className={cn(
            'text-[10px] font-medium px-2 py-0.5 rounded-full',
            device.is_online
              ? 'bg-neon-green/10 text-neon-green'
              : 'bg-opta-surface text-text-muted',
          )}
        >
          {device.is_online ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Details */}
      <div className="space-y-1.5 mb-4">
        {device.lan_ip && (
          <DetailRow
            icon={Wifi}
            label={`${device.lan_ip}:${device.lan_port}`}
          />
        )}
        {device.tunnel_url && (
          <DetailRow icon={ExternalLink} label={device.tunnel_url} />
        )}
        {device.capabilities?.models_loaded &&
          device.capabilities.models_loaded.length > 0 && (
            <DetailRow
              icon={Cpu}
              label={`Models: ${device.capabilities.models_loaded.join(', ')}`}
            />
          )}
        {device.capabilities?.vram_gb != null &&
          device.capabilities?.vram_total_gb != null && (
            <DetailRow
              icon={Cpu}
              label={`VRAM: ${device.capabilities.vram_gb}/${device.capabilities.vram_total_gb} GB`}
            />
          )}
        {device.helper_enabled && device.helper_config && (
          <DetailRow
            icon={Cpu}
            label={`Helper: ${device.helper_config.models.join(', ')}`}
          />
        )}
        <p className="text-[10px] text-text-muted flex items-center gap-1">
          {device.is_online ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          {lastSeenText}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {isHost && device.is_online && (
          <>
            <ActionButton icon={MessageSquare} label="Chat" href="/chat" />
            <ActionButton icon={LayoutDashboard} label="Dashboard" href="/" />
          </>
        )}
        {!isHost && onToggleHelper && (
          <button
            onClick={() => onToggleHelper(device.id, !device.helper_enabled)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              device.helper_enabled
                ? 'bg-primary/15 text-primary'
                : 'bg-opta-surface/50 text-text-secondary hover:text-text-primary',
            )}
          >
            {device.helper_enabled ? (
              <ToggleRight className="h-3.5 w-3.5" />
            ) : (
              <ToggleLeft className="h-3.5 w-3.5" />
            )}
            Helper {device.helper_enabled ? 'On' : 'Off'}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DetailRow({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <p className="text-xs text-text-secondary flex items-center gap-1.5 truncate">
      <Icon className="h-3 w-3 shrink-0 text-text-muted" />
      <span className="truncate">{label}</span>
    </p>
  );
}

function ActionButton({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-opta-surface/50 text-text-secondary hover:text-text-primary hover:bg-opta-surface transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

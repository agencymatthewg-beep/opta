/**
 * Sync Status Indicator Component
 *
 * Displays current sync status across all channels:
 * - Cloud sync status
 * - LAN peer count
 * - Offline queue status
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  Cloud,
  CloudOff,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Users,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { SyncStatus, LANSyncStatus } from '../../lib/sync';

export interface SyncStatusIndicatorProps {
  cloudStatus: SyncStatus;
  lanStatus: LANSyncStatus;
  isOnline: boolean;
  connectedPeers: number;
  pendingOperations: number;
  failedOperations: number;
  lastSync: number | null;
  onCloudSync?: () => void;
  onRetryFailed?: () => void;
  compact?: boolean;
  className?: string;
}

export function SyncStatusIndicator({
  cloudStatus,
  lanStatus,
  isOnline,
  connectedPeers,
  pendingOperations,
  failedOperations,
  lastSync,
  onCloudSync,
  onRetryFailed,
  compact = false,
  className,
}: SyncStatusIndicatorProps) {
  const getCloudIcon = () => {
    if (!isOnline) return CloudOff;
    if (cloudStatus === 'syncing') return Loader2;
    if (cloudStatus === 'error') return AlertCircle;
    return Cloud;
  };

  const getCloudColor = () => {
    if (!isOnline) return 'text-muted';
    if (cloudStatus === 'syncing') return 'text-primary';
    if (cloudStatus === 'error') return 'text-danger';
    return 'text-success';
  };

  const getLanIcon = () => {
    if (lanStatus === 'idle') return WifiOff;
    if (lanStatus === 'discovering' || lanStatus === 'connecting') return Wifi;
    if (lanStatus === 'syncing') return RefreshCw;
    if (lanStatus === 'error') return AlertCircle;
    return Wifi;
  };

  const getLanColor = () => {
    if (lanStatus === 'idle') return 'text-muted';
    if (lanStatus === 'error') return 'text-danger';
    if (connectedPeers > 0) return 'text-success';
    return 'text-primary';
  };

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const CloudIcon = getCloudIcon();
  const LanIcon = getLanIcon();

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <motion.div
          className={cn('p-1.5 rounded-lg glass-subtle', getCloudColor())}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onCloudSync}
          style={{ cursor: onCloudSync ? 'pointer' : 'default' }}
        >
          <CloudIcon
            className={cn('w-4 h-4', cloudStatus === 'syncing' && 'animate-spin')}
            strokeWidth={1.75}
          />
        </motion.div>

        {connectedPeers > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg glass-subtle text-success"
          >
            <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span className="text-xs font-medium">{connectedPeers}</span>
          </motion.div>
        )}

        {pendingOperations > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg glass-subtle text-warning"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
            <span className="text-xs font-medium">{pendingOperations}</span>
          </motion.div>
        )}

        {failedOperations > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRetryFailed}
            className="flex items-center gap-1 px-2 py-1 rounded-lg glass-subtle text-danger"
          >
            <AlertCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span className="text-xs font-medium">{failedOperations}</span>
          </motion.button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('glass rounded-xl p-4 border border-border/30', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Sync Status</h3>
        <div className="flex items-center gap-1">
          {isOnline ? (
            <CheckCircle className="w-4 h-4 text-success" strokeWidth={1.75} />
          ) : (
            <WifiOff className="w-4 h-4 text-muted" strokeWidth={1.75} />
          )}
          <span className="text-xs text-muted">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Cloud Sync */}
        <motion.div
          className="flex items-center justify-between p-3 rounded-lg glass-subtle"
          whileHover={{ scale: 1.01 }}
        >
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg bg-card/50', getCloudColor())}>
              <CloudIcon
                className={cn('w-5 h-5', cloudStatus === 'syncing' && 'animate-spin')}
                strokeWidth={1.75}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Cloud Sync</p>
              <p className="text-xs text-muted">
                {cloudStatus === 'syncing'
                  ? 'Syncing...'
                  : cloudStatus === 'error'
                    ? 'Sync failed'
                    : `Last: ${formatLastSync(lastSync)}`}
              </p>
            </div>
          </div>
          {onCloudSync && cloudStatus !== 'syncing' && (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onCloudSync}
              className="p-2 rounded-lg hover:bg-card/50 text-muted hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-4 h-4" strokeWidth={1.75} />
            </motion.button>
          )}
        </motion.div>

        {/* LAN Sync */}
        <motion.div
          className="flex items-center justify-between p-3 rounded-lg glass-subtle"
          whileHover={{ scale: 1.01 }}
        >
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg bg-card/50', getLanColor())}>
              <LanIcon
                className={cn(
                  'w-5 h-5',
                  (lanStatus === 'discovering' || lanStatus === 'syncing') && 'animate-pulse'
                )}
                strokeWidth={1.75}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">LAN Sync</p>
              <p className="text-xs text-muted">
                {lanStatus === 'idle'
                  ? 'Disabled'
                  : lanStatus === 'discovering'
                    ? 'Discovering...'
                    : connectedPeers > 0
                      ? `${connectedPeers} peer${connectedPeers > 1 ? 's' : ''} connected`
                      : 'No peers found'}
              </p>
            </div>
          </div>
          {connectedPeers > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-success/20">
              <Users className="w-3.5 h-3.5 text-success" strokeWidth={1.75} />
              <span className="text-xs font-medium text-success">{connectedPeers}</span>
            </div>
          )}
        </motion.div>

        {/* Offline Queue */}
        <AnimatePresence>
          {(pendingOperations > 0 || failedOperations > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-between p-3 rounded-lg glass-subtle"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'p-2 rounded-lg bg-card/50',
                    failedOperations > 0 ? 'text-danger' : 'text-warning'
                  )}
                >
                  {failedOperations > 0 ? (
                    <AlertCircle className="w-5 h-5" strokeWidth={1.75} />
                  ) : (
                    <RefreshCw className="w-5 h-5 animate-spin" strokeWidth={1.75} />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Offline Queue</p>
                  <p className="text-xs text-muted">
                    {failedOperations > 0
                      ? `${failedOperations} failed`
                      : `${pendingOperations} pending`}
                  </p>
                </div>
              </div>
              {failedOperations > 0 && onRetryFailed && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onRetryFailed}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-danger/20 text-danger hover:bg-danger/30 transition-colors"
                >
                  Retry
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

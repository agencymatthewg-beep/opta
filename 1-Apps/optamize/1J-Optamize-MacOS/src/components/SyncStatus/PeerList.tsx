/**
 * Peer List Component
 *
 * Displays discovered LAN peers with connection status
 * and sync controls.
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor,
  Laptop,
  Smartphone,
  Server,
  Wifi,
  WifiOff,
  RefreshCw,
  Check,
  Clock,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { PeerDevice } from '../../lib/sync';

export interface PeerListProps {
  peers: PeerDevice[];
  onConnect: (peerId: string) => void;
  onSync: (peerId: string) => void;
  isSyncing?: boolean;
  className?: string;
}

export function PeerList({
  peers,
  onConnect,
  onSync,
  isSyncing = false,
  className,
}: PeerListProps) {
  const getDeviceIcon = (name: string) => {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('phone') || lowerName.includes('mobile')) return Smartphone;
    if (lowerName.includes('laptop') || lowerName.includes('macbook')) return Laptop;
    if (lowerName.includes('server')) return Server;
    return Monitor;
  };

  const formatLastSeen = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  if (peers.length === 0) {
    return (
      <div className={cn('glass rounded-xl p-6 border border-border/30 text-center', className)}>
        <WifiOff className="w-8 h-8 mx-auto mb-3 text-muted" strokeWidth={1.5} />
        <p className="text-sm text-muted">No devices found on network</p>
        <p className="text-xs text-muted/70 mt-1">
          Make sure other devices have LAN sync enabled
        </p>
      </div>
    );
  }

  return (
    <div className={cn('glass rounded-xl p-4 border border-border/30', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Nearby Devices</h3>
        <span className="text-xs text-muted">{peers.length} found</span>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {peers.map((peer, index) => {
            const DeviceIcon = getDeviceIcon(peer.name);

            return (
              <motion.div
                key={peer.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-3 rounded-lg glass-subtle"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'p-2 rounded-lg',
                      peer.isConnected ? 'bg-success/20 text-success' : 'bg-card/50 text-muted'
                    )}
                  >
                    <DeviceIcon className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{peer.name}</p>
                      {peer.isConnected && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-success/20 text-success">
                          <Check className="w-3 h-3" strokeWidth={2} />
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" strokeWidth={1.75} />
                      {formatLastSeen(peer.lastSeen)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {peer.isConnected ? (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onSync(peer.id)}
                      disabled={isSyncing}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        isSyncing
                          ? 'bg-primary/20 text-primary cursor-not-allowed'
                          : 'bg-primary/20 text-primary hover:bg-primary/30'
                      )}
                    >
                      <RefreshCw
                        className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')}
                        strokeWidth={1.75}
                      />
                      {isSyncing ? 'Syncing...' : 'Sync'}
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onConnect(peer.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-card/50 text-foreground hover:bg-card/70 transition-colors"
                    >
                      <Wifi className="w-3.5 h-3.5" strokeWidth={1.75} />
                      Connect
                    </motion.button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

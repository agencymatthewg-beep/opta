/**
 * PlatformIndicator - Subtle badge showing current platform with capabilities.
 *
 * Displays in sidebar footer and settings, providing platform context
 * with hover tooltip showing enabled native features.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { usePlatform, type NativeFeature } from '../hooks/usePlatform';
import { cn } from '@/lib/utils';
import {
  Apple,
  Monitor,
  Terminal,
  Smartphone,
  HelpCircle,
  CheckCircle,
  XCircle,
  Cpu,
  Bell,
  Layout,
  Zap,
  Battery,
} from 'lucide-react';

/**
 * Props for PlatformIndicator.
 */
interface PlatformIndicatorProps {
  /** Show expanded view with details */
  expanded?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Get Lucide icon component for platform.
 */
function getPlatformIcon(iconName: string) {
  switch (iconName) {
    case 'apple':
      return Apple;
    case 'monitor':
      return Monitor;
    case 'terminal':
      return Terminal;
    case 'smartphone':
      return Smartphone;
    default:
      return HelpCircle;
  }
}

/**
 * Get icon for native feature.
 */
function getFeatureIcon(feature: NativeFeature) {
  switch (feature) {
    case 'menu_bar':
    case 'system_tray':
    case 'jump_list':
      return Layout;
    case 'native_notifications':
    case 'toast_notifications':
    case 'dbus_notifications':
      return Bell;
    case 'metal':
      return Zap;
    case 'power_management':
    case 'app_nap':
      return Battery;
    default:
      return Cpu;
  }
}

/**
 * Human-readable feature names.
 */
const FEATURE_NAMES: Record<NativeFeature, string> = {
  menu_bar: 'Menu Bar',
  dock_badge: 'Dock Badge',
  app_nap: 'App Nap',
  metal: 'Metal GPU',
  spotlight: 'Spotlight',
  jump_list: 'Jump Lists',
  taskbar_progress: 'Taskbar Progress',
  toast_notifications: 'Toast Notifications',
  startup_registration: 'Startup Registration',
  desktop_entry: 'Desktop Entry',
  dbus_notifications: 'D-Bus Notifications',
  freedesktop_tray: 'System Tray',
  systemd_integration: 'Systemd',
  system_tray: 'System Tray',
  native_notifications: 'Native Notifications',
  background_execution: 'Background Execution',
  power_management: 'Power Management',
};

/**
 * Tooltip showing platform capabilities.
 */
function CapabilitiesTooltip({
  features,
  capabilities,
}: {
  features: NativeFeature[];
  capabilities: {
    gpu_acceleration: boolean;
    native_notifications: boolean;
    system_tray: boolean;
    background_execution: boolean;
    power_management: boolean;
  } | null;
}) {
  if (!capabilities) return null;

  // Key capabilities to show
  const capabilityList = [
    { name: 'GPU Acceleration', enabled: capabilities.gpu_acceleration },
    { name: 'Notifications', enabled: capabilities.native_notifications },
    { name: 'System Tray', enabled: capabilities.system_tray },
    { name: 'Background', enabled: capabilities.background_execution },
    { name: 'Power Management', enabled: capabilities.power_management },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'absolute bottom-full left-0 mb-2 z-50',
        'w-56 p-3 rounded-xl',
        'glass-strong border border-border/30',
        'shadow-lg shadow-black/20'
      )}
    >
      <h4 className="text-xs font-semibold text-foreground mb-2">
        Platform Capabilities
      </h4>

      <div className="space-y-1.5">
        {capabilityList.map((cap) => (
          <div
            key={cap.name}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-muted-foreground">{cap.name}</span>
            {cap.enabled ? (
              <CheckCircle className="w-3.5 h-3.5 text-success" strokeWidth={2} />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-muted-foreground/50" strokeWidth={2} />
            )}
          </div>
        ))}
      </div>

      {features.length > 0 && (
        <>
          <div className="h-px bg-border/20 my-2" />
          <h4 className="text-xs font-semibold text-foreground mb-2">
            Native Features
          </h4>
          <div className="flex flex-wrap gap-1">
            {features.slice(0, 6).map((feature) => (
              <span
                key={feature}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
                  'text-[10px] font-medium',
                  'bg-primary/10 text-primary border border-primary/20'
                )}
              >
                {FEATURE_NAMES[feature] || feature}
              </span>
            ))}
            {features.length > 6 && (
              <span className="text-[10px] text-muted-foreground">
                +{features.length - 6} more
              </span>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}

/**
 * PlatformIndicator component.
 */
function PlatformIndicator({ expanded = false, className }: PlatformIndicatorProps) {
  const {
    platform,
    displayName,
    icon,
    nativeFeatures,
    capabilities,
    loading,
    isDesktop,
  } = usePlatform();

  const [showTooltip, setShowTooltip] = useState(false);

  const Icon = getPlatformIcon(icon);

  // Loading state
  if (loading) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg',
          'glass-subtle border border-border/20',
          className
        )}
      >
        <div className="w-4 h-4 rounded bg-muted/30 animate-shimmer" />
        <div className="w-12 h-3 rounded bg-muted/30 animate-shimmer" />
      </div>
    );
  }

  // Compact view (default)
  if (!expanded) {
    return (
      <div className={cn('relative', className)}>
        <motion.button
          className={cn(
            'flex items-center gap-2 px-2.5 py-1.5 rounded-lg',
            'glass-subtle border border-border/20',
            'hover:border-primary/30 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
          )}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
          <span className="text-xs font-medium text-foreground">
            {displayName}
          </span>
          {isDesktop && (
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          )}
        </motion.button>

        <AnimatePresence>
          {showTooltip && (
            <CapabilitiesTooltip
              features={nativeFeatures}
              capabilities={capabilities}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Expanded view (for Settings page)
  return (
    <motion.div
      className={cn(
        'glass-subtle rounded-xl border border-border/20 overflow-hidden',
        className
      )}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="px-4 py-3 border-b border-border/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {displayName}
            </h3>
            <p className="text-xs text-muted-foreground">
              {platform?.os.type === 'macos' && 'version' in platform.os
                ? `Version ${platform.os.version}`
                : platform?.os.type === 'windows' && 'build' in platform.os
                ? `Build ${platform.os.build}`
                : platform?.os.type === 'linux' && 'distro' in platform.os
                ? platform.os.distro
                : 'Unknown version'}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Capabilities Grid */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            Capabilities
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {capabilities &&
              Object.entries({
                'GPU Acceleration': capabilities.gpu_acceleration,
                'Notifications': capabilities.native_notifications,
                'System Tray': capabilities.system_tray,
                'Background': capabilities.background_execution,
                'Power Mgmt': capabilities.power_management,
                'High DPI': capabilities.high_dpi,
              }).map(([name, enabled]) => (
                <div
                  key={name}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg',
                    'glass-subtle border',
                    enabled
                      ? 'border-success/20 bg-success/5'
                      : 'border-border/20'
                  )}
                >
                  {enabled ? (
                    <CheckCircle className="w-3.5 h-3.5 text-success" strokeWidth={2} />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-muted-foreground/40" strokeWidth={2} />
                  )}
                  <span className="text-xs text-foreground">{name}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Native Features */}
        {nativeFeatures.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
              Native Features
            </h4>
            <div className="flex flex-wrap gap-2">
              {nativeFeatures.map((feature, index) => {
                const FeatureIcon = getFeatureIcon(feature);
                return (
                  <motion.span
                    key={feature}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
                      'text-xs font-medium',
                      'bg-primary/10 text-primary border border-primary/20'
                    )}
                  >
                    <FeatureIcon className="w-3 h-3" strokeWidth={2} />
                    {FEATURE_NAMES[feature] || feature}
                  </motion.span>
                );
              })}
            </div>
          </div>
        )}

        {/* Launch Optimizations */}
        {platform?.launch_optimizations &&
          platform.launch_optimizations.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                Launch Optimizations
              </h4>
              <div className="space-y-2">
                {platform.launch_optimizations.map((opt, index) => (
                  <motion.div
                    key={opt.name}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-start gap-2"
                  >
                    <CheckCircle
                      className={cn(
                        'w-4 h-4 mt-0.5 flex-shrink-0',
                        opt.applied ? 'text-success' : 'text-muted-foreground/40'
                      )}
                      strokeWidth={2}
                    />
                    <div>
                      <p className="text-xs font-medium text-foreground">
                        {opt.name}
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        {opt.description}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
      </div>
    </motion.div>
  );
}

export default PlatformIndicator;

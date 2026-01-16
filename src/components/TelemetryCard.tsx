import { ReactNode, memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Cpu, MemoryStick, MonitorSpeaker, HardDrive, LucideIcon } from 'lucide-react';
import { LearnModeExplanation } from './LearnModeExplanation';

/**
 * TelemetryCard - The Obsidian Metric Display
 *
 * Displays hardware telemetry with obsidian glass styling.
 * Features 0%→50% energy transitions on hover/active states.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

// Icon components for telemetry cards
const icons: Record<string, LucideIcon> = {
  cpu: Cpu,
  memory: MemoryStick,
  gpu: MonitorSpeaker,
  disk: HardDrive,
};

type IconType = keyof typeof icons;

// Educational explanations for each telemetry type
const telemetryExplanations: Record<string, { short: string; technical: string }> = {
  cpu: {
    short: 'Shows how much of your processor is being used. Lower is better for gaming headroom.',
    technical: 'Measures CPU utilization across all cores. High sustained usage (>80%) may cause frame drops and stuttering.',
  },
  gpu: {
    short: 'Shows graphics card usage. In games, you typically want this near 95-99% (GPU-bound).',
    technical: 'GPU utilization from NVIDIA/AMD drivers. Low GPU + high CPU indicates a CPU bottleneck limiting your framerate.',
  },
  memory: {
    short: 'RAM usage. Keep some headroom (70-80%) for smooth gaming.',
    technical: 'Physical memory usage. When full, Windows uses slow disk swap (paging), causing major stutters.',
  },
  disk: {
    short: 'Storage usage. Keep 10-15% free for optimal performance and game updates.',
    technical: 'Available disk space. Full drives slow down significantly and may prevent game updates or crash during play.',
  },
};

interface TelemetryCardProps {
  title: string;
  icon: IconType;
  children: ReactNode;
  className?: string;
  delay?: number;
  /** Energy state for the card */
  energyState?: 'dormant' | 'active';
}

/**
 * TelemetryCard - Displays a telemetry metric with obsidian glass styling.
 * Memoized to prevent re-renders when props haven't changed.
 */
const TelemetryCard = memo(function TelemetryCard({
  title,
  icon,
  children,
  className,
  delay = 0,
  energyState = 'dormant',
}: TelemetryCardProps) {
  const Icon = icons[icon];
  const explanation = telemetryExplanations[icon];

  return (
    <motion.div
      // Ignition animation - emerges from darkness
      initial={{
        opacity: 0,
        y: 12,
        filter: 'brightness(0.5) blur(2px)',
      }}
      animate={{
        opacity: 1,
        y: 0,
        filter: 'brightness(1) blur(0px)',
      }}
      transition={{
        duration: 0.5,
        delay,
        ease: smoothOut,
      }}
      // Hover: 0% → 50% energy transition
      whileHover={{
        y: -3,
        transition: { duration: 0.3, ease: smoothOut },
      }}
      className={cn(
        'relative overflow-hidden rounded-xl group',
        // Obsidian glass material
        'bg-[#05030a]/80 backdrop-blur-xl',
        'border border-white/[0.06]',
        // Inner specular highlight
        'before:absolute before:inset-x-0 before:top-0 before:h-px',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        'before:rounded-t-xl',
        // Energy state styling
        energyState === 'active' && [
          'border-primary/30',
          'shadow-[inset_0_0_20px_rgba(168,85,247,0.1),0_0_20px_-5px_rgba(168,85,247,0.3)]',
        ],
        className
      )}
    >
      {/* Hover glow overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-xl opacity-0 group-hover:opacity-100"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Border glow on hover */}
      <motion.div
        className="absolute inset-0 pointer-events-none rounded-xl opacity-0 group-hover:opacity-100"
        style={{
          boxShadow: 'inset 0 0 0 1px rgba(168, 85, 247, 0.2), 0 0 20px -5px rgba(168, 85, 247, 0.25)',
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Header */}
      <div className="relative px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          {/* Icon container with energy glow */}
          <motion.div
            className={cn(
              'p-1.5 rounded-lg transition-all duration-300',
              'bg-primary/10 group-hover:bg-primary/20',
              energyState === 'active' && 'bg-primary/25'
            )}
            whileHover={{
              boxShadow: '0 0 15px -3px rgba(168, 85, 247, 0.5)',
            }}
          >
            <Icon
              className={cn(
                'w-4 h-4 transition-all duration-300',
                'text-primary',
                'group-hover:drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]',
                energyState === 'active' && 'drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]'
              )}
              strokeWidth={1.75}
            />
          </motion.div>

          {/* Title with moonlight gradient on hover */}
          <span
            className={cn(
              'text-sm font-medium transition-colors duration-300',
              'text-muted-foreground group-hover:text-foreground',
              energyState === 'active' && 'text-foreground'
            )}
          >
            {title}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="relative px-5 py-4">
        {children}

        {/* Learn Mode Explanation */}
        {explanation && (
          <LearnModeExplanation
            title={`Understanding ${title}`}
            description={explanation.short}
            details={explanation.technical}
            type="how-it-works"
          />
        )}
      </div>
    </motion.div>
  );
});

export default TelemetryCard;

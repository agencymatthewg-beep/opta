import { motion, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DiskMeterProps {
  usedGb: number;
  totalGb: number;
  percent: number;
}

function DiskMeter({ usedGb, totalGb, percent }: DiskMeterProps) {
  // Animated value for smooth transitions
  const springValue = useSpring(percent, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const width = useTransform(springValue, [0, 100], ["0%", "100%"]);

  // Determine color based on usage level
  const getColorClass = (value: number) => {
    if (value >= 85) return 'text-danger';
    if (value >= 60) return 'text-warning';
    return 'text-success';
  };

  const getBarColor = (value: number) => {
    if (value >= 85) return 'hsl(var(--danger))';
    if (value >= 60) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  const getGlowClass = (value: number) => {
    if (value >= 85) return 'shadow-[0_0_12px_hsl(var(--danger)/0.4)]';
    if (value >= 60) return 'shadow-[0_0_12px_hsl(var(--warning)/0.4)]';
    return 'shadow-[0_0_12px_hsl(var(--success)/0.4)]';
  };

  // Format to show TB if >= 1000 GB
  const formatSize = (gb: number) => {
    if (gb >= 1000) {
      return `${(gb / 1000).toFixed(1)} TB`;
    }
    return `${gb.toFixed(0)} GB`;
  };

  const colorClass = getColorClass(percent);
  const barColor = getBarColor(percent);
  const glowClass = getGlowClass(percent);
  const isHighUsage = percent >= 90;

  return (
    <div
      className="flex flex-col gap-4 w-full"
      role="meter"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Disk usage: ${formatSize(usedGb)} of ${formatSize(totalGb)} (${Math.round(percent)} percent)`}
    >
      {/* Header */}
      <motion.div
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-baseline gap-2">
          <span className={cn("text-3xl font-bold tabular-nums", colorClass)}>
            {Math.round(percent)}
            <span className="text-lg">%</span>
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Disk
        </span>
      </motion.div>

      {/* Progress bar */}
      <div className={cn(
        "relative h-3 w-full rounded-full bg-muted/20 overflow-hidden",
        isHighUsage && "animate-pulse"
      )}>
        <motion.div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            glowClass
          )}
          style={{
            width,
            background: `linear-gradient(90deg, hsl(var(--success)) 0%, ${barColor} 100%)`,
          }}
          initial={{ width: "0%" }}
          animate={{ width: `${percent}%` }}
          transition={{
            duration: 0.8,
            ease: [0.4, 0, 0.2, 1] as const,
          }}
        />
      </div>

      {/* Stats */}
      <motion.div
        className="flex items-center justify-center gap-2 text-xs"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <span className="text-foreground/80 font-medium tabular-nums">
          {formatSize(usedGb)}
        </span>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-muted-foreground tabular-nums">
          {formatSize(totalGb)}
        </span>
      </motion.div>
    </div>
  );
}

export default DiskMeter;

import { motion, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CpuMeterProps {
  percent: number;
  cores: number;
  threads: number;
}

function CpuMeter({ percent, cores, threads }: CpuMeterProps) {
  // Animated value for smooth transitions
  const springValue = useSpring(percent, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  // Calculate stroke dashoffset for the progress ring
  const radius = 46;
  const circumference = 2 * Math.PI * radius;

  const dashOffset = useTransform(
    springValue,
    [0, 100],
    [circumference, 0]
  );

  // Determine color based on usage level
  const getColorClass = (value: number) => {
    if (value >= 85) return 'text-danger';
    if (value >= 60) return 'text-warning';
    return 'text-success';
  };

  const getStrokeColor = (value: number) => {
    if (value >= 85) return 'hsl(var(--danger))';
    if (value >= 60) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  const getGlowClass = (value: number) => {
    if (value >= 85) return 'drop-shadow-[0_0_12px_hsl(var(--danger)/0.6)]';
    if (value >= 60) return 'drop-shadow-[0_0_12px_hsl(var(--warning)/0.6)]';
    return 'drop-shadow-[0_0_12px_hsl(var(--success)/0.6)]';
  };

  const colorClass = getColorClass(percent);
  const strokeColor = getStrokeColor(percent);
  const glowClass = getGlowClass(percent);
  const isHighUsage = percent >= 90;

  return (
    <div
      className="flex flex-col items-center gap-3"
      role="meter"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`CPU usage: ${Math.round(percent)} percent`}
    >
      {/* Meter ring */}
      <div className={cn(
        "relative w-32 h-32",
        isHighUsage && "animate-pulse"
      )}>
        <svg
          className="w-full h-full -rotate-90"
          viewBox="0 0 120 120"
          aria-hidden="true"
        >
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="8"
            className="stroke-muted/20"
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="cpuGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.8" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* Progress circle */}
          <motion.circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: dashOffset }}
            strokeLinecap="round"
            stroke="url(#cpuGradient)"
            className={cn("transition-all duration-300", glowClass)}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={cn("text-3xl font-bold tabular-nums", colorClass)}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {Math.round(percent)}
            <span className="text-lg">%</span>
          </motion.span>
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide mt-0.5">
            CPU
          </span>
        </div>
      </div>

      {/* Stats */}
      <motion.div
        className="flex items-center gap-4 text-xs"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/50" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground/80">{cores}</span> cores
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent/50" />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground/80">{threads}</span> threads
          </span>
        </div>
      </motion.div>
    </div>
  );
}

export default CpuMeter;

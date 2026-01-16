import { motion, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MonitorOff } from 'lucide-react';

interface GpuMeterProps {
  available: boolean;
  name?: string;
  percent?: number;
  temperature?: number;
}

function GpuMeter({ available, name, percent = 0, temperature }: GpuMeterProps) {
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

  if (!available) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center gap-3 py-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        role="status"
        aria-label="No GPU detected"
      >
        <div className="w-32 h-32 rounded-full border-2 border-dashed border-muted/20 flex items-center justify-center">
          <MonitorOff className="w-8 h-8 text-muted-foreground/30" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <span className="text-xs text-muted-foreground/60">No GPU detected</span>
      </motion.div>
    );
  }

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

  // Temperature color
  const getTempColorClass = (temp: number) => {
    if (temp >= 80) return 'text-danger border-danger/30 bg-danger/10';
    if (temp >= 65) return 'text-warning border-warning/30 bg-warning/10';
    return 'text-success border-success/30 bg-success/10';
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
      aria-label={`GPU usage: ${Math.round(percent)} percent${temperature !== undefined ? `, temperature: ${temperature} degrees Celsius` : ''}`}
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
            <linearGradient id="gpuGradient" x1="0%" y1="0%" x2="100%" y2="0%">
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
            stroke="url(#gpuGradient)"
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
            GPU
          </span>
        </div>

        {/* Temperature badge */}
        {temperature !== undefined && (
          <motion.div
            className={cn(
              "absolute -bottom-1 left-1/2 -translate-x-1/2",
              "px-2.5 py-1 rounded-full text-[10px] font-semibold",
              "border backdrop-blur-sm",
              getTempColorClass(temperature)
            )}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.4, type: "spring", stiffness: 400 }}
          >
            {temperature}°C
          </motion.div>
        )}
      </div>

      {/* GPU name */}
      <motion.div
        className="text-xs text-muted-foreground text-center truncate max-w-[140px]"
        title={name}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <span className="text-foreground/70">{name || 'Unknown GPU'}</span>
      </motion.div>
    </div>
  );
}

export default GpuMeter;

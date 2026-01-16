/**
 * ImpactPrediction - Animated impact prediction before applying changes.
 *
 * Shows predicted metrics (FPS, Quality, Thermal, Load Time) with
 * animated transitions between before/after values.
 * Only renders when Learn Mode is active.
 */

import { useState, useEffect } from 'react';

import { motion } from 'framer-motion';

import { useLearnMode } from '@/components/LearnModeContext';
import { cn } from '@/lib/utils';
import { Gauge, Eye, Zap, Clock } from 'lucide-react';

interface ImpactPredictionProps {
  predictedFps: { before: number; after: number };
  predictedQuality: { before: number; after: number };  // 0-100
  predictedThermal: { before: number; after: number };  // Celsius
  predictedLoadTime: { before: number; after: number };  // Seconds
  confidence: 'high' | 'medium' | 'low';
}

export function ImpactPrediction({
  predictedFps,
  predictedQuality,
  predictedThermal,
  predictedLoadTime,
  confidence,
}: ImpactPredictionProps) {
  const { isLearnMode } = useLearnMode();

  if (!isLearnMode) return null;

  const metrics = [
    {
      label: 'FPS',
      Icon: Gauge,
      before: predictedFps.before,
      after: predictedFps.after,
      unit: '',
      higherIsBetter: true,
    },
    {
      label: 'Quality',
      Icon: Eye,
      before: predictedQuality.before,
      after: predictedQuality.after,
      unit: '%',
      higherIsBetter: true,
    },
    {
      label: 'GPU Temp',
      Icon: Zap,
      before: predictedThermal.before,
      after: predictedThermal.after,
      unit: 'C',
      higherIsBetter: false,
    },
    {
      label: 'Load Time',
      Icon: Clock,
      before: predictedLoadTime.before,
      after: predictedLoadTime.after,
      unit: 's',
      higherIsBetter: false,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="glass-subtle rounded-xl p-4 my-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">Predicted Impact</h4>
        <div className={cn(
          "text-xs px-2 py-0.5 rounded-full",
          confidence === 'high' && "bg-success/20 text-success",
          confidence === 'medium' && "bg-warning/20 text-warning",
          confidence === 'low' && "bg-muted text-muted-foreground"
        )}>
          {confidence} confidence
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map((metric, i) => {
          const diff = metric.after - metric.before;
          const isImprovement = metric.higherIsBetter ? diff > 0 : diff < 0;
          const displayDiff = metric.higherIsBetter ? diff : -diff;

          return (
            <motion.div
              key={metric.label}
              className="p-3 rounded-lg bg-card/50"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="flex items-center gap-2 mb-2">
                <metric.Icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
                <span className="text-xs font-medium">{metric.label}</span>
              </div>

              {/* Animated number */}
              <div className="flex items-baseline gap-2">
                <CountUp
                  from={metric.before}
                  to={metric.after}
                  duration={1}
                  unit={metric.unit}
                />
                <span className={cn(
                  "text-sm font-medium",
                  isImprovement ? "text-success" : diff === 0 ? "text-muted-foreground" : "text-warning"
                )}>
                  {displayDiff > 0 && '+'}{displayDiff}{metric.unit}
                </span>
              </div>

              {/* Progress bar animation */}
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    isImprovement ? "bg-success" : "bg-warning"
                  )}
                  initial={{ width: `${(metric.before / Math.max(metric.before, metric.after, 1)) * 100}%` }}
                  animate={{ width: `${(metric.after / Math.max(metric.before, metric.after, 1)) * 100}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Predictions based on similar hardware configurations. Actual results
        may vary. Run a benchmark after applying to confirm gains.
      </p>
    </motion.div>
  );
}

/**
 * Animated counter component for smooth number transitions.
 */
function CountUp({ from, to, duration, unit }: { from: number; to: number; duration: number; unit: string }) {
  const [value, setValue] = useState(from);

  useEffect(() => {
    const steps = 30;
    const increment = (to - from) / steps;
    let current = from;
    const interval = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= to) || (increment < 0 && current <= to) || increment === 0) {
        setValue(to);
        clearInterval(interval);
      } else {
        setValue(Math.round(current));
      }
    }, (duration * 1000) / steps);

    return () => clearInterval(interval);
  }, [from, to, duration]);

  return <span className="text-xl font-bold">{value}{unit}</span>;
}

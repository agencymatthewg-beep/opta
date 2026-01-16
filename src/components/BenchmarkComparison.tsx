/**
 * BenchmarkComparison - Visual before/after performance comparison.
 *
 * Follows DESIGN_SYSTEM.md:
 * - Glass effects
 * - Framer Motion animations
 * - Lucide icons
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Minus, Cpu, MemoryStick, Thermometer, Activity } from 'lucide-react';
import type { BenchmarkComparison as BenchmarkComparisonType } from '../types/benchmark';

export interface BenchmarkComparisonProps {
  comparison: BenchmarkComparisonType;
}

interface MetricCardProps {
  label: string;
  icon: React.ElementType;
  before: number | null;
  after: number | null;
  unit: string;
  lowerIsBetter?: boolean;
}

function MetricCard({ label, icon: Icon, before, after, unit, lowerIsBetter = true }: MetricCardProps) {
  if (before === null || after === null) return null;

  const diff = before - after;
  const percentChange = (diff / before) * 100;
  const isImprovement = lowerIsBetter ? diff > 0 : diff < 0;
  const isNeutral = Math.abs(percentChange) < 1;

  const TrendIcon = isNeutral ? Minus : isImprovement ? TrendingDown : TrendingUp;
  const trendColor = isNeutral
    ? 'text-muted-foreground'
    : isImprovement
    ? 'text-success'
    : 'text-danger';

  return (
    <motion.div
      className="rounded-xl bg-white/[0.02] p-4 border border-white/[0.04]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-primary/10">
          <Icon className="w-4 h-4 text-primary" strokeWidth={1.75} />
        </div>
        <span className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
          {label}
        </span>
      </div>

      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-muted-foreground/50">Before:</span>
            <span className="text-sm font-medium text-foreground/70">{before.toFixed(1)}{unit}</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-muted-foreground/50">After:</span>
            <span className="text-sm font-semibold text-foreground">{after.toFixed(1)}{unit}</span>
          </div>
        </div>

        <div className={cn('flex items-center gap-1', trendColor)}>
          <TrendIcon className="w-4 h-4" strokeWidth={2} />
          <span className="text-sm font-semibold">
            {Math.abs(percentChange).toFixed(1)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function BenchmarkComparison({ comparison }: BenchmarkComparisonProps) {
  const { before, after, improvement } = comparison;

  if (!before || !after) {
    return (
      <motion.div
        className="rounded-xl bg-white/[0.02] p-6 border border-white/[0.04] text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Activity className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground/70">
          Run benchmarks before and after optimization to see the comparison.
        </p>
      </motion.div>
    );
  }

  const hasGpuData = before.gpu_avg !== null && after.gpu_avg !== null;
  const hasGpuTemp = before.gpu_temp_avg !== null && after.gpu_temp_avg !== null;

  return (
    <motion.div
      className="rounded-xl bg-white/[0.02] border border-white/[0.04] overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="px-4 py-3 border-b border-border/20">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Performance Comparison
          </h3>
          <span className="text-xs text-muted-foreground/50">
            {before.sample_count} samples → {after.sample_count} samples
          </span>
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 gap-3">
        <MetricCard
          label="CPU Usage"
          icon={Cpu}
          before={before.cpu_avg}
          after={after.cpu_avg}
          unit="%"
          lowerIsBetter={true}
        />
        <MetricCard
          label="Memory"
          icon={MemoryStick}
          before={before.memory_avg}
          after={after.memory_avg}
          unit="%"
          lowerIsBetter={true}
        />
        {hasGpuData && (
          <MetricCard
            label="GPU Usage"
            icon={Activity}
            before={before.gpu_avg}
            after={after.gpu_avg}
            unit="%"
            lowerIsBetter={false} // Higher GPU usage often means better utilization
          />
        )}
        {hasGpuTemp && (
          <MetricCard
            label="GPU Temp"
            icon={Thermometer}
            before={before.gpu_temp_avg}
            after={after.gpu_temp_avg}
            unit="°C"
            lowerIsBetter={true}
          />
        )}
      </div>

      {/* Summary */}
      {improvement && (
        <div className="px-4 py-3 bg-success/5 border-t border-success/10">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-success" strokeWidth={2} />
            <span className="text-sm text-success font-medium">
              {improvement.cpu_reduction_percent !== undefined && improvement.cpu_reduction_percent > 0
                ? `${improvement.cpu_reduction_percent.toFixed(1)}% lower CPU usage`
                : 'Optimization applied'}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default BenchmarkComparison;

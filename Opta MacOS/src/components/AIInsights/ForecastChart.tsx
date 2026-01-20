/**
 * Forecast Chart Component
 *
 * Displays time series predictions with confidence intervals
 * for CPU, memory, and GPU metrics.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ForecastResult } from '@/hooks/useForecast';

interface ForecastChartProps {
  forecast: ForecastResult | null;
  className?: string;
  showConfidenceInterval?: boolean;
  compact?: boolean;
}

export function ForecastChart({
  forecast,
  className,
  showConfidenceInterval = true,
  compact = false,
}: ForecastChartProps) {
  // Calculate chart dimensions
  const width = compact ? 200 : 300;
  const height = compact ? 60 : 100;
  const padding = { top: 10, right: 10, bottom: 20, left: 30 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Generate path data
  const pathData = useMemo(() => {
    if (!forecast || forecast.predictions.length === 0) return null;

    const predictions = forecast.predictions;
    const minTime = predictions[0].timestamp;
    const maxTime = predictions[predictions.length - 1].timestamp;
    const timeRange = maxTime - minTime;

    // Scale functions
    const xScale = (t: number) => ((t - minTime) / timeRange) * chartWidth;
    const yScale = (v: number) => chartHeight - (v / 100) * chartHeight;

    // Main prediction line
    const mainPath = predictions
      .map((p, i) => {
        const x = xScale(p.timestamp);
        const y = yScale(p.value);
        return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
      })
      .join(' ');

    // Confidence interval area
    let confidencePath = '';
    if (showConfidenceInterval) {
      const upperPath = predictions
        .map((p, i) => {
          const x = xScale(p.timestamp);
          const y = yScale(p.confidence_upper);
          return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
        })
        .join(' ');

      const lowerPath = predictions
        .slice()
        .reverse()
        .map((p) => {
          const x = xScale(p.timestamp);
          const y = yScale(p.confidence_lower);
          return `L ${x} ${y}`;
        })
        .join(' ');

      confidencePath = `${upperPath} ${lowerPath} Z`;
    }

    // Current value marker
    const currentX = 0;
    const currentY = yScale(forecast.currentValue);

    return {
      mainPath,
      confidencePath,
      currentX,
      currentY,
      predictions,
      xScale,
      yScale,
    };
  }, [forecast, chartWidth, chartHeight, showConfidenceInterval]);

  // Get trend icon
  const TrendIcon = forecast?.trend === 'increasing'
    ? TrendingUp
    : forecast?.trend === 'decreasing'
      ? TrendingDown
      : Minus;

  // Get trend color
  const trendColor = forecast?.trend === 'increasing'
    ? 'text-warning'
    : forecast?.trend === 'decreasing'
      ? 'text-success'
      : 'text-muted-foreground';

  if (!forecast || !pathData) {
    return (
      <div className={cn('glass-subtle rounded-lg p-4', className)}>
        <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
          Collecting data for predictions...
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('glass-subtle rounded-lg p-4', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium capitalize">{forecast.metric}</span>
          <span className="text-lg font-bold">{forecast.currentValue}%</span>
        </div>
        <div className={cn('flex items-center gap-1', trendColor)}>
          <TrendIcon className="w-4 h-4" />
          <span className="text-xs capitalize">{forecast.trend}</span>
        </div>
      </div>

      {/* Chart */}
      <svg width={width} height={height} className="overflow-visible">
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {/* Grid lines */}
          <line
            x1={0}
            y1={chartHeight * 0.15}
            x2={chartWidth}
            y2={chartHeight * 0.15}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeDasharray="2,2"
          />
          <line
            x1={0}
            y1={chartHeight * 0.4}
            x2={chartWidth}
            y2={chartHeight * 0.4}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeDasharray="2,2"
          />

          {/* Threshold lines */}
          <line
            x1={0}
            y1={pathData.yScale(85)}
            x2={chartWidth}
            y2={pathData.yScale(85)}
            stroke="hsl(var(--danger))"
            strokeOpacity={0.3}
            strokeWidth={1}
          />
          <line
            x1={0}
            y1={pathData.yScale(60)}
            x2={chartWidth}
            y2={pathData.yScale(60)}
            stroke="hsl(var(--warning))"
            strokeOpacity={0.3}
            strokeWidth={1}
          />

          {/* Confidence interval */}
          {showConfidenceInterval && pathData.confidencePath && (
            <path
              d={pathData.confidencePath}
              fill="hsl(var(--primary))"
              fillOpacity={0.1}
            />
          )}

          {/* Prediction line */}
          <path
            d={pathData.mainPath}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Current value marker */}
          <circle
            cx={pathData.currentX}
            cy={pathData.currentY}
            r={4}
            fill="hsl(var(--primary))"
          />

          {/* Y-axis labels */}
          <text
            x={-5}
            y={chartHeight}
            fontSize={9}
            fill="currentColor"
            fillOpacity={0.5}
            textAnchor="end"
          >
            0%
          </text>
          <text
            x={-5}
            y={10}
            fontSize={9}
            fill="currentColor"
            fillOpacity={0.5}
            textAnchor="end"
          >
            100%
          </text>
        </g>
      </svg>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>
          Confidence: {Math.round(forecast.confidence * 100)}%
        </span>
        {forecast.estimatedTimeToCritical !== null && (
          <div className="flex items-center gap-1 text-warning">
            <AlertTriangle className="w-3 h-3" />
            <span>
              Critical in ~{Math.round(forecast.estimatedTimeToCritical / 60)} min
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

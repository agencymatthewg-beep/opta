/**
 * RealtimeTelemetryChart - High-performance streaming telemetry visualization
 *
 * Uses Apache ECharts with Canvas rendering for 60fps performance with 10K+ data points.
 * Displays CPU, Memory, GPU, and Disk metrics with real-time updates.
 *
 * @see DESIGN_SYSTEM.md for color and styling guidelines
 */

import { useRef, useEffect, useMemo, useCallback } from 'react';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption, LineSeriesOption } from 'echarts';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useTelemetryHistory } from '@/hooks/useTelemetryHistory';

// Register ECharts components (tree-shakeable)
echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  CanvasRenderer,
]);

/**
 * Props for RealtimeTelemetryChart component.
 */
export interface RealtimeTelemetryChartProps {
  /** Which metric(s) to display */
  metric: 'cpu' | 'memory' | 'gpu' | 'disk' | 'all';
  /** Chart height in pixels (default: 200) */
  height?: number;
  /** Whether to show legend (default: true for 'all', false otherwise) */
  showLegend?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Maximum data points to display (default: 300) */
  maxPoints?: number;
  /** Sample interval in ms (default: 1000) */
  sampleInterval?: number;
}

// Semantic colors from design system (HSL values converted to hex for ECharts)
// --primary: 265 90% 65% (Electric Violet)
// --neon-blue: 59 130 246 (#3b82f6)
// --neon-green: 34 197 94 (#22c55e)
// --warning: 45 90% 55% (Amber)
const METRIC_COLORS = {
  cpu: '#a855f7',      // Primary purple (hsl(265, 90%, 65%))
  memory: '#3b82f6',   // Neon blue
  gpu: '#22c55e',      // Neon green
  disk: '#f59e0b',     // Warning amber
} as const;

// Threshold lines for warning (60%) and danger (85%)
const WARNING_THRESHOLD = 60;
const DANGER_THRESHOLD = 85;

/**
 * Format timestamp for X-axis display.
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * RealtimeTelemetryChart - Displays real-time streaming telemetry data.
 *
 * Features:
 * - Canvas-based rendering for 60fps performance
 * - Automatic streaming updates from telemetry hook
 * - Warning (60%) and danger (85%) threshold lines
 * - Glass styling matching design system
 * - ResizeObserver for responsive sizing
 *
 * @example
 * ```tsx
 * // Single metric
 * <RealtimeTelemetryChart metric="cpu" height={200} />
 *
 * // All metrics with legend
 * <RealtimeTelemetryChart metric="all" height={300} showLegend />
 * ```
 */
export function RealtimeTelemetryChart({
  metric,
  height = 200,
  showLegend,
  className,
  maxPoints = 300,
  sampleInterval = 1000,
}: RealtimeTelemetryChartProps) {
  const chartRef = useRef<ReactEChartsCore>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get telemetry history
  const { history, hasData } = useTelemetryHistory({
    maxPoints,
    sampleInterval,
  });

  // Determine which series to show
  const showCpu = metric === 'cpu' || metric === 'all';
  const showMemory = metric === 'memory' || metric === 'all';
  const showGpu = metric === 'gpu' || metric === 'all';
  const showDisk = metric === 'disk' || metric === 'all';

  // Default legend visibility
  const legendVisible = showLegend ?? metric === 'all';

  // Extract series data from history
  const seriesData = useMemo(() => {
    const timestamps = history.map(p => p.timestamp);
    const cpuData = showCpu ? history.map(p => p.cpu) : [];
    const memoryData = showMemory ? history.map(p => p.memory) : [];
    const gpuData = showGpu ? history.map(p => p.gpu ?? 0) : [];
    const diskData = showDisk ? history.map(p => p.disk) : [];

    return { timestamps, cpuData, memoryData, gpuData, diskData };
  }, [history, showCpu, showMemory, showGpu, showDisk]);

  // Build ECharts options
  const chartOptions = useMemo((): EChartsOption => {
    const series: LineSeriesOption[] = [];

    // Common series config for real-time performance
    const commonSeriesConfig: Partial<LineSeriesOption> = {
      type: 'line',
      smooth: true,
      showSymbol: false,
      animation: false, // Disable animation for real-time updates
      lineStyle: {
        width: 2,
      },
      areaStyle: {
        opacity: 0.1,
      },
    };

    if (showCpu && seriesData.cpuData.length > 0) {
      series.push({
        ...commonSeriesConfig,
        name: 'CPU',
        data: seriesData.cpuData,
        itemStyle: { color: METRIC_COLORS.cpu },
        lineStyle: { ...commonSeriesConfig.lineStyle, color: METRIC_COLORS.cpu },
        areaStyle: { ...commonSeriesConfig.areaStyle, color: METRIC_COLORS.cpu },
      });
    }

    if (showMemory && seriesData.memoryData.length > 0) {
      series.push({
        ...commonSeriesConfig,
        name: 'Memory',
        data: seriesData.memoryData,
        itemStyle: { color: METRIC_COLORS.memory },
        lineStyle: { ...commonSeriesConfig.lineStyle, color: METRIC_COLORS.memory },
        areaStyle: { ...commonSeriesConfig.areaStyle, color: METRIC_COLORS.memory },
      });
    }

    if (showGpu && seriesData.gpuData.length > 0) {
      series.push({
        ...commonSeriesConfig,
        name: 'GPU',
        data: seriesData.gpuData,
        itemStyle: { color: METRIC_COLORS.gpu },
        lineStyle: { ...commonSeriesConfig.lineStyle, color: METRIC_COLORS.gpu },
        areaStyle: { ...commonSeriesConfig.areaStyle, color: METRIC_COLORS.gpu },
      });
    }

    if (showDisk && seriesData.diskData.length > 0) {
      series.push({
        ...commonSeriesConfig,
        name: 'Disk',
        data: seriesData.diskData,
        itemStyle: { color: METRIC_COLORS.disk },
        lineStyle: { ...commonSeriesConfig.lineStyle, color: METRIC_COLORS.disk },
        areaStyle: { ...commonSeriesConfig.areaStyle, color: METRIC_COLORS.disk },
      });
    }

    return {
      backgroundColor: 'transparent',
      animation: false,
      grid: {
        top: legendVisible ? 40 : 20,
        right: 20,
        bottom: 30,
        left: 45,
        containLabel: false,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(12, 12, 18, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        textStyle: {
          color: '#fafafa',
          fontSize: 12,
        },
        formatter: (params: unknown) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          const firstParam = params[0] as { dataIndex: number };
          const timestamp = seriesData.timestamps[firstParam.dataIndex];
          const time = formatTime(timestamp);

          let content = `<div style="font-weight: 500; margin-bottom: 4px;">${time}</div>`;
          for (const p of params as Array<{ seriesName: string; value: number; color: string }>) {
            content += `<div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${p.color}"></span>
              <span>${p.seriesName}: <strong>${p.value?.toFixed(1) ?? 0}%</strong></span>
            </div>`;
          }
          return content;
        },
      },
      legend: legendVisible ? {
        show: true,
        top: 5,
        right: 10,
        textStyle: {
          color: 'rgba(255, 255, 255, 0.7)',
          fontSize: 11,
        },
        itemWidth: 16,
        itemHeight: 8,
      } : undefined,
      xAxis: {
        type: 'category',
        data: seriesData.timestamps.map(formatTime),
        axisLine: {
          lineStyle: { color: 'rgba(255, 255, 255, 0.1)' },
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: 10,
          interval: Math.floor(seriesData.timestamps.length / 5),
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        interval: 20,
        axisLine: {
          show: false,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          color: 'rgba(255, 255, 255, 0.5)',
          fontSize: 10,
          formatter: '{value}%',
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.05)',
            type: 'dashed',
          },
        },
      },
      series: series.length > 0 ? series.map((s, index) => ({
        ...s,
        // Add threshold marklines only on first series
        ...(index === 0 ? {
          markLine: {
            silent: true,
            symbol: 'none',
            animation: false,
            data: [
              {
                yAxis: WARNING_THRESHOLD,
                lineStyle: {
                  color: '#f59e0b',
                  type: 'dashed',
                  width: 1,
                  opacity: 0.5,
                },
                label: {
                  show: false,
                },
              },
              {
                yAxis: DANGER_THRESHOLD,
                lineStyle: {
                  color: '#ef4444',
                  type: 'dashed',
                  width: 1,
                  opacity: 0.5,
                },
                label: {
                  show: false,
                },
              },
            ],
          },
        } : {}),
      })) : [],
    };
  }, [seriesData, showCpu, showMemory, showGpu, showDisk, legendVisible]);

  // Handle window resize
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      chartRef.current?.getEchartsInstance()?.resize();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Get echarts instance for cleanup
  const onChartReady = useCallback(() => {
    // Instance is ready, can be used for additional setup if needed
  }, []);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        // Glass effect container
        'relative overflow-hidden rounded-xl',
        'bg-[#05030a]/80 backdrop-blur-xl',
        'border border-white/[0.06]',
        // Inner specular highlight
        'before:absolute before:inset-x-0 before:top-0 before:h-px',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        'before:rounded-t-xl',
        className
      )}
      style={{ height }}
    >
      {!hasData ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-muted-foreground text-sm">
            Collecting telemetry data...
          </div>
        </div>
      ) : (
        <ReactEChartsCore
          ref={chartRef}
          echarts={echarts}
          option={chartOptions}
          style={{ height: '100%', width: '100%' }}
          notMerge={false}
          lazyUpdate={true}
          onChartReady={onChartReady}
          opts={{
            renderer: 'canvas', // Canvas for performance (NOT svg)
            devicePixelRatio: window.devicePixelRatio || 1,
          }}
        />
      )}
    </motion.div>
  );
}

export default RealtimeTelemetryChart;

/**
 * CpuFlameGraph - Hierarchical CPU attribution visualization.
 *
 * Shows process CPU usage as a flame graph using Visx hierarchy.
 * Supports drill-down by clicking categories to expand/collapse.
 *
 * @see DESIGN_SYSTEM.md - Part 4: Glass Effects
 */

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Group } from '@visx/group';
import { hierarchy, Treemap, treemapSlice } from '@visx/hierarchy';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { ParentSize } from '@visx/responsive';
import { useProcessCpuAttribution } from '@/hooks/useProcessCpuAttribution';
import type { CpuAttributionNode } from '@/hooks/useProcessCpuAttribution';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { Layers, ChevronRight, ChevronDown, Cpu } from 'lucide-react';
import { OptaRingLoader } from '@/components/OptaRing';

/**
 * Props for the CpuFlameGraph component.
 */
export interface CpuFlameGraphProps {
  /** Height of the flame graph in pixels (default: 300) */
  height?: number;
  /** Whether to show labels on bars (default: true) */
  showLabels?: boolean;
  /** Callback when a process is clicked */
  onProcessClick?: (pid: number) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Tooltip data structure.
 */
interface TooltipData {
  name: string;
  value: number;
  category?: string;
  pid?: number;
}

/**
 * Default minimum bar width for showing labels.
 */
const MIN_LABEL_WIDTH = 60;

/**
 * Animation easing curve.
 */
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Tooltip styles matching the design system.
 */
const tooltipStyles = {
  ...defaultStyles,
  backgroundColor: 'rgba(5, 3, 10, 0.95)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '8px',
  color: '#fafafa',
  fontFamily: 'Sora, system-ui, sans-serif',
  fontSize: '12px',
  padding: '8px 12px',
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
};

/**
 * Get color for a node based on its category.
 */
function getNodeColor(node: CpuAttributionNode, isExpanded: boolean): string {
  const baseColors: Record<string, string> = {
    system: 'rgb(113, 113, 122)', // muted-foreground
    user: 'rgb(168, 85, 247)', // primary
    'safe-to-kill': 'rgb(234, 179, 8)', // warning
    other: 'rgb(88, 28, 135)', // secondary
    aggregated: 'rgb(63, 63, 70)', // darker muted
  };

  const category = node.category || 'other';
  const baseColor = baseColors[category] || baseColors.other;

  // Slightly desaturate if expanded to show hierarchy
  if (isExpanded) {
    return baseColor;
  }

  return baseColor;
}

/**
 * Get hover color (brighter) for a node.
 */
function getNodeHoverColor(category?: string): string {
  const hoverColors: Record<string, string> = {
    system: 'rgb(161, 161, 170)',
    user: 'rgb(192, 132, 252)',
    'safe-to-kill': 'rgb(250, 204, 21)',
    other: 'rgb(107, 33, 168)',
    aggregated: 'rgb(82, 82, 91)',
  };

  return hoverColors[category || 'other'] || hoverColors.other;
}

/**
 * Internal flame graph renderer with access to dimensions.
 */
function FlameGraphInner({
  width,
  height,
  showLabels,
  onProcessClick,
}: {
  width: number;
  height: number;
  showLabels: boolean;
  onProcessClick?: (pid: number) => void;
}) {
  const { root: attributionRoot, loading, error, totalCpu } = useProcessCpuAttribution();
  const prefersReducedMotion = useReducedMotion();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['user', 'safe-to-kill', 'system'])
  );
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const {
    tooltipOpen,
    tooltipData,
    tooltipLeft,
    tooltipTop,
    showTooltip,
    hideTooltip,
  } = useTooltip<TooltipData>();

  // Toggle category expansion
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Handle bar click
  const handleBarClick = useCallback(
    (node: CpuAttributionNode) => {
      if (node.pid && onProcessClick) {
        onProcessClick(node.pid);
      } else if (node.category && node.children && node.children.length > 0) {
        toggleCategory(node.category);
      }
    },
    [onProcessClick, toggleCategory]
  );

  // Build the hierarchy data structure for visx
  const hierarchyData = useMemo(() => {
    if (!attributionRoot || attributionRoot.value === 0) {
      return null;
    }

    // Filter children based on expanded state
    const filteredRoot: CpuAttributionNode = {
      ...attributionRoot,
      children: attributionRoot.children?.map((categoryNode) => {
        const isExpanded = expandedCategories.has(categoryNode.category || '');
        if (isExpanded && categoryNode.children && categoryNode.children.length > 0) {
          return categoryNode;
        }
        // Collapse: show category as single bar
        return {
          ...categoryNode,
          children: undefined,
        };
      }),
    };

    return hierarchy(filteredRoot)
      .sum((d) => (d.children ? 0 : d.value))
      .sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [attributionRoot, expandedCategories]);

  // Loading state
  if (loading && !attributionRoot) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <OptaRingLoader size="md" />
        <p className="text-sm text-muted-foreground/60">Analyzing CPU usage...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-danger">
        <Cpu className="w-8 h-8" strokeWidth={1.5} />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // Empty state
  if (!hierarchyData || totalCpu === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/60">
        <Layers className="w-8 h-8" strokeWidth={1.5} />
        <p className="text-sm">No CPU activity to display</p>
      </div>
    );
  }

  const margin = { top: 10, left: 10, right: 10, bottom: 10 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  return (
    <>
      <svg width={width} height={height} aria-label="CPU flame graph">
        <rect width={width} height={height} rx={12} fill="transparent" />
        <Group top={margin.top} left={margin.left}>
          <Treemap<CpuAttributionNode>
            root={hierarchyData}
            size={[innerWidth, innerHeight]}
            tile={treemapSlice}
            round
            paddingInner={2}
            paddingOuter={2}
          >
            {(treemap) => (
              <Group>
                {treemap.descendants().map((node, i) => {
                  const nodeWidth = node.x1 - node.x0;
                  const nodeHeight = node.y1 - node.y0;
                  const isLeaf = !node.children;
                  const data = node.data;
                  const isHovered = hoveredNode === `${data.name}-${i}`;
                  const isExpanded = expandedCategories.has(data.category || '');
                  const isCategory = data.children && data.children.length > 0 && !data.pid;

                  // Skip root node and very small nodes
                  if (node.depth === 0 || nodeWidth < 2) return null;

                  const fillColor = isHovered
                    ? getNodeHoverColor(data.category)
                    : getNodeColor(data, isExpanded);

                  return (
                    <motion.g
                      key={`node-${i}`}
                      initial={prefersReducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: i * 0.01 }}
                    >
                      <rect
                        x={node.x0}
                        y={node.y0}
                        width={nodeWidth}
                        height={nodeHeight}
                        fill={fillColor}
                        rx={4}
                        stroke={isHovered ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.1)'}
                        strokeWidth={isHovered ? 2 : 1}
                        style={{
                          cursor: isLeaf && data.pid ? 'pointer' : isCategory ? 'pointer' : 'default',
                          transition: 'fill 0.15s ease, stroke 0.15s ease',
                        }}
                        role="graphics-symbol"
                        aria-label={`${data.name}: ${data.value.toFixed(1)}% CPU`}
                        tabIndex={isLeaf || isCategory ? 0 : undefined}
                        onMouseEnter={(e) => {
                          setHoveredNode(`${data.name}-${i}`);
                          showTooltip({
                            tooltipData: {
                              name: data.name,
                              value: data.value,
                              category: data.category,
                              pid: data.pid,
                            },
                            tooltipLeft: e.clientX,
                            tooltipTop: e.clientY,
                          });
                        }}
                        onMouseLeave={() => {
                          setHoveredNode(null);
                          hideTooltip();
                        }}
                        onMouseMove={(e) => {
                          showTooltip({
                            tooltipData: {
                              name: data.name,
                              value: data.value,
                              category: data.category,
                              pid: data.pid,
                            },
                            tooltipLeft: e.clientX,
                            tooltipTop: e.clientY,
                          });
                        }}
                        onClick={() => handleBarClick(data)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleBarClick(data);
                          }
                        }}
                      />
                      {/* Label */}
                      {showLabels && nodeWidth > MIN_LABEL_WIDTH && nodeHeight > 16 && (
                        <text
                          x={node.x0 + 6}
                          y={node.y0 + nodeHeight / 2}
                          dy="0.35em"
                          fontSize={11}
                          fontFamily="Sora, system-ui, sans-serif"
                          fill="rgba(250, 250, 250, 0.9)"
                          pointerEvents="none"
                          style={{
                            textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                          }}
                        >
                          <tspan fontWeight={500}>
                            {data.name.length > nodeWidth / 8
                              ? `${data.name.slice(0, Math.floor(nodeWidth / 8))}...`
                              : data.name}
                          </tspan>
                          {nodeWidth > 100 && (
                            <tspan
                              x={node.x1 - 40}
                              fill="rgba(250, 250, 250, 0.7)"
                              fontSize={10}
                            >
                              {data.value.toFixed(1)}%
                            </tspan>
                          )}
                        </text>
                      )}
                      {/* Expand/collapse indicator for categories */}
                      {isCategory && nodeWidth > 24 && nodeHeight > 16 && (
                        <g
                          transform={`translate(${node.x1 - 18}, ${node.y0 + nodeHeight / 2 - 6})`}
                          pointerEvents="none"
                        >
                          {isExpanded ? (
                            <ChevronDown
                              className="w-3 h-3"
                              stroke="rgba(250, 250, 250, 0.6)"
                              strokeWidth={2}
                            />
                          ) : (
                            <ChevronRight
                              className="w-3 h-3"
                              stroke="rgba(250, 250, 250, 0.6)"
                              strokeWidth={2}
                            />
                          )}
                        </g>
                      )}
                    </motion.g>
                  );
                })}
              </Group>
            )}
          </Treemap>
        </Group>
      </svg>

      {/* Tooltip */}
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          top={tooltipTop}
          left={tooltipLeft}
          style={tooltipStyles}
        >
          <div className="flex flex-col gap-1">
            <div className="font-medium">{tooltipData.name}</div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>CPU: {tooltipData.value.toFixed(1)}%</span>
              {tooltipData.category && (
                <>
                  <span className="text-white/20">|</span>
                  <span className="capitalize">{tooltipData.category}</span>
                </>
              )}
            </div>
            {tooltipData.pid && (
              <div className="text-xs text-muted-foreground/60">
                PID: {tooltipData.pid}
              </div>
            )}
          </div>
        </TooltipWithBounds>
      )}
    </>
  );
}

/**
 * CPU Flame Graph component showing hierarchical process CPU attribution.
 *
 * @example
 * ```tsx
 * <CpuFlameGraph
 *   height={400}
 *   onProcessClick={(pid) => console.log('Clicked:', pid)}
 * />
 * ```
 */
export function CpuFlameGraph({
  height = 300,
  showLabels = true,
  onProcessClick,
  className,
}: CpuFlameGraphProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-xl',
        // Obsidian glass material
        'bg-[#05030a]/80 backdrop-blur-xl',
        'border border-white/[0.06]',
        // Inner specular highlight
        'before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10',
        'before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent',
        'before:rounded-t-xl',
        className
      )}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: smoothOut }}
    >
      {/* Header */}
      <div className="relative px-5 py-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <motion.div
            className="p-2 rounded-lg bg-primary/10"
            whileHover={{
              boxShadow: '0 0 15px -3px rgba(168, 85, 247, 0.5)',
            }}
          >
            <Layers
              className="w-4 h-4 text-primary"
              strokeWidth={1.75}
            />
          </motion.div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
            CPU Attribution
          </h3>
        </div>
      </div>

      {/* Flame Graph */}
      <div style={{ height }} className="relative p-3">
        <ParentSize debounceTime={100}>
          {({ width, height: innerHeight }) => (
            <FlameGraphInner
              width={width}
              height={innerHeight}
              showLabels={showLabels}
              onProcessClick={onProcessClick}
            />
          )}
        </ParentSize>
      </div>
    </motion.div>
  );
}

export default CpuFlameGraph;

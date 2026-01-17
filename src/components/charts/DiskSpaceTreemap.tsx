/**
 * DiskSpaceTreemap - Hierarchical disk space visualization.
 *
 * Shows disk usage as a treemap using Visx hierarchy.
 * Supports drill-down navigation by double-clicking directories.
 *
 * @see DESIGN_SYSTEM.md - Part 4: Glass Effects
 */

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Group } from '@visx/group';
import { hierarchy, Treemap, treemapSquarify } from '@visx/hierarchy';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { ParentSize } from '@visx/responsive';
import { useDiskAnalysis, formatSize } from '@/hooks/useDiskAnalysis';
import type { DiskNode } from '@/hooks/useDiskAnalysis';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';
import { HardDrive, ChevronRight, FolderOpen, RefreshCw, AlertCircle } from 'lucide-react';
import { OptaRingLoader } from '@/components/OptaRing';

/**
 * Props for the DiskSpaceTreemap component.
 */
export interface DiskSpaceTreemapProps {
  /** Height of the treemap in pixels (default: 400) */
  height?: number;
  /** Callback when a directory is navigated to */
  onNavigate?: (path: string) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Tooltip data structure.
 */
interface TooltipData {
  name: string;
  path: string;
  size: number;
  category: string;
  childCount?: number;
}

/**
 * Minimum rectangle width for showing labels.
 */
const MIN_LABEL_WIDTH = 80;

/**
 * Minimum rectangle height for showing labels.
 */
const MIN_LABEL_HEIGHT = 40;

/**
 * Maximum nodes to render for performance.
 */
const MAX_VISIBLE_NODES = 100;

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
function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    applications: 'rgb(168, 85, 247)', // primary - purple
    documents: 'rgb(59, 130, 246)', // chart-2 - blue
    media: 'rgb(34, 197, 94)', // chart-3 - green
    system: 'rgb(249, 115, 22)', // chart-4 - orange
    cache: 'rgb(113, 113, 122)', // muted
    code: 'rgb(6, 182, 212)', // cyan
    other: 'rgb(63, 63, 70)', // muted-foreground
  };

  return colors[category] || colors.other;
}

/**
 * Get hover color (brighter) for a node.
 */
function getCategoryHoverColor(category: string): string {
  const hoverColors: Record<string, string> = {
    applications: 'rgb(192, 132, 252)', // lighter purple
    documents: 'rgb(96, 165, 250)', // lighter blue
    media: 'rgb(74, 222, 128)', // lighter green
    system: 'rgb(251, 146, 60)', // lighter orange
    cache: 'rgb(161, 161, 170)', // lighter muted
    code: 'rgb(34, 211, 238)', // lighter cyan
    other: 'rgb(82, 82, 91)', // lighter muted-foreground
  };

  return hoverColors[category] || hoverColors.other;
}

/**
 * Flatten the tree and limit visible nodes for performance.
 */
function limitNodes(root: DiskNode): DiskNode {
  if (!root.children || root.children.length === 0) {
    return root;
  }

  // Sort by size and take top items
  const sortedChildren = [...root.children].sort((a, b) => b.size - a.size);

  // Count total nodes recursively
  function countNodes(node: DiskNode): number {
    if (!node.children) return 1;
    return 1 + node.children.reduce((sum, child) => sum + countNodes(child), 0);
  }

  let nodeCount = 1;
  const limitedChildren: DiskNode[] = [];

  for (const child of sortedChildren) {
    const childCount = countNodes(child);
    if (nodeCount + childCount <= MAX_VISIBLE_NODES) {
      limitedChildren.push(child);
      nodeCount += childCount;
    } else {
      // Add remainder as aggregated "Other"
      const remaining = sortedChildren.slice(limitedChildren.length);
      if (remaining.length > 0) {
        const otherSize = remaining.reduce((sum, n) => sum + n.size, 0);
        limitedChildren.push({
          name: `Other (${remaining.length} items)`,
          path: `${root.path}/__aggregated__`,
          size: otherSize,
          category: 'other',
        });
      }
      break;
    }
  }

  return {
    ...root,
    children: limitedChildren.map(limitNodes),
  };
}

/**
 * Internal treemap renderer with access to dimensions.
 */
function TreemapInner({
  width,
  height,
  onNavigate,
}: {
  width: number;
  height: number;
  onNavigate?: (path: string) => void;
}) {
  const {
    root: diskRoot,
    loading,
    error,
    // currentPath - available but not used directly
    navigateTo,
    // navigateUp - could be used for back button
    breadcrumbs,
    refresh,
    refreshing,
  } = useDiskAnalysis();

  const prefersReducedMotion = useReducedMotion();
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const {
    tooltipOpen,
    tooltipData,
    tooltipLeft,
    tooltipTop,
    showTooltip,
    hideTooltip,
  } = useTooltip<TooltipData>();

  // Handle double-click navigation
  const handleDoubleClick = useCallback(
    (node: DiskNode) => {
      // Don't navigate to aggregated/other nodes
      if (node.path.includes('__other__') || node.path.includes('__aggregated__')) {
        return;
      }
      // Only navigate to directories (nodes with children or no extension)
      if (node.children || !node.name.includes('.')) {
        navigateTo(node.path);
        onNavigate?.(node.path);
      }
    },
    [navigateTo, onNavigate]
  );

  // Build the hierarchy data structure for visx
  const hierarchyData = useMemo(() => {
    if (!diskRoot || diskRoot.size === 0) {
      return null;
    }

    // Limit nodes for performance
    const limitedRoot = limitNodes(diskRoot);

    return hierarchy(limitedRoot)
      .sum((d) => (d.children ? 0 : d.size))
      .sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [diskRoot]);

  // Loading state
  if (loading && !diskRoot) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <OptaRingLoader size="md" />
        <p className="text-sm text-muted-foreground/60">Analyzing disk usage...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-danger">
        <AlertCircle className="w-8 h-8" strokeWidth={1.5} />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // Empty state
  if (!hierarchyData || diskRoot?.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/60">
        <HardDrive className="w-8 h-8" strokeWidth={1.5} />
        <p className="text-sm">No disk data to display</p>
      </div>
    );
  }

  const margin = { top: 10, left: 10, right: 10, bottom: 10 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  return (
    <>
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-1 px-4 py-2 text-sm overflow-x-auto border-b border-white/[0.05]">
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1;
          const name = crumb === '/' ? 'Root' : crumb.split('/').filter(Boolean).pop() || crumb;

          return (
            <div key={crumb} className="flex items-center gap-1 shrink-0">
              {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" strokeWidth={1.5} />}
              <button
                onClick={() => !isLast && navigateTo(crumb)}
                disabled={isLast}
                className={cn(
                  'px-2 py-0.5 rounded-md transition-colors text-xs',
                  isLast
                    ? 'text-foreground font-medium cursor-default'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5 cursor-pointer'
                )}
              >
                {name}
              </button>
            </div>
          );
        })}

        {/* Refresh button */}
        <button
          onClick={refresh}
          disabled={refreshing}
          className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          title="Refresh"
        >
          <RefreshCw
            className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')}
            strokeWidth={1.5}
          />
        </button>
      </div>

      {/* Total size indicator */}
      <div className="px-4 py-2 text-xs text-muted-foreground border-b border-white/[0.05]">
        <span className="font-medium text-foreground">{formatSize(diskRoot?.size || 0)}</span>
        <span className="ml-1">total in current directory</span>
      </div>

      {/* Treemap */}
      <svg width={width} height={height - 70} aria-label="Disk space treemap">
        <rect width={width} height={height - 70} fill="transparent" />
        <Group top={margin.top} left={margin.left}>
          <Treemap<DiskNode>
            root={hierarchyData}
            size={[innerWidth, innerHeight - 70]}
            tile={treemapSquarify}
            round
            paddingInner={2}
            paddingOuter={2}
          >
            {(treemap) => (
              <Group>
                {treemap.descendants().map((node, i) => {
                  const nodeWidth = node.x1 - node.x0;
                  const nodeHeight = node.y1 - node.y0;
                  const data = node.data;
                  const isHovered = hoveredNode === `${data.name}-${i}`;
                  const hasChildren = data.children && data.children.length > 0;
                  const isNavigable =
                    !data.path.includes('__other__') &&
                    !data.path.includes('__aggregated__') &&
                    (hasChildren || !data.name.includes('.'));

                  // Skip root node and very small nodes
                  if (node.depth === 0 || nodeWidth < 2 || nodeHeight < 2) return null;

                  const fillColor = isHovered
                    ? getCategoryHoverColor(data.category)
                    : getCategoryColor(data.category);

                  return (
                    <motion.g
                      key={`node-${i}`}
                      initial={prefersReducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: Math.min(i * 0.005, 0.3) }}
                    >
                      <rect
                        x={node.x0}
                        y={node.y0}
                        width={nodeWidth}
                        height={nodeHeight}
                        fill={fillColor}
                        rx={3}
                        stroke={isHovered ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.08)'}
                        strokeWidth={isHovered ? 2 : 1}
                        style={{
                          cursor: isNavigable ? 'pointer' : 'default',
                          transition: 'fill 0.15s ease, stroke 0.15s ease',
                        }}
                        role="graphics-symbol"
                        aria-label={`${data.name}: ${formatSize(data.size)}`}
                        tabIndex={isNavigable ? 0 : undefined}
                        onMouseEnter={(e) => {
                          setHoveredNode(`${data.name}-${i}`);
                          showTooltip({
                            tooltipData: {
                              name: data.name,
                              path: data.path,
                              size: data.size,
                              category: data.category,
                              childCount: data.children?.length,
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
                              path: data.path,
                              size: data.size,
                              category: data.category,
                              childCount: data.children?.length,
                            },
                            tooltipLeft: e.clientX,
                            tooltipTop: e.clientY,
                          });
                        }}
                        onDoubleClick={() => handleDoubleClick(data)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleDoubleClick(data);
                          }
                        }}
                      />
                      {/* Label */}
                      {nodeWidth > MIN_LABEL_WIDTH && nodeHeight > MIN_LABEL_HEIGHT && (
                        <>
                          <text
                            x={node.x0 + 6}
                            y={node.y0 + 16}
                            fontSize={11}
                            fontFamily="Sora, system-ui, sans-serif"
                            fontWeight={500}
                            fill="rgba(250, 250, 250, 0.9)"
                            pointerEvents="none"
                            style={{
                              textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
                            }}
                          >
                            {data.name.length > Math.floor(nodeWidth / 7)
                              ? `${data.name.slice(0, Math.floor(nodeWidth / 7))}...`
                              : data.name}
                          </text>
                          <text
                            x={node.x0 + 6}
                            y={node.y0 + 30}
                            fontSize={10}
                            fontFamily="Sora, system-ui, sans-serif"
                            fill="rgba(250, 250, 250, 0.65)"
                            pointerEvents="none"
                            style={{
                              textShadow: '0 1px 2px rgba(0, 0, 0, 0.6)',
                            }}
                          >
                            {formatSize(data.size)}
                          </text>
                        </>
                      )}
                      {/* Folder icon for navigable directories */}
                      {isNavigable && hasChildren && nodeWidth > 24 && nodeHeight > 20 && (
                        <FolderOpen
                          x={node.x1 - 18}
                          y={node.y0 + 4}
                          className="w-3 h-3"
                          stroke="rgba(250, 250, 250, 0.5)"
                          strokeWidth={1.5}
                        />
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
            <div className="text-primary font-semibold">{formatSize(tooltipData.size)}</div>
            <div className="text-xs text-muted-foreground capitalize">
              {tooltipData.category}
            </div>
            {tooltipData.childCount !== undefined && (
              <div className="text-xs text-muted-foreground/60">
                {tooltipData.childCount} items
              </div>
            )}
            <div className="text-xs text-muted-foreground/40 truncate max-w-[200px]">
              {tooltipData.path}
            </div>
          </div>
        </TooltipWithBounds>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-4 py-3 text-xs border-t border-white/[0.05]">
        {[
          { category: 'applications', label: 'Apps' },
          { category: 'documents', label: 'Docs' },
          { category: 'media', label: 'Media' },
          { category: 'system', label: 'System' },
          { category: 'cache', label: 'Cache' },
          { category: 'code', label: 'Code' },
          { category: 'other', label: 'Other' },
        ].map(({ category, label }) => (
          <div key={category} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: getCategoryColor(category) }}
            />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Disk Space Treemap component showing hierarchical disk usage.
 *
 * @example
 * ```tsx
 * <DiskSpaceTreemap
 *   height={400}
 *   onNavigate={(path) => console.log('Navigated to:', path)}
 * />
 * ```
 */
export function DiskSpaceTreemap({
  height = 400,
  onNavigate,
  className,
}: DiskSpaceTreemapProps) {
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
            <HardDrive
              className="w-4 h-4 text-primary"
              strokeWidth={1.75}
            />
          </motion.div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
              Disk Space
            </h3>
            <p className="text-xs text-muted-foreground">
              Double-click to navigate into folders
            </p>
          </div>
        </div>
      </div>

      {/* Treemap */}
      <div style={{ height }} className="relative">
        <ParentSize debounceTime={100}>
          {({ width, height: innerHeight }) => (
            <TreemapInner
              width={width}
              height={innerHeight}
              onNavigate={onNavigate}
            />
          )}
        </ParentSize>
      </div>
    </motion.div>
  );
}

export default DiskSpaceTreemap;

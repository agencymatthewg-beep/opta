/**
 * React hook for hierarchical CPU attribution data.
 *
 * Transforms the flat process list into a hierarchical tree structure
 * suitable for flame graph visualization with Visx.
 *
 * Hierarchy structure:
 * Root (Total CPU)
 * ├── System (kernel_task, WindowServer, etc.)
 * ├── User Apps (Chrome, VS Code, etc.)
 * ├── Background (Spotlight, Time Machine, etc.)
 * └── Other (aggregated small processes)
 */

import { useMemo } from 'react';
import { useProcesses } from './useProcesses';
import type { ProcessInfo, ProcessCategory } from '../types/processes';

/**
 * Node in the CPU attribution hierarchy.
 */
export interface CpuAttributionNode {
  /** Display name for this node */
  name: string;
  /** CPU percentage (0-100) */
  value: number;
  /** Child nodes (processes or subcategories) */
  children?: CpuAttributionNode[];
  /** Color for visualization (CSS variable or hex) */
  color?: string;
  /** Process ID (only for leaf nodes) */
  pid?: number;
  /** Category for grouping */
  category?: string;
}

/**
 * Return type for the useProcessCpuAttribution hook.
 */
export interface UseProcessCpuAttributionReturn {
  /** Root node of the CPU attribution tree */
  root: CpuAttributionNode;
  /** Total CPU usage across all processes */
  totalCpu: number;
  /** Whether data is still loading */
  loading: boolean;
  /** Error message if any */
  error: string | null;
}

/**
 * Category configuration with colors matching design system.
 */
const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  system: {
    label: 'System',
    color: 'hsl(var(--muted-foreground))', // Gray for system processes
  },
  user: {
    label: 'User Apps',
    color: 'hsl(var(--primary))', // Purple for user apps
  },
  'safe-to-kill': {
    label: 'Background',
    color: 'hsl(var(--warning))', // Amber for killable processes
  },
  other: {
    label: 'Other',
    color: 'hsl(var(--secondary))', // Muted purple for aggregated
  },
};

/**
 * Minimum CPU threshold to include a process (noise reduction).
 * Processes below this are aggregated into "Other".
 */
const MIN_CPU_THRESHOLD = 0.1;

/**
 * Maximum number of processes to show per category before aggregating.
 */
const MAX_PROCESSES_PER_CATEGORY = 10;

/**
 * Groups processes by their category and creates attribution nodes.
 */
function groupProcessesByCategory(
  processes: ProcessInfo[]
): Map<ProcessCategory | 'other', ProcessInfo[]> {
  const groups = new Map<ProcessCategory | 'other', ProcessInfo[]>();

  // Initialize groups
  groups.set('system', []);
  groups.set('user', []);
  groups.set('safe-to-kill', []);
  groups.set('other', []);

  for (const process of processes) {
    // Filter out noise (very low CPU usage)
    if (process.cpu_percent < MIN_CPU_THRESHOLD) {
      const others = groups.get('other')!;
      others.push(process);
      continue;
    }

    const group = groups.get(process.category);
    if (group) {
      group.push(process);
    }
  }

  // Sort each group by CPU usage (highest first)
  for (const [, group] of groups) {
    group.sort((a, b) => b.cpu_percent - a.cpu_percent);
  }

  return groups;
}

/**
 * Creates a category node with its process children.
 */
function createCategoryNode(
  category: string,
  processes: ProcessInfo[],
  config: { label: string; color: string }
): CpuAttributionNode | null {
  // Take top processes, aggregate the rest
  const topProcesses = processes.slice(0, MAX_PROCESSES_PER_CATEGORY);
  const aggregatedProcesses = processes.slice(MAX_PROCESSES_PER_CATEGORY);

  // Calculate totals
  const topCpu = topProcesses.reduce((sum, p) => sum + p.cpu_percent, 0);
  const aggregatedCpu = aggregatedProcesses.reduce(
    (sum, p) => sum + p.cpu_percent,
    0
  );
  const totalCpu = topCpu + aggregatedCpu;

  // Skip empty categories
  if (totalCpu === 0 && processes.length === 0) {
    return null;
  }

  // Create children from top processes
  const children: CpuAttributionNode[] = topProcesses.map((p) => ({
    name: p.name,
    value: p.cpu_percent,
    pid: p.pid,
    color: config.color,
    category,
  }));

  // Add aggregated node if there are more processes
  if (aggregatedProcesses.length > 0 && aggregatedCpu > 0) {
    children.push({
      name: `${aggregatedProcesses.length} more processes`,
      value: aggregatedCpu,
      color: config.color,
      category: 'aggregated',
    });
  }

  return {
    name: config.label,
    value: totalCpu,
    children: children.length > 0 ? children : undefined,
    color: config.color,
    category,
  };
}

/**
 * Hook to transform process list into hierarchical CPU attribution data.
 *
 * @param pollingIntervalMs - Polling interval for process data (default: 3000ms)
 * @returns CPU attribution tree structure for flame graph visualization
 *
 * @example
 * ```tsx
 * const { root, totalCpu, loading } = useProcessCpuAttribution();
 *
 * if (loading) return <Spinner />;
 *
 * return <FlameGraph data={root} />;
 * ```
 */
export function useProcessCpuAttribution(
  pollingIntervalMs: number = 3000
): UseProcessCpuAttributionReturn {
  const { processes, loading, error } = useProcesses(pollingIntervalMs);

  const { root, totalCpu } = useMemo(() => {
    // Default empty state
    if (!processes || processes.length === 0) {
      return {
        root: {
          name: 'CPU',
          value: 0,
          children: [],
          color: 'hsl(var(--primary))',
        },
        totalCpu: 0,
      };
    }

    // Group processes by category
    const groups = groupProcessesByCategory(processes);

    // Create category nodes
    const categoryNodes: CpuAttributionNode[] = [];

    // Add categories in specific order for consistent display
    const categoryOrder: (ProcessCategory | 'other')[] = [
      'system',
      'user',
      'safe-to-kill',
      'other',
    ];

    for (const category of categoryOrder) {
      const categoryProcesses = groups.get(category) || [];
      const config =
        CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;

      const node = createCategoryNode(category, categoryProcesses, config);
      if (node && node.value > 0) {
        categoryNodes.push(node);
      }
    }

    // Calculate total CPU
    const total = categoryNodes.reduce((sum, node) => sum + node.value, 0);

    // Create root node
    const rootNode: CpuAttributionNode = {
      name: 'CPU',
      value: total,
      children: categoryNodes,
      color: 'hsl(var(--primary))',
    };

    return {
      root: rootNode,
      totalCpu: total,
    };
  }, [processes]);

  return {
    root,
    totalCpu,
    loading,
    error,
  };
}

export default useProcessCpuAttribution;

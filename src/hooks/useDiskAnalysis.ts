/**
 * Hook for disk analysis data with navigation support.
 *
 * Fetches hierarchical disk usage data from the backend and provides
 * navigation capabilities for drilling into directories.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Represents a node in the disk analysis tree.
 */
export interface DiskNode {
  name: string;
  path: string;
  size: number; // bytes
  category: string; // applications, documents, media, cache, system, code, other
  children?: DiskNode[];
  error?: string;
}

/**
 * Return type for useDiskAnalysis hook.
 */
export interface UseDiskAnalysisReturn {
  /** Root node of the current view */
  root: DiskNode | null;
  /** Whether data is being loaded */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Refresh the current view */
  refresh: () => Promise<void>;
  /** Current path being viewed */
  currentPath: string;
  /** Navigate into a directory */
  navigateTo: (path: string) => void;
  /** Navigate up one level */
  navigateUp: () => void;
  /** Breadcrumb trail of paths */
  breadcrumbs: string[];
  /** Whether currently refreshing (vs initial load) */
  refreshing: boolean;
}

// In-memory cache for fetched directories
const directoryCache = new Map<string, { data: DiskNode; timestamp: number }>();
const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Format bytes into human-readable size.
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Get parent path from a path string.
 */
function getParentPath(path: string): string {
  // Handle Windows paths
  if (path.includes('\\')) {
    const parts = path.split('\\').filter(Boolean);
    if (parts.length <= 1) return path; // Already at root
    return parts.slice(0, -1).join('\\') + '\\';
  }

  // Handle Unix paths
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 0) return '/';
  return '/' + parts.slice(0, -1).join('/');
}

/**
 * Build breadcrumb trail from path.
 */
function buildBreadcrumbs(path: string): string[] {
  const breadcrumbs: string[] = [];

  if (path.includes('\\')) {
    // Windows paths
    const parts = path.split('\\').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current += part + '\\';
      breadcrumbs.push(current);
    }
  } else {
    // Unix paths
    breadcrumbs.push('/');
    const parts = path.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current += '/' + part;
      breadcrumbs.push(current);
    }
  }

  return breadcrumbs;
}

/**
 * Hook to fetch and navigate disk analysis data.
 *
 * @param initialPath - Starting path to analyze (default "/")
 * @param maxDepth - Maximum depth to traverse (default 2)
 * @returns Disk analysis data with navigation functions
 *
 * @example
 * ```tsx
 * const { root, loading, navigateTo, breadcrumbs } = useDiskAnalysis();
 *
 * if (loading) return <Spinner />;
 *
 * return (
 *   <Treemap
 *     data={root}
 *     onDoubleClick={(path) => navigateTo(path)}
 *   />
 * );
 * ```
 */
export function useDiskAnalysis(
  initialPath: string = '/',
  maxDepth: number = 2
): UseDiskAnalysisReturn {
  const [root, setRoot] = useState<DiskNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>(['/']);

  // Track if component is mounted
  const mountedRef = useRef(true);

  const fetchDiskAnalysis = useCallback(async (path: string, forceRefresh: boolean = false) => {
    // Check cache first
    const cacheKey = `${path}:${maxDepth}`;
    if (!forceRefresh) {
      const cached = directoryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        if (mountedRef.current) {
          setRoot(cached.data);
          setError(null);
        }
        return;
      }
    }

    try {
      const data = await invoke<DiskNode>('get_disk_analysis', {
        path,
        maxDepth,
      });

      // Cache the result
      directoryCache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      });

      if (mountedRef.current) {
        setRoot(data);
        setError(null);
      }
    } catch (e) {
      if (mountedRef.current) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setError(errorMessage);
        console.error('Disk analysis fetch error:', errorMessage);
      }
    }
  }, [maxDepth]);

  // Initial fetch and path changes
  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    setBreadcrumbs(buildBreadcrumbs(currentPath));

    fetchDiskAnalysis(currentPath).finally(() => {
      if (mountedRef.current) {
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
    };
  }, [currentPath, fetchDiskAnalysis]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDiskAnalysis(currentPath, true);
    if (mountedRef.current) {
      setRefreshing(false);
    }
  }, [currentPath, fetchDiskAnalysis]);

  const navigateTo = useCallback((path: string) => {
    // Don't navigate to aggregated/other nodes
    if (path.includes('__other__') || path.includes('__aggregated__')) {
      return;
    }
    setCurrentPath(path);
  }, []);

  const navigateUp = useCallback(() => {
    const parentPath = getParentPath(currentPath);
    if (parentPath !== currentPath) {
      setCurrentPath(parentPath);
    }
  }, [currentPath]);

  return {
    root,
    loading,
    error,
    refresh,
    currentPath,
    navigateTo,
    navigateUp,
    breadcrumbs,
    refreshing,
  };
}

export default useDiskAnalysis;

/**
 * Hook for personalized optimization recommendations.
 *
 * Provides intelligent recommendations based on system state
 * and user context using content-based filtering.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

export type RecommendationType =
  | 'performance'
  | 'power_saving'
  | 'cooling'
  | 'memory'
  | 'storage'
  | 'gaming'
  | 'productivity';

export type RecommendationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface RecommendationAction {
  action: string;
  label: string;
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  title: string;
  description: string;
  impactEstimate: string;
  confidence: number;
  actions: RecommendationAction[];
  reasons: string[];
  createdAt: number;
}

export interface UserContext {
  primaryUse: 'gaming' | 'productivity' | 'mixed';
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredStyle: 'conservative' | 'balanced' | 'aggressive';
  thermalSensitivity: 'cool' | 'balanced' | 'performance';
}

interface UseSmartRecommendationsOptions {
  /** Whether to auto-generate recommendations (default true) */
  autoGenerate?: boolean;
  /** Interval for generating recommendations in ms (default 30000) */
  generateInterval?: number;
  /** Maximum recommendations to show (default 5) */
  maxRecommendations?: number;
}

export function useSmartRecommendations(options: UseSmartRecommendationsOptions = {}) {
  const {
    autoGenerate = true,
    generateInterval = 30000, // 30 seconds
    maxRecommendations = 5,
  } = options;

  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [userContext, setUserContextState] = useState<UserContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Set user context for personalization
   */
  const setUserContext = useCallback(async (context: Partial<UserContext>) => {
    try {
      await invoke('call_mcp_tool', {
        tool: 'set_recommendation_context',
        args: {
          primary_use: context.primaryUse || 'mixed',
          expertise_level: context.expertiseLevel || 'intermediate',
          preferred_style: context.preferredStyle || 'balanced',
          thermal_sensitivity: context.thermalSensitivity || 'balanced',
        },
      });
      setUserContextState(prev => ({
        primaryUse: context.primaryUse || prev?.primaryUse || 'mixed',
        expertiseLevel: context.expertiseLevel || prev?.expertiseLevel || 'intermediate',
        preferredStyle: context.preferredStyle || prev?.preferredStyle || 'balanced',
        thermalSensitivity: context.thermalSensitivity || prev?.thermalSensitivity || 'balanced',
      }));
    } catch (err) {
      console.error('Failed to set user context:', err);
    }
  }, []);

  /**
   * Generate recommendations based on current system state
   */
  const generateRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get current telemetry
      const snapshotResult = await invoke<string>('call_mcp_tool', {
        tool: 'get_system_snapshot',
        args: {},
      });
      const snapshot = JSON.parse(snapshotResult);

      // Generate recommendations
      const result = await invoke<string>('call_mcp_tool', {
        tool: 'generate_smart_recommendations',
        args: {
          cpu_percent: snapshot.cpu?.percent || 0,
          memory_percent: snapshot.memory?.percent || 0,
          disk_percent: snapshot.disk?.percent || 0,
          gpu_percent: snapshot.gpu?.utilization_percent,
          gpu_temp: snapshot.gpu?.temperature_c,
          max_recommendations: maxRecommendations,
        },
      });
      const recs = JSON.parse(result) as Recommendation[];
      setRecommendations(recs);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate recommendations';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [maxRecommendations]);

  /**
   * Dismiss a recommendation
   */
  const dismissRecommendation = useCallback(async (
    recId: string,
    helpful: boolean = false
  ) => {
    try {
      await invoke('call_mcp_tool', {
        tool: 'dismiss_recommendation',
        args: { rec_id: recId, helpful },
      });
      setRecommendations(prev => prev.filter(r => r.id !== recId));
    } catch (err) {
      console.error('Failed to dismiss recommendation:', err);
    }
  }, []);

  /**
   * Mark a recommendation as applied
   */
  const applyRecommendation = useCallback(async (recId: string) => {
    try {
      await invoke('call_mcp_tool', {
        tool: 'mark_recommendation_applied',
        args: { rec_id: recId },
      });
      setRecommendations(prev => prev.filter(r => r.id !== recId));
    } catch (err) {
      console.error('Failed to mark recommendation applied:', err);
    }
  }, []);

  /**
   * Execute a recommendation action
   */
  const executeAction = useCallback(async (action: RecommendationAction) => {
    // Handle common actions
    switch (action.action) {
      case 'stealth_mode':
        await invoke('call_mcp_tool', {
          tool: 'stealth_mode',
          args: {},
        });
        break;
      case 'view_processes':
        // Navigate to processes page
        window.location.hash = '#/processes';
        break;
      case 'view_disk':
        // Navigate to storage visualization
        window.location.hash = '#/storage';
        break;
      default:
        console.log(`Action not implemented: ${action.action}`);
    }
  }, []);

  /**
   * Start auto-generating recommendations
   */
  const startAutoGenerate = useCallback(() => {
    if (intervalRef.current) return;

    // Generate immediately
    generateRecommendations();

    // Then continue at interval
    intervalRef.current = setInterval(generateRecommendations, generateInterval);
  }, [generateRecommendations, generateInterval]);

  /**
   * Stop auto-generating
   */
  const stopAutoGenerate = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Auto-start if enabled
  useEffect(() => {
    if (autoGenerate) {
      startAutoGenerate();
    }
    return () => stopAutoGenerate();
  }, [autoGenerate, startAutoGenerate, stopAutoGenerate]);

  /**
   * Get priority color class
   */
  const getPriorityColor = (priority: RecommendationPriority): string => {
    switch (priority) {
      case 'urgent':
        return 'text-danger';
      case 'high':
        return 'text-warning';
      case 'medium':
        return 'text-primary';
      case 'low':
      default:
        return 'text-muted-foreground';
    }
  };

  /**
   * Get priority badge variant
   */
  const getPriorityBadgeClass = (priority: RecommendationPriority): string => {
    switch (priority) {
      case 'urgent':
        return 'bg-danger/20 text-danger border-danger/30';
      case 'high':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'medium':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'low':
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  /**
   * Get type icon name (for Lucide)
   */
  const getTypeIcon = (type: RecommendationType): string => {
    switch (type) {
      case 'performance':
        return 'Zap';
      case 'power_saving':
        return 'Battery';
      case 'cooling':
        return 'Thermometer';
      case 'memory':
        return 'MemoryStick';
      case 'storage':
        return 'HardDrive';
      case 'gaming':
        return 'Gamepad2';
      case 'productivity':
        return 'Laptop';
      default:
        return 'Lightbulb';
    }
  };

  /**
   * Get count by priority
   */
  const counts = {
    urgent: recommendations.filter(r => r.priority === 'urgent').length,
    high: recommendations.filter(r => r.priority === 'high').length,
    medium: recommendations.filter(r => r.priority === 'medium').length,
    low: recommendations.filter(r => r.priority === 'low').length,
    total: recommendations.length,
  };

  /**
   * Check if there are urgent recommendations
   */
  const hasUrgent = counts.urgent > 0;

  return {
    recommendations,
    userContext,
    loading,
    error,
    counts,
    hasUrgent,
    setUserContext,
    generateRecommendations,
    dismissRecommendation,
    applyRecommendation,
    executeAction,
    getPriorityColor,
    getPriorityBadgeClass,
    getTypeIcon,
    startAutoGenerate,
    stopAutoGenerate,
  };
}

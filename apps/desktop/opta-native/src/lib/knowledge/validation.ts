/**
 * Phase 48: Knowledge Graph UI
 *
 * GraphValidation service for consistency checks across knowledge domains.
 */

import type {
  KnowledgeGraphData,
  GraphValidationIssue,
  GraphValidationResult,
} from '@/types/knowledgeGraph';
import { getKnowledgeGraphStore, KnowledgeGraphStore } from './store';

/**
 * GraphValidation - Validates graph consistency and integrity.
 *
 * Handles:
 * - Finding orphan nodes (no connections)
 * - Detecting circular dependencies
 * - Checking platform consistency
 * - Validating edge weights and confidence
 * - Finding missing bidirectional edges
 */
export class GraphValidation {
  private store: KnowledgeGraphStore;

  constructor(store?: KnowledgeGraphStore) {
    this.store = store ?? getKnowledgeGraphStore();
  }

  /**
   * Run all validation checks.
   */
  validate(): GraphValidationResult {
    const graphData = this.store.getGraphData();
    const issues: GraphValidationIssue[] = [];

    // Run all checks
    issues.push(...this.findOrphanNodes(graphData));
    issues.push(...this.findCircularDependencies(graphData));
    issues.push(...this.checkPlatformConsistency(graphData));
    issues.push(...this.checkWeightConsistency(graphData));
    issues.push(...this.findMissingEdges(graphData));

    // Calculate statistics
    const orphanCount = issues.filter(i => i.type === 'orphan_node').length;
    const circularCount = issues.filter(i => i.type === 'circular_dependency').length;

    const nodeEdgeCount = new Map<string, number>();
    for (const edge of graphData.edges) {
      nodeEdgeCount.set(edge.source, (nodeEdgeCount.get(edge.source) ?? 0) + 1);
      nodeEdgeCount.set(edge.target, (nodeEdgeCount.get(edge.target) ?? 0) + 1);
    }

    const edgeCounts = Array.from(nodeEdgeCount.values());
    const averageConnectivity = edgeCounts.length > 0
      ? edgeCounts.reduce((a, b) => a + b, 0) / edgeCounts.length
      : 0;

    return {
      isValid: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      stats: {
        totalNodes: graphData.nodes.length,
        totalEdges: graphData.edges.length,
        orphanNodes: orphanCount,
        circularDependencies: circularCount,
        averageConnectivity,
      },
    };
  }

  /**
   * Find nodes with no connections (orphans).
   */
  findOrphanNodes(graphData: KnowledgeGraphData): GraphValidationIssue[] {
    const issues: GraphValidationIssue[] = [];
    const connectedNodes = new Set<string>();

    for (const edge of graphData.edges) {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    }

    for (const node of graphData.nodes) {
      if (!connectedNodes.has(node.id)) {
        issues.push({
          severity: 'warning',
          type: 'orphan_node',
          nodeIds: [node.id],
          edgeIds: [],
          message: `Node "${node.label}" (${node.id}) has no connections`,
          suggestion: `Consider connecting this ${node.type} node to related nodes or removing it if no longer needed`,
        });
      }
    }

    return issues;
  }

  /**
   * Detect circular dependencies in 'requires' relationships.
   */
  findCircularDependencies(graphData: KnowledgeGraphData): GraphValidationIssue[] {
    const issues: GraphValidationIssue[] = [];
    const requiresEdges = graphData.edges.filter(e => e.type === 'requires');

    // Build adjacency list for requires relationships
    const requiresGraph = new Map<string, string[]>();
    for (const edge of requiresEdges) {
      const sources = requiresGraph.get(edge.source) ?? [];
      sources.push(edge.target);
      requiresGraph.set(edge.source, sources);
    }

    // DFS to find cycles
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycleNodes: string[] = [];

    const hasCycle = (nodeId: string, path: string[]): boolean => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = requiresGraph.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor, [...path, neighbor])) {
            return true;
          }
        } else if (recStack.has(neighbor)) {
          // Found cycle
          cycleNodes.push(...path.slice(path.indexOf(neighbor)));
          return true;
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const nodeId of requiresGraph.keys()) {
      if (!visited.has(nodeId)) {
        if (hasCycle(nodeId, [nodeId])) {
          const uniqueCycleNodes = [...new Set(cycleNodes)];
          const cycleEdges = requiresEdges
            .filter(e => uniqueCycleNodes.includes(e.source) && uniqueCycleNodes.includes(e.target))
            .map(e => e.id);

          issues.push({
            severity: 'error',
            type: 'circular_dependency',
            nodeIds: uniqueCycleNodes,
            edgeIds: cycleEdges,
            message: `Circular dependency detected in "requires" relationships`,
            suggestion: 'Remove one of the requires edges to break the cycle',
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check platform consistency between connected nodes.
   */
  checkPlatformConsistency(graphData: KnowledgeGraphData): GraphValidationIssue[] {
    const issues: GraphValidationIssue[] = [];
    const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));

    for (const edge of graphData.edges) {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);

      if (!source || !target) continue;

      // Skip if either node has no platform restrictions
      if (!source.platforms?.length || !target.platforms?.length) continue;

      // Check if platforms overlap
      const commonPlatforms = source.platforms.filter(p => target.platforms!.includes(p));

      if (commonPlatforms.length === 0) {
        issues.push({
          severity: 'warning',
          type: 'platform_mismatch',
          nodeIds: [source.id, target.id],
          edgeIds: [edge.id],
          message: `Platform mismatch: "${source.label}" (${source.platforms.join(', ')}) connected to "${target.label}" (${target.platforms.join(', ')})`,
          suggestion: 'Verify this relationship is valid across platforms or add platform conditions',
        });
      }
    }

    return issues;
  }

  /**
   * Check weight consistency for edges.
   */
  checkWeightConsistency(graphData: KnowledgeGraphData): GraphValidationIssue[] {
    const issues: GraphValidationIssue[] = [];

    for (const edge of graphData.edges) {
      // Weight should be between 0 and 1
      if (edge.weight < 0 || edge.weight > 1) {
        issues.push({
          severity: 'warning',
          type: 'inconsistent_weight',
          nodeIds: [edge.source, edge.target],
          edgeIds: [edge.id],
          message: `Edge weight ${edge.weight} is outside valid range [0, 1]`,
          suggestion: 'Normalize the weight to be between 0 and 1',
        });
      }

      // Confidence should be between 0 and 1
      if (edge.confidence < 0 || edge.confidence > 1) {
        issues.push({
          severity: 'warning',
          type: 'inconsistent_weight',
          nodeIds: [edge.source, edge.target],
          edgeIds: [edge.id],
          message: `Edge confidence ${edge.confidence} is outside valid range [0, 1]`,
          suggestion: 'Normalize the confidence to be between 0 and 1',
        });
      }

      // Conflict edges should have high weight (they're important)
      if (edge.type === 'conflicts_with' && edge.weight < 0.5) {
        issues.push({
          severity: 'info',
          type: 'inconsistent_weight',
          nodeIds: [edge.source, edge.target],
          edgeIds: [edge.id],
          message: `Conflict edge has low weight (${edge.weight})`,
          suggestion: 'Consider if this is truly a conflict or just a minor degradation',
        });
      }
    }

    return issues;
  }

  /**
   * Find potentially missing edges based on patterns.
   */
  findMissingEdges(graphData: KnowledgeGraphData): GraphValidationIssue[] {
    const issues: GraphValidationIssue[] = [];
    const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));
    const edgeSet = new Set(graphData.edges.map(e => `${e.source}:${e.target}`));

    // Check for RT settings without RT enabled connection
    const rtSettings = graphData.nodes.filter(n => n.id.startsWith('setting:rt:') && n.id !== 'setting:rt:enabled');
    const rtEnabledId = 'setting:rt:enabled';

    if (nodeMap.has(rtEnabledId)) {
      for (const rtSetting of rtSettings) {
        const hasRequires = edgeSet.has(`${rtEnabledId}:${rtSetting.id}`) ||
                           edgeSet.has(`${rtSetting.id}:${rtEnabledId}`);

        if (!hasRequires) {
          issues.push({
            severity: 'info',
            type: 'missing_edge',
            nodeIds: [rtSetting.id, rtEnabledId],
            edgeIds: [],
            message: `RT setting "${rtSetting.label}" may need a "requires" edge to RT Enabled`,
            suggestion: 'Add a "requires" edge if this setting needs RT to be enabled',
          });
        }
      }
    }

    // Check for upscaling technologies without platform-specific edges
    const upscalingNodes = graphData.nodes.filter(n => n.category === 'upscaling');
    const platformNodes = graphData.nodes.filter(n => n.type === 'platform');

    for (const upscaling of upscalingNodes) {
      if (!upscaling.platforms?.length) continue;

      for (const platform of platformNodes) {
        const platformName = platform.label.toLowerCase();
        if (upscaling.platforms.includes(platformName)) {
          const hasEdge = edgeSet.has(`${upscaling.id}:${platform.id}`) ||
                         edgeSet.has(`${platform.id}:${upscaling.id}`);

          if (!hasEdge) {
            issues.push({
              severity: 'info',
              type: 'missing_edge',
              nodeIds: [upscaling.id, platform.id],
              edgeIds: [],
              message: `"${upscaling.label}" supports ${platform.label} but has no edge`,
              suggestion: 'Consider adding a "supports" or "belongs_to" edge for platform association',
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Fix common issues automatically.
   */
  autoFix(issues: GraphValidationIssue[]): number {
    let fixedCount = 0;

    for (const issue of issues) {
      // Only auto-fix certain issue types
      if (issue.type === 'inconsistent_weight') {
        for (const edgeId of issue.edgeIds) {
          const edge = this.store.getEdge(edgeId);
          if (edge) {
            // Clamp weights to valid range
            const clampedWeight = Math.max(0, Math.min(1, edge.weight));
            const clampedConfidence = Math.max(0, Math.min(1, edge.confidence));

            if (edge.weight !== clampedWeight || edge.confidence !== clampedConfidence) {
              // Note: Would need to add an updateEdge method to store
              // For now, we just count potential fixes
              fixedCount++;
            }
          }
        }
      }
    }

    return fixedCount;
  }

  /**
   * Get a summary of the validation results.
   */
  getSummary(result: GraphValidationResult): string {
    const { isValid, issues, stats } = result;

    const lines = [
      `Graph Validation ${isValid ? 'PASSED' : 'FAILED'}`,
      ``,
      `Statistics:`,
      `  - Total Nodes: ${stats.totalNodes}`,
      `  - Total Edges: ${stats.totalEdges}`,
      `  - Orphan Nodes: ${stats.orphanNodes}`,
      `  - Circular Dependencies: ${stats.circularDependencies}`,
      `  - Avg Connectivity: ${stats.averageConnectivity.toFixed(2)}`,
    ];

    if (issues.length > 0) {
      lines.push(``);
      lines.push(`Issues Found: ${issues.length}`);

      const errors = issues.filter(i => i.severity === 'error');
      const warnings = issues.filter(i => i.severity === 'warning');
      const infos = issues.filter(i => i.severity === 'info');

      if (errors.length > 0) lines.push(`  - Errors: ${errors.length}`);
      if (warnings.length > 0) lines.push(`  - Warnings: ${warnings.length}`);
      if (infos.length > 0) lines.push(`  - Info: ${infos.length}`);
    }

    return lines.join('\n');
  }
}

// Singleton instance
let validationInstance: GraphValidation | null = null;

/**
 * Get the GraphValidation singleton instance.
 */
export function getGraphValidation(): GraphValidation {
  if (!validationInstance) {
    validationInstance = new GraphValidation();
  }
  return validationInstance;
}

/**
 * Phase 48: Knowledge Graph UI
 *
 * GraphQueryEngine provides lookup methods for optimization paths
 * and graph traversal.
 */

import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeNodeType,
  KnowledgeEdgeType,
  GraphQueryResult,
  GraphPath,
  OptimizationPath,
  GraphFilter,
} from '@/types/knowledgeGraph';
import { DEFAULT_GRAPH_FILTER } from '@/types/knowledgeGraph';
import { getKnowledgeGraphStore, KnowledgeGraphStore } from './store';

/**
 * GraphQueryEngine - Query and traverse the knowledge graph.
 *
 * Handles:
 * - Finding shortest paths between nodes
 * - Finding optimization paths for games/hardware
 * - Filtering and searching the graph
 * - Finding related nodes and patterns
 */
export class GraphQueryEngine {
  private store: KnowledgeGraphStore;

  constructor(store?: KnowledgeGraphStore) {
    this.store = store ?? getKnowledgeGraphStore();
  }

  /**
   * Search nodes by query string.
   */
  searchNodes(query: string, filter?: Partial<GraphFilter>): GraphQueryResult {
    const start = performance.now();
    const normalizedQuery = query.toLowerCase().trim();
    const fullFilter = { ...DEFAULT_GRAPH_FILTER, ...filter };

    const graphData = this.store.getGraphData();

    // Filter nodes
    let matchingNodes = graphData.nodes.filter(node => {
      // Type filter
      if (!fullFilter.nodeTypes.includes(node.type)) return false;

      // Platform filter
      if (node.platforms && node.platforms.length > 0) {
        if (!node.platforms.some(p => fullFilter.platforms.includes(p))) return false;
      }

      // Weight filter
      if (node.weight < fullFilter.minWeight) return false;

      // Search query
      if (normalizedQuery) {
        const searchText = `${node.label} ${node.description ?? ''} ${node.category ?? ''}`.toLowerCase();
        if (!searchText.includes(normalizedQuery)) return false;
      }

      return true;
    });

    // Get edges connecting matching nodes
    const nodeIds = new Set(matchingNodes.map(n => n.id));
    const matchingEdges = graphData.edges.filter(edge => {
      if (!fullFilter.edgeTypes.includes(edge.type)) return false;
      if (edge.confidence < fullFilter.minConfidence) return false;
      return nodeIds.has(edge.source) && nodeIds.has(edge.target);
    });

    return {
      nodes: matchingNodes,
      edges: matchingEdges,
      queryTime: performance.now() - start,
      totalResults: matchingNodes.length,
    };
  }

  /**
   * Get nodes by type with optional filtering.
   */
  getNodesByType(
    type: KnowledgeNodeType,
    filter?: Partial<GraphFilter>
  ): KnowledgeNode[] {
    const result = this.searchNodes('', { ...filter, nodeTypes: [type] });
    return result.nodes;
  }

  /**
   * Find the shortest path between two nodes using BFS.
   */
  findShortestPath(
    startId: string,
    endId: string,
    allowedEdgeTypes?: KnowledgeEdgeType[]
  ): GraphPath | null {
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: string[]; edges: KnowledgeEdge[] }> = [
      { nodeId: startId, path: [startId], edges: [] },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.nodeId === endId) {
        const nodes = current.path
          .map(id => this.store.getNode(id))
          .filter((n): n is KnowledgeNode => n !== undefined);

        return {
          nodes,
          edges: current.edges,
          totalWeight: current.edges.reduce((sum, e) => sum + e.weight, 0),
          description: `Path from ${nodes[0]?.label} to ${nodes[nodes.length - 1]?.label}`,
        };
      }

      if (visited.has(current.nodeId)) continue;
      visited.add(current.nodeId);

      const edges = this.store.getEdgesForNode(current.nodeId);
      for (const edge of edges) {
        // Filter by allowed edge types
        if (allowedEdgeTypes && !allowedEdgeTypes.includes(edge.type)) continue;

        const neighborId = edge.source === current.nodeId ? edge.target : edge.source;

        // Only traverse in the right direction for non-bidirectional edges
        if (!edge.bidirectional && edge.source !== current.nodeId) continue;

        if (!visited.has(neighborId)) {
          queue.push({
            nodeId: neighborId,
            path: [...current.path, neighborId],
            edges: [...current.edges, edge],
          });
        }
      }
    }

    return null;
  }

  /**
   * Find all paths between two nodes (up to a maximum length).
   */
  findAllPaths(
    startId: string,
    endId: string,
    maxLength: number = 5
  ): GraphPath[] {
    const paths: GraphPath[] = [];

    const dfs = (
      currentId: string,
      visited: Set<string>,
      currentPath: string[],
      currentEdges: KnowledgeEdge[]
    ) => {
      if (currentPath.length > maxLength) return;

      if (currentId === endId) {
        const nodes = currentPath
          .map(id => this.store.getNode(id))
          .filter((n): n is KnowledgeNode => n !== undefined);

        paths.push({
          nodes,
          edges: currentEdges,
          totalWeight: currentEdges.reduce((sum, e) => sum + e.weight, 0),
          description: `Path of length ${nodes.length - 1}`,
        });
        return;
      }

      const edges = this.store.getEdgesForNode(currentId);
      for (const edge of edges) {
        const neighborId = edge.source === currentId ? edge.target : edge.source;

        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          dfs(
            neighborId,
            visited,
            [...currentPath, neighborId],
            [...currentEdges, edge]
          );
          visited.delete(neighborId);
        }
      }
    };

    const visited = new Set([startId]);
    dfs(startId, visited, [startId], []);

    // Sort by path length (shortest first)
    return paths.sort((a, b) => a.nodes.length - b.nodes.length);
  }

  /**
   * Find the optimization path for a specific game on specific hardware.
   */
  findOptimizationPath(
    gameId?: string,
    hardwareId?: string
  ): OptimizationPath | null {
    // Start from game or find a reasonable starting point
    const startNode = gameId
      ? this.store.getNode(gameId)
      : this.store.getNodesByType('game')[0];

    if (!startNode) {
      // If no game, start from hardware
      const hwNode = hardwareId
        ? this.store.getNode(hardwareId)
        : this.store.getNodesByType('hardware')[0];

      if (!hwNode) return null;

      // Find settings supported by this hardware
      const supportedSettings = this.getRelatedNodes(hwNode.id, ['supports', 'recommends']);
      if (supportedSettings.length === 0) return null;

      const endNode = supportedSettings[0];
      const path = this.findShortestPath(hwNode.id, endNode.id);

      if (!path) return null;

      return {
        startNode: hwNode,
        endNode,
        path,
        recommendations: this.generateRecommendations(path),
        conflicts: this.findConflictsInPath(path),
        synergies: this.findSynergiesInPath(path),
      };
    }

    // Find the best settings for this game
    const relatedSettings = this.getRelatedNodes(startNode.id, ['optimizes', 'recommends']);

    if (relatedSettings.length === 0) {
      // No direct recommendations, find through categories
      const categories = this.getRelatedNodes(startNode.id, ['belongs_to']);
      for (const cat of categories) {
        const catSettings = this.getRelatedNodes(cat.id, ['belongs_to']);
        if (catSettings.length > 0) {
          relatedSettings.push(...catSettings);
        }
      }
    }

    if (relatedSettings.length === 0) return null;

    // Find the highest-weighted related setting
    const endNode = relatedSettings.sort((a, b) => b.weight - a.weight)[0];
    const path = this.findShortestPath(startNode.id, endNode.id);

    if (!path) return null;

    return {
      startNode,
      endNode,
      path,
      recommendations: this.generateRecommendations(path),
      conflicts: this.findConflictsInPath(path),
      synergies: this.findSynergiesInPath(path),
    };
  }

  /**
   * Get nodes related to a given node through specific edge types.
   */
  getRelatedNodes(
    nodeId: string,
    edgeTypes?: KnowledgeEdgeType[]
  ): KnowledgeNode[] {
    const edges = this.store.getEdgesForNode(nodeId);
    const relatedIds = new Set<string>();

    for (const edge of edges) {
      if (edgeTypes && !edgeTypes.includes(edge.type)) continue;

      if (edge.source === nodeId) {
        relatedIds.add(edge.target);
      } else if (edge.bidirectional || !edgeTypes) {
        relatedIds.add(edge.source);
      }
    }

    return Array.from(relatedIds)
      .map(id => this.store.getNode(id))
      .filter((n): n is KnowledgeNode => n !== undefined);
  }

  /**
   * Find all conflicts involving a node.
   */
  findConflicts(nodeId: string): Array<{ node: KnowledgeNode; edge: KnowledgeEdge }> {
    const edges = this.store.getEdgesForNode(nodeId);
    const conflicts: Array<{ node: KnowledgeNode; edge: KnowledgeEdge }> = [];

    for (const edge of edges) {
      if (edge.type === 'conflicts_with' || edge.type === 'degrades') {
        const otherNodeId = edge.source === nodeId ? edge.target : edge.source;
        const otherNode = this.store.getNode(otherNodeId);
        if (otherNode) {
          conflicts.push({ node: otherNode, edge });
        }
      }
    }

    return conflicts;
  }

  /**
   * Find all synergies involving a node.
   */
  findSynergies(nodeId: string): Array<{ node: KnowledgeNode; edge: KnowledgeEdge }> {
    const edges = this.store.getEdgesForNode(nodeId);
    const synergies: Array<{ node: KnowledgeNode; edge: KnowledgeEdge }> = [];

    for (const edge of edges) {
      if (edge.type === 'enhances' || edge.type === 'supports') {
        const otherNodeId = edge.source === nodeId ? edge.target : edge.source;
        const otherNode = this.store.getNode(otherNodeId);
        if (otherNode) {
          synergies.push({ node: otherNode, edge });
        }
      }
    }

    return synergies;
  }

  /**
   * Get the dependency tree for a setting.
   */
  getDependencyTree(nodeId: string, maxDepth: number = 3): KnowledgeNode[] {
    const dependencies: KnowledgeNode[] = [];
    const visited = new Set<string>();

    const traverse = (currentId: string, depth: number) => {
      if (depth > maxDepth || visited.has(currentId)) return;
      visited.add(currentId);

      const edges = this.store.getEdgesForNode(currentId);
      for (const edge of edges) {
        if (edge.type === 'requires' && edge.source === currentId) {
          const depNode = this.store.getNode(edge.target);
          if (depNode) {
            dependencies.push(depNode);
            traverse(edge.target, depth + 1);
          }
        }
      }
    };

    traverse(nodeId, 0);
    return dependencies;
  }

  /**
   * Find conflicts in a path.
   */
  private findConflictsInPath(path: GraphPath): KnowledgeEdge[] {
    return path.edges.filter(
      e => e.type === 'conflicts_with' || e.type === 'degrades'
    );
  }

  /**
   * Find synergies in a path.
   */
  private findSynergiesInPath(path: GraphPath): KnowledgeEdge[] {
    return path.edges.filter(
      e => e.type === 'enhances' || e.type === 'supports'
    );
  }

  /**
   * Generate recommendations from a path.
   */
  private generateRecommendations(path: GraphPath): string[] {
    const recommendations: string[] = [];

    for (const edge of path.edges) {
      if (edge.description) {
        recommendations.push(edge.description);
      }

      if (edge.type === 'requires') {
        const source = path.nodes.find(n => n.id === edge.source);
        const target = path.nodes.find(n => n.id === edge.target);
        if (source && target) {
          recommendations.push(`${source.label} requires ${target.label} to be enabled`);
        }
      }

      if (edge.type === 'enhances') {
        const source = path.nodes.find(n => n.id === edge.source);
        const target = path.nodes.find(n => n.id === edge.target);
        if (source && target) {
          recommendations.push(`Enable ${source.label} to enhance ${target.label}`);
        }
      }
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Get graph statistics.
   */
  getStatistics(): {
    nodeCount: number;
    edgeCount: number;
    nodesByType: Record<string, number>;
    edgesByType: Record<string, number>;
    averageConnectivity: number;
    mostConnectedNodes: KnowledgeNode[];
  } {
    const graphData = this.store.getGraphData();

    const nodesByType: Record<string, number> = {};
    const edgesByType: Record<string, number> = {};
    const connectivity: Map<string, number> = new Map();

    for (const node of graphData.nodes) {
      nodesByType[node.type] = (nodesByType[node.type] ?? 0) + 1;
      connectivity.set(node.id, 0);
    }

    for (const edge of graphData.edges) {
      edgesByType[edge.type] = (edgesByType[edge.type] ?? 0) + 1;
      connectivity.set(edge.source, (connectivity.get(edge.source) ?? 0) + 1);
      connectivity.set(edge.target, (connectivity.get(edge.target) ?? 0) + 1);
    }

    const connectivityValues = Array.from(connectivity.values());
    const averageConnectivity = connectivityValues.length > 0
      ? connectivityValues.reduce((a, b) => a + b, 0) / connectivityValues.length
      : 0;

    // Find most connected nodes
    const sortedByConnectivity = Array.from(connectivity.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const mostConnectedNodes = sortedByConnectivity
      .map(([id]) => this.store.getNode(id))
      .filter((n): n is KnowledgeNode => n !== undefined);

    return {
      nodeCount: graphData.nodes.length,
      edgeCount: graphData.edges.length,
      nodesByType,
      edgesByType,
      averageConnectivity,
      mostConnectedNodes,
    };
  }
}

// Singleton instance
let queryEngineInstance: GraphQueryEngine | null = null;

/**
 * Get the GraphQueryEngine singleton instance.
 */
export function getGraphQueryEngine(): GraphQueryEngine {
  if (!queryEngineInstance) {
    queryEngineInstance = new GraphQueryEngine();
  }
  return queryEngineInstance;
}

/**
 * Phase 48: Knowledge Graph UI
 *
 * useKnowledgeGraph hook - React hook for interacting with the
 * optimization knowledge graph.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';

import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphData,
  GraphQueryResult,
  OptimizationPath,
  GraphFilter,
  GraphValidationResult,
} from '@/types/knowledgeGraph';
import { DEFAULT_GRAPH_FILTER } from '@/types/knowledgeGraph';
import {
  getKnowledgeGraphStore,
  getGraphQueryEngine,
  getGraphValidation,
} from '@/lib/knowledge';
import { getConfigCalculator } from '@/lib/calculator';
import { getProfileStore } from '@/lib/profiles';

interface UseKnowledgeGraphReturn {
  // Graph data
  graphData: KnowledgeGraphData | null;
  filteredData: GraphQueryResult | null;
  isLoading: boolean;

  // Selection state
  selectedNode: KnowledgeNode | null;
  selectedEdge: KnowledgeEdge | null;
  selectNode: (nodeId: string | null) => void;
  selectEdge: (edgeId: string | null) => void;

  // Filtering
  filter: GraphFilter;
  setFilter: (filter: Partial<GraphFilter>) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Graph operations
  findPath: (startId: string, endId: string) => OptimizationPath | null;
  getOptimizationPath: (gameId?: string, hardwareId?: string) => OptimizationPath | null;
  getRelatedNodes: (nodeId: string) => KnowledgeNode[];
  getConflicts: (nodeId: string) => Array<{ node: KnowledgeNode; edge: KnowledgeEdge }>;
  getSynergies: (nodeId: string) => Array<{ node: KnowledgeNode; edge: KnowledgeEdge }>;

  // Validation
  validate: () => GraphValidationResult;
  validationResult: GraphValidationResult | null;

  // Integration
  syncFromConfigCalculator: () => void;
  syncFromProfiles: () => void;

  // Refresh
  refresh: () => void;
}

/**
 * Hook for interacting with the optimization knowledge graph.
 */
export function useKnowledgeGraph(
  initialFilter?: Partial<GraphFilter>
): UseKnowledgeGraphReturn {
  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<KnowledgeEdge | null>(null);
  const [filter, setFilterState] = useState<GraphFilter>({
    ...DEFAULT_GRAPH_FILTER,
    ...initialFilter,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [validationResult, setValidationResult] = useState<GraphValidationResult | null>(null);

  // Load initial data
  useEffect(() => {
    const store = getKnowledgeGraphStore();
    setGraphData(store.getGraphData());
    setIsLoading(false);
  }, []);

  // Compute filtered data
  const filteredData = useMemo(() => {
    if (!graphData) return null;

    const queryEngine = getGraphQueryEngine();
    return queryEngine.searchNodes(searchQuery, filter);
  }, [graphData, searchQuery, filter]);

  // Refresh graph data
  const refresh = useCallback(() => {
    setIsLoading(true);
    const store = getKnowledgeGraphStore();
    setGraphData(store.getGraphData());
    setIsLoading(false);
  }, []);

  // Select a node
  const selectNode = useCallback((nodeId: string | null) => {
    if (nodeId === null) {
      setSelectedNode(null);
      const store = getKnowledgeGraphStore();
      store.resetVisualStates();
      refresh();
      return;
    }

    const store = getKnowledgeGraphStore();
    const node = store.getNode(nodeId);
    setSelectedNode(node ?? null);

    if (node) {
      // Highlight the node and its connections
      const neighbors = store.getNeighbors(nodeId).map(n => n.id);
      store.highlightPath([nodeId, ...neighbors]);
      refresh();
    }
  }, [refresh]);

  // Select an edge
  const selectEdge = useCallback((edgeId: string | null) => {
    if (edgeId === null) {
      setSelectedEdge(null);
      return;
    }

    const store = getKnowledgeGraphStore();
    const edge = store.getEdge(edgeId);
    setSelectedEdge(edge ?? null);

    if (edge) {
      // Highlight the connected nodes
      store.highlightPath([edge.source, edge.target]);
      refresh();
    }
  }, [refresh]);

  // Update filter
  const setFilter = useCallback((newFilter: Partial<GraphFilter>) => {
    setFilterState(prev => ({ ...prev, ...newFilter }));
  }, []);

  // Find optimization path
  const findPath = useCallback(
    (startId: string, endId: string): OptimizationPath | null => {
      const queryEngine = getGraphQueryEngine();
      const path = queryEngine.findShortestPath(startId, endId);

      if (!path) return null;

      const store = getKnowledgeGraphStore();
      const startNode = store.getNode(startId);
      const endNode = store.getNode(endId);

      if (!startNode || !endNode) return null;

      return {
        startNode,
        endNode,
        path,
        recommendations: [],
        conflicts: path.edges.filter(e => e.type === 'conflicts_with'),
        synergies: path.edges.filter(e => e.type === 'enhances'),
      };
    },
    []
  );

  // Get optimization path for a game/hardware
  const getOptimizationPath = useCallback(
    (gameId?: string, hardwareId?: string): OptimizationPath | null => {
      const queryEngine = getGraphQueryEngine();
      return queryEngine.findOptimizationPath(gameId, hardwareId);
    },
    []
  );

  // Get related nodes
  const getRelatedNodes = useCallback((nodeId: string): KnowledgeNode[] => {
    const queryEngine = getGraphQueryEngine();
    return queryEngine.getRelatedNodes(nodeId);
  }, []);

  // Get conflicts for a node
  const getConflicts = useCallback(
    (nodeId: string): Array<{ node: KnowledgeNode; edge: KnowledgeEdge }> => {
      const queryEngine = getGraphQueryEngine();
      return queryEngine.findConflicts(nodeId);
    },
    []
  );

  // Get synergies for a node
  const getSynergies = useCallback(
    (nodeId: string): Array<{ node: KnowledgeNode; edge: KnowledgeEdge }> => {
      const queryEngine = getGraphQueryEngine();
      return queryEngine.findSynergies(nodeId);
    },
    []
  );

  // Validate the graph
  const validate = useCallback((): GraphValidationResult => {
    const validation = getGraphValidation();
    const result = validation.validate();
    setValidationResult(result);
    return result;
  }, []);

  // Sync from ConfigCalculator
  const syncFromConfigCalculator = useCallback(() => {
    const store = getKnowledgeGraphStore();
    const calculator = getConfigCalculator();

    // Import constraints as relationships
    const constraints = calculator.getConstraints();

    for (const constraint of constraints) {
      // Add setting node
      const settingId = `setting:${constraint.category}:${constraint.setting}`;
      if (!store.getNode(settingId)) {
        store.addNode({
          id: settingId,
          type: 'setting',
          label: constraint.setting,
          category: constraint.category,
          weight: constraint.weight,
          visualState: 'normal',
        });
      }

      // Add dependency edges
      if (constraint.constraintType === 'depends_on' && constraint.dependsOn) {
        const depId = `setting:${constraint.dependsOn.category}:${constraint.dependsOn.setting}`;

        if (!store.getNode(depId)) {
          store.addNode({
            id: depId,
            type: 'setting',
            label: constraint.dependsOn.setting,
            category: constraint.dependsOn.category,
            weight: 0.7,
            visualState: 'normal',
          });
        }

        const edgeId = `constraint:${settingId}:${depId}`;
        if (!store.getEdge(edgeId)) {
          store.addEdge({
            id: edgeId,
            source: settingId,
            target: depId,
            type: 'requires',
            weight: constraint.weight,
            description: constraint.reason,
            bidirectional: false,
            confidence: 0.9,
            active: false,
          });
        }
      }
    }

    refresh();
  }, [refresh]);

  // Sync from ProfileStore
  const syncFromProfiles = useCallback(() => {
    const graphStore = getKnowledgeGraphStore();
    const profileStore = getProfileStore();

    const profiles = profileStore.getProfiles();
    graphStore.importProfiles(profiles);

    refresh();
  }, [refresh]);

  return {
    graphData,
    filteredData,
    isLoading,
    selectedNode,
    selectedEdge,
    selectNode,
    selectEdge,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    findPath,
    getOptimizationPath,
    getRelatedNodes,
    getConflicts,
    getSynergies,
    validate,
    validationResult,
    syncFromConfigCalculator,
    syncFromProfiles,
    refresh,
  };
}

/**
 * Phase 48: Knowledge Graph UI
 *
 * Types for Opta's optimization knowledge graph that maps relationships
 * between settings, hardware, and games.
 */

/**
 * Node types in the knowledge graph.
 */
export type KnowledgeNodeType =
  | 'setting'      // Game/system setting (e.g., "DLSS", "Ray Tracing")
  | 'hardware'     // Hardware component (e.g., "RTX 4090", "M3 Pro")
  | 'game'         // Game title (e.g., "Cyberpunk 2077")
  | 'profile'      // Optimization profile (e.g., "Gaming", "Battery Saver")
  | 'category'     // Setting category (e.g., "Graphics", "Display")
  | 'platform';    // Platform (e.g., "macOS", "Windows")

/**
 * Edge types representing relationships between nodes.
 */
export type KnowledgeEdgeType =
  | 'requires'        // A requires B to function
  | 'conflicts_with'  // A and B cannot be used together
  | 'enhances'        // A improves B's effectiveness
  | 'degrades'        // A reduces B's effectiveness
  | 'belongs_to'      // A is a member of B (categorization)
  | 'supports'        // Hardware A supports setting B
  | 'optimizes'       // Profile A optimizes for game/hardware B
  | 'recommends';     // System recommends A for B

/**
 * Visual state for a node in the graph.
 */
export type NodeVisualState =
  | 'normal'      // Default appearance
  | 'highlighted' // User is hovering/selecting
  | 'active'      // Part of active optimization path
  | 'dimmed'      // Not relevant to current focus
  | 'error';      // Has validation issues

/**
 * A node in the knowledge graph.
 */
export interface KnowledgeNode {
  /** Unique identifier */
  id: string;
  /** Node type */
  type: KnowledgeNodeType;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Icon name (Lucide icon) */
  icon?: string;
  /** Category for grouping (e.g., "graphics", "upscaling") */
  category?: string;
  /** Platform restrictions */
  platforms?: string[];
  /** Importance weight (0-1, affects visual size) */
  weight: number;
  /** Visual state */
  visualState: NodeVisualState;
  /** Position in 2D space (for visualization) */
  position?: { x: number; y: number };
  /** Velocity for physics simulation */
  velocity?: { x: number; y: number };
  /** Whether position is fixed (user pinned) */
  fixed?: boolean;
  /** Metadata for type-specific properties */
  metadata?: Record<string, unknown>;
}

/**
 * An edge connecting two nodes in the knowledge graph.
 */
export interface KnowledgeEdge {
  /** Unique identifier */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Edge type */
  type: KnowledgeEdgeType;
  /** Edge strength/weight (0-1, affects visual thickness) */
  weight: number;
  /** Human-readable description */
  description?: string;
  /** Whether this edge is bidirectional */
  bidirectional: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Whether this edge is currently active/highlighted */
  active: boolean;
  /** Platforms this relationship applies to */
  platforms?: string[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Complete graph data structure.
 */
export interface KnowledgeGraphData {
  /** All nodes in the graph */
  nodes: KnowledgeNode[];
  /** All edges in the graph */
  edges: KnowledgeEdge[];
  /** Graph metadata */
  metadata: {
    /** Graph version for migrations */
    version: number;
    /** Last updated timestamp */
    updatedAt: number;
    /** Total node count */
    nodeCount: number;
    /** Total edge count */
    edgeCount: number;
  };
}

/**
 * Query result for graph searches.
 */
export interface GraphQueryResult {
  /** Matching nodes */
  nodes: KnowledgeNode[];
  /** Edges connecting matched nodes */
  edges: KnowledgeEdge[];
  /** Query execution time (ms) */
  queryTime: number;
  /** Total results before pagination */
  totalResults: number;
}

/**
 * Path through the graph (for optimization paths).
 */
export interface GraphPath {
  /** Nodes in order */
  nodes: KnowledgeNode[];
  /** Edges connecting the nodes */
  edges: KnowledgeEdge[];
  /** Total path weight/cost */
  totalWeight: number;
  /** Path description */
  description: string;
}

/**
 * Optimization path analysis result.
 */
export interface OptimizationPath {
  /** Starting node (usually a game or use case) */
  startNode: KnowledgeNode;
  /** End node (usually an optimal setting) */
  endNode: KnowledgeNode;
  /** Path through the graph */
  path: GraphPath;
  /** Recommendations along the path */
  recommendations: string[];
  /** Conflicts to avoid */
  conflicts: KnowledgeEdge[];
  /** Synergies to leverage */
  synergies: KnowledgeEdge[];
}

/**
 * Validation issue in the graph.
 */
export interface GraphValidationIssue {
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** Issue type */
  type: 'orphan_node' | 'missing_edge' | 'circular_dependency' | 'inconsistent_weight' | 'platform_mismatch';
  /** Affected node IDs */
  nodeIds: string[];
  /** Affected edge IDs */
  edgeIds: string[];
  /** Human-readable message */
  message: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Graph validation result.
 */
export interface GraphValidationResult {
  /** Whether the graph is valid */
  isValid: boolean;
  /** List of issues found */
  issues: GraphValidationIssue[];
  /** Statistics */
  stats: {
    totalNodes: number;
    totalEdges: number;
    orphanNodes: number;
    circularDependencies: number;
    averageConnectivity: number;
  };
}

/**
 * Graph visualization options.
 */
export interface GraphVizOptions {
  /** Enable physics simulation */
  enablePhysics: boolean;
  /** Show edge labels */
  showEdgeLabels: boolean;
  /** Show node icons */
  showNodeIcons: boolean;
  /** Highlight active paths */
  highlightPaths: boolean;
  /** Node size multiplier */
  nodeSizeScale: number;
  /** Edge width multiplier */
  edgeWidthScale: number;
  /** Animation speed (0-1) */
  animationSpeed: number;
  /** Color scheme */
  colorScheme: 'default' | 'impact' | 'confidence';
}

/**
 * Graph filter configuration.
 */
export interface GraphFilter {
  /** Node types to include */
  nodeTypes: KnowledgeNodeType[];
  /** Edge types to include */
  edgeTypes: KnowledgeEdgeType[];
  /** Platforms to filter by */
  platforms: string[];
  /** Minimum weight threshold */
  minWeight: number;
  /** Minimum confidence threshold */
  minConfidence: number;
  /** Search query */
  searchQuery: string;
}

/**
 * Default graph filter (show everything).
 */
export const DEFAULT_GRAPH_FILTER: GraphFilter = {
  nodeTypes: ['setting', 'hardware', 'game', 'profile', 'category', 'platform'],
  edgeTypes: ['requires', 'conflicts_with', 'enhances', 'degrades', 'belongs_to', 'supports', 'optimizes', 'recommends'],
  platforms: ['macos', 'windows', 'linux'],
  minWeight: 0,
  minConfidence: 0,
  searchQuery: '',
};

/**
 * Default visualization options.
 */
export const DEFAULT_VIZ_OPTIONS: GraphVizOptions = {
  enablePhysics: true,
  showEdgeLabels: false,
  showNodeIcons: true,
  highlightPaths: true,
  nodeSizeScale: 1,
  edgeWidthScale: 1,
  animationSpeed: 0.5,
  colorScheme: 'default',
};

/**
 * Color mapping for node types.
 */
export const NODE_TYPE_COLORS: Record<KnowledgeNodeType, string> = {
  setting: 'hsl(265, 90%, 65%)',    // Primary purple
  hardware: 'hsl(200, 80%, 55%)',   // Blue
  game: 'hsl(160, 70%, 45%)',       // Green
  profile: 'hsl(45, 90%, 55%)',     // Amber
  category: 'hsl(280, 60%, 60%)',   // Light purple
  platform: 'hsl(0, 0%, 60%)',      // Gray
};

/**
 * Color mapping for edge types.
 */
export const EDGE_TYPE_COLORS: Record<KnowledgeEdgeType, string> = {
  requires: 'hsl(200, 70%, 50%)',      // Blue
  conflicts_with: 'hsl(0, 75%, 55%)',  // Red
  enhances: 'hsl(160, 70%, 45%)',      // Green
  degrades: 'hsl(30, 80%, 50%)',       // Orange
  belongs_to: 'hsl(0, 0%, 50%)',       // Gray
  supports: 'hsl(200, 60%, 55%)',      // Light blue
  optimizes: 'hsl(265, 70%, 60%)',     // Purple
  recommends: 'hsl(45, 80%, 55%)',     // Amber
};

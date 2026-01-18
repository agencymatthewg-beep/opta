/**
 * Phase 48: Knowledge Graph UI
 *
 * KnowledgeGraphStore manages the graph state with relationship mapping
 * between settings, hardware, and games.
 */

import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphData,
  KnowledgeNodeType,
  KnowledgeEdgeType,
  NodeVisualState,
} from '@/types/knowledgeGraph';
import type { SettingRelationship, HardwareProfile } from '@/lib/calculator/types';
import type { OptimizationProfile } from '@/lib/profiles/types';

const STORAGE_KEY = 'opta-knowledge-graph';
const GRAPH_VERSION = 1;

/**
 * KnowledgeGraphStore - Manages the optimization knowledge graph.
 *
 * Handles:
 * - Adding/removing nodes and edges
 * - Building relationships from existing data
 * - Persisting graph state
 * - Graph manipulation operations
 */
export class KnowledgeGraphStore {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private edges: Map<string, KnowledgeEdge> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();
  private reverseAdjacencyList: Map<string, Set<string>> = new Map();

  constructor() {
    this.loadFromStorage();
    if (this.nodes.size === 0) {
      this.initializeDefaultGraph();
    }
  }

  /**
   * Get the complete graph data.
   */
  getGraphData(): KnowledgeGraphData {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      metadata: {
        version: GRAPH_VERSION,
        updatedAt: Date.now(),
        nodeCount: this.nodes.size,
        edgeCount: this.edges.size,
      },
    };
  }

  /**
   * Get a node by ID.
   */
  getNode(id: string): KnowledgeNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Get an edge by ID.
   */
  getEdge(id: string): KnowledgeEdge | undefined {
    return this.edges.get(id);
  }

  /**
   * Get all nodes of a specific type.
   */
  getNodesByType(type: KnowledgeNodeType): KnowledgeNode[] {
    return Array.from(this.nodes.values()).filter(n => n.type === type);
  }

  /**
   * Get all edges of a specific type.
   */
  getEdgesByType(type: KnowledgeEdgeType): KnowledgeEdge[] {
    return Array.from(this.edges.values()).filter(e => e.type === type);
  }

  /**
   * Get neighbors of a node.
   */
  getNeighbors(nodeId: string): KnowledgeNode[] {
    const neighborIds = this.adjacencyList.get(nodeId) ?? new Set();
    return Array.from(neighborIds)
      .map(id => this.nodes.get(id))
      .filter((n): n is KnowledgeNode => n !== undefined);
  }

  /**
   * Get incoming connections to a node.
   */
  getIncomingConnections(nodeId: string): KnowledgeNode[] {
    const incomingIds = this.reverseAdjacencyList.get(nodeId) ?? new Set();
    return Array.from(incomingIds)
      .map(id => this.nodes.get(id))
      .filter((n): n is KnowledgeNode => n !== undefined);
  }

  /**
   * Get edges connected to a node.
   */
  getEdgesForNode(nodeId: string): KnowledgeEdge[] {
    return Array.from(this.edges.values()).filter(
      e => e.source === nodeId || e.target === nodeId
    );
  }

  /**
   * Add a node to the graph.
   */
  addNode(node: KnowledgeNode): void {
    this.nodes.set(node.id, node);
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, new Set());
    }
    if (!this.reverseAdjacencyList.has(node.id)) {
      this.reverseAdjacencyList.set(node.id, new Set());
    }
    this.saveToStorage();
  }

  /**
   * Remove a node and all its edges.
   */
  removeNode(nodeId: string): boolean {
    if (!this.nodes.has(nodeId)) return false;

    // Remove all edges connected to this node
    const edgesToRemove = this.getEdgesForNode(nodeId);
    for (const edge of edgesToRemove) {
      this.removeEdge(edge.id);
    }

    // Remove from adjacency lists
    this.adjacencyList.delete(nodeId);
    this.reverseAdjacencyList.delete(nodeId);

    // Remove node itself
    this.nodes.delete(nodeId);
    this.saveToStorage();
    return true;
  }

  /**
   * Add an edge to the graph.
   */
  addEdge(edge: KnowledgeEdge): void {
    // Ensure source and target nodes exist
    if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target)) {
      console.warn(`Cannot add edge: source or target node not found`);
      return;
    }

    this.edges.set(edge.id, edge);

    // Update adjacency lists
    const sourceNeighbors = this.adjacencyList.get(edge.source) ?? new Set();
    sourceNeighbors.add(edge.target);
    this.adjacencyList.set(edge.source, sourceNeighbors);

    const targetIncoming = this.reverseAdjacencyList.get(edge.target) ?? new Set();
    targetIncoming.add(edge.source);
    this.reverseAdjacencyList.set(edge.target, targetIncoming);

    // Handle bidirectional edges
    if (edge.bidirectional) {
      const targetNeighbors = this.adjacencyList.get(edge.target) ?? new Set();
      targetNeighbors.add(edge.source);
      this.adjacencyList.set(edge.target, targetNeighbors);

      const sourceIncoming = this.reverseAdjacencyList.get(edge.source) ?? new Set();
      sourceIncoming.add(edge.target);
      this.reverseAdjacencyList.set(edge.source, sourceIncoming);
    }

    this.saveToStorage();
  }

  /**
   * Remove an edge from the graph.
   */
  removeEdge(edgeId: string): boolean {
    const edge = this.edges.get(edgeId);
    if (!edge) return false;

    // Update adjacency lists
    this.adjacencyList.get(edge.source)?.delete(edge.target);
    this.reverseAdjacencyList.get(edge.target)?.delete(edge.source);

    if (edge.bidirectional) {
      this.adjacencyList.get(edge.target)?.delete(edge.source);
      this.reverseAdjacencyList.get(edge.source)?.delete(edge.target);
    }

    this.edges.delete(edgeId);
    this.saveToStorage();
    return true;
  }

  /**
   * Update a node's visual state.
   */
  setNodeVisualState(nodeId: string, state: NodeVisualState): void {
    const node = this.nodes.get(nodeId);
    if (node) {
      node.visualState = state;
      this.nodes.set(nodeId, node);
    }
  }

  /**
   * Reset all visual states to normal.
   */
  resetVisualStates(): void {
    for (const node of this.nodes.values()) {
      node.visualState = 'normal';
    }
    for (const edge of this.edges.values()) {
      edge.active = false;
    }
  }

  /**
   * Highlight a path through the graph.
   */
  highlightPath(nodeIds: string[]): void {
    this.resetVisualStates();

    // Highlight nodes in path
    for (const nodeId of nodeIds) {
      this.setNodeVisualState(nodeId, 'active');
    }

    // Highlight edges in path
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const source = nodeIds[i];
      const target = nodeIds[i + 1];
      const edge = Array.from(this.edges.values()).find(
        e => (e.source === source && e.target === target) ||
             (e.bidirectional && e.source === target && e.target === source)
      );
      if (edge) {
        edge.active = true;
      }
    }

    // Dim other nodes
    for (const node of this.nodes.values()) {
      if (node.visualState !== 'active') {
        node.visualState = 'dimmed';
      }
    }
  }

  /**
   * Import relationships from ConfigCalculator.
   */
  importFromRelationships(relationships: SettingRelationship[]): void {
    for (const rel of relationships) {
      // Create nodes for each setting in the relationship
      for (const setting of rel.settings) {
        const nodeId = `setting:${setting.category}:${setting.setting}`;
        if (!this.nodes.has(nodeId)) {
          this.addNode({
            id: nodeId,
            type: 'setting',
            label: setting.setting,
            category: setting.category,
            platforms: rel.platforms,
            weight: rel.confidence,
            visualState: 'normal',
          });
        }
      }

      // Create edges between settings
      if (rel.settings.length >= 2) {
        const edgeType: KnowledgeEdgeType = rel.type === 'synergy'
          ? (rel.direction === 'enhances' ? 'enhances' : 'degrades')
          : 'conflicts_with';

        for (let i = 0; i < rel.settings.length - 1; i++) {
          const sourceId = `setting:${rel.settings[i].category}:${rel.settings[i].setting}`;
          const targetId = `setting:${rel.settings[i + 1].category}:${rel.settings[i + 1].setting}`;

          const edgeId = `rel:${rel.id}:${i}`;
          if (!this.edges.has(edgeId)) {
            this.addEdge({
              id: edgeId,
              source: sourceId,
              target: targetId,
              type: edgeType,
              weight: rel.confidence,
              description: rel.description,
              bidirectional: rel.direction !== 'excludes',
              confidence: rel.confidence,
              active: false,
              platforms: rel.platforms,
            });
          }
        }
      }
    }
  }

  /**
   * Import hardware profile as nodes.
   */
  importHardwareProfile(profile: HardwareProfile): void {
    // Platform node
    const platformId = `platform:${profile.platform}`;
    if (!this.nodes.has(platformId)) {
      this.addNode({
        id: platformId,
        type: 'platform',
        label: profile.platform.charAt(0).toUpperCase() + profile.platform.slice(1),
        weight: 1,
        visualState: 'normal',
        icon: profile.platform === 'macos' ? 'Apple' : profile.platform === 'windows' ? 'Monitor' : 'Terminal',
      });
    }

    // GPU node
    const gpuId = `hardware:gpu:${profile.gpu.toLowerCase().replace(/\s+/g, '-')}`;
    if (!this.nodes.has(gpuId)) {
      this.addNode({
        id: gpuId,
        type: 'hardware',
        label: profile.gpu,
        category: 'gpu',
        weight: 0.9,
        visualState: 'normal',
        icon: 'Cpu',
        metadata: { vramGb: profile.vramGb },
      });

      // Link GPU to platform
      this.addEdge({
        id: `hw:${gpuId}:${platformId}`,
        source: gpuId,
        target: platformId,
        type: 'belongs_to',
        weight: 1,
        bidirectional: false,
        confidence: 1,
        active: false,
      });
    }

    // CPU node
    const cpuId = `hardware:cpu:${profile.cpu.toLowerCase().replace(/\s+/g, '-')}`;
    if (!this.nodes.has(cpuId)) {
      this.addNode({
        id: cpuId,
        type: 'hardware',
        label: profile.cpu,
        category: 'cpu',
        weight: 0.8,
        visualState: 'normal',
        icon: 'Microchip',
        metadata: { ramGb: profile.ramGb, isAppleSilicon: profile.isAppleSilicon },
      });

      // Link CPU to platform
      this.addEdge({
        id: `hw:${cpuId}:${platformId}`,
        source: cpuId,
        target: platformId,
        type: 'belongs_to',
        weight: 1,
        bidirectional: false,
        confidence: 1,
        active: false,
      });
    }
  }

  /**
   * Import optimization profiles as nodes.
   */
  importProfiles(profiles: OptimizationProfile[]): void {
    for (const profile of profiles) {
      const profileId = `profile:${profile.id}`;
      if (!this.nodes.has(profileId)) {
        this.addNode({
          id: profileId,
          type: 'profile',
          label: profile.name,
          description: profile.description,
          weight: profile.isDefault ? 0.9 : 0.7,
          visualState: 'normal',
          icon: profile.icon,
          metadata: { mode: profile.mode, tier: profile.tier },
        });
      }
    }
  }

  /**
   * Clear the entire graph.
   */
  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.adjacencyList.clear();
    this.reverseAdjacencyList.clear();
    this.saveToStorage();
  }

  /**
   * Initialize with default optimization knowledge.
   */
  private initializeDefaultGraph(): void {
    // Categories
    const categories = [
      { id: 'cat:graphics', label: 'Graphics', icon: 'Image' },
      { id: 'cat:display', label: 'Display', icon: 'Monitor' },
      { id: 'cat:upscaling', label: 'Upscaling', icon: 'Maximize' },
      { id: 'cat:rt', label: 'Ray Tracing', icon: 'Sun' },
    ];

    for (const cat of categories) {
      this.addNode({
        id: cat.id,
        type: 'category',
        label: cat.label,
        icon: cat.icon,
        weight: 0.7,
        visualState: 'normal',
      });
    }

    // Common settings
    const settings = [
      { id: 'setting:upscaling:dlss', label: 'DLSS', category: 'upscaling', platforms: ['windows'] },
      { id: 'setting:upscaling:fsr', label: 'FSR', category: 'upscaling', platforms: ['windows', 'macos', 'linux'] },
      { id: 'setting:upscaling:metalfx', label: 'MetalFX', category: 'upscaling', platforms: ['macos'] },
      { id: 'setting:upscaling:xess', label: 'XeSS', category: 'upscaling', platforms: ['windows', 'linux'] },
      { id: 'setting:rt:enabled', label: 'Ray Tracing', category: 'rt', platforms: ['windows', 'macos'] },
      { id: 'setting:rt:reflections', label: 'RT Reflections', category: 'rt', platforms: ['windows'] },
      { id: 'setting:rt:shadows', label: 'RT Shadows', category: 'rt', platforms: ['windows'] },
      { id: 'setting:rt:gi', label: 'RT Global Illumination', category: 'rt', platforms: ['windows'] },
      { id: 'setting:display:vsync', label: 'V-Sync', category: 'display', platforms: ['windows', 'macos', 'linux'] },
      { id: 'setting:display:frame-cap', label: 'Frame Cap', category: 'display', platforms: ['windows', 'macos', 'linux'] },
      { id: 'setting:graphics:textures', label: 'Texture Quality', category: 'graphics', platforms: ['windows', 'macos', 'linux'] },
      { id: 'setting:graphics:shadows', label: 'Shadow Quality', category: 'graphics', platforms: ['windows', 'macos', 'linux'] },
    ];

    for (const s of settings) {
      this.addNode({
        id: s.id,
        type: 'setting',
        label: s.label,
        category: s.category,
        platforms: s.platforms,
        weight: 0.8,
        visualState: 'normal',
      });

      // Link to category
      this.addEdge({
        id: `link:${s.id}:cat:${s.category}`,
        source: s.id,
        target: `cat:${s.category}`,
        type: 'belongs_to',
        weight: 1,
        bidirectional: false,
        confidence: 1,
        active: false,
      });
    }

    // Key relationships
    const relationships = [
      { source: 'setting:upscaling:dlss', target: 'setting:rt:enabled', type: 'enhances' as const, desc: 'DLSS Frame Generation helps offset RT performance cost' },
      { source: 'setting:rt:enabled', target: 'setting:rt:reflections', type: 'requires' as const, desc: 'RT Reflections requires RT enabled' },
      { source: 'setting:rt:enabled', target: 'setting:rt:shadows', type: 'requires' as const, desc: 'RT Shadows requires RT enabled' },
      { source: 'setting:rt:enabled', target: 'setting:rt:gi', type: 'requires' as const, desc: 'RT GI requires RT enabled' },
      { source: 'setting:display:vsync', target: 'setting:display:frame-cap', type: 'conflicts_with' as const, desc: 'V-Sync and frame cap can conflict; use one or the other' },
    ];

    for (const rel of relationships) {
      this.addEdge({
        id: `rel:${rel.source}:${rel.target}`,
        source: rel.source,
        target: rel.target,
        type: rel.type,
        weight: 0.9,
        description: rel.desc,
        bidirectional: rel.type === 'enhances',
        confidence: 0.9,
        active: false,
      });
    }

    // Platforms
    const platforms = [
      { id: 'platform:macos', label: 'macOS', icon: 'Apple' },
      { id: 'platform:windows', label: 'Windows', icon: 'Monitor' },
      { id: 'platform:linux', label: 'Linux', icon: 'Terminal' },
    ];

    for (const p of platforms) {
      this.addNode({
        id: p.id,
        type: 'platform',
        label: p.label,
        icon: p.icon,
        weight: 1,
        visualState: 'normal',
      });
    }

    this.saveToStorage();
  }

  /**
   * Save graph to localStorage.
   */
  private saveToStorage(): void {
    try {
      const data = this.getGraphData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save knowledge graph to storage:', e);
    }
  }

  /**
   * Load graph from localStorage.
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: KnowledgeGraphData = JSON.parse(stored);
        if (data.metadata.version === GRAPH_VERSION) {
          for (const node of data.nodes) {
            this.nodes.set(node.id, node);
            this.adjacencyList.set(node.id, new Set());
            this.reverseAdjacencyList.set(node.id, new Set());
          }
          for (const edge of data.edges) {
            this.edges.set(edge.id, edge);
            this.adjacencyList.get(edge.source)?.add(edge.target);
            this.reverseAdjacencyList.get(edge.target)?.add(edge.source);
            if (edge.bidirectional) {
              this.adjacencyList.get(edge.target)?.add(edge.source);
              this.reverseAdjacencyList.get(edge.source)?.add(edge.target);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load knowledge graph from storage:', e);
    }
  }
}

// Singleton instance
let storeInstance: KnowledgeGraphStore | null = null;

/**
 * Get the KnowledgeGraphStore singleton instance.
 */
export function getKnowledgeGraphStore(): KnowledgeGraphStore {
  if (!storeInstance) {
    storeInstance = new KnowledgeGraphStore();
  }
  return storeInstance;
}

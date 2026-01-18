/**
 * Phase 48: Knowledge Graph UI
 *
 * KnowledgeGraphViz - Interactive visualization of the optimization
 * knowledge graph using canvas-based force-directed layout.
 */

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Filter,
  Search,
  Info,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useLearnMode } from '@/components/LearnModeContext';
import type {
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraphData,
  GraphVizOptions,
  GraphFilter,
  KnowledgeNodeType,
} from '@/types/knowledgeGraph';
import {
  DEFAULT_VIZ_OPTIONS,
  DEFAULT_GRAPH_FILTER,
  NODE_TYPE_COLORS,
  EDGE_TYPE_COLORS,
} from '@/types/knowledgeGraph';
import { getKnowledgeGraphStore } from '@/lib/knowledge/store';
import { getGraphQueryEngine } from '@/lib/knowledge/query';

interface KnowledgeGraphVizProps {
  /** Width of the visualization */
  width?: number;
  /** Height of the visualization */
  height?: number;
  /** Initial filter */
  initialFilter?: Partial<GraphFilter>;
  /** Visualization options */
  options?: Partial<GraphVizOptions>;
  /** Callback when a node is selected */
  onNodeSelect?: (node: KnowledgeNode | null) => void;
  /** Callback when an edge is selected */
  onEdgeSelect?: (edge: KnowledgeEdge | null) => void;
  /** Whether to show the control panel */
  showControls?: boolean;
  /** Additional class name */
  className?: string;
}

// Physics constants for force simulation
const REPULSION_FORCE = 500;
const ATTRACTION_FORCE = 0.05;
const DAMPING = 0.9;
const MIN_DISTANCE = 50;

interface SimulationNode extends KnowledgeNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
}

export function KnowledgeGraphViz({
  width = 800,
  height = 600,
  initialFilter,
  options: initialOptions,
  onNodeSelect,
  onEdgeSelect: _onEdgeSelect,
  showControls = true,
  className,
}: KnowledgeGraphVizProps) {
  // Reserved for future use
  void _onEdgeSelect;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const isDraggingRef = useRef<string | null>(null);
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const [graphData, setGraphData] = useState<KnowledgeGraphData | null>(null);
  const [simulationNodes, setSimulationNodes] = useState<SimulationNode[]>([]);
  const [filter, setFilter] = useState<GraphFilter>({
    ...DEFAULT_GRAPH_FILTER,
    ...initialFilter,
  });
  const [options, setOptions] = useState<GraphVizOptions>({
    ...DEFAULT_VIZ_OPTIONS,
    ...initialOptions,
  });
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<KnowledgeNode | null>(null);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);

  const { isLearnMode } = useLearnMode();

  // Initialize graph data
  useEffect(() => {
    const store = getKnowledgeGraphStore();
    const data = store.getGraphData();
    setGraphData(data);

    // Initialize node positions randomly
    const initialNodes: SimulationNode[] = data.nodes.map((node) => ({
      ...node,
      x: node.position?.x ?? width / 2 + (Math.random() - 0.5) * width * 0.8,
      y: node.position?.y ?? height / 2 + (Math.random() - 0.5) * height * 0.8,
      vx: 0,
      vy: 0,
    }));
    setSimulationNodes(initialNodes);
  }, [width, height]);

  // Filter nodes and edges
  const filteredData = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [] };

    const queryEngine = getGraphQueryEngine();
    const result = queryEngine.searchNodes(searchQuery, filter);

    const nodeIds = new Set(result.nodes.map(n => n.id));
    const simNodes = simulationNodes.filter(n => nodeIds.has(n.id));

    return {
      nodes: simNodes,
      edges: result.edges,
    };
  }, [graphData, simulationNodes, filter, searchQuery]);

  // Run physics simulation
  useEffect(() => {
    if (!options.enablePhysics || filteredData.nodes.length === 0) return;

    const simulate = () => {
      setSimulationNodes(prevNodes => {
        const newNodes = prevNodes.map(node => ({ ...node }));
        const nodeMap = new Map(newNodes.map(n => [n.id, n]));
        const filteredIds = new Set(filteredData.nodes.map(n => n.id));

        // Only simulate visible nodes
        for (const node of newNodes) {
          if (!filteredIds.has(node.id)) continue;
          if (node.fx !== undefined && node.fy !== undefined) {
            node.x = node.fx;
            node.y = node.fy;
            continue;
          }

          // Repulsion from other nodes
          for (const other of newNodes) {
            if (node.id === other.id || !filteredIds.has(other.id)) continue;

            const dx = node.x - other.x;
            const dy = node.y - other.y;
            const dist = Math.max(Math.sqrt(dx * dx + dy * dy), MIN_DISTANCE);

            const force = REPULSION_FORCE / (dist * dist);
            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
          }

          // Attraction along edges
          for (const edge of filteredData.edges) {
            if (edge.source !== node.id && edge.target !== node.id) continue;

            const otherId = edge.source === node.id ? edge.target : edge.source;
            const other = nodeMap.get(otherId);
            if (!other) continue;

            const dx = other.x - node.x;
            const dy = other.y - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
              const force = ATTRACTION_FORCE * edge.weight;
              node.vx += dx * force;
              node.vy += dy * force;
            }
          }

          // Center gravity
          const centerDx = width / 2 - node.x;
          const centerDy = height / 2 - node.y;
          node.vx += centerDx * 0.001;
          node.vy += centerDy * 0.001;

          // Apply velocity with damping
          node.vx *= DAMPING;
          node.vy *= DAMPING;
          node.x += node.vx;
          node.y += node.vy;

          // Boundary constraints
          const padding = 50;
          node.x = Math.max(padding, Math.min(width - padding, node.x));
          node.y = Math.max(padding, Math.min(height - padding, node.y));
        }

        return newNodes;
      });

      animationRef.current = requestAnimationFrame(simulate);
    };

    animationRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [options.enablePhysics, filteredData.nodes.length, filteredData.edges, width, height]);

  // Draw the graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.save();

      // Apply pan and zoom
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      const nodeMap = new Map(filteredData.nodes.map(n => [n.id, n]));

      // Draw edges
      for (const edge of filteredData.edges) {
        const source = nodeMap.get(edge.source);
        const target = nodeMap.get(edge.target);
        if (!source || !target) continue;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);

        const edgeColor = EDGE_TYPE_COLORS[edge.type] ?? 'hsl(0, 0%, 40%)';
        ctx.strokeStyle = edge.active
          ? edgeColor
          : `${edgeColor.replace(')', ', 0.3)')}`;
        ctx.lineWidth = (edge.weight * 2 + 0.5) * options.edgeWidthScale;
        ctx.stroke();

        // Draw arrow for directed edges
        if (!edge.bidirectional) {
          const angle = Math.atan2(target.y - source.y, target.x - source.x);
          const arrowSize = 8;
          const nodeRadius = 20;
          const arrowX = target.x - Math.cos(angle) * nodeRadius;
          const arrowY = target.y - Math.sin(angle) * nodeRadius;

          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(
            arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
            arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
            arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fill();
        }

        // Draw edge labels
        if (options.showEdgeLabels && edge.description) {
          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;
          ctx.font = '10px Sora, sans-serif';
          ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.textAlign = 'center';
          ctx.fillText(edge.type.replace('_', ' '), midX, midY);
        }
      }

      // Draw nodes
      for (const node of filteredData.nodes) {
        const isHovered = hoveredNode?.id === node.id;
        const isSelected = selectedNode?.id === node.id;
        const radius = (15 + node.weight * 10) * options.nodeSizeScale;
        const nodeColor = NODE_TYPE_COLORS[node.type] ?? 'hsl(0, 0%, 50%)';

        // Node glow for hovered/selected
        if (isHovered || isSelected) {
          const gradient = ctx.createRadialGradient(
            node.x, node.y, radius,
            node.x, node.y, radius * 2
          );
          gradient.addColorStop(0, `${nodeColor.replace(')', ', 0.4)')}`);
          gradient.addColorStop(1, 'transparent');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(node.x, node.y, radius * 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);

        // Fill based on visual state
        switch (node.visualState) {
          case 'dimmed':
            ctx.fillStyle = `${nodeColor.replace(')', ', 0.3)')}`;
            break;
          case 'active':
          case 'highlighted':
            ctx.fillStyle = nodeColor;
            break;
          case 'error':
            ctx.fillStyle = 'hsl(0, 75%, 55%)';
            break;
          default:
            ctx.fillStyle = `${nodeColor.replace(')', ', 0.7)')}`;
        }
        ctx.fill();

        // Node border
        ctx.strokeStyle = isSelected
          ? 'hsl(265, 90%, 65%)'
          : isHovered
          ? 'rgba(255, 255, 255, 0.8)'
          : 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = isSelected ? 3 : isHovered ? 2 : 1;
        ctx.stroke();

        // Node label
        ctx.font = `${11 * options.nodeSizeScale}px Sora, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.label, node.x, node.y + radius + 12);
      }

      ctx.restore();
      requestAnimationFrame(draw);
    };

    draw();
  }, [
    filteredData,
    selectedNode,
    hoveredNode,
    options,
    width,
    height,
  ]);

  // Mouse event handlers
  const getMousePos = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - panRef.current.x) / zoomRef.current;
    const y = (e.clientY - rect.top - panRef.current.y) / zoomRef.current;
    return { x, y };
  }, []);

  const findNodeAtPosition = useCallback((pos: { x: number; y: number }) => {
    for (const node of filteredData.nodes) {
      const radius = (15 + node.weight * 10) * options.nodeSizeScale;
      const dx = pos.x - node.x;
      const dy = pos.y - node.y;
      if (dx * dx + dy * dy < radius * radius) {
        return node;
      }
    }
    return null;
  }, [filteredData.nodes, options.nodeSizeScale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const pos = getMousePos(e);
    const node = findNodeAtPosition(pos);

    if (node) {
      isDraggingRef.current = node.id;
      setSimulationNodes(prev =>
        prev.map(n =>
          n.id === node.id ? { ...n, fx: n.x, fy: n.y } : n
        )
      );
    } else {
      // Start panning
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    }
  }, [getMousePos, findNodeAtPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getMousePos(e);

    if (isDraggingRef.current) {
      setSimulationNodes(prev =>
        prev.map(n =>
          n.id === isDraggingRef.current
            ? { ...n, x: pos.x, y: pos.y, fx: pos.x, fy: pos.y, vx: 0, vy: 0 }
            : n
        )
      );
    } else if (e.buttons === 1) {
      // Panning
      const dx = e.clientX - lastMouseRef.current.x;
      const dy = e.clientY - lastMouseRef.current.y;
      panRef.current.x += dx;
      panRef.current.y += dy;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    } else {
      // Hover detection
      const node = findNodeAtPosition(pos);
      setHoveredNode(node);
    }
  }, [getMousePos, findNodeAtPosition]);

  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      setSimulationNodes(prev =>
        prev.map(n =>
          n.id === isDraggingRef.current
            ? { ...n, fx: undefined, fy: undefined }
            : n
        )
      );
      isDraggingRef.current = null;
    }
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const pos = getMousePos(e);
    const node = findNodeAtPosition(pos);

    setSelectedNode(node);
    onNodeSelect?.(node);

    // Highlight connected nodes
    if (node) {
      const store = getKnowledgeGraphStore();
      store.highlightPath([node.id]);
    } else {
      const store = getKnowledgeGraphStore();
      store.resetVisualStates();
    }
  }, [getMousePos, findNodeAtPosition, onNodeSelect]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, zoomRef.current * delta));
    zoomRef.current = newZoom;
    setZoom(newZoom);
  }, []);

  const handleZoomIn = () => {
    zoomRef.current = Math.min(3, zoomRef.current * 1.2);
    setZoom(zoomRef.current);
  };

  const handleZoomOut = () => {
    zoomRef.current = Math.max(0.1, zoomRef.current / 1.2);
    setZoom(zoomRef.current);
  };

  const handleReset = () => {
    panRef.current = { x: 0, y: 0 };
    zoomRef.current = 1;
    setZoom(1);
    setSelectedNode(null);
    setHoveredNode(null);

    const store = getKnowledgeGraphStore();
    store.resetVisualStates();
  };

  const toggleNodeType = (type: KnowledgeNodeType) => {
    setFilter(prev => ({
      ...prev,
      nodeTypes: prev.nodeTypes.includes(type)
        ? prev.nodeTypes.filter(t => t !== type)
        : [...prev.nodeTypes, type],
    }));
  };

  return (
    <div className={cn('relative rounded-xl overflow-hidden', className)}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="bg-[#09090b] cursor-move"
        style={{ width, height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      {/* Controls */}
      {showControls && (
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleZoomIn}
            className="glass p-2 rounded-lg"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" strokeWidth={1.75} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleZoomOut}
            className="glass p-2 rounded-lg"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" strokeWidth={1.75} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleReset}
            className="glass p-2 rounded-lg"
            title="Reset View"
          >
            <Maximize2 className="w-4 h-4" strokeWidth={1.75} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={cn('glass p-2 rounded-lg', showFilterPanel && 'bg-primary/20')}
            title="Filter"
          >
            <Filter className="w-4 h-4" strokeWidth={1.75} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOptions(prev => ({ ...prev, enablePhysics: !prev.enablePhysics }))}
            className={cn('glass p-2 rounded-lg', options.enablePhysics && 'bg-primary/20')}
            title="Toggle Physics"
          >
            <RefreshCw className={cn('w-4 h-4', options.enablePhysics && 'animate-spin')} strokeWidth={1.75} />
          </motion.button>
        </div>
      )}

      {/* Search Bar */}
      {showControls && (
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="glass-subtle flex items-center gap-2 px-3 py-2 rounded-lg">
            <Search className="w-4 h-4 text-muted-foreground" strokeWidth={1.75} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes..."
              className="bg-transparent border-none outline-none text-sm w-40"
            />
          </div>
        </div>
      )}

      {/* Filter Panel */}
      <AnimatePresence>
        {showFilterPanel && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-20 right-4 glass p-4 rounded-xl w-48"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Filter Nodes</span>
              <button onClick={() => setShowFilterPanel(false)}>
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
            <div className="space-y-2">
              {(['setting', 'hardware', 'game', 'profile', 'category', 'platform'] as KnowledgeNodeType[]).map(type => (
                <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.nodeTypes.includes(type)}
                    onChange={() => toggleNodeType(type)}
                    className="rounded border-border"
                  />
                  <span className="capitalize">{type}</span>
                  <span
                    className="w-3 h-3 rounded-full ml-auto"
                    style={{ backgroundColor: NODE_TYPE_COLORS[type] }}
                  />
                </label>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Node Info Panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 left-4 glass p-4 rounded-xl w-64"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: NODE_TYPE_COLORS[selectedNode.type] }}
                />
                <span className="font-medium">{selectedNode.label}</span>
              </div>
              <button onClick={() => setSelectedNode(null)}>
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
            <div className="text-xs text-muted-foreground mb-2 capitalize">
              {selectedNode.type}
              {selectedNode.category && ` / ${selectedNode.category}`}
            </div>
            {selectedNode.description && (
              <p className="text-sm text-muted-foreground mb-2">
                {selectedNode.description}
              </p>
            )}
            {selectedNode.platforms && selectedNode.platforms.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {selectedNode.platforms.map(p => (
                  <span
                    key={p}
                    className="text-xs px-2 py-0.5 rounded bg-white/5"
                  >
                    {p}
                  </span>
                ))}
              </div>
            )}

            {/* Learn Mode: Additional context */}
            {isLearnMode && (
              <div className="mt-3 pt-3 border-t border-border/30">
                <div className="flex items-center gap-1 text-xs text-primary mb-1">
                  <Info className="w-3 h-3" strokeWidth={1.75} />
                  <span>Learn Mode</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  This {selectedNode.type} is connected to{' '}
                  {getKnowledgeGraphStore().getEdgesForNode(selectedNode.id).length} other nodes.
                  {selectedNode.weight > 0.8 && ' It has high importance in the optimization graph.'}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="absolute bottom-4 right-4 text-xs text-muted-foreground">
        {filteredData.nodes.length} nodes / {filteredData.edges.length} edges / {(zoom * 100).toFixed(0)}%
      </div>
    </div>
  );
}

export default KnowledgeGraphViz;

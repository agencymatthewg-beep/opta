/**
 * GpuPipelineViz - Animated visualization of the GPU rendering pipeline.
 *
 * Shows GPU rendering stages and resolution impact, helping users understand
 * how resolution and quality settings affect performance.
 * Only renders when Learn Mode is active.
 */

import { motion } from 'framer-motion';

import { useLearnMode } from '@/components/LearnModeContext';
import { cn } from '@/lib/utils';
import { Triangle, Grid3X3, Sun, Image } from 'lucide-react';

interface GpuPipelineVizProps {
  resolution: { before: string; after: string };
  quality: { before: string; after: string };
  showComparison?: boolean;
}

export function GpuPipelineViz({ resolution, quality, showComparison = false }: GpuPipelineVizProps) {
  const { isLearnMode } = useLearnMode();

  if (!isLearnMode) return null;

  const stages = [
    { name: 'Geometry', desc: 'Vertices & triangles', Icon: Triangle },
    { name: 'Rasterization', desc: 'Pixels to render', Icon: Grid3X3 },
    { name: 'Shading', desc: 'Lighting & effects', Icon: Sun },
    { name: 'Output', desc: 'Final frame', Icon: Image },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="rounded-xl p-4 my-4 bg-white/[0.02] border border-white/[0.04]"
    >
      <h4 className="text-sm font-semibold mb-3">GPU Rendering Pipeline</h4>

      {/* Pipeline stages */}
      <div className="flex items-center gap-2 mb-4">
        {stages.map((stage, i) => (
          <motion.div
            key={stage.name}
            className="flex-1 text-center relative"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex items-center justify-center mb-1">
              <stage.Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
            </div>
            <div className="text-xs font-medium">{stage.name}</div>
            <div className="text-xs text-muted-foreground">{stage.desc}</div>
            {i < stages.length - 1 && (
              <motion.div
                className="absolute right-0 top-3 text-muted-foreground transform translate-x-1/2"
                animate={{ x: [0, 4, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <span className="text-xs">→</span>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Resolution impact */}
      {showComparison && (
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/30">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Before</div>
            <div className="text-sm">{resolution.before}</div>
            <div className="text-xs text-muted-foreground">{quality.before} quality</div>
            <PixelGrid pixels={16} highlighted={16} label="All pixels rendered" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">After</div>
            <div className="text-sm text-success">{resolution.after}</div>
            <div className="text-xs text-muted-foreground">{quality.after} quality</div>
            <PixelGrid pixels={16} highlighted={9} label="Fewer pixels = faster" />
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        Lower resolution = fewer pixels to process = higher FPS. The GPU renders
        at lower resolution then upscales, trading some sharpness for speed.
      </p>
    </motion.div>
  );
}

function PixelGrid({ pixels, highlighted, label }: { pixels: number; highlighted: number; label: string }) {
  return (
    <div className="mt-2">
      <div className="grid grid-cols-4 gap-0.5 w-16 mx-auto">
        {[...Array(pixels)].map((_, i) => (
          <motion.div
            key={i}
            className={cn(
              "w-3 h-3 rounded-sm",
              i < highlighted ? "bg-primary" : "bg-muted"
            )}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.02 }}
          />
        ))}
      </div>
      <div className="text-xs text-center mt-1 text-muted-foreground">{label}</div>
    </div>
  );
}

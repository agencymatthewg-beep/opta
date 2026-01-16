import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import type { OptimizationGoal } from './GoalSelector';
import type { Recommendation } from './ReviewStep';
import type { DetectedGame } from '../../types/games';
import { Loader2, Cpu, Settings, Sparkles, CheckCircle2 } from 'lucide-react';

interface AnalysisStepProps {
  game: DetectedGame;
  goal: OptimizationGoal;
  onComplete: (recommendations: Recommendation[]) => void;
}

// Analysis phases
const ANALYSIS_PHASES = [
  { id: 'game-settings', label: 'Game settings', icon: Settings },
  { id: 'system-config', label: 'System configuration', icon: Cpu },
  { id: 'optimization', label: 'Optimization potential', icon: Sparkles },
];

/**
 * Delay utility for simulating analysis progress.
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate mock recommendations based on goal and game.
 * In production, this would call the backend optimization engine.
 */
const generateRecommendations = (
  _game: DetectedGame,
  goal: OptimizationGoal
): Recommendation[] => {
  // Note: _game parameter reserved for future use when we integrate with
  // the backend optimization engine for game-specific recommendations
  const baseRecommendations: Recommendation[] = [];

  switch (goal.id) {
    case 'max-fps':
      baseRecommendations.push(
        {
          id: 'graphics-quality',
          name: 'Lower Graphics Quality',
          description: 'Reduce texture quality and shadow resolution for higher FPS',
          impactPercent: 25,
          category: 'graphics',
        },
        {
          id: 'vsync-off',
          name: 'Disable V-Sync',
          description: 'Remove frame rate cap for maximum FPS',
          impactPercent: 15,
          category: 'graphics',
        },
        {
          id: 'background-apps',
          name: 'Close Background Apps',
          description: 'Free up CPU and RAM resources',
          impactPercent: 10,
          category: 'system',
        },
        {
          id: 'power-mode',
          name: 'High Performance Power Mode',
          description: 'Maximize CPU and GPU clock speeds',
          impactPercent: 8,
          category: 'system',
        }
      );
      break;

    case 'min-latency':
      baseRecommendations.push(
        {
          id: 'fullscreen-mode',
          name: 'Enable Exclusive Fullscreen',
          description: 'Bypass desktop compositor for lower latency',
          impactPercent: 20,
          category: 'graphics',
        },
        {
          id: 'disable-gsync',
          name: 'Disable G-Sync/FreeSync',
          description: 'Remove variable refresh rate for consistent timing',
          impactPercent: 12,
          category: 'graphics',
        },
        {
          id: 'low-latency-mode',
          name: 'Enable Low Latency Mode',
          description: 'Reduce render queue for faster input response',
          impactPercent: 15,
          category: 'system',
        },
        {
          id: 'high-polling',
          name: 'Max Mouse Polling Rate',
          description: 'Ensure mouse is set to highest polling rate',
          impactPercent: 5,
          category: 'peripheral',
        }
      );
      break;

    case 'reduce-heat':
      baseRecommendations.push(
        {
          id: 'fps-cap',
          name: 'Cap Frame Rate',
          description: 'Limit FPS to reduce GPU workload and heat',
          impactPercent: 30,
          category: 'graphics',
        },
        {
          id: 'fan-curve',
          name: 'Optimize Fan Curve',
          description: 'Adjust cooling profile for better thermal management',
          impactPercent: 20,
          category: 'system',
        },
        {
          id: 'undervolt',
          name: 'GPU Undervolting',
          description: 'Reduce voltage for lower temperatures',
          impactPercent: 15,
          category: 'system',
        }
      );
      break;

    case 'battery-life':
      baseRecommendations.push(
        {
          id: 'battery-saver',
          name: 'Enable Battery Saver',
          description: 'System-wide power optimization',
          impactPercent: 25,
          category: 'system',
        },
        {
          id: 'fps-limit-30',
          name: 'Limit to 30 FPS',
          description: 'Significant power savings with smooth gameplay',
          impactPercent: 35,
          category: 'graphics',
        },
        {
          id: 'brightness-reduction',
          name: 'Reduce Display Brightness',
          description: 'Lower screen brightness for battery savings',
          impactPercent: 15,
          category: 'display',
        },
        {
          id: 'disable-hdr',
          name: 'Disable HDR',
          description: 'Reduce power consumption from display processing',
          impactPercent: 10,
          category: 'graphics',
        }
      );
      break;
  }

  return baseRecommendations;
};

/**
 * AnalysisStep - Third step in the Pinpoint wizard.
 *
 * Shows analysis progress with animated phases.
 * Generates recommendations based on game and goal.
 */
export function AnalysisStep({ game, goal, onComplete }: AnalysisStepProps) {
  const [progress, setProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [analyzing, setAnalyzing] = useState(true);

  useEffect(() => {
    const analyze = async () => {
      // Phase 1: Game settings (0-30%)
      for (let i = 0; i <= 30; i += 5) {
        await delay(100);
        setProgress(i);
      }
      setCurrentPhase(1);

      // Phase 2: System config (30-70%)
      for (let i = 30; i <= 70; i += 5) {
        await delay(100);
        setProgress(i);
      }
      setCurrentPhase(2);

      // Phase 3: Optimization potential (70-100%)
      for (let i = 70; i <= 100; i += 5) {
        await delay(100);
        setProgress(i);
      }

      // Generate recommendations
      await delay(300);
      const recommendations = generateRecommendations(game, goal);

      setAnalyzing(false);
      onComplete(recommendations);
    };

    analyze();
  }, [game, goal, onComplete]);

  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
    >
      {/* Spinner */}
      <motion.div
        className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#05030a]/80 backdrop-blur-xl border border-primary/30 flex items-center justify-center"
        animate={analyzing ? { boxShadow: ['0 0 0px hsl(var(--glow-primary)/0)', '0 0 24px hsl(var(--glow-primary)/0.4)', '0 0 0px hsl(var(--glow-primary)/0)'] } : {}}
        transition={{ duration: 2, repeat: analyzing ? Infinity : 0 }}
      >
        <Loader2 className="w-10 h-10 text-primary animate-spin" strokeWidth={1.5} />
      </motion.div>

      {/* Title */}
      <h2 className="text-xl font-semibold mb-2">
        Analyzing {game.name}
      </h2>
      <p className="text-muted-foreground mb-6">
        Optimizing for <span className="text-primary font-medium">{goal.label}</span>
      </p>

      {/* Progress bar */}
      <div className="w-72 mx-auto mb-8">
        <Progress value={progress} className="h-2" />
        <p className="text-sm text-muted-foreground mt-2">{progress}% complete</p>
      </div>

      {/* Analysis phases */}
      <div className="rounded-xl p-4 max-w-sm mx-auto bg-white/[0.02] border border-white/[0.04]">
        <div className="space-y-3">
          {ANALYSIS_PHASES.map((phase, index) => {
            const Icon = phase.icon;
            const isActive = index === currentPhase && analyzing;
            const isComplete = index < currentPhase || !analyzing;

            return (
              <motion.div
                key={phase.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg',
                  isActive && 'bg-primary/10',
                  isComplete && 'opacity-60'
                )}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    isActive ? 'bg-primary/20 text-primary' : 'bg-muted/50 text-muted-foreground',
                    isComplete && 'bg-success/20 text-success'
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />
                  ) : (
                    <Icon className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </div>
                <span
                  className={cn(
                    'text-sm',
                    isActive ? 'text-primary font-medium' : 'text-muted-foreground',
                    isComplete && 'text-success'
                  )}
                >
                  {isComplete ? `${phase.label}` : isActive ? `Checking ${phase.label.toLowerCase()}...` : phase.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export default AnalysisStep;

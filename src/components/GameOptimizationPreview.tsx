import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CheckCircle, Sparkles, Brush, Terminal, Lightbulb, Zap, HelpCircle, Eye } from 'lucide-react';
import { LearnModeExplanation } from './LearnModeExplanation';
import { LearningCallout } from './LearningCallout';
import OptimizationApprovalModal from './OptimizationApprovalModal';
import OptimizationResultModal from './OptimizationResultModal';
import { useOptimizer } from '../hooks/useOptimizer';
import { useLearning } from '../hooks/useLearning';
import { useInvestigationMode } from './InvestigationMode';
import type { GameOptimization } from '../types/games';
import type { OptimizationResult } from '../types/optimizer';
import type { InvestigationReport } from '@/types/investigation';

// Re-export for backward compatibility
export type { GameOptimization };

/**
 * Props for GameOptimizationPreview component.
 */
export interface GameOptimizationPreviewProps {
  /** Optimization data (null if no optimization available) */
  optimization: GameOptimization | null;
  /** Whether the component is loading */
  loading?: boolean;
  /** Callback when user requests AI recommendations */
  onRequestAI?: () => void;
  /** Game ID for optimization */
  gameId?: string;
  /** Game name for display */
  gameName?: string;
}

/**
 * Trust indicator badge for optimization source.
 */
function TrustIndicator({ source }: { source: 'database' | 'ai' | 'generic' }) {
  if (source === 'database') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        'bg-success/15 text-success border border-success/30'
      )}>
        <CheckCircle className="w-3.5 h-3.5" strokeWidth={2} />
        Community Verified
      </span>
    );
  }

  if (source === 'ai') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        'bg-primary/15 text-primary border border-primary/30'
      )}>
        <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />
        AI Generated
      </span>
    );
  }

  // Generic tips
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
      'bg-muted/30 text-muted-foreground border border-border/30'
    )}>
      <Lightbulb className="w-3.5 h-3.5" strokeWidth={2} />
      Generic Tips
    </span>
  );
}

/**
 * Loading skeleton for the optimization preview.
 */
function OptimizationSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-6 w-32 rounded-lg bg-muted/30 animate-shimmer" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-muted/30 animate-shimmer" />
        <div className="h-4 w-3/4 rounded bg-muted/30 animate-shimmer" />
        <div className="h-4 w-1/2 rounded bg-muted/30 animate-shimmer" />
      </div>
      <div className="h-px bg-border/20" />
      <div className="space-y-2">
        <div className="h-4 w-full rounded bg-muted/30 animate-shimmer" />
        <div className="h-4 w-2/3 rounded bg-muted/30 animate-shimmer" />
      </div>
    </div>
  );
}

/**
 * Empty state when no optimization is available.
 */
function NoOptimizationState({
  onRequestAI,
}: {
  onRequestAI?: () => void;
}) {
  return (
    <motion.div
      className="py-8 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.div
        className={cn(
          'w-14 h-14 mx-auto flex items-center justify-center rounded-full mb-4',
          'glass border border-border/30'
        )}
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <HelpCircle className="w-7 h-7 text-muted-foreground/50" strokeWidth={1.5} />
      </motion.div>
      <h4 className="text-sm font-medium text-foreground mb-2">
        No Community Settings
      </h4>
      <p className="text-xs text-muted-foreground/60 mb-4 max-w-[240px] mx-auto">
        No community-verified settings are available for this game yet.
      </p>

      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          variant="outline"
          size="sm"
          onClick={onRequestAI}
          className="gap-1.5 glass-subtle rounded-xl border-border/30"
          disabled={!onRequestAI}
        >
          <Sparkles className="w-4 h-4" strokeWidth={2} />
          Generate AI Recommendations
        </Button>
      </motion.div>

      <p className="text-xs text-muted-foreground/50 mt-3 italic">
        AI suggestions should be verified before applying
      </p>
    </motion.div>
  );
}

/**
 * Section for displaying graphics settings.
 */
function GraphicsSection({ settings }: { settings: Record<string, string> }) {
  const entries = Object.entries(settings);
  if (entries.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
        <Brush className="w-4 h-4 text-primary" strokeWidth={1.75} />
        Graphics Settings
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {entries.map(([key, value], index) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + index * 0.03 }}
            className="flex items-center justify-between px-3 py-2 rounded-xl glass-subtle border border-border/20"
          >
            <span className="text-xs text-muted-foreground/60 capitalize">
              {key.replace(/_/g, ' ')}
            </span>
            <span className="text-xs font-medium text-foreground">
              {value}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Section for displaying launch options.
 */
function LaunchOptionsSection({ options }: { options: string[] }) {
  if (options.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
        <Terminal className="w-4 h-4 text-primary" strokeWidth={1.75} />
        Launch Options
      </h4>
      <code className="block px-4 py-3 rounded-xl glass-subtle border border-border/20 font-mono text-xs text-foreground/80">
        {options.join(' ')}
      </code>
    </motion.div>
  );
}

/**
 * Section for displaying tips.
 */
function TipsSection({ tips }: { tips: string[] }) {
  if (tips.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-primary" strokeWidth={1.75} />
        Tips
      </h4>
      <ul className="space-y-2">
        {tips.map((tip, index) => (
          <motion.li
            key={index}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + index * 0.05 }}
            className="flex items-start gap-2.5 text-xs text-muted-foreground/70"
          >
            <span className={cn(
              'flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-xs font-medium',
              'bg-primary/10 text-primary border border-primary/20'
            )}>
              {index + 1}
            </span>
            <span className="pt-0.5 leading-relaxed">{tip}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

/**
 * GameOptimizationPreview - Shows optimization settings and tips for a game.
 */
function GameOptimizationPreview({
  optimization,
  loading = false,
  onRequestAI,
  gameId,
  gameName = 'Unknown Game',
}: GameOptimizationPreviewProps) {
  const [showApproval, setShowApproval] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [showPreferenceCallout, setShowPreferenceCallout] = useState(true);

  const { applyOptimization, revertOptimization, loading: optimizing } = useOptimizer();
  const { isInvestigationMode, showReport } = useInvestigationMode();
  const { getRelevantPreferences } = useLearning();

  // Get preferences relevant to this game
  const relevantPrefs = gameId ? getRelevantPreferences(gameId) : [];

  // Handle investigate button click - generate and show report
  const handleInvestigate = () => {
    if (!optimization || !gameId) return;

    // Generate an investigation report based on the optimization
    // In production, this would call the backend via MCP
    const report: InvestigationReport = {
      optimizationId: `game_${gameId}`,
      optimizationName: `${gameName} Optimization`,
      timestamp: Date.now(),
      changes: [
        {
          id: `game_${gameId}_config`,
          type: 'config',
          platform: 'all',
          location: `Game config file for ${gameName}`,
          description: 'Graphics settings configuration',
          before: 'Default settings',
          after: 'Optimized settings',
          technical: 'Modifies in-game graphics settings to optimize for performance. Settings are stored in the game\'s config directory and will be loaded on next launch.',
          reversible: true,
          rollbackCommand: `Restore from backup: ~/.opta/backups/game_${gameId}/`,
        },
      ],
      dependencies: [
        {
          name: 'Backup System',
          type: 'requires',
          description: 'Original config backed up before changes',
          status: 'ok',
        },
      ],
      impacts: [
        {
          category: 'performance',
          severity: 'low',
          description: 'Some visual quality may be reduced',
          mitigation: 'Adjust individual settings if quality is too low',
        },
      ],
      rollback: {
        available: true,
        steps: [`Restore from backup: ~/.opta/backups/game_${gameId}/`],
        warnings: [],
      },
    };

    showReport(report);
  };

  const handleApply = () => {
    if (optimization) {
      setShowApproval(true);
    }
  };

  const handleApprove = async () => {
    if (!gameId) return;

    try {
      const optimizationResult = await applyOptimization(gameId);
      setResult(optimizationResult);
      setShowApproval(false);
      setShowResult(true);
    } catch (e) {
      console.error('Optimization failed:', e);
      setShowApproval(false);
    }
  };

  const handleRevert = async () => {
    if (!gameId) return;

    try {
      await revertOptimization(gameId);
      setShowResult(false);
    } catch (e) {
      console.error('Revert failed:', e);
    }
  };

  if (loading) {
    return (
      <div className="glass-subtle rounded-xl border border-border/20 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/20">
          <h3 className="text-sm font-semibold">Optimization Settings</h3>
        </div>
        <div className="p-4">
          <OptimizationSkeleton />
        </div>
      </div>
    );
  }

  if (!optimization) {
    return (
      <div className="glass-subtle rounded-xl border border-border/20 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/20">
          <h3 className="text-sm font-semibold">Optimization Settings</h3>
        </div>
        <div className="p-4">
          <NoOptimizationState onRequestAI={onRequestAI} />
        </div>
      </div>
    );
  }

  // Extract settings from the backend format
  const settings = optimization.settings as Record<string, unknown> || {};
  const graphics = settings.graphics as Record<string, string> | undefined;
  const launchOptions = settings.launch_options as string | undefined;
  const launchOptionsArray = launchOptions ? [launchOptions] : [];

  return (
    <motion.div
      className="glass-subtle rounded-xl border border-border/20 overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="px-4 py-3 border-b border-border/20">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Optimization Settings</h3>
          <TrustIndicator source={optimization.source} />
        </div>
        {optimization.source === 'ai' && (
          <p className="text-xs text-muted-foreground/50 mt-1">
            AI suggestions should be verified before applying
          </p>
        )}
      </div>
      <div className="p-4 space-y-5">
        {/* Learn Mode Explanation */}
        <LearnModeExplanation
          title="What These Settings Do"
          description="Each setting trades something for performance. Resolution affects sharpness, shadows affect atmosphere, anti-aliasing smooths edges."
          details="Settings are community-verified to balance FPS gains with visual quality. Higher impact settings give bigger FPS gains but may noticeably reduce visuals."
          type="info"
        />

        {/* Learning Callout - show if relevant preferences exist */}
        {relevantPrefs.length > 0 && showPreferenceCallout && (
          <LearningCallout
            preference={`You usually prefer ${relevantPrefs[0].name}`}
            action={`I'm prioritizing ${relevantPrefs[0].description.toLowerCase()} for this optimization.`}
            onChangePreference={() => {
              // Navigate to settings learning section
              // In production, would use a proper navigation method
              console.log('Navigate to Settings -> Learning');
            }}
            onDismiss={() => setShowPreferenceCallout(false)}
          />
        )}

        {/* Graphics Settings */}
        {graphics && Object.keys(graphics).length > 0 && (
          <GraphicsSection settings={graphics} />
        )}

        {/* Launch Options */}
        {launchOptionsArray.length > 0 && (
          <>
            <div className="h-px bg-border/20" />
            <LaunchOptionsSection options={launchOptionsArray} />
          </>
        )}

        {/* Tips */}
        {optimization.tips && optimization.tips.length > 0 && (
          <>
            <div className="h-px bg-border/20" />
            <TipsSection tips={optimization.tips} />
          </>
        )}

        {/* Action Buttons */}
        <div className="h-px bg-border/20" />
        <div className="flex items-center justify-end gap-2 pt-1">
          {/* Investigation Mode Button */}
          {isInvestigationMode && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <Button
                variant="outline"
                onClick={handleInvestigate}
                disabled={!gameId}
                className="gap-1.5 rounded-xl glass-subtle border-border/30"
              >
                <Eye className="w-4 h-4" strokeWidth={1.75} />
                Investigate
              </Button>
            </motion.div>
          )}

          {/* Apply Button */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleApply}
              disabled={!gameId || optimizing}
              className={cn(
                'gap-1.5 rounded-xl',
                gameId
                  ? 'bg-gradient-to-r from-primary to-accent shadow-[0_0_16px_-4px_hsl(var(--glow-primary)/0.5)]'
                  : 'opacity-50 cursor-not-allowed'
              )}
            >
              <Zap className="w-4 h-4" strokeWidth={2} />
              {optimizing ? 'Applying...' : 'Apply Optimization'}
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Approval Modal */}
      {optimization && (
        <OptimizationApprovalModal
          open={showApproval}
          onClose={() => setShowApproval(false)}
          onApprove={handleApprove}
          optimization={optimization}
          gameName={gameName}
          loading={optimizing}
        />
      )}

      {/* Result Modal */}
      <OptimizationResultModal
        open={showResult}
        onClose={() => setShowResult(false)}
        result={result}
        gameName={gameName}
        onRevert={handleRevert}
      />
    </motion.div>
  );
}

export default GameOptimizationPreview;

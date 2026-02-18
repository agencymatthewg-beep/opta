'use client';

/**
 * StepCard — Renders a single pipeline step in the agent workspace.
 *
 * Shows step type icon, label, configuration, and execution status.
 * Supports editing step config inline.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Shuffle,
  GitBranch,
  FileOutput,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { cn } from '@opta/ui';
import type { PipelineStep, StepExecution, StepExecutionStatus } from '@/types/agent';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StepCardProps {
  step: PipelineStep;
  execution?: StepExecution;
  isActive?: boolean;
  onEdit?: (step: PipelineStep) => void;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  StepExecutionStatus,
  { icon: typeof CheckCircle2; color: string; label: string }
> = {
  pending: { icon: Clock, color: 'text-text-muted', label: 'Pending' },
  running: { icon: Loader2, color: 'text-neon-cyan', label: 'Running' },
  completed: { icon: CheckCircle2, color: 'text-neon-green', label: 'Done' },
  failed: { icon: XCircle, color: 'text-neon-red', label: 'Failed' },
  skipped: { icon: Clock, color: 'text-text-muted', label: 'Skipped' },
};

const STEP_ICONS: Record<PipelineStep['type'], typeof MessageSquare> = {
  prompt: MessageSquare,
  transform: Shuffle,
  conditional: GitBranch,
  output: FileOutput,
};

const STEP_COLORS: Record<PipelineStep['type'], string> = {
  prompt: 'border-primary/40',
  transform: 'border-neon-cyan/40',
  conditional: 'border-neon-amber/40',
  output: 'border-neon-green/40',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StepCard({ step, execution, isActive }: StepCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = STEP_ICONS[step.type];
  const borderColor = STEP_COLORS[step.type];

  const statusConfig = execution
    ? STATUS_CONFIG[execution.status]
    : null;
  const StatusIcon = statusConfig?.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'glass-subtle rounded-xl border-l-4 overflow-hidden transition-all',
        borderColor,
        isActive && 'ring-1 ring-primary/30',
      )}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            'bg-opta-surface',
          )}
        >
          <Icon className="w-4 h-4 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {step.label}
          </p>
          <p className="text-xs text-text-muted capitalize">{step.type}</p>
        </div>

        {/* Status indicator */}
        {statusConfig && StatusIcon && (
          <div className={cn('flex items-center gap-1.5', statusConfig.color)}>
            <StatusIcon
              className={cn(
                'w-4 h-4',
                execution?.status === 'running' && 'animate-spin',
              )}
            />
            <span className="text-xs font-medium">{statusConfig.label}</span>
          </div>
        )}

        {/* Duration */}
        {execution?.durationMs != null && (
          <span className="text-xs text-text-muted tabular-nums">
            {execution.durationMs < 1000
              ? `${execution.durationMs}ms`
              : `${(execution.durationMs / 1000).toFixed(1)}s`}
          </span>
        )}

        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-text-muted" />
        ) : (
          <ChevronRight className="w-4 h-4 text-text-muted" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 pb-4 space-y-3 border-t border-opta-border"
        >
          {/* Step config summary */}
          <div className="pt-3">
            {step.type === 'prompt' && (
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-medium text-text-muted uppercase tracking-widest mb-1">
                    Model
                  </p>
                  <p className="text-xs text-text-secondary font-mono">
                    {step.config.model || 'Default'}
                  </p>
                </div>
                {step.config.systemPrompt && (
                  <div>
                    <p className="text-[10px] font-medium text-text-muted uppercase tracking-widest mb-1">
                      System Prompt
                    </p>
                    <p className="text-xs text-text-secondary line-clamp-2">
                      {step.config.systemPrompt}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-medium text-text-muted uppercase tracking-widest mb-1">
                    User Prompt Template
                  </p>
                  <p className="text-xs text-text-secondary line-clamp-3 font-mono">
                    {step.config.userPromptTemplate}
                  </p>
                </div>
              </div>
            )}

            {step.type === 'transform' && (
              <div>
                <p className="text-[10px] font-medium text-text-muted uppercase tracking-widest mb-1">
                  Operation
                </p>
                <p className="text-xs text-text-secondary capitalize">
                  {step.config.operation.replace('_', ' ')}
                </p>
              </div>
            )}

            {step.type === 'conditional' && (
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-medium text-text-muted uppercase tracking-widest mb-1">
                    Condition
                  </p>
                  <p className="text-xs text-text-secondary">
                    {step.config.condition.replace('_', ' ')} &quot;{step.config.value}&quot;
                  </p>
                </div>
              </div>
            )}

            {step.type === 'output' && (
              <div>
                <p className="text-[10px] font-medium text-text-muted uppercase tracking-widest mb-1">
                  Format
                </p>
                <p className="text-xs text-text-secondary capitalize">
                  {step.config.format} → {step.config.destination}
                </p>
              </div>
            )}
          </div>

          {/* Execution output */}
          {execution?.output && (
            <div>
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-widest mb-1">
                Output
              </p>
              <div className="bg-opta-bg rounded-lg p-3 max-h-48 overflow-y-auto no-scrollbar">
                <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono">
                  {execution.output}
                </pre>
              </div>
            </div>
          )}

          {/* Error */}
          {execution?.error && (
            <div className="bg-neon-red/10 border border-neon-red/20 rounded-lg p-3">
              <p className="text-xs text-neon-red">{execution.error}</p>
            </div>
          )}

          {/* Token count */}
          {execution?.tokensUsed != null && (
            <p className="text-xs text-text-muted tabular-nums">
              ~{execution.tokensUsed.toLocaleString()} tokens
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

'use client';

/**
 * ExecutionLog — Shows real-time execution progress of an agent workflow.
 *
 * Displays each step's status, output, and timing as the workflow executes.
 * Steps expand/collapse to show detailed output.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Play, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@opta/ui';
import type { WorkflowExecution } from '@/types/agent';

interface ExecutionLogProps {
  execution: WorkflowExecution;
}

export function ExecutionLog({ execution }: ExecutionLogProps) {
  const totalDuration = useMemo(() => {
    if (!execution.completedAt) return null;
    return (
      new Date(execution.completedAt).getTime() -
      new Date(execution.startedAt).getTime()
    );
  }, [execution.startedAt, execution.completedAt]);

  const totalTokens = useMemo(() => {
    return execution.steps.reduce(
      (sum, s) => sum + (s.tokensUsed ?? 0),
      0,
    );
  }, [execution.steps]);

  const StatusIcon =
    execution.status === 'completed'
      ? CheckCircle2
      : execution.status === 'failed'
        ? XCircle
        : execution.status === 'running'
          ? Play
          : Clock;

  const statusColor =
    execution.status === 'completed'
      ? 'text-neon-green'
      : execution.status === 'failed'
        ? 'text-neon-red'
        : execution.status === 'running'
          ? 'text-neon-cyan'
          : 'text-text-muted';

  return (
    <div className="glass-subtle rounded-xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon className={cn('w-5 h-5', statusColor)} />
          <h3 className="text-sm font-semibold text-text-primary capitalize">
            {execution.status}
          </h3>
        </div>
        <div className="flex items-center gap-4 text-xs text-text-muted">
          {totalDuration != null && (
            <span className="tabular-nums">
              {totalDuration < 1000
                ? `${totalDuration}ms`
                : `${(totalDuration / 1000).toFixed(1)}s`}
            </span>
          )}
          {totalTokens > 0 && (
            <span className="tabular-nums">
              ~{totalTokens.toLocaleString()} tokens
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-opta-surface overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full',
            execution.status === 'failed' ? 'bg-neon-red' : 'bg-primary',
          )}
          initial={{ width: '0%' }}
          animate={{
            width: `${
              (execution.steps.filter(
                (s) =>
                  s.status === 'completed' ||
                  s.status === 'failed' ||
                  s.status === 'skipped',
              ).length /
                execution.steps.length) *
              100
            }%`,
          }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Step list */}
      <div className="space-y-2">
        {execution.steps.map((step, i) => {
          const isLast = i === execution.steps.length - 1;

          return (
            <div
              key={step.stepId}
              className={cn(
                'flex items-start gap-3 text-xs',
                step.status === 'pending' && 'opacity-40',
              )}
            >
              {/* Timeline dot + line */}
              <div className="flex flex-col items-center pt-0.5">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    step.status === 'completed' && 'bg-neon-green',
                    step.status === 'running' && 'bg-neon-cyan animate-pulse',
                    step.status === 'failed' && 'bg-neon-red',
                    step.status === 'pending' && 'bg-text-muted',
                    step.status === 'skipped' && 'bg-text-muted',
                  )}
                />
                {!isLast && (
                  <div className="w-px h-6 bg-opta-border mt-1" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-text-primary font-medium">
                    Step {i + 1}
                  </span>
                  {step.durationMs != null && (
                    <span className="text-text-muted tabular-nums">
                      {step.durationMs < 1000
                        ? `${step.durationMs}ms`
                        : `${(step.durationMs / 1000).toFixed(1)}s`}
                    </span>
                  )}
                </div>

                {/* Show truncated output for completed steps */}
                {step.output && step.status === 'completed' && (
                  <p className="text-text-muted mt-0.5 line-clamp-2 break-all">
                    {step.output.slice(0, 200)}
                    {step.output.length > 200 ? '...' : ''}
                  </p>
                )}

                {/* Show error for failed steps */}
                {step.error && (
                  <p className="text-neon-red mt-0.5">{step.error}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Final output */}
      {execution.finalOutput && (
        <div className="border-t border-opta-border pt-4">
          <p className="text-[10px] font-medium text-text-muted uppercase tracking-widest mb-2">
            Final Output
          </p>
          <div className="bg-opta-bg rounded-lg p-4 max-h-64 overflow-y-auto no-scrollbar">
            <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono leading-relaxed">
              {execution.finalOutput}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

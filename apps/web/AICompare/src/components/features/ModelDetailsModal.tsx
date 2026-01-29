'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Check, Minus, Copy, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CompanyLogo } from './CompanyLogo';
import { SourceBadgeGroup } from './SourceBadge';
import { formatContextLength, formatPrice } from '@/lib/data/constants';
import type { AIModel } from '@/lib/types';

interface ModelDetailsModalProps {
  model: AIModel | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Full-screen modal showing detailed model information
 */
export function ModelDetailsModal({ model, isOpen, onClose }: ModelDetailsModalProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!model) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const benchmarksByCategory = {
    reasoning: model.benchmarks.filter(b =>
      ['MMLU', 'GPQA', 'ARC-C', 'HellaSwag'].some(name => b.name.includes(name))
    ),
    coding: model.benchmarks.filter(b =>
      ['HumanEval', 'MBPP', 'CodeContests'].some(name => b.name.includes(name))
    ),
    math: model.benchmarks.filter(b =>
      ['MATH', 'GSM8K', 'AIME'].some(name => b.name.includes(name))
    ),
    other: model.benchmarks.filter(b =>
      !['MMLU', 'GPQA', 'ARC-C', 'HellaSwag', 'HumanEval', 'MBPP', 'CodeContests', 'MATH', 'GSM8K', 'AIME'].some(name => b.name.includes(name))
    ),
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
          onClick={onClose}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-opta-bg/90 backdrop-blur-xl"
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'relative w-full max-w-4xl max-h-[90vh] overflow-auto',
              'glass-strong rounded-2xl',
              'shadow-2xl shadow-purple-glow/20'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 p-6 border-b border-glass-border bg-opta-bg/95 backdrop-blur-xl">
              <div className="flex items-center gap-4">
                <CompanyLogo company={model.company} size={48} />
                <div>
                  <h2 className="text-2xl font-bold text-moonlight">{model.name}</h2>
                  <p className="text-text-secondary flex items-center gap-2">
                    {model.company}
                    {model.family && (
                      <>
                        <span className="text-text-muted">&middot;</span>
                        <span className="text-text-muted">{model.family}</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Rank badge */}
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-bold text-neon-orange">#{model.rank}</span>
                  <span className="text-xs text-text-muted">Rank</span>
                </div>
                {/* Score badge */}
                <div className="flex flex-col items-center px-4 py-2 rounded-lg bg-purple-glow/20 border border-purple-glow/30">
                  <span className="text-2xl font-mono font-bold text-purple-glow">{model.compositeScore}</span>
                  <span className="text-xs text-text-muted">Score</span>
                </div>
                {/* Close button */}
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-8">
              {/* Sources */}
              {model.sources.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Data sources:</span>
                  <SourceBadgeGroup sources={model.sources} size="sm" maxVisible={5} />
                </div>
              )}

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Context Length"
                  value={formatContextLength(model.capabilities.contextLength)}
                  highlight
                />
                <StatCard
                  label="Input Price"
                  value={model.pricing ? formatPrice(model.pricing.promptPer1M) : 'N/A'}
                  sublabel="per 1M tokens"
                />
                <StatCard
                  label="Output Price"
                  value={model.pricing ? formatPrice(model.pricing.completionPer1M) : 'N/A'}
                  sublabel="per 1M tokens"
                />
                <StatCard
                  label="Status"
                  value={model.status.charAt(0).toUpperCase() + model.status.slice(1)}
                  status={model.status}
                />
              </div>

              {/* Capabilities */}
              <section>
                <h3 className="text-lg font-semibold text-white mb-4">Capabilities</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <CapabilityBadge name="Vision" enabled={model.capabilities.vision} />
                  <CapabilityBadge name="Function Calling" enabled={model.capabilities.functionCalling} />
                  <CapabilityBadge name="JSON Mode" enabled={model.capabilities.jsonMode} />
                  <CapabilityBadge name="Streaming" enabled={model.capabilities.streaming} />
                  <CapabilityBadge name="Fine-Tunable" enabled={model.capabilities.fineTunable} />
                </div>
                {/* Modalities */}
                <div className="mt-4">
                  <span className="text-xs text-text-muted">Modalities:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {model.capabilities.modalities.map((mod) => (
                      <span
                        key={mod}
                        className="px-2 py-1 text-xs rounded-lg bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/30"
                      >
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              {/* Benchmarks */}
              <section>
                <h3 className="text-lg font-semibold text-white mb-4">Benchmark Scores</h3>
                <div className="space-y-6">
                  {benchmarksByCategory.reasoning.length > 0 && (
                    <BenchmarkSection title="Reasoning" benchmarks={benchmarksByCategory.reasoning} />
                  )}
                  {benchmarksByCategory.coding.length > 0 && (
                    <BenchmarkSection title="Coding" benchmarks={benchmarksByCategory.coding} />
                  )}
                  {benchmarksByCategory.math.length > 0 && (
                    <BenchmarkSection title="Math" benchmarks={benchmarksByCategory.math} />
                  )}
                  {benchmarksByCategory.other.length > 0 && (
                    <BenchmarkSection title="Other" benchmarks={benchmarksByCategory.other} />
                  )}
                </div>
              </section>

              {/* Model ID */}
              <section>
                <h3 className="text-lg font-semibold text-white mb-4">API Information</h3>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-glass-border">
                  <span className="text-xs text-text-muted">Model ID:</span>
                  <code className="flex-1 text-sm font-mono text-neon-cyan truncate">{model.slug}</code>
                  <button
                    onClick={() => copyToClipboard(model.slug, 'slug')}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors"
                    title="Copy model ID"
                  >
                    {copiedId === 'slug' ? (
                      <CheckCircle className="w-4 h-4 text-neon-green" />
                    ) : (
                      <Copy className="w-4 h-4 text-text-muted" />
                    )}
                  </button>
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  highlight,
  status,
}: {
  label: string;
  value: string;
  sublabel?: string;
  highlight?: boolean;
  status?: string;
}) {
  const statusColors: Record<string, string> = {
    active: 'text-neon-green',
    new: 'text-purple-glow',
    trending: 'text-neon-orange',
    deprecated: 'text-text-muted',
    beta: 'text-neon-cyan',
  };

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-glass-border">
      <p className="text-xs text-text-muted mb-1">{label}</p>
      <p className={cn(
        'text-lg font-semibold',
        highlight ? 'text-neon-cyan' : status ? statusColors[status] || 'text-white' : 'text-white'
      )}>
        {value}
      </p>
      {sublabel && <p className="text-[10px] text-text-muted">{sublabel}</p>}
    </div>
  );
}

function CapabilityBadge({ name, enabled }: { name: string; enabled: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-2 rounded-lg border',
      enabled
        ? 'bg-neon-green/10 border-neon-green/30 text-neon-green'
        : 'bg-white/5 border-glass-border text-text-muted'
    )}>
      {enabled ? (
        <Check className="w-4 h-4" />
      ) : (
        <Minus className="w-4 h-4" />
      )}
      <span className="text-sm">{name}</span>
    </div>
  );
}

function BenchmarkSection({
  title,
  benchmarks,
}: {
  title: string;
  benchmarks: AIModel['benchmarks'];
}) {
  return (
    <div>
      <h4 className="text-sm font-medium text-text-secondary mb-3">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {benchmarks.map((benchmark) => {
          const percentage = benchmark.maxScore
            ? (benchmark.score / benchmark.maxScore) * 100
            : benchmark.score;

          return (
            <div
              key={benchmark.name}
              className="p-3 rounded-lg bg-white/5 border border-glass-border"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-white">{benchmark.name}</span>
                <span className="text-sm font-mono text-purple-glow">
                  {benchmark.score.toFixed(1)}
                  {benchmark.maxScore && (
                    <span className="text-text-muted">/{benchmark.maxScore}</span>
                  )}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="h-full bg-gradient-to-r from-neon-cyan to-purple-glow rounded-full"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

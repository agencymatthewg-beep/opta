'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CompanyLogo } from './CompanyLogo';
import { SourceBadgeGroup } from './SourceBadge';
import { useCompare } from '@/lib/context/CompareContext';
import { formatContextLength, formatPrice } from '@/lib/data/constants';
import type { AIModel } from '@/lib/types';

/**
 * Full-screen comparison view modal
 */
export function CompareView() {
  const { selectedModels, isCompareViewOpen, closeCompareView, removeModel } =
    useCompare();

  if (!isCompareViewOpen || selectedModels.length < 2) return null;

  // Get all unique benchmark names across selected models
  const allBenchmarks = [
    ...new Set(selectedModels.flatMap((m) => m.benchmarks.map((b) => b.name))),
  ];

  // Get all unique capability keys
  const capabilityKeys: (keyof AIModel['capabilities'])[] = [
    'contextLength',
    'modalities',
    'functionCalling',
    'streaming',
    'fineTunable',
    'jsonMode',
    'vision',
  ];

  return (
    <AnimatePresence>
      {isCompareViewOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-opta-bg/90 backdrop-blur-xl"
            onClick={closeCompareView}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={cn(
              'relative w-full max-w-6xl max-h-[90vh] overflow-auto',
              'bg-opta-bg/95 backdrop-blur-xl rounded-2xl',
              'border border-glass-border shadow-2xl shadow-purple-glow/20'
            )}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-glass-border bg-opta-bg/95 backdrop-blur-xl">
              <h2 className="text-xl font-semibold text-white">
                Model Comparison
              </h2>
              <button
                onClick={closeCompareView}
                className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Close comparison"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comparison Table */}
            <div className="p-6 overflow-x-auto">
              <table className="w-full border-collapse">
                {/* Model Headers */}
                <thead>
                  <tr>
                    <th className="text-left p-3 text-sm text-text-muted font-medium w-40">
                      Model
                    </th>
                    {selectedModels.map((model) => (
                      <th key={model.id} className="p-3 min-w-[180px]">
                        <div className="flex flex-col items-center gap-2">
                          <div className="relative">
                            <CompanyLogo company={model.company} size={40} />
                            <button
                              onClick={() => removeModel(model.id)}
                              className="absolute -top-1 -right-1 p-0.5 rounded-full bg-opta-bg border border-glass-border text-text-muted hover:text-neon-coral transition-colors"
                              aria-label={`Remove ${model.name}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-medium text-white">
                              {model.name}
                            </p>
                            <p className="text-xs text-text-muted">
                              {model.company}
                            </p>
                          </div>
                          {model.sources.length > 0 && (
                            <SourceBadgeGroup
                              sources={model.sources}
                              size="xs"
                              maxVisible={2}
                            />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {/* Rank & Score Section */}
                  <SectionHeader title="Ranking" colSpan={selectedModels.length + 1} />
                  <CompareRow label="Rank">
                    {selectedModels.map((model) => (
                      <td key={model.id} className="p-3 text-center">
                        <span className="text-2xl font-bold text-neon-orange">
                          #{model.rank}
                        </span>
                      </td>
                    ))}
                  </CompareRow>
                  <CompareRow label="Composite Score">
                    {selectedModels.map((model) => (
                      <td key={model.id} className="p-3 text-center">
                        <span className="text-xl font-mono text-purple-glow">
                          {model.compositeScore}
                        </span>
                      </td>
                    ))}
                  </CompareRow>

                  {/* Benchmarks Section */}
                  <SectionHeader
                    title="Benchmarks"
                    colSpan={selectedModels.length + 1}
                  />
                  {allBenchmarks.map((benchmarkName) => (
                    <CompareRow key={benchmarkName} label={benchmarkName}>
                      {selectedModels.map((model) => {
                        const benchmark = model.benchmarks.find(
                          (b) => b.name === benchmarkName
                        );
                        const score = benchmark?.score;
                        const maxScore = benchmark?.maxScore || 100;
                        const percentage = score ? (score / maxScore) * 100 : 0;

                        // Find the best score among selected models
                        const scores = selectedModels
                          .map(
                            (m) =>
                              m.benchmarks.find((b) => b.name === benchmarkName)
                                ?.score || 0
                          )
                          .filter((s) => s > 0);
                        const bestScore = Math.max(...scores);
                        const isBest = score === bestScore && scores.length > 1;

                        return (
                          <td key={model.id} className="p-3">
                            {score !== undefined ? (
                              <div className="flex flex-col items-center gap-1">
                                <span
                                  className={cn(
                                    'text-lg font-mono',
                                    isBest
                                      ? 'text-neon-green font-bold'
                                      : 'text-white'
                                  )}
                                >
                                  {score.toFixed(1)}
                                  {isBest && (
                                    <span className="ml-1 text-xs">*</span>
                                  )}
                                </span>
                                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full',
                                      isBest
                                        ? 'bg-neon-green'
                                        : 'bg-gradient-to-r from-neon-cyan to-purple-glow'
                                    )}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-text-muted">N/A</span>
                            )}
                          </td>
                        );
                      })}
                    </CompareRow>
                  ))}

                  {/* Capabilities Section */}
                  <SectionHeader
                    title="Capabilities"
                    colSpan={selectedModels.length + 1}
                  />
                  <CompareRow label="Context Length">
                    {selectedModels.map((model) => {
                      const lengths = selectedModels.map(
                        (m) => m.capabilities.contextLength
                      );
                      const maxLength = Math.max(...lengths);
                      const isBest =
                        model.capabilities.contextLength === maxLength;

                      return (
                        <td key={model.id} className="p-3 text-center">
                          <span
                            className={cn(
                              'font-mono',
                              isBest
                                ? 'text-neon-green font-bold'
                                : 'text-white'
                            )}
                          >
                            {formatContextLength(model.capabilities.contextLength)}
                          </span>
                        </td>
                      );
                    })}
                  </CompareRow>
                  <CompareRow label="Modalities">
                    {selectedModels.map((model) => (
                      <td key={model.id} className="p-3 text-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {model.capabilities.modalities.map((mod) => (
                            <span
                              key={mod}
                              className="px-1.5 py-0.5 text-[10px] rounded bg-white/10 text-text-secondary"
                            >
                              {mod}
                            </span>
                          ))}
                        </div>
                      </td>
                    ))}
                  </CompareRow>
                  {(['functionCalling', 'streaming', 'jsonMode', 'vision'] as const).map(
                    (cap) => (
                      <CompareRow key={cap} label={formatCapabilityName(cap)}>
                        {selectedModels.map((model) => (
                          <td key={model.id} className="p-3 text-center">
                            <BooleanIndicator
                              value={model.capabilities[cap] as boolean}
                            />
                          </td>
                        ))}
                      </CompareRow>
                    )
                  )}

                  {/* Pricing Section */}
                  <SectionHeader
                    title="Pricing (per 1M tokens)"
                    colSpan={selectedModels.length + 1}
                  />
                  <CompareRow label="Input">
                    {selectedModels.map((model) => {
                      const prices = selectedModels
                        .filter((m) => m.pricing?.promptPer1M)
                        .map((m) => m.pricing!.promptPer1M);
                      const lowestPrice =
                        prices.length > 0 ? Math.min(...prices) : null;
                      const isBest =
                        model.pricing?.promptPer1M === lowestPrice &&
                        prices.length > 1;

                      return (
                        <td key={model.id} className="p-3 text-center">
                          {model.pricing ? (
                            <span
                              className={cn(
                                'font-mono',
                                isBest
                                  ? 'text-neon-green font-bold'
                                  : 'text-white'
                              )}
                            >
                              {formatPrice(model.pricing.promptPer1M)}
                            </span>
                          ) : (
                            <span className="text-text-muted">N/A</span>
                          )}
                        </td>
                      );
                    })}
                  </CompareRow>
                  <CompareRow label="Output">
                    {selectedModels.map((model) => {
                      const prices = selectedModels
                        .filter((m) => m.pricing?.completionPer1M)
                        .map((m) => m.pricing!.completionPer1M);
                      const lowestPrice =
                        prices.length > 0 ? Math.min(...prices) : null;
                      const isBest =
                        model.pricing?.completionPer1M === lowestPrice &&
                        prices.length > 1;

                      return (
                        <td key={model.id} className="p-3 text-center">
                          {model.pricing ? (
                            <span
                              className={cn(
                                'font-mono',
                                isBest
                                  ? 'text-neon-green font-bold'
                                  : 'text-white'
                              )}
                            >
                              {formatPrice(model.pricing.completionPer1M)}
                            </span>
                          ) : (
                            <span className="text-text-muted">N/A</span>
                          )}
                        </td>
                      );
                    })}
                  </CompareRow>
                </tbody>
              </table>
            </div>

            {/* Footer Legend */}
            <div className="px-6 py-3 border-t border-glass-border">
              <p className="text-xs text-text-muted">
                <span className="text-neon-green font-medium">*</span> = Best in
                category among selected models
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SectionHeader({
  title,
  colSpan,
}: {
  title: string;
  colSpan: number;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="pt-6 pb-2 px-3 text-xs font-semibold text-neon-cyan uppercase tracking-wider"
      >
        {title}
      </td>
    </tr>
  );
}

function CompareRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <tr className="border-b border-glass-border/50 hover:bg-white/2">
      <td className="p-3 text-sm text-text-secondary whitespace-nowrap">
        {label}
      </td>
      {children}
    </tr>
  );
}

function BooleanIndicator({ value }: { value: boolean }) {
  return value ? (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-neon-green/20 text-neon-green">
      <Check className="w-3 h-3" />
    </span>
  ) : (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/5 text-text-muted">
      <Minus className="w-3 h-3" />
    </span>
  );
}

function formatCapabilityName(key: string): string {
  const names: Record<string, string> = {
    functionCalling: 'Function Calling',
    streaming: 'Streaming',
    fineTunable: 'Fine-Tunable',
    jsonMode: 'JSON Mode',
    vision: 'Vision',
  };
  return names[key] || key;
}

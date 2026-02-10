'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Filter,
  ChevronDown,
  X,
  Building2,
  Cpu,
  DollarSign,
  FileText,
  SortAsc,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RangeSlider } from '@/components/ui/range-slider';
import { SearchInput } from './SearchBar';
import type { LeaderboardFilters, Modality, ModelType } from '@/lib/types';
import { formatContextLength, formatPrice } from '@/lib/data/constants';

interface FilterPanelProps {
  filters: LeaderboardFilters;
  onChange: (filters: Partial<LeaderboardFilters>) => void;
  options: {
    companies: string[];
    modelTypes: string[];
    modalities: string[];
    maxContext: number;
    maxPrice: number;
  };
  className?: string;
}

/**
 * Advanced filter panel with dropdowns and sliders
 */
export function FilterPanel({
  filters,
  onChange,
  options,
  className,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count active filters
  const activeFilterCount = [
    filters.companies.length > 0,
    filters.modelTypes.length > 0,
    filters.modalities.length > 0,
    filters.contextRange[0] > 0 || filters.contextRange[1] < options.maxContext,
    filters.priceRange[0] > 0 || filters.priceRange[1] < options.maxPrice,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    onChange({
      search: '',
      companies: [],
      modelTypes: [],
      modalities: [],
      contextRange: [0, options.maxContext || 2_000_000],
      priceRange: [0, options.maxPrice || 100],
      sortBy: 'rank',
      sortOrder: 'asc',
      showDeprecated: false,
    });
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Main Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search Input */}
        <SearchInput
          value={filters.search}
          onChange={(search) => onChange({ search })}
          placeholder="Search models..."
          className="flex-1 min-w-[200px]"
        />

        {/* Filter Toggle Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg',
            'border transition-all duration-200',
            isExpanded || activeFilterCount > 0
              ? 'bg-neon-cyan/10 border-neon-cyan/30 text-neon-cyan'
              : 'bg-white/5 border-glass-border text-text-secondary hover:bg-white/10'
          )}
        >
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-neon-cyan text-opta-bg text-xs font-bold">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            className={cn(
              'w-4 h-4 transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        </button>

        {/* Sort Dropdown */}
        <SortDropdown
          sortBy={filters.sortBy}
          sortOrder={filters.sortOrder}
          onChange={(sortBy, sortOrder) => onChange({ sortBy, sortOrder })}
        />

        {/* Clear All */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 px-3 py-2 text-sm text-text-muted hover:text-neon-coral transition-colors"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Expanded Filter Options */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-glass-border">
              {/* Company Filter */}
              <FilterSection icon={Building2} title="Company">
                <MultiSelectDropdown
                  options={options.companies}
                  selected={filters.companies}
                  onChange={(companies) => onChange({ companies })}
                  placeholder="All companies"
                />
              </FilterSection>

              {/* Model Type Filter */}
              <FilterSection icon={Cpu} title="Model Type">
                <MultiSelectDropdown
                  options={options.modelTypes}
                  selected={filters.modelTypes as string[]}
                  onChange={(modelTypes) => onChange({ modelTypes: modelTypes as ModelType[] })}
                  placeholder="All types"
                />
              </FilterSection>

              {/* Context Length Filter */}
              <FilterSection icon={FileText} title="Context Length">
                <RangeSlider
                  min={0}
                  max={options.maxContext || 2_000_000}
                  value={filters.contextRange}
                  onChange={(contextRange) => onChange({ contextRange })}
                  step={1000}
                  formatLabel={(v) => formatContextLength(v)}
                />
              </FilterSection>

              {/* Price Range Filter */}
              <FilterSection icon={DollarSign} title="Price (per 1M tokens)">
                <RangeSlider
                  min={0}
                  max={options.maxPrice || 100}
                  value={filters.priceRange}
                  onChange={(priceRange) => onChange({ priceRange })}
                  step={0.1}
                  formatLabel={(v) => formatPrice(v)}
                />
              </FilterSection>
            </div>

            {/* Modality Chips */}
            <div className="mt-4">
              <p className="text-xs text-text-muted mb-2">Modalities</p>
              <div className="flex flex-wrap gap-2">
                {(options.modalities as Modality[]).map((modality) => (
                  <button
                    key={modality}
                    onClick={() => {
                      const newModalities = filters.modalities.includes(modality)
                        ? filters.modalities.filter((m) => m !== modality)
                        : [...filters.modalities, modality];
                      onChange({ modalities: newModalities });
                    }}
                    className={cn(
                      'px-3 py-1.5 text-sm rounded-lg border transition-all duration-200',
                      filters.modalities.includes(modality)
                        ? 'bg-purple-glow/20 border-purple-glow/40 text-purple-glow'
                        : 'bg-white/5 border-glass-border text-text-secondary hover:bg-white/10'
                    )}
                  >
                    {modality}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle Options */}
            <div className="mt-4 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.showDeprecated}
                  onChange={(e) =>
                    onChange({ showDeprecated: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-glass-border bg-white/5 text-neon-cyan focus:ring-neon-cyan/50"
                />
                <span className="text-sm text-text-secondary">
                  Show deprecated models
                </span>
              </label>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-text-muted">
        <Icon className="w-3.5 h-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

function MultiSelectDropdown({
  options,
  selected,
  onChange,
  placeholder,
}: {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter((s) => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm',
          'bg-white/5 border border-glass-border',
          'text-left transition-colors hover:bg-white/10',
          isOpen && 'ring-1 ring-neon-cyan/50'
        )}
      >
        <span className={cn(selected.length === 0 && 'text-text-muted')}>
          {selected.length === 0
            ? placeholder
            : selected.length === 1
              ? selected[0]
              : `${selected.length} selected`}
        </span>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-text-muted transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              'absolute z-20 w-full mt-1 py-1 rounded-lg',
              'bg-opta-bg/95 backdrop-blur-xl border border-glass-border',
              'shadow-xl max-h-48 overflow-auto'
            )}
          >
            {options.map((option) => (
              <button
                key={option}
                onClick={() => toggleOption(option)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left',
                  'hover:bg-white/5 transition-colors',
                  selected.includes(option) && 'text-neon-cyan'
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center w-4 h-4 rounded border',
                    selected.includes(option)
                      ? 'bg-neon-cyan/20 border-neon-cyan'
                      : 'border-glass-border'
                  )}
                >
                  {selected.includes(option) && (
                    <svg
                      className="w-2.5 h-2.5"
                      fill="currentColor"
                      viewBox="0 0 12 12"
                    >
                      <path d="M10.28 2.28L4 8.56l-2.28-2.28a.75.75 0 00-1.06 1.06l2.81 2.81a.75.75 0 001.06 0l6.97-6.97a.75.75 0 00-1.06-1.06z" />
                    </svg>
                  )}
                </span>
                {option}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop to close dropdown */}
      {isOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

function SortDropdown({
  sortBy,
  sortOrder,
  onChange,
}: {
  sortBy: LeaderboardFilters['sortBy'];
  sortOrder: LeaderboardFilters['sortOrder'];
  onChange: (sortBy: LeaderboardFilters['sortBy'], sortOrder: LeaderboardFilters['sortOrder']) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const sortOptions: { value: LeaderboardFilters['sortBy']; label: string }[] = [
    { value: 'rank', label: 'Rank' },
    { value: 'score', label: 'Score' },
    { value: 'name', label: 'Name' },
    { value: 'company', label: 'Company' },
    { value: 'price', label: 'Price' },
    { value: 'context', label: 'Context Length' },
  ];

  const currentLabel = sortOptions.find((o) => o.value === sortBy)?.label || 'Rank';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
          'bg-white/5 border border-glass-border',
          'text-text-secondary hover:bg-white/10 transition-colors'
        )}
      >
        <SortAsc className="w-4 h-4" />
        <span>{currentLabel}</span>
        <span className="text-text-muted">
          {sortOrder === 'asc' ? '↑' : '↓'}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              'absolute right-0 z-20 w-40 mt-1 py-1 rounded-lg',
              'bg-opta-bg/95 backdrop-blur-xl border border-glass-border',
              'shadow-xl'
            )}
          >
            {sortOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  if (sortBy === option.value) {
                    // Toggle order if clicking same option
                    onChange(option.value, sortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    onChange(option.value, 'asc');
                  }
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 text-sm text-left',
                  'hover:bg-white/5 transition-colors',
                  sortBy === option.value && 'text-neon-cyan'
                )}
              >
                {option.label}
                {sortBy === option.value && (
                  <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {isOpen && (
        <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

/**
 * Compact filter pills for quick access
 */
export function FilterPills({
  filters,
  onChange,
  className,
}: {
  filters: LeaderboardFilters;
  onChange: (filters: Partial<LeaderboardFilters>) => void;
  className?: string;
}) {
  const activePills: { label: string; onRemove: () => void }[] = [];

  // Add active filter pills
  filters.companies.forEach((company) => {
    activePills.push({
      label: company,
      onRemove: () =>
        onChange({
          companies: filters.companies.filter((c) => c !== company),
        }),
    });
  });

  filters.modelTypes.forEach((type) => {
    activePills.push({
      label: type,
      onRemove: () =>
        onChange({
          modelTypes: filters.modelTypes.filter((t) => t !== type),
        }),
    });
  });

  filters.modalities.forEach((modality) => {
    activePills.push({
      label: modality,
      onRemove: () =>
        onChange({
          modalities: filters.modalities.filter((m) => m !== modality),
        }),
    });
  });

  if (activePills.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {activePills.map((pill, index) => (
        <span
          key={`${pill.label}-${index}`}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs',
            'bg-purple-glow/20 border border-purple-glow/30 text-purple-glow'
          )}
        >
          {pill.label}
          <button
            onClick={pill.onRemove}
            className="hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
}

/**
 * LearnModeExplanation - Reusable explanation components for Learn Mode.
 *
 * When Learn Mode is active, these components display educational content
 * to help users understand what Opta is doing and why.
 *
 * Explanations adapt to user expertise level:
 * - simple: Plain language, essential information only
 * - standard: Balanced explanations with helpful context
 * - power: Full technical details always visible
 *
 * Uses ExpertiseContext for level detection and CommunicationStyleContext
 * for verbosity preferences.
 */

import { useState, useCallback } from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import { useLearnMode } from './LearnModeContext';
import { useExpertise } from './ExpertiseContext';
import { useCommunicationStyle } from './CommunicationStyleContext';
import { useExpertiseTracking } from '@/hooks/useExpertise';
import { cn } from '@/lib/utils';

import { Info, Lightbulb, HelpCircle, ChevronRight, ChevronDown } from 'lucide-react';

type ExplanationType = 'info' | 'tip' | 'how-it-works';

/**
 * Content structure for expertise-level explanations.
 */
export interface ExpertiseLevelContent {
  /** Simple explanation for beginners */
  simple: string;
  /** Standard explanation for regular users */
  standard: string;
  /** Detailed explanation for power users */
  power: string;
}

/**
 * Extended content for Learn Mode topics with verbosity options.
 */
interface LearnModeTopicContent {
  /** Full explanation for each expertise level */
  full: ExpertiseLevelContent;
  /** Short version for concise mode */
  short: ExpertiseLevelContent;
  /** Technical details for power users */
  technical?: string;
}

/**
 * Pre-defined Learn Mode content for common optimization topics.
 * Adapts to both expertise level and communication style.
 */
export const LEARN_MODE_CONTENT: Record<string, LearnModeTopicContent> = {
  stealth_mode: {
    full: {
      simple:
        "Stealth Mode is like putting your computer into 'gaming mode'. It pauses background apps so your game runs better!",
      standard:
        'Stealth Mode temporarily disables non-essential background processes and services to maximize gaming performance. Resources are freed up for your game.',
      power:
        'Stealth Mode suspends low-priority processes, terminates resource-hungry background services, and adjusts CPU affinity to prioritize your game thread. Memory is defragmented and GPU scheduling is optimized.',
    },
    short: {
      simple: 'Pauses background apps for better gaming.',
      standard: 'Temporarily frees system resources for your game.',
      power: 'Process suspension + CPU affinity optimization.',
    },
    technical:
      'Implements SIGSTOP for suspendable processes, adjusts nice values, modifies cgroup resource limits, and utilizes platform-specific GPU scheduler hints (DXGI flip model on Windows, Metal scheduling hints on macOS).',
  },
  optimization_score: {
    full: {
      simple:
        "Your Optimization Score shows how well your system is set up for gaming. Higher is better - like a grade for your PC!",
      standard:
        'The Optimization Score measures your system configuration against optimal gaming settings. It considers hardware utilization, background processes, and game-specific settings.',
      power:
        'Composite score derived from three dimensions: Performance (frame consistency, 1% lows), Experience (visual quality vs. hardware capability), and Competitive Edge (input latency, network optimization).',
    },
    short: {
      simple: 'A grade showing how gaming-ready your PC is.',
      standard: 'Measures system optimization for gaming performance.',
      power: 'Multi-dimensional score: Performance + Experience + Competitive.',
    },
    technical:
      'Weighted algorithm: 40% Performance (frame times, stutter analysis), 35% Experience (resolution, quality settings vs. hardware tier), 25% Competitive (input pipeline, network buffer optimization). Normalized against community percentile data.',
  },
  conflict_detection: {
    full: {
      simple:
        "Some programs don't play nicely together. Opta finds these conflicts so your games don't have problems!",
      standard:
        'Conflict Detection identifies software that may interfere with gaming performance - like overlays, resource monitors, or other optimization tools running simultaneously.',
      power:
        'Scans for competing process injection (overlays), duplicate GPU schedulers, conflicting input hooks, and resource contention from parallel optimization suites.',
    },
    short: {
      simple: 'Finds programs that might cause game issues.',
      standard: 'Identifies software conflicts affecting performance.',
      power: 'Detects injection conflicts + resource contention.',
    },
    technical:
      'Pattern matching on process names and signatures. Checks for DLL injection hooks, input interception chains, GPU present queues, and MMIO resource conflicts. Severity scored by measured performance impact.',
  },
  game_detection: {
    full: {
      simple: 'Opta finds all your games automatically from Steam, Epic, GOG, and more!',
      standard:
        'Game Detection scans your system for installed games across all major launchers. This enables automatic optimization based on known game requirements.',
      power:
        'Multi-launcher scanning (Steam, Epic, GOG, Xbox, Origin, Ubisoft Connect) via registry, VDF parsing, and manifest reading. Maintains optimization database with game-specific settings.',
    },
    short: {
      simple: 'Automatically finds all your installed games.',
      standard: 'Scans for games across all major launchers.',
      power: 'Multi-launcher manifest parsing + optimization DB.',
    },
    technical:
      'Steam: libraryfolders.vdf + appmanifest_*.acf parsing. Epic: LauncherInstalled.dat JSON. GOG: galaxy.db SQLite. Registry scanning for legacy installations. SHA256 matching for portable games.',
  },
  hardware_telemetry: {
    full: {
      simple:
        'The meters show how hard your computer is working - like a speedometer for your PC!',
      standard:
        'Hardware Telemetry monitors CPU, GPU, memory, and disk usage in real-time. This helps identify bottlenecks affecting game performance.',
      power:
        'Real-time monitoring via sysinfo (cross-platform), GPUtil/pynvml (NVIDIA), and platform-specific APIs. Tracks utilization, temperatures, clock speeds, and memory bandwidth.',
    },
    short: {
      simple: 'Shows how hard your computer is working.',
      standard: 'Real-time hardware usage monitoring.',
      power: 'Cross-platform telemetry via sysinfo + GPU APIs.',
    },
    technical:
      'Polling interval: 1s for telemetry, 3s for processes. GPU detection chain: GPUtil -> pynvml -> system_profiler (macOS). Memory includes per-process working set analysis for potential reclaim estimation.',
  },
  process_management: {
    full: {
      simple: 'Shows all the programs running on your computer. You can close ones you dont need!',
      standard:
        'Process Management displays all running applications and background services. You can terminate or deprioritize processes that may impact gaming.',
      power:
        'Full process enumeration with categorization (system, user, background). Supports graceful termination (SIGTERM), force kill (SIGKILL), and priority adjustment.',
    },
    short: {
      simple: 'Lists and manages running programs.',
      standard: 'View and control running processes.',
      power: 'Process enumeration + priority/termination control.',
    },
    technical:
      'Uses psutil for cross-platform process info. Termination: 0.5s graceful window then force kill. Safe mode excludes critical system processes (PID 0, 1, kernel threads).',
  },
};

interface LearnModeExplanationProps {
  /** Title of the explanation */
  title: string;
  /** Main description text (or expertise-level content object) */
  description: string | ExpertiseLevelContent;
  /** Short description for concise mode (optional, falls back to truncating description) */
  shortDescription?: string;
  /** Optional technical details (expandable for simple/standard, always shown for power) */
  details?: string;
  /** Type of explanation (affects styling) */
  type?: ExplanationType;
  /** Optional additional className */
  className?: string;
}

/**
 * Main explanation component - shows a styled card when Learn Mode is active.
 * Adapts content complexity to user expertise level and communication style.
 */
export function LearnModeExplanation({
  title,
  description,
  shortDescription,
  details,
  type = 'info',
  className,
}: LearnModeExplanationProps) {
  const { isLearnMode } = useLearnMode();
  const { level } = useExpertise();
  const { isVerbose } = useCommunicationStyle();
  const { trackTechnicalExpand } = useExpertiseTracking();
  const [expanded, setExpanded] = useState(false);
  const [showMore, setShowMore] = useState(false);

  if (!isLearnMode) return null;

  // Get the appropriate description based on expertise level
  const fullDescriptionText =
    typeof description === 'string' ? description : description[level] || description.standard;

  // In concise mode, use short description or show truncated version with "Learn more"
  const displayDescription = isVerbose ? fullDescriptionText : shortDescription || fullDescriptionText;

  // Show "Learn more" button if in concise mode and we have more content
  const hasMoreContent = !isVerbose && !shortDescription && fullDescriptionText.length > 100;

  // Power users always see technical details expanded
  const showTechnicalDetails = level === 'power';
  const hasExpandableDetails = details && !showTechnicalDetails;

  const Icon = {
    info: Info,
    tip: Lightbulb,
    'how-it-works': HelpCircle,
  }[type];

  const colors = {
    info: 'text-primary border-primary/30 bg-primary/10',
    tip: 'text-success border-success/30 bg-success/10',
    'how-it-works': 'text-warning border-warning/30 bg-warning/10',
  }[type];

  const handleExpandDetails = useCallback(() => {
    setExpanded(true);
    trackTechnicalExpand();
  }, [trackTechnicalExpand]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, maxHeight: 0 }}
        animate={{ opacity: 1, y: 0, maxHeight: 600 }}
        exit={{ opacity: 0, y: -8, maxHeight: 0 }}
        className={cn('rounded-lg border p-3 my-2 overflow-hidden', colors, className)}
      >
        <div className="flex items-start gap-2">
          <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" strokeWidth={1.75} />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{title}</div>
            <div className="text-sm opacity-80 leading-relaxed">
              {hasMoreContent && !showMore ? displayDescription.slice(0, 100) + '...' : displayDescription}
            </div>

            {/* "Learn more" button for concise mode when content is truncated */}
            {hasMoreContent && !showMore && (
              <motion.button
                onClick={() => setShowMore(true)}
                className="mt-1 text-xs cursor-pointer text-primary hover:underline"
                whileTap={{ scale: 0.98 }}
              >
                Learn more...
              </motion.button>
            )}

            {/* Technical details - expandable for simple/standard, always visible for power */}
            {showTechnicalDetails && details && (
              <motion.div
                initial={{ opacity: 0, maxHeight: 0 }}
                animate={{ opacity: 1, maxHeight: 200 }}
                className="mt-2 pt-2 border-t border-current/20 overflow-hidden"
              >
                <p className="text-xs font-mono opacity-70 leading-relaxed">
                  <span className="font-semibold">Advanced: </span>
                  {details}
                </p>
              </motion.div>
            )}

            {/* Only show technical details expansion when in verbose mode or user expanded */}
            {hasExpandableDetails && isVerbose && !expanded && (
              <motion.button
                onClick={handleExpandDetails}
                className="mt-2 text-xs cursor-pointer flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
                whileTap={{ scale: 0.98 }}
              >
                <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
                Technical details
              </motion.button>
            )}

            {hasExpandableDetails && expanded && (
              <motion.div initial={{ opacity: 0, maxHeight: 0 }} animate={{ opacity: 1, maxHeight: 300 }} className="overflow-hidden">
                <motion.button
                  onClick={() => setExpanded(false)}
                  className="mt-2 text-xs cursor-pointer flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
                  whileTap={{ scale: 0.98 }}
                >
                  <ChevronDown className="w-3 h-3" strokeWidth={1.5} />
                  Technical details
                </motion.button>
                <p className="text-xs mt-1 opacity-70 pl-4 leading-relaxed">{details}</p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface LearnModeTopicProps {
  /** Topic key from LEARN_MODE_CONTENT */
  topic: keyof typeof LEARN_MODE_CONTENT;
  /** Type of explanation (affects styling) */
  type?: ExplanationType;
  /** Optional additional className */
  className?: string;
}

/**
 * Topic-based explanation using pre-defined content.
 * Automatically adapts to expertise level and communication style.
 */
export function LearnModeTopic({ topic, type = 'info', className }: LearnModeTopicProps) {
  const { isLearnMode } = useLearnMode();
  const { level } = useExpertise();
  const { isVerbose } = useCommunicationStyle();

  if (!isLearnMode) return null;

  const content = LEARN_MODE_CONTENT[topic];
  if (!content) return null;

  // Get the appropriate content based on expertise and verbosity
  const description = isVerbose ? content.full[level] : content.short[level];
  const technical = level === 'power' ? content.technical : undefined;

  // Generate title from topic key
  const title = topic
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return (
    <LearnModeExplanation
      title={title}
      description={description}
      details={technical}
      type={type}
      className={className}
    />
  );
}

interface LearnModeHintProps {
  /** The content to wrap with a hint */
  children: React.ReactNode;
  /** The hint text to show on hover (or expertise-level content) */
  hint: string | ExpertiseLevelContent;
  /** Short hint for concise mode (optional) */
  shortHint?: string;
}

/**
 * Compact inline hint - shows tooltip-style hint on hover when Learn Mode is active.
 * Adapts hint content to user expertise level and communication style.
 */
export function LearnModeHint({ children, hint, shortHint }: LearnModeHintProps) {
  const { isLearnMode } = useLearnMode();
  const { level } = useExpertise();
  const { isVerbose } = useCommunicationStyle();

  // Get the appropriate hint based on expertise level
  const fullHintText = typeof hint === 'string' ? hint : hint[level] || hint.standard;

  // In concise mode, use short hint if provided
  const hintText = isVerbose ? fullHintText : shortHint || fullHintText;

  return (
    <span className="relative group inline-flex items-center">
      {children}
      {isLearnMode && (
        <span
          className={cn(
            'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
            'px-2.5 py-1.5 text-xs font-medium',
            'bg-primary text-primary-foreground rounded-lg',
            'whitespace-nowrap opacity-0 group-hover:opacity-100',
            'transition-opacity duration-200 pointer-events-none',
            'shadow-lg z-50'
          )}
        >
          {hintText}
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-primary" />
        </span>
      )}
    </span>
  );
}

interface LearnModeSectionProps {
  /** Title for the section (or expertise-level content) */
  title: string | ExpertiseLevelContent;
  /** Description content */
  children: React.ReactNode;
  /** Type of explanation */
  type?: ExplanationType;
  /** Optional className */
  className?: string;
}

/**
 * Section wrapper - wraps content with Learn Mode explanation header.
 * Only shows the header when Learn Mode is active.
 * Adapts title to user expertise level.
 */
export function LearnModeSection({ title, children, type = 'info', className }: LearnModeSectionProps) {
  const { isLearnMode } = useLearnMode();
  const { level } = useExpertise();

  // Get the appropriate title based on expertise level
  const titleText = typeof title === 'string' ? title : title[level] || title.standard;

  const Icon = {
    info: Info,
    tip: Lightbulb,
    'how-it-works': HelpCircle,
  }[type];

  const iconColors = {
    info: 'text-primary bg-primary/10',
    tip: 'text-success bg-success/10',
    'how-it-works': 'text-warning bg-warning/10',
  }[type];

  return (
    <div className={className}>
      <AnimatePresence>
        {isLearnMode && (
          <motion.div
            initial={{ opacity: 0, maxHeight: 0 }}
            animate={{ opacity: 1, maxHeight: 100 }}
            exit={{ opacity: 0, maxHeight: 0 }}
            className="flex items-center gap-2 mb-2 overflow-hidden"
          >
            <div className={cn('p-1 rounded-md', iconColors)}>
              <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{titleText}</span>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </div>
  );
}

export default LearnModeExplanation;

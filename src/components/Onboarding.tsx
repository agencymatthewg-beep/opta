/**
 * Onboarding - The Obsidian Welcome Experience
 *
 * Conversational onboarding with obsidian glass styling and energy effects.
 *
 * @see DESIGN_SYSTEM.md - Part 4: The Obsidian Glass Material System
 */

import { useState, useMemo } from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import { cn } from '@/lib/utils';

// Easing curve for smooth energy transitions
const smoothOut: [number, number, number, number] = [0.22, 1, 0.36, 1];

import {
  Zap,
  Palette,
  Scale,
  Eye,
  Gauge,
  Wrench,
  Crosshair,
  Gamepad2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

import type { ExpertiseLevel } from '@/types/expertise';

/**
 * Onboarding preferences interface.
 */
export interface OnboardingPreferences {
  priority: 'fps' | 'quality' | 'balanced';
  expertise: 'simple' | 'standard' | 'power';
  gameType: 'competitive' | 'story' | 'both';
}

/**
 * Props for Onboarding component.
 */
interface OnboardingProps {
  onComplete: (preferences: OnboardingPreferences) => void;
}

/**
 * Question option definition.
 */
interface QuestionOption {
  value: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

/**
 * Question content that adapts to expertise level.
 */
interface AdaptiveContent {
  simple: { title: string; subtitle: string };
  standard: { title: string; subtitle: string };
  power: { title: string; subtitle: string };
}

/**
 * Question definition with optional adaptive content.
 */
interface Question {
  id: keyof OnboardingPreferences;
  title: string;
  subtitle: string;
  /** Adaptive titles/subtitles based on selected expertise (for questions after expertise selection) */
  adaptiveContent?: AdaptiveContent;
  options: QuestionOption[];
}

/**
 * Get questions with content adapted to expertise level.
 */
function getQuestions(expertiseLevel: ExpertiseLevel): Question[] {
  return [
    {
      id: 'priority',
      title: "What matters most to you?",
      subtitle: "I'll optimize accordingly.",
      options: [
        { value: 'fps', label: 'Maximum FPS', desc: 'Every frame counts', icon: Zap },
        { value: 'quality', label: 'Visual Quality', desc: 'Keep games looking great', icon: Palette },
        { value: 'balanced', label: 'Balanced', desc: 'Best of both worlds', icon: Scale },
      ],
    },
    {
      id: 'expertise',
      title: "How technical are you?",
      subtitle: "I'll adjust my explanations.",
      options: [
        { value: 'simple', label: 'Keep it simple', desc: 'Plain language only', icon: Eye },
        { value: 'standard', label: 'Standard', desc: 'Good balance', icon: Gauge },
        { value: 'power', label: 'Show me everything', desc: 'Full technical details', icon: Wrench },
      ],
    },
    {
      id: 'gameType',
      title: {
        simple: "What games do you like?",
        standard: "What kind of games do you play?",
        power: "Game genre focus?",
      }[expertiseLevel],
      subtitle: {
        simple: "I'll help make them run better!",
        standard: "I'll prioritize those optimizations.",
        power: "Determines optimization profile priority.",
      }[expertiseLevel],
      options: [
        {
          value: 'competitive',
          label: {
            simple: 'Fast games',
            standard: 'Competitive',
            power: 'Competitive/Esports',
          }[expertiseLevel],
          desc: {
            simple: 'Shooters, racing',
            standard: 'Valorant, CS2, Apex',
            power: 'Input latency focus, 1%/0.1% lows',
          }[expertiseLevel],
          icon: Crosshair,
        },
        {
          value: 'story',
          label: {
            simple: 'Adventure games',
            standard: 'Story/Adventure',
            power: 'Single-player/Immersive',
          }[expertiseLevel],
          desc: {
            simple: 'Explore, adventure',
            standard: 'RPGs, open world',
            power: 'Visual quality priority, stable frametime',
          }[expertiseLevel],
          icon: Gamepad2,
        },
        {
          value: 'both',
          label: {
            simple: 'Everything!',
            standard: 'Both',
            power: 'Mixed workload',
          }[expertiseLevel],
          desc: {
            simple: 'I play all kinds',
            standard: 'I play everything',
            power: 'Balanced profile, per-game tuning',
          }[expertiseLevel],
          icon: Sparkles,
        },
      ],
    },
  ];
}

/**
 * Welcome screen content adapted to expertise level.
 * Exported for potential use in other welcome/intro screens.
 */
export const WELCOME_CONTENT: Record<ExpertiseLevel, { title: string; subtitle: string }> = {
  simple: {
    title: "Hi there!",
    subtitle: "I'm Opta. Let me help make your games run better.",
  },
  standard: {
    title: "Welcome to Opta",
    subtitle: "Let's optimize your system for peak performance.",
  },
  power: {
    title: "Opta Initialized",
    subtitle: "Ready to analyze your system configuration.",
  },
};

/**
 * Onboarding component.
 */
export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingPreferences>>({});

  // Determine expertise level for adaptive content
  const expertiseLevel: ExpertiseLevel = (answers.expertise as ExpertiseLevel) || 'standard';

  // Get questions adapted to current expertise selection
  const questions = useMemo(() => getQuestions(expertiseLevel), [expertiseLevel]);
  const currentQuestion = questions[step];

  const handleSelect = (value: string) => {
    const newAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(newAnswers);

    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      onComplete(newAnswers as OnboardingPreferences);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center"
    >
      <motion.div
        className={cn(
          "relative p-8 rounded-2xl max-w-md w-full mx-4 overflow-hidden",
          // Obsidian glass material
          "bg-[#05030a]/90 backdrop-blur-2xl",
          "border border-white/[0.08]",
          // Inner specular highlight
          "before:absolute before:inset-x-0 before:top-0 before:h-px before:z-10",
          "before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent",
          // Energy glow shadow
          "shadow-[0_0_60px_-15px_rgba(168,85,247,0.3)]"
        )}
        initial={{ opacity: 0, scale: 0.95, filter: 'brightness(0.5)' }}
        animate={{ opacity: 1, scale: 1, filter: 'brightness(1)' }}
        transition={{ ease: smoothOut }}
      >
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {questions.map((_, i) => (
            <motion.div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: i * 0.1 }}
            />
          ))}
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${step}-${expertiseLevel}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h2 className="text-2xl font-semibold mb-2 text-foreground">
              {currentQuestion.title}
            </h2>
            <p className="text-muted-foreground mb-6">{currentQuestion.subtitle}</p>

            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const Icon = option.icon;
                return (
                  <motion.button
                    key={option.value}
                    className={cn(
                      "w-full p-4 rounded-xl text-left",
                      // Obsidian subtle glass
                      "bg-white/[0.02] border border-white/[0.06]",
                      // Hover energy state
                      "hover:bg-primary/[0.08] hover:border-primary/40",
                      "hover:shadow-[inset_0_0_15px_rgba(168,85,247,0.08),0_0_15px_-5px_rgba(168,85,247,0.2)]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      "transition-all duration-200"
                    )}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, ease: smoothOut }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect(option.value)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        "bg-primary/10 border border-primary/30"
                      )}>
                        <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-foreground">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.desc}</div>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground/50" strokeWidth={2} />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Step indicator with adaptive messaging */}
        <motion.div
          className="text-center mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-xs text-muted-foreground/50">
            Question {step + 1} of {questions.length}
          </p>
          {/* Show personalized message after expertise selection */}
          {step > 1 && (
            <motion.p
              className="text-xs text-primary/70 mt-1"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {expertiseLevel === 'simple' && "Almost done!"}
              {expertiseLevel === 'standard' && "One more question..."}
              {expertiseLevel === 'power' && "Final configuration step."}
            </motion.p>
          )}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default Onboarding;

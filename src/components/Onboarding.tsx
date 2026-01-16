/**
 * Onboarding - Conversational onboarding flow for first-time users.
 *
 * Collects user preferences through a friendly 3-question quiz:
 * - Priority (FPS, Quality, Balanced)
 * - Expertise level (Simple, Standard, Power)
 * - Game types (Competitive, Story, Both)
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
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
 * Question definition.
 */
interface Question {
  id: keyof OnboardingPreferences;
  title: string;
  subtitle: string;
  options: QuestionOption[];
}

const questions: Question[] = [
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
    title: "What kind of games do you play?",
    subtitle: "I'll prioritize those optimizations.",
    options: [
      { value: 'competitive', label: 'Competitive', desc: 'Valorant, CS2, Apex', icon: Crosshair },
      { value: 'story', label: 'Story/Adventure', desc: 'RPGs, open world', icon: Gamepad2 },
      { value: 'both', label: 'Both', desc: 'I play everything', icon: Sparkles },
    ],
  },
];

/**
 * Onboarding component.
 */
export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<OnboardingPreferences>>({});

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
        className="glass p-8 rounded-2xl max-w-md w-full mx-4"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
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
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h2 className="text-2xl font-semibold mb-2 text-foreground">{currentQuestion.title}</h2>
            <p className="text-muted-foreground mb-6">{currentQuestion.subtitle}</p>

            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const Icon = option.icon;
                return (
                  <motion.button
                    key={option.value}
                    className={cn(
                      "w-full p-4 glass-subtle rounded-xl text-left",
                      "border border-border/30",
                      "hover:bg-primary/10 hover:border-primary/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    )}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
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

        {/* Step indicator */}
        <motion.p
          className="text-center text-xs text-muted-foreground/50 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Question {step + 1} of {questions.length}
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

export default Onboarding;

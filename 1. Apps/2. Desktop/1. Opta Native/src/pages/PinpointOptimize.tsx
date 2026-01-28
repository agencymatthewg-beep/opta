import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { GoalSelector, type OptimizationGoal } from '../components/pinpoint/GoalSelector';
import { GameSelector } from '../components/pinpoint/GameSelector';
import { AnalysisStep } from '../components/pinpoint/AnalysisStep';
import { ReviewStep, type Recommendation } from '../components/pinpoint/ReviewStep';
import { ApplyStep } from '../components/pinpoint/ApplyStep';
import { ResultsStep } from '../components/pinpoint/ResultsStep';
import { ProgressIndicator } from '../components/pinpoint/ProgressIndicator';

import { cn } from '@/lib/utils';
import type { DetectedGame } from '../types/games';
import { Target, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type WizardStep = 'select-goal' | 'select-game' | 'analyze' | 'review' | 'apply' | 'results';

const STEP_ORDER: WizardStep[] = ['select-goal', 'select-game', 'analyze', 'review', 'apply', 'results'];

/**
 * PinpointOptimize - Wizard-style focused optimization sessions.
 *
 * Guides users through a multi-step flow to optimize for a single goal
 * like "Maximize FPS" or "Reduce Heat" for a specific game.
 */
function PinpointOptimize() {
  const [step, setStep] = useState<WizardStep>('select-goal');
  const [goal, setGoal] = useState<OptimizationGoal | null>(null);
  const [game, setGame] = useState<DetectedGame | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  // Get step index for progress indicator
  const stepIndex = STEP_ORDER.indexOf(step);

  // Handle going back to previous step
  const handleBack = () => {
    const currentIndex = STEP_ORDER.indexOf(step);
    if (currentIndex > 0) {
      setStep(STEP_ORDER[currentIndex - 1]);
    }
  };

  // Check if we can go back (not on first step or results)
  const canGoBack = stepIndex > 0 && step !== 'results';

  // Reset wizard to start
  const handleReset = () => {
    setStep('select-goal');
    setGoal(null);
    setGame(null);
    setRecommendations([]);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <motion.div
        className="flex items-center gap-3 mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <Target className="w-5 h-5 text-primary" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Pinpoint Optimization
          </h1>
          <p className="text-sm text-muted-foreground">
            Focused sessions for specific optimization goals
          </p>
        </div>
      </motion.div>

      {/* Progress indicator */}
      <ProgressIndicator currentStep={step} />

      {/* Main content area */}
      <div className="flex-1 flex items-start justify-center pt-8">
        <div className="w-full max-w-2xl">
          {/* Back button */}
          <AnimatePresence mode="wait">
            {canGoBack && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="mb-4"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className={cn(
                    'gap-1.5 text-muted-foreground hover:text-foreground',
                    'rounded-lg'
                  )}
                >
                  <ChevronLeft className="w-4 h-4" strokeWidth={1.75} />
                  Back
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Wizard steps */}
          <AnimatePresence mode="wait">
            {step === 'select-goal' && (
              <GoalSelector
                key="select-goal"
                onSelect={(g) => {
                  setGoal(g);
                  setStep('select-game');
                }}
              />
            )}

            {step === 'select-game' && goal && (
              <GameSelector
                key="select-game"
                goal={goal}
                onSelect={(g) => {
                  setGame(g);
                  setStep('analyze');
                }}
              />
            )}

            {step === 'analyze' && game && goal && (
              <AnalysisStep
                key="analyze"
                game={game}
                goal={goal}
                onComplete={(recs) => {
                  setRecommendations(recs);
                  setStep('review');
                }}
              />
            )}

            {step === 'review' && (
              <ReviewStep
                key="review"
                recommendations={recommendations}
                onApprove={() => setStep('apply')}
                onSkip={handleReset}
              />
            )}

            {step === 'apply' && (
              <ApplyStep
                key="apply"
                recommendations={recommendations}
                onComplete={() => setStep('results')}
              />
            )}

            {step === 'results' && game && goal && (
              <ResultsStep
                key="results"
                game={game}
                goal={goal}
                recommendations={recommendations}
                onStartNew={handleReset}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default PinpointOptimize;

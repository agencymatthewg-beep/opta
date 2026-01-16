/**
 * PlatformOnboarding - First-launch tutorial explaining platform-specific features.
 *
 * Displays on first app launch to educate users about:
 * - Current platform detection
 * - Available native features
 * - How Opta optimizes for their platform
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlatform } from '../hooks/usePlatform';
import { cn } from '@/lib/utils';
import {
  Apple,
  Monitor,
  Terminal,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Zap,
  Layout,
  CheckCircle,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Props for PlatformOnboarding.
 */
interface PlatformOnboardingProps {
  /** Callback when onboarding is completed */
  onComplete: () => void;
  /** Callback when onboarding is skipped */
  onSkip: () => void;
}

/**
 * Onboarding step definition.
 */
interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  platform?: 'macos' | 'windows' | 'linux' | 'all';
  highlight?: string;
}

/**
 * Get platform icon component.
 */
function getPlatformIcon(platform: string) {
  switch (platform) {
    case 'macos':
      return Apple;
    case 'windows':
      return Monitor;
    case 'linux':
      return Terminal;
    default:
      return Smartphone;
  }
}

/**
 * Platform-specific feature descriptions.
 */
const PLATFORM_FEATURES: Record<string, { title: string; description: string }[]> = {
  macos: [
    { title: 'Menu Bar Access', description: 'Quick access from the menu bar' },
    { title: 'Dock Badge', description: 'Conflict count shown on Dock icon' },
    { title: 'Metal Acceleration', description: 'GPU-accelerated performance' },
  ],
  windows: [
    { title: 'Jump Lists', description: 'Quick actions from taskbar' },
    { title: 'Taskbar Progress', description: 'Progress shown in taskbar' },
    { title: 'Toast Notifications', description: 'Native Windows alerts' },
  ],
  linux: [
    { title: 'Desktop Integration', description: 'Native desktop entry' },
    { title: 'D-Bus Notifications', description: 'freedesktop notifications' },
    { title: 'System Tray', description: 'StatusNotifierItem support' },
  ],
};

/**
 * Individual step content.
 */
function StepContent({
  step,
  platformType,
}: {
  step: OnboardingStep;
  platformType: string;
}) {
  const Icon = step.icon;
  const features = PLATFORM_FEATURES[platformType] || [];

  return (
    <motion.div
      key={step.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="text-center"
    >
      <motion.div
        className={cn(
          'w-20 h-20 mx-auto flex items-center justify-center rounded-full mb-6',
          'bg-gradient-to-br from-primary/20 to-accent/20',
          'border-2 border-primary/30'
        )}
        animate={{
          scale: [1, 1.05, 1],
          boxShadow: [
            '0 0 0 0 hsl(var(--primary) / 0)',
            '0 0 30px 10px hsl(var(--primary) / 0.2)',
            '0 0 0 0 hsl(var(--primary) / 0)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Icon className="w-10 h-10 text-primary" strokeWidth={1.5} />
      </motion.div>

      <h2 className="text-xl font-bold text-foreground mb-3">{step.title}</h2>
      <p className="text-sm text-muted-foreground/80 mb-6 max-w-sm mx-auto">
        {step.description}
      </p>

      {step.highlight && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6',
            'bg-primary/10 border border-primary/30'
          )}
        >
          <Sparkles className="w-4 h-4 text-primary" strokeWidth={2} />
          <span className="text-sm font-medium text-primary">{step.highlight}</span>
        </motion.div>
      )}

      {/* Platform features for platform step */}
      {step.id === 'platform' && features.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 space-y-2"
        >
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className={cn(
                'flex items-center gap-3 px-4 py-2 rounded-xl',
                'glass-subtle border border-border/20',
                'max-w-xs mx-auto'
              )}
            >
              <CheckCircle className="w-4 h-4 text-success flex-shrink-0" strokeWidth={2} />
              <div className="text-left">
                <p className="text-xs font-medium text-foreground">{feature.title}</p>
                <p className="text-xs text-muted-foreground/70">{feature.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Progress dots indicator.
 */
function ProgressDots({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, index) => (
        <motion.div
          key={index}
          className={cn(
            'w-2 h-2 rounded-full transition-colors',
            index === current ? 'bg-primary' : 'bg-muted-foreground/30'
          )}
          animate={index === current ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 0.3 }}
        />
      ))}
    </div>
  );
}

/**
 * PlatformOnboarding component.
 */
function PlatformOnboarding({ onComplete, onSkip }: PlatformOnboardingProps) {
  const { platform, displayName, isDesktop } = usePlatform();
  const [currentStep, setCurrentStep] = useState(0);

  const platformType = platform?.os.type || 'unknown';
  const PlatformIcon = getPlatformIcon(platformType);

  // Define onboarding steps
  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Opta',
      description:
        'Your AI-powered PC optimization companion. One tool to replace them all.',
      icon: Sparkles,
      platform: 'all',
      highlight: 'Intelligent Optimization',
    },
    {
      id: 'platform',
      title: `Running on ${displayName}`,
      description: `Opta has detected your platform and configured itself for optimal performance. Here's what's available:`,
      icon: PlatformIcon,
      platform: platformType as 'macos' | 'windows' | 'linux',
    },
    {
      id: 'features',
      title: 'Native Integration',
      description:
        isDesktop
          ? 'Opta integrates with your system\'s native features for a seamless experience.'
          : 'Opta provides a mobile-optimized experience with battery-conscious monitoring.',
      icon: Layout,
      platform: 'all',
    },
    {
      id: 'ready',
      title: 'Ready to Optimize',
      description:
        'Your system is configured and ready. Let\'s make your PC faster!',
      icon: Rocket,
      platform: 'all',
      highlight: 'Let\'s Go!',
    },
  ];

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSkip();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (isLastStep) {
          onComplete();
        } else {
          setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
        }
      } else if (e.key === 'ArrowLeft') {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLastStep, onComplete, onSkip, steps.length]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-background/90 backdrop-blur-xl"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      />

      {/* Content */}
      <motion.div
        className={cn(
          'relative w-full max-w-md',
          'glass-strong rounded-2xl border border-border/30',
          'shadow-2xl shadow-black/30'
        )}
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* Skip button */}
        <motion.button
          className={cn(
            'absolute top-4 right-4 p-2 rounded-lg',
            'text-muted-foreground hover:text-foreground',
            'hover:bg-muted/20 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
          )}
          onClick={onSkip}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Skip onboarding"
        >
          <X className="w-5 h-5" strokeWidth={1.75} />
        </motion.button>

        {/* Step content */}
        <div className="p-8 pt-12">
          <AnimatePresence mode="wait">
            <StepContent
              key={currentStepData.id}
              step={currentStepData}
              platformType={platformType}
            />
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="px-8 pb-8">
          <div className="flex items-center justify-between">
            {/* Back button */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentStep((prev) => Math.max(prev - 1, 0))}
                disabled={isFirstStep}
                className={cn(
                  'gap-1 rounded-xl',
                  isFirstStep && 'opacity-0 pointer-events-none'
                )}
              >
                <ChevronLeft className="w-4 h-4" strokeWidth={2} />
                Back
              </Button>
            </motion.div>

            {/* Progress dots */}
            <ProgressDots total={steps.length} current={currentStep} />

            {/* Next/Complete button */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="sm"
                onClick={() => {
                  if (isLastStep) {
                    onComplete();
                  } else {
                    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
                  }
                }}
                className={cn(
                  'gap-1 rounded-xl',
                  'bg-gradient-to-r from-primary to-accent',
                  'shadow-[0_0_16px_-4px_hsl(var(--glow-primary)/0.5)]'
                )}
              >
                {isLastStep ? (
                  <>
                    Get Started
                    <Zap className="w-4 h-4" strokeWidth={2} />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4" strokeWidth={2} />
                  </>
                )}
              </Button>
            </motion.div>
          </div>

          {/* Keyboard hint */}
          <p className="text-center text-xs text-muted-foreground/50 mt-4">
            Press <kbd className="px-1 py-0.5 rounded bg-muted/30 font-mono">→</kbd> to continue,{' '}
            <kbd className="px-1 py-0.5 rounded bg-muted/30 font-mono">Esc</kbd> to skip
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default PlatformOnboarding;

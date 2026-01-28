/**
 * AccessibilityStatement - Documents Opta's accessibility features
 *
 * Provides users with information about:
 * - Keyboard navigation
 * - Screen reader support
 * - Reduced motion support
 * - High contrast support
 * - Known limitations
 *
 * @see WCAG 2.1 AA Guidelines
 */

import { motion, type Variants } from 'framer-motion';
import {
  Keyboard,
  Eye,
  Volume2,
  Contrast,
  Accessibility,
  ChevronRight,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

/**
 * Accessibility feature section
 */
interface FeatureSectionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
}

function FeatureSection({ icon: Icon, title, description, features }: FeatureSectionProps) {
  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'p-4 rounded-xl',
        'glass-subtle',
        'border border-white/[0.06]'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'p-2 rounded-lg shrink-0',
          'bg-primary/10'
        )}>
          <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
          <p className="text-xs text-muted-foreground mb-3">{description}</p>
          <ul className="space-y-1">
            {features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
                <ChevronRight className="w-3 h-3 mt-0.5 text-primary/60 shrink-0" strokeWidth={2} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Keyboard shortcut row
 */
interface ShortcutRowProps {
  keys: string[];
  description: string;
}

function ShortcutRow({ keys, description }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
      <span className="text-xs text-muted-foreground">{description}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <kbd
            key={index}
            className={cn(
              'px-2 py-1 text-[10px] font-medium rounded',
              'bg-white/5 border border-white/10',
              'text-muted-foreground'
            )}
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  );
}

export interface AccessibilityStatementProps {
  className?: string;
}

/**
 * AccessibilityStatement - Full accessibility documentation
 */
export function AccessibilityStatement({ className }: AccessibilityStatementProps) {
  return (
    <motion.div
      className={cn('space-y-6', className)}
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className={cn(
          'p-2.5 rounded-xl',
          'bg-primary/10 border border-primary/20'
        )}>
          <Accessibility className="w-6 h-6 text-primary" strokeWidth={1.75} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Accessibility</h2>
          <p className="text-xs text-muted-foreground">
            Opta is designed to be accessible to everyone
          </p>
        </div>
      </motion.div>

      {/* WCAG Compliance Badge */}
      <motion.div
        variants={itemVariants}
        className={cn(
          'p-3 rounded-lg',
          'bg-success/10 border border-success/20'
        )}
      >
        <p className="text-xs text-success">
          Opta targets WCAG 2.1 Level AA compliance. We continuously work to improve accessibility.
        </p>
      </motion.div>

      {/* Feature Sections */}
      <div className="grid gap-4">
        <FeatureSection
          icon={Keyboard}
          title="Keyboard Navigation"
          description="Full keyboard support for all interactive elements."
          features={[
            'Tab through all interactive elements',
            'Arrow keys for menu navigation',
            'Enter/Space to activate buttons',
            'Escape to close dialogs and menus',
            'Command+K opens Command Palette for quick access',
          ]}
        />

        <FeatureSection
          icon={Volume2}
          title="Screen Reader Support"
          description="Tested with VoiceOver (macOS) and NVDA (Windows)."
          features={[
            'All interactive elements have accessible names',
            'Dynamic content announced via ARIA live regions',
            'Proper heading hierarchy for navigation',
            'Drag-and-drop has keyboard alternatives',
            'Status updates announced automatically',
          ]}
        />

        <FeatureSection
          icon={Eye}
          title="Reduced Motion"
          description="Respects your system preference for reduced motion."
          features={[
            'Enable via System Preferences > Accessibility > Display > Reduce Motion',
            'Animations are simplified or disabled',
            'No auto-playing or looping animations',
            'Essential transitions still work smoothly',
          ]}
        />

        <FeatureSection
          icon={Contrast}
          title="High Contrast"
          description="Enhanced visibility for users who prefer more contrast."
          features={[
            'Enable via System Preferences > Accessibility > Display > Increase Contrast',
            'Borders and text become more visible',
            'Focus indicators are more prominent',
            'Color contrast meets WCAG AA requirements (4.5:1 minimum)',
          ]}
        />

        <FeatureSection
          icon={ZoomIn}
          title="Zoom & Magnification"
          description="Works with browser and system zoom features."
          features={[
            'Supports browser zoom up to 200%',
            'Works with macOS Zoom accessibility feature',
            'Pinch-to-zoom on charts and graphs',
            'Keyboard shortcuts: + and - to zoom, 0 to reset',
          ]}
        />
      </div>

      {/* Keyboard Shortcuts Reference */}
      <motion.div
        variants={itemVariants}
        className={cn(
          'p-4 rounded-xl',
          'glass-subtle',
          'border border-white/[0.06]'
        )}
      >
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-primary" strokeWidth={1.75} />
          Keyboard Shortcuts
        </h3>
        <div className="space-y-0">
          <ShortcutRow keys={['Cmd', 'K']} description="Open Command Palette" />
          <ShortcutRow keys={['Cmd', 'Shift', 'O']} description="Quick Optimize" />
          <ShortcutRow keys={['Tab']} description="Move to next element" />
          <ShortcutRow keys={['Shift', 'Tab']} description="Move to previous element" />
          <ShortcutRow keys={['Enter']} description="Activate focused element" />
          <ShortcutRow keys={['Esc']} description="Close dialog/menu" />
          <ShortcutRow keys={['+']} description="Zoom in (when viewing charts)" />
          <ShortcutRow keys={['-']} description="Zoom out (when viewing charts)" />
          <ShortcutRow keys={['0']} description="Reset zoom" />
        </div>
      </motion.div>

      {/* Known Limitations */}
      <motion.div
        variants={itemVariants}
        className={cn(
          'p-4 rounded-xl',
          'bg-warning/5 border border-warning/20'
        )}
      >
        <h3 className="text-sm font-semibold text-warning mb-2">Known Limitations</h3>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-warning">-</span>
            <span>Some complex visualizations may have limited screen reader descriptions</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-warning">-</span>
            <span>Drag-and-drop is optimized for macOS VoiceOver; other screen readers use keyboard fallback</span>
          </li>
        </ul>
      </motion.div>

      {/* Feedback Section */}
      <motion.div
        variants={itemVariants}
        className="p-4 rounded-xl bg-primary/5 border border-primary/20"
      >
        <h3 className="text-sm font-semibold text-foreground mb-2">Feedback</h3>
        <p className="text-xs text-muted-foreground">
          If you encounter any accessibility barriers or have suggestions for improvement,
          please let us know. We are committed to making Opta accessible to everyone.
        </p>
      </motion.div>
    </motion.div>
  );
}

export default AccessibilityStatement;

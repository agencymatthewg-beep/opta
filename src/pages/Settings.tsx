import { useState } from 'react';
import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useConflicts } from '../hooks/useConflicts';
import { useClaude } from '../hooks/useClaude';
import { useUserProfile } from '../hooks/useUserProfile';
import { useInvestigationMode } from '../components/InvestigationMode';
import { useExpertise } from '../components/ExpertiseContext';
import { useCommunicationStyle } from '../components/CommunicationStyleContext';
import ConflictCard from '../components/ConflictCard';
import PlatformIndicator from '../components/PlatformIndicator';
import { ProfileViewer } from '../components/ProfileViewer';
import { DataDeletionModal } from '../components/DataDeletionModal';
import { cn } from '@/lib/utils';
import {
  Settings as SettingsIcon,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Shield,
  Palette,
  Info,
  Cloud,
  Monitor,
  Loader2,
  Cpu,
  User,
  Eye,
  Brain,
  RotateCcw,
  BookOpen,
  Zap,
  MessageSquare,
} from 'lucide-react';
import type { ExpertiseLevel } from '@/types/expertise';

function Settings() {
  const { conflicts, summary, loading } = useConflicts();
  const { status: claudeStatus, loading: claudeLoading, sessionUsage } = useClaude();
  const { profile, loading: profileLoading, updateProfile, deleteProfile } = useUserProfile();
  const { isInvestigationMode, setInvestigationMode } = useInvestigationMode();
  const { level: expertiseLevel, confidence: expertiseConfidence, isManualOverride, setManualLevel, recordSignal } = useExpertise();
  const { style: communicationStyle, setStyle: setCommunicationStyle } = useCommunicationStyle();
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(new Set());
  const [showPrivacyIndicators, setShowPrivacyIndicators] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const expertiseOptions: { value: ExpertiseLevel; label: string; desc: string }[] = [
    { value: 'simple', label: 'Simple', desc: 'Plain language, safer options' },
    { value: 'standard', label: 'Standard', desc: 'Balanced explanations' },
    { value: 'power', label: 'Power User', desc: 'Full technical details' },
  ];

  const handleDismiss = (toolId: string) => {
    setAcknowledgedIds((prev) => new Set([...prev, toolId]));
  };

  // Track when user toggles Investigation Mode (indicates power user behavior)
  const handleInvestigationModeChange = (enabled: boolean) => {
    setInvestigationMode(enabled);
    if (enabled) {
      recordSignal('uses_investigation_mode', 100);
    }
  };

  const handleLearnMore = (toolId: string) => {
    // Placeholder for future docs link
    console.log('Learn more about:', toolId);
  };

  const handleDeleteProfile = async () => {
    setDeleteLoading(true);
    try {
      await deleteProfile();
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="page max-w-2xl">
      {/* Header */}
      <motion.div
        className="flex items-center gap-3 mb-8"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="p-2 rounded-lg bg-primary/10">
          <SettingsIcon className="w-5 h-5 text-primary" strokeWidth={1.75} />
        </div>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Settings
        </h1>
      </motion.div>

      <div className="flex flex-col gap-8">
        {/* Detected Conflicts Section */}
        <motion.section
          className="space-y-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
              Detected Conflicts
            </h2>
            {!loading && summary && summary.total_count > 0 && (
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
                summary.high_count > 0
                  ? 'bg-danger/15 text-danger border-danger/30'
                  : summary.medium_count > 0
                  ? 'bg-warning/15 text-warning border-warning/30'
                  : 'bg-muted/50 text-muted-foreground border-border/30'
              )}>
                {summary.total_count}
              </span>
            )}
          </div>

          {loading ? (
            <div className="glass rounded-xl border border-border/30 p-6">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground/70">Scanning for conflicts...</span>
              </div>
            </div>
          ) : conflicts.length === 0 ? (
            <motion.div
              className={cn(
                'glass rounded-xl border border-success/30 p-5',
                'shadow-[0_0_24px_-8px_hsl(var(--success)/0.3)]'
              )}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  'bg-success/15 border border-success/30'
                )}>
                  <CheckCircle className="w-6 h-6 text-success" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="font-semibold text-foreground">No conflicts detected</div>
                  <div className="text-sm text-muted-foreground/70">
                    Opta has full control over system optimizations
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground/70">
                These tools may interfere with Opta's optimizations. Consider disabling them for best results.
              </p>
              {conflicts.map((conflict, index) => (
                <ConflictCard
                  key={conflict.tool_id}
                  conflict={conflict}
                  acknowledged={acknowledgedIds.has(conflict.tool_id)}
                  onDismiss={handleDismiss}
                  onLearnMore={handleLearnMore}
                  delay={index * 0.05}
                />
              ))}
            </div>
          )}
        </motion.section>

        {/* Cloud AI Section */}
        <motion.section
          className="space-y-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
            Cloud AI
          </h2>

          {claudeLoading ? (
            <div className="glass rounded-xl border border-border/30 p-6">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground/70">Checking Claude API status...</span>
              </div>
            </div>
          ) : claudeStatus?.available ? (
            <motion.div
              className={cn(
                'glass rounded-xl border border-success/30 overflow-hidden',
                'shadow-[0_0_24px_-8px_hsl(var(--success)/0.3)]'
              )}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center',
                    'bg-success/15 border border-success/30'
                  )}>
                    <CheckCircle className="w-6 h-6 text-success" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">Claude API Configured</div>
                    <div className="text-sm text-muted-foreground/70">
                      Using {claudeStatus.model || 'Claude Sonnet'}
                    </div>
                  </div>
                </div>
                {sessionUsage.requestCount > 0 && (
                  <>
                    <div className="h-px bg-border/20 my-5" />
                    <div className="space-y-3">
                      <div className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest">
                        Session Usage
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="glass-subtle rounded-xl p-3 border border-border/20 text-center">
                          <div className="text-2xl font-bold text-primary tabular-nums">
                            {sessionUsage.requestCount}
                          </div>
                          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Requests</div>
                        </div>
                        <div className="glass-subtle rounded-xl p-3 border border-border/20 text-center">
                          <div className="text-2xl font-bold text-foreground tabular-nums">
                            {(sessionUsage.totalInputTokens / 1000).toFixed(1)}k
                          </div>
                          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Input</div>
                        </div>
                        <div className="glass-subtle rounded-xl p-3 border border-border/20 text-center">
                          <div className="text-2xl font-bold text-foreground tabular-nums">
                            {(sessionUsage.totalOutputTokens / 1000).toFixed(1)}k
                          </div>
                          <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Output</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              className={cn(
                'glass rounded-xl border border-warning/30 overflow-hidden',
                'shadow-[0_0_24px_-8px_hsl(var(--warning)/0.3)]'
              )}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="p-5">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-12 h-12 rounded-full flex items-center justify-center',
                    'bg-warning/15 border border-warning/30'
                  )}>
                    <AlertTriangle className="w-6 h-6 text-warning" strokeWidth={1.75} />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">Claude API Not Configured</div>
                    <div className="text-sm text-muted-foreground/70">
                      {claudeStatus?.error || 'API key not set'}
                    </div>
                  </div>
                </div>
                <div className="h-px bg-border/20 my-5" />
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground/70">
                    To enable cloud AI features, set your API key:
                  </div>
                  <ol className="text-sm text-muted-foreground/70 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className={cn(
                        'flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-xs font-medium mt-0.5',
                        'bg-primary/10 text-primary border border-primary/20'
                      )}>1</span>
                      <span>
                        Get an API key from{' '}
                        <a
                          href="https://console.anthropic.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          console.anthropic.com
                          <ExternalLink className="w-3 h-3" strokeWidth={2} />
                        </a>
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className={cn(
                        'flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-xs font-medium mt-0.5',
                        'bg-primary/10 text-primary border border-primary/20'
                      )}>2</span>
                      <span>Set ANTHROPIC_API_KEY environment variable</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className={cn(
                        'flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-xs font-medium mt-0.5',
                        'bg-primary/10 text-primary border border-primary/20'
                      )}>3</span>
                      <span>Restart Opta</span>
                    </li>
                  </ol>
                </div>
              </div>
            </motion.div>
          )}
        </motion.section>

        {/* Experience Level Section */}
        <motion.section
          className="space-y-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-semibold">Experience Level</h2>
          </div>
          <p className="text-sm text-muted-foreground/70">
            Opta adapts explanations based on your expertise.
            {!isManualOverride && (
              <span className="ml-1 text-primary">
                Currently auto-detected: {expertiseLevel} ({expertiseConfidence}% confident)
              </span>
            )}
          </p>

          <div className="grid grid-cols-3 gap-3">
            {expertiseOptions.map((option) => (
              <motion.button
                key={option.value}
                className={cn(
                  'p-4 glass-subtle rounded-xl text-left border',
                  expertiseLevel === option.value
                    ? 'ring-2 ring-primary border-primary/30'
                    : 'border-border/30 hover:border-border/50'
                )}
                onClick={() => setManualLevel(option.value)}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="font-medium text-sm">{option.label}</div>
                <div className="text-xs text-muted-foreground/70 mt-1">{option.desc}</div>
              </motion.button>
            ))}
          </div>

          {isManualOverride && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => setManualLevel(null)}
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.75} />
              Reset to auto-detect
            </Button>
          )}
        </motion.section>

        {/* Communication Style Section */}
        <motion.section
          className="space-y-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.27 }}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-semibold">Communication Style</h2>
          </div>
          <p className="text-sm text-muted-foreground/70">
            Choose how much detail Opta includes in explanations.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <motion.button
              onClick={() => setCommunicationStyle('informative')}
              className={cn(
                'glass-subtle rounded-xl p-4 text-left border transition-all',
                communicationStyle === 'informative'
                  ? 'ring-2 ring-primary border-primary/30'
                  : 'border-border/30 hover:border-border/50'
              )}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <BookOpen className="w-5 h-5 mb-2 text-primary" strokeWidth={1.75} />
              <p className="font-medium text-sm">Informative & Educational</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Explains the "why" behind optimizations
              </p>
            </motion.button>

            <motion.button
              onClick={() => setCommunicationStyle('concise')}
              className={cn(
                'glass-subtle rounded-xl p-4 text-left border transition-all',
                communicationStyle === 'concise'
                  ? 'ring-2 ring-primary border-primary/30'
                  : 'border-border/30 hover:border-border/50'
              )}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Zap className="w-5 h-5 mb-2 text-primary" strokeWidth={1.75} />
              <p className="font-medium text-sm">Concise & Efficient</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Just the facts, minimal explanation
              </p>
            </motion.button>
          </div>
        </motion.section>

        {/* Privacy Section */}
        <motion.section
          className="space-y-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
            Privacy
          </h2>

          <motion.div
            className={cn(
              'glass rounded-xl border border-success/30 p-5',
              'shadow-[0_0_24px_-8px_hsl(var(--success)/0.3)]'
            )}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center',
                'bg-success/15 border border-success/30'
              )}>
                <Shield className="w-6 h-6 text-success" strokeWidth={1.75} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-foreground">Your Data is Protected</div>
                <div className="text-sm text-muted-foreground/70">
                  Sensitive information is anonymized before cloud transmission
                </div>
              </div>
            </div>
          </motion.div>

          <div className="glass rounded-xl border border-border/30 overflow-hidden">
            <div className="p-5 space-y-5">
              {/* Privacy model explanation */}
              <div>
                <div className="text-sm font-semibold text-foreground mb-3">How Opta Protects Your Privacy</div>
                <div className="space-y-3 text-sm text-muted-foreground/70">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                      'bg-success/10 border border-success/20'
                    )}>
                      <Monitor className="w-4 h-4 text-success" strokeWidth={1.75} />
                    </div>
                    <span>
                      <strong className="text-foreground">Local queries</strong> stay completely on your device. No data is transmitted.
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                      'bg-primary/10 border border-primary/20'
                    )}>
                      <Cloud className="w-4 h-4 text-primary" strokeWidth={1.75} />
                    </div>
                    <span>
                      <strong className="text-foreground">Cloud queries</strong> have sensitive data automatically removed before transmission.
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-px bg-border/20" />

              {/* Sample anonymization */}
              <div>
                <div className="text-sm font-semibold text-foreground mb-3">What Gets Anonymized</div>
                <div className="text-sm text-muted-foreground/70 space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="px-2 py-1 glass-subtle rounded-lg text-xs border border-border/20">/Users/john/</code>
                    <span className="text-muted-foreground/40">-&gt;</span>
                    <code className="px-2 py-1 glass-subtle rounded-lg text-xs border border-border/20">/Users/[USER]/</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-2 py-1 glass-subtle rounded-lg text-xs border border-border/20">192.168.1.100</code>
                    <span className="text-muted-foreground/40">-&gt;</span>
                    <code className="px-2 py-1 glass-subtle rounded-lg text-xs border border-border/20">[IP_ADDR]</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="px-2 py-1 glass-subtle rounded-lg text-xs border border-border/20">AA:BB:CC:DD:EE:FF</code>
                    <span className="text-muted-foreground/40">-&gt;</span>
                    <code className="px-2 py-1 glass-subtle rounded-lg text-xs border border-border/20">[MAC_ADDR]</code>
                  </div>
                </div>
              </div>

              <div className="h-px bg-border/20" />

              {/* Privacy indicator toggle */}
              <div className="flex justify-between items-center gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-foreground">Show Privacy Indicators</span>
                  <span className="text-xs text-muted-foreground/60">
                    Display privacy badges on chat messages
                  </span>
                </div>
                <Switch
                  checked={showPrivacyIndicators}
                  onCheckedChange={setShowPrivacyIndicators}
                />
              </div>

              <div className="h-px bg-border/20" />

              {/* Investigation Mode toggle */}
              <div className="flex justify-between items-center gap-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                    'bg-primary/10 border border-primary/20'
                  )}>
                    <Eye className="w-4 h-4 text-primary" strokeWidth={1.75} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-foreground">Investigation Mode</span>
                    <span className="text-xs text-muted-foreground/60">
                      Show detailed technical information about what Opta is doing
                    </span>
                  </div>
                </div>
                <Switch
                  checked={isInvestigationMode}
                  onCheckedChange={handleInvestigationModeChange}
                />
              </div>
            </div>
          </div>
        </motion.section>

        {/* Your Profile Section */}
        <motion.section
          className="space-y-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" strokeWidth={1.75} />
            <h2 className="text-lg font-semibold">Your Profile</h2>
          </div>
          <p className="text-sm text-muted-foreground/70">
            View and manage all data Opta has stored about you
          </p>

          <ProfileViewer
            profile={profile}
            onUpdate={updateProfile}
            onDelete={() => setShowDeleteModal(true)}
            loading={profileLoading}
          />
        </motion.section>

        <DataDeletionModal
          open={showDeleteModal}
          onOpenChange={setShowDeleteModal}
          onConfirm={handleDeleteProfile}
          loading={deleteLoading}
        />

        {/* Appearance Section */}
        <motion.section
          className="space-y-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
            Appearance
          </h2>
          <div className="glass rounded-xl border border-border/30 p-5">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  'bg-primary/10 border border-primary/20'
                )}>
                  <Palette className="w-5 h-5 text-primary" strokeWidth={1.75} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">Theme</span>
                  <span className="text-xs text-muted-foreground/60">
                    Customize the app appearance
                  </span>
                </div>
              </div>
              <select
                className={cn(
                  'px-4 py-2 text-sm rounded-xl',
                  'glass-subtle border border-border/30',
                  'cursor-not-allowed opacity-50'
                )}
                disabled
              >
                <option>Dark (Default)</option>
                <option>Light</option>
                <option>System</option>
              </select>
            </div>
          </div>
        </motion.section>

        {/* Platform Section */}
        <motion.section
          className="space-y-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
              Platform
            </h2>
            <div className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
              'bg-primary/15 text-primary border border-primary/30'
            )}>
              <Cpu className="w-3 h-3 mr-1" strokeWidth={2} />
              Native
            </div>
          </div>

          <PlatformIndicator expanded className="w-full" />

          <div className="glass rounded-xl border border-border/30 p-5">
            <div className="text-sm text-muted-foreground/70">
              <p className="mb-3">
                Opta automatically detects and optimizes for your platform, providing native integration
                and performance tuning specific to your operating system.
              </p>
              <p className="text-xs text-muted-foreground/50">
                Platform-specific features are enabled at launch and run in the background to ensure
                optimal performance without requiring any configuration.
              </p>
            </div>
          </div>
        </motion.section>

        {/* About Section */}
        <motion.section
          className="space-y-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest">
            About
          </h2>
          <div className="glass rounded-xl border border-border/30 overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  'bg-primary/10 border border-primary/20'
                )}>
                  <Info className="w-5 h-5 text-primary" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="font-bold text-lg bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Opta
                  </div>
                  <div className="text-xs text-muted-foreground/60">PC Optimization Suite</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-subtle rounded-xl p-3 border border-border/20 text-center">
                  <div className="text-sm font-semibold text-foreground">0.1.0</div>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Version</div>
                </div>
                <div className="glass-subtle rounded-xl p-3 border border-border/20 text-center">
                  <div className="text-sm font-semibold text-foreground">Foundation</div>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Build</div>
                </div>
                <div className="glass-subtle rounded-xl p-3 border border-border/20 text-center">
                  <div className="text-sm font-semibold text-foreground">Tauri v2</div>
                  <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Platform</div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}

export default Settings;

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTelemetry } from '../hooks/useTelemetry';
import TelemetryCard from '../components/TelemetryCard';
import CpuMeter from '../components/CpuMeter';
import MemoryMeter from '../components/MemoryMeter';
import GpuMeter from '../components/GpuMeter';
import DiskMeter from '../components/DiskMeter';
import StealthMode from '../components/StealthMode';
import ProcessList from '../components/ProcessList';
import ConflictWarning from '../components/ConflictWarning';
import ChatInterface from '../components/ChatInterface';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Sparkles, X, TrendingUp, Wand2, RefreshCw } from 'lucide-react';
import { ThermalViz, MemoryHierarchyViz } from '../components/visualizations';

/** Storage key for chat panel open state */
const CHAT_OPEN_KEY = 'opta-chat-open';

/**
 * Chat toggle button with AI icon.
 */
function ChatToggleButton({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <motion.div
      className="fixed bottom-6 right-6 z-50"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 0.5, type: "spring", stiffness: 300 }}
    >
      <Button
        onClick={onClick}
        size="icon"
        className={cn(
          'h-14 w-14 rounded-full shadow-lg',
          'bg-gradient-to-br from-primary to-accent',
          'hover:shadow-[0_0_24px_-4px_hsl(var(--glow-primary)/0.6)]',
          'transition-all duration-300',
          isOpen && 'rotate-0',
          !isOpen && 'animate-pulse-glow'
        )}
        title={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-6 h-6 text-white" strokeWidth={2} />
            </motion.div>
          ) : (
            <motion.div
              key="sparkles"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Sparkles className="w-6 h-6 text-white" strokeWidth={1.75} />
            </motion.div>
          )}
        </AnimatePresence>
        <span className="sr-only">{isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}</span>
      </Button>
    </motion.div>
  );
}

interface DashboardProps {
  /** Callback to navigate to another page (used for "View Details" link) */
  onNavigate?: (page: string) => void;
}

function Dashboard({ onNavigate }: DashboardProps) {
  const { telemetry, loading, error, lastUpdated, refetch } = useTelemetry(2000);

  // Chat panel open state with localStorage persistence
  const [isChatOpen, setIsChatOpen] = useState(() => {
    const saved = localStorage.getItem(CHAT_OPEN_KEY);
    return saved === 'true';
  });

  // Persist chat open state
  useEffect(() => {
    localStorage.setItem(CHAT_OPEN_KEY, isChatOpen.toString());
  }, [isChatOpen]);

  const toggleChat = () => setIsChatOpen((prev) => !prev);

  // Calculate time since last update
  const getTimeSinceUpdate = () => {
    if (!lastUpdated) return null;
    const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  if (loading && !telemetry) {
    return (
      <div className="page max-w-6xl">
        <motion.h1
          className="page-title"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-glow bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Dashboard
          </span>
        </motion.h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="rounded-xl overflow-hidden bg-[#05030a]/80 backdrop-blur-xl border border-white/[0.06]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="px-5 py-4 border-b border-border/30">
                <div className="h-5 w-24 rounded animate-shimmer" />
              </div>
              <div className="p-5">
                <div className="h-32 rounded animate-shimmer" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page max-w-6xl">
        <motion.h1
          className="page-title"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-glow bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Dashboard
          </span>
        </motion.h1>
        <motion.div
          className="mt-6 flex flex-col items-center justify-center min-h-[300px] p-12 rounded-xl bg-[#05030a]/80 backdrop-blur-xl border border-white/[0.06]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="w-16 h-16 flex items-center justify-center text-3xl font-bold text-danger bg-danger/10 border-2 border-danger rounded-full mb-6 glow-sm-danger">
            !
          </div>
          <p className="text-muted-foreground text-center mb-6">{error}</p>
          <Button onClick={refetch} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="page max-w-6xl">
      {/* Conflict Warning Banner - shows at top when conflicts detected */}
      <ConflictWarning onViewDetails={onNavigate ? () => onNavigate('settings') : undefined} />

      {/* Header */}
      <motion.div
        className="flex items-baseline justify-between mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="page-title">
          <span className="text-glow bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Dashboard
          </span>
        </h1>
        {lastUpdated && (
          <motion.span
            className="text-xs text-muted-foreground/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Updated {getTimeSinceUpdate()}
          </motion.span>
        )}
      </motion.div>

      {/* Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <TelemetryCard title="CPU" icon="cpu" delay={0.05}>
          {telemetry && (
            <CpuMeter
              percent={telemetry.cpu.percent ?? 0}
              cores={telemetry.cpu.cores ?? 0}
              threads={telemetry.cpu.threads ?? 0}
            />
          )}
        </TelemetryCard>

        <TelemetryCard title="Memory" icon="memory" delay={0.1}>
          {telemetry && (
            <>
              <MemoryMeter
                usedGb={telemetry.memory.used_gb ?? 0}
                totalGb={telemetry.memory.total_gb ?? 0}
                percent={telemetry.memory.percent ?? 0}
              />
              <MemoryHierarchyViz
                currentRamUsage={telemetry.memory.percent ?? 0}
                recommendedHeadroom={80}
              />
            </>
          )}
        </TelemetryCard>

        <TelemetryCard title="GPU" icon="gpu" delay={0.15}>
          {telemetry && (
            <>
              <GpuMeter
                available={telemetry.gpu.available}
                name={telemetry.gpu.name ?? undefined}
                percent={telemetry.gpu.utilization_percent ?? undefined}
                temperature={telemetry.gpu.temperature_c ?? undefined}
              />
              <ThermalViz
                currentTemp={telemetry.gpu.temperature_c ?? 50}
                throttleTemp={85}
                component="gpu"
              />
            </>
          )}
        </TelemetryCard>

        <TelemetryCard title="Disk" icon="disk" delay={0.2}>
          {telemetry && (
            <DiskMeter
              usedGb={telemetry.disk.used_gb ?? 0}
              totalGb={telemetry.disk.total_gb ?? 0}
              percent={telemetry.disk.percent ?? 0}
            />
          )}
        </TelemetryCard>
      </div>

      {/* Stealth Mode Section */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <StealthMode />
      </motion.div>

      {/* Process List Section */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <ProcessList />
      </motion.div>

      {/* Additional Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div
          className="rounded-xl overflow-hidden group bg-[#05030a]/80 backdrop-blur-xl border border-white/[0.06]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          whileHover={{ y: -2 }}
        >
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                <TrendingUp className="w-5 h-5 text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="text-base font-medium">Optimization Score</h3>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-5xl font-bold text-glow bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                --
              </span>
              <span className="text-lg text-muted-foreground/50">/ 100</span>
            </div>
            <p className="text-sm text-muted-foreground/70">Score calculation coming soon...</p>
          </div>
        </motion.div>

        <motion.div
          className="rounded-xl overflow-hidden group bg-[#05030a]/80 backdrop-blur-xl border border-white/[0.06]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          whileHover={{ y: -2 }}
        >
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
                <Wand2 className="w-5 h-5 text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="text-base font-medium">Active Optimizations</h3>
            </div>
            <p className="text-sm text-muted-foreground/70">No optimizations applied yet.</p>
          </div>
        </motion.div>
      </div>

      {/* AI Chat Toggle Button */}
      <ChatToggleButton isOpen={isChatOpen} onClick={toggleChat} />

      {/* AI Chat Drawer - slides in from right */}
      <AnimatePresence>
        {isChatOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={toggleChat}
            />

            {/* Chat panel */}
            <motion.div
              className={cn(
                'fixed top-0 right-0 h-full w-[400px] z-40',
                'bg-[#05030a]/90 backdrop-blur-2xl border-l border-white/[0.06] rounded-l-2xl shadow-2xl'
              )}
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 25,
              }}
            >
              <ChatInterface className="h-full border-0 rounded-none bg-transparent" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Dashboard;

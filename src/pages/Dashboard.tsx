import { useState, useEffect } from 'react';
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
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** Storage key for chat panel open state */
const CHAT_OPEN_KEY = 'opta-chat-open';

/**
 * Chat toggle button with AI icon.
 */
function ChatToggleButton({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      size="icon"
      variant={isOpen ? 'default' : 'outline'}
      className={cn(
        'fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg',
        'transition-all duration-300',
        isOpen ? 'glow-md rotate-0' : 'hover:glow-sm',
        !isOpen && 'animate-pulse-slow'
      )}
      title={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
    >
      {isOpen ? (
        // Close icon
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        // AI sparkles icon
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
          />
        </svg>
      )}
      <span className="sr-only">{isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}</span>
    </Button>
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
        <h1 className="page-title text-glow-primary">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="h-5 w-24 rounded animate-shimmer" />
              </CardHeader>
              <CardContent>
                <div className="h-32 rounded animate-shimmer" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page max-w-6xl">
        <h1 className="page-title text-glow-primary">Dashboard</h1>
        <Card className="mt-6 flex flex-col items-center justify-center min-h-[300px] p-12">
          <div className="w-16 h-16 flex items-center justify-center text-3xl font-bold text-danger bg-danger/10 border-2 border-danger rounded-full mb-6">
            !
          </div>
          <p className="text-muted-foreground text-center mb-6">{error}</p>
          <Button onClick={refetch} className="glow-sm">
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page max-w-6xl">
      {/* Conflict Warning Banner - shows at top when conflicts detected */}
      <ConflictWarning onViewDetails={onNavigate ? () => onNavigate('settings') : undefined} />

      {/* Header */}
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="page-title text-glow-primary">Dashboard</h1>
        {lastUpdated && (
          <span className="text-xs text-muted-foreground/80">
            Last updated: {getTimeSinceUpdate()}
          </span>
        )}
      </div>

      {/* Telemetry Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 mb-6">
        <TelemetryCard title="CPU" icon="cpu">
          {telemetry && (
            <CpuMeter
              percent={telemetry.cpu.percent ?? 0}
              cores={telemetry.cpu.cores ?? 0}
              threads={telemetry.cpu.threads ?? 0}
            />
          )}
        </TelemetryCard>

        <TelemetryCard title="Memory" icon="memory">
          {telemetry && (
            <MemoryMeter
              usedGb={telemetry.memory.used_gb ?? 0}
              totalGb={telemetry.memory.total_gb ?? 0}
              percent={telemetry.memory.percent ?? 0}
            />
          )}
        </TelemetryCard>

        <TelemetryCard title="GPU" icon="gpu">
          {telemetry && (
            <GpuMeter
              available={telemetry.gpu.available}
              name={telemetry.gpu.name ?? undefined}
              percent={telemetry.gpu.utilization_percent ?? undefined}
              temperature={telemetry.gpu.temperature_c ?? undefined}
            />
          )}
        </TelemetryCard>

        <TelemetryCard title="Disk" icon="disk">
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
      <div className="mb-6">
        <StealthMode />
      </div>

      {/* Process List Section */}
      <div className="mb-6">
        <ProcessList />
      </div>

      {/* Additional Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="transition-all hover:border-primary/30 hover:glow-sm">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            <CardTitle className="text-base">Optimization Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-5xl font-bold text-primary text-glow-primary">--</span>
              <span className="text-lg text-muted-foreground">/ 100</span>
            </div>
            <p className="text-sm text-muted-foreground">Score calculation coming soon...</p>
          </CardContent>
        </Card>

        <Card className="transition-all hover:border-primary/30 hover:glow-sm">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <CardTitle className="text-base">Active Optimizations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No optimizations applied yet.</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Chat Toggle Button */}
      <ChatToggleButton isOpen={isChatOpen} onClick={toggleChat} />

      {/* AI Chat Drawer - slides in from right */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-[380px] z-40',
          'transform transition-transform duration-300 ease-in-out',
          'bg-background/95 backdrop-blur-md border-l border-border/50 shadow-xl',
          isChatOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <ChatInterface className="h-full border-0 rounded-none bg-transparent" />
      </div>

      {/* Backdrop overlay when chat is open */}
      {isChatOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm transition-opacity duration-300"
          onClick={toggleChat}
        />
      )}
    </div>
  );
}

export default Dashboard;

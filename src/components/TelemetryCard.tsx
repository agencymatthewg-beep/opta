import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Cpu, MemoryStick, MonitorSpeaker, HardDrive, LucideIcon } from 'lucide-react';
import { LearnModeExplanation } from './LearnModeExplanation';

// Icon components for telemetry cards
const icons: Record<string, LucideIcon> = {
  cpu: Cpu,
  memory: MemoryStick,
  gpu: MonitorSpeaker,
  disk: HardDrive,
};

type IconType = keyof typeof icons;

// Educational explanations for each telemetry type
const telemetryExplanations: Record<string, { short: string; technical: string }> = {
  cpu: {
    short: 'Shows how much of your processor is being used. Lower is better for gaming headroom.',
    technical: 'Measures CPU utilization across all cores. High sustained usage (>80%) may cause frame drops and stuttering.',
  },
  gpu: {
    short: 'Shows graphics card usage. In games, you typically want this near 95-99% (GPU-bound).',
    technical: 'GPU utilization from NVIDIA/AMD drivers. Low GPU + high CPU indicates a CPU bottleneck limiting your framerate.',
  },
  memory: {
    short: 'RAM usage. Keep some headroom (70-80%) for smooth gaming.',
    technical: 'Physical memory usage. When full, Windows uses slow disk swap (paging), causing major stutters.',
  },
  disk: {
    short: 'Storage usage. Keep 10-15% free for optimal performance and game updates.',
    technical: 'Available disk space. Full drives slow down significantly and may prevent game updates or crash during play.',
  },
};

interface TelemetryCardProps {
  title: string;
  icon: IconType;
  children: ReactNode;
  className?: string;
  delay?: number;
}

function TelemetryCard({ title, icon, children, className, delay = 0 }: TelemetryCardProps) {
  const Icon = icons[icon];
  const explanation = telemetryExplanations[icon];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0, 0, 0.2, 1] as const,
      }}
      whileHover={{ y: -2 }}
      className={cn(
        "glass rounded-xl overflow-hidden group",
        "transition-shadow duration-300",
        "hover:shadow-[0_0_0_1px_hsl(var(--glow-primary)/0.2),0_8px_32px_-8px_hsl(var(--glow-primary)/0.2)]",
        className
      )}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/15 transition-colors">
            <Icon
              className="w-4 h-4 text-primary group-hover:drop-shadow-[0_0_6px_hsl(var(--glow-primary)/0.5)] transition-all"
              strokeWidth={1.75}
            />
          </div>
          <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground/80 transition-colors">
            {title}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {children}

        {/* Learn Mode Explanation */}
        {explanation && (
          <LearnModeExplanation
            title={`Understanding ${title}`}
            description={explanation.short}
            details={explanation.technical}
            type="how-it-works"
          />
        )}
      </div>
    </motion.div>
  );
}

export default TelemetryCard;

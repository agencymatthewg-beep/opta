import { cn } from '@/lib/utils';

interface CpuMeterProps {
  percent: number;
  cores: number;
  threads: number;
}

function CpuMeter({ percent, cores, threads }: CpuMeterProps) {
  // Calculate stroke dashoffset for the progress ring
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  // Determine color based on usage level using CSS variable colors
  const getColorClass = (value: number) => {
    if (value >= 85) return 'text-[hsl(var(--danger))]';
    if (value >= 60) return 'text-[hsl(var(--warning))]';
    return 'text-[hsl(var(--success))]';
  };

  const getStrokeColor = (value: number) => {
    if (value >= 85) return 'hsl(var(--danger))';
    if (value >= 60) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  const getGlowStyle = (value: number) => {
    const opacity = Math.min(0.4, (value / 100) * 0.5);
    if (value >= 85) return `0 0 20px hsl(var(--danger) / ${opacity})`;
    if (value >= 60) return `0 0 20px hsl(var(--warning) / ${opacity})`;
    return `0 0 20px hsl(var(--success) / ${opacity})`;
  };

  const colorClass = getColorClass(percent);
  const strokeColor = getStrokeColor(percent);
  const isHighUsage = percent >= 90;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn(
        "relative w-28 h-28",
        isHighUsage && "animate-pulse"
      )}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="8"
            className="stroke-muted/30"
          />
          {/* Progress circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              stroke: strokeColor,
              filter: getGlowStyle(percent),
              transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease'
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-2xl font-bold", colorClass)}>
            {Math.round(percent)}%
          </span>
          <span className="text-xs text-muted-foreground font-medium">CPU</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground text-center">
        <span>{cores} cores / {threads} threads</span>
      </div>
    </div>
  );
}

export default CpuMeter;

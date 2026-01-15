import { cn } from '@/lib/utils';

interface GpuMeterProps {
  available: boolean;
  name?: string;
  percent?: number;
  temperature?: number;
}

function GpuMeter({ available, name, percent = 0, temperature }: GpuMeterProps) {
  if (!available) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-4">
        <div className="w-28 h-28 rounded-full border-2 border-dashed border-muted/30 flex items-center justify-center">
          <span className="text-2xl text-muted-foreground/50">--</span>
        </div>
        <span className="text-xs text-muted-foreground">No GPU detected</span>
      </div>
    );
  }

  // Calculate stroke dashoffset for the progress ring
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  // Determine color based on usage level
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

  // Temperature color
  const getTempColorClass = (temp: number) => {
    if (temp >= 80) return 'text-[hsl(var(--danger))] border-[hsl(var(--danger)/0.3)]';
    if (temp >= 65) return 'text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.3)]';
    return 'text-[hsl(var(--success))] border-[hsl(var(--success)/0.3)]';
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
          <span className="text-xs text-muted-foreground font-medium">GPU</span>
        </div>
        {temperature !== undefined && (
          <div className={cn(
            "absolute -bottom-1 left-1/2 -translate-x-1/2",
            "px-2 py-0.5 rounded-full text-[10px] font-medium",
            "border bg-card/80 backdrop-blur-sm",
            getTempColorClass(temperature)
          )}>
            {temperature}°C
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground text-center truncate max-w-[120px]" title={name}>
        <span>{name || 'Unknown GPU'}</span>
      </div>
    </div>
  );
}

export default GpuMeter;

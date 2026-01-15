import { cn } from '@/lib/utils';

interface DiskMeterProps {
  usedGb: number;
  totalGb: number;
  percent: number;
}

function DiskMeter({ usedGb, totalGb, percent }: DiskMeterProps) {
  // Determine color based on usage level
  const getColorClass = (value: number) => {
    if (value >= 85) return 'text-[hsl(var(--danger))]';
    if (value >= 60) return 'text-[hsl(var(--warning))]';
    return 'text-[hsl(var(--success))]';
  };

  const getBarColor = (value: number) => {
    if (value >= 85) return 'hsl(var(--danger))';
    if (value >= 60) return 'hsl(var(--warning))';
    return 'hsl(var(--success))';
  };

  const getGlowStyle = (value: number) => {
    const color = getBarColor(value);
    return `0 0 10px ${color.replace(')', ' / 0.4)')}`;
  };

  // Format to show TB if >= 1000 GB
  const formatSize = (gb: number) => {
    if (gb >= 1000) {
      return `${(gb / 1000).toFixed(1)} TB`;
    }
    return `${gb.toFixed(0)} GB`;
  };

  const colorClass = getColorClass(percent);
  const barColor = getBarColor(percent);
  const isHighUsage = percent >= 90;

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-2xl font-bold", colorClass)}>
            {Math.round(percent)}%
          </span>
          <span className="text-xs text-muted-foreground font-medium">Disk</span>
        </div>
      </div>

      <div className={cn(
        "relative h-3 w-full rounded-full bg-muted/30 overflow-hidden",
        isHighUsage && "animate-pulse"
      )}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{
            width: `${percent}%`,
            background: `linear-gradient(90deg, hsl(var(--success)) 0%, ${barColor} 100%)`,
            boxShadow: getGlowStyle(percent)
          }}
        />
      </div>

      <div className="text-xs text-muted-foreground text-center">
        <span>{formatSize(usedGb)} / {formatSize(totalGb)}</span>
      </div>
    </div>
  );
}

export default DiskMeter;

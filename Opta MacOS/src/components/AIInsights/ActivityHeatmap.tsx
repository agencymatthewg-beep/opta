/**
 * Activity Heatmap Component
 *
 * Displays daily activity patterns as a 24-hour heatmap
 * showing when the user typically games, works, or is idle.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Gamepad2,
  Briefcase,
  Film,
  Moon,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DailyPattern, ActivityType } from '@/hooks/useBehaviorPatterns';

// Activity colors
const activityColors: Record<ActivityType, string> = {
  gaming: 'bg-success',
  productivity: 'bg-primary',
  media: 'bg-warning',
  idle: 'bg-muted',
  sleep: 'bg-muted/50',
  unknown: 'bg-muted/30',
};

const activityIcons: Record<ActivityType, typeof Gamepad2> = {
  gaming: Gamepad2,
  productivity: Briefcase,
  media: Film,
  idle: Moon,
  sleep: Moon,
  unknown: HelpCircle,
};

interface ActivityHeatmapProps {
  patterns: DailyPattern[];
  className?: string;
  showLegend?: boolean;
}

export function ActivityHeatmap({
  patterns,
  className,
  showLegend = true,
}: ActivityHeatmapProps) {
  // Ensure we have 24 hours of data
  const hourlyData = useMemo(() => {
    const data: DailyPattern[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const pattern = patterns.find(p => p.hour === hour);
      data.push(pattern || {
        hour,
        dominantActivity: 'unknown' as ActivityType,
        confidence: 0,
        avgCpu: 0,
        avgMemory: 0,
        sampleCount: 0,
      });
    }
    return data;
  }, [patterns]);

  // Format hour for display
  const formatHour = (hour: number): string => {
    if (hour === 0) return '12am';
    if (hour === 12) return '12pm';
    if (hour < 12) return `${hour}am`;
    return `${hour - 12}pm`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('glass-subtle rounded-lg p-4', className)}
    >
      <h3 className="text-sm font-medium mb-3">Daily Activity Pattern</h3>

      {/* Heatmap Grid */}
      <div className="grid grid-cols-24 gap-0.5">
        {hourlyData.map((pattern, i) => {
          const opacity = pattern.confidence > 0 ? 0.3 + pattern.confidence * 0.7 : 0.1;
          const ActivityIcon = activityIcons[pattern.dominantActivity];

          return (
            <div
              key={i}
              className="relative group"
              title={`${formatHour(pattern.hour)}: ${pattern.dominantActivity} (${Math.round(pattern.confidence * 100)}% confidence)`}
            >
              <div
                className={cn(
                  'h-8 rounded-sm transition-all hover:scale-110 hover:z-10',
                  activityColors[pattern.dominantActivity]
                )}
                style={{ opacity }}
              />

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                <div className="glass rounded-lg px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                  <div className="font-medium">{formatHour(pattern.hour)}</div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <ActivityIcon className="w-3 h-3" />
                    <span className="capitalize">{pattern.dominantActivity}</span>
                  </div>
                  {pattern.sampleCount > 0 && (
                    <div className="text-muted-foreground/60">
                      {pattern.sampleCount} samples
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hour labels */}
      <div className="grid grid-cols-24 gap-0.5 mt-1">
        {[0, 6, 12, 18].map(hour => (
          <div
            key={hour}
            className="text-xs text-muted-foreground"
            style={{ gridColumn: hour + 1 }}
          >
            {formatHour(hour)}
          </div>
        ))}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-border/30">
          {(['gaming', 'productivity', 'media', 'idle'] as ActivityType[]).map(activity => {
            const Icon = activityIcons[activity];
            return (
              <div key={activity} className="flex items-center gap-1.5">
                <div className={cn('w-3 h-3 rounded-sm', activityColors[activity])} />
                <Icon className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground capitalize">{activity}</span>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

interface WeeklyActivityProps {
  patterns: Array<{
    day: number;
    dayName: string;
    activeHours: number[];
    gamingHours: number[];
    workHours: number[];
    avgDailyScreenTime: number;
  }>;
  className?: string;
}

export function WeeklyActivitySummary({ patterns, className }: WeeklyActivityProps) {
  const today = new Date().getDay();
  const todayIndex = today === 0 ? 6 : today - 1; // Convert Sunday=0 to Monday=0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('glass-subtle rounded-lg p-4', className)}
    >
      <h3 className="text-sm font-medium mb-3">Weekly Overview</h3>

      <div className="space-y-2">
        {patterns.map((day, i) => {
          const isToday = i === todayIndex;
          const totalActive = day.activeHours.length;
          const gamingPercent = totalActive > 0 ? (day.gamingHours.length / totalActive) * 100 : 0;
          const workPercent = totalActive > 0 ? (day.workHours.length / totalActive) * 100 : 0;

          return (
            <div
              key={day.day}
              className={cn(
                'flex items-center gap-3 p-2 rounded-lg',
                isToday && 'bg-primary/10 border border-primary/30'
              )}
            >
              <div className="w-12 text-sm font-medium">
                {day.dayName.slice(0, 3)}
                {isToday && <span className="text-primary ml-1">•</span>}
              </div>

              {/* Activity bar */}
              <div className="flex-1 h-4 rounded-full bg-muted/30 overflow-hidden flex">
                {gamingPercent > 0 && (
                  <div
                    className="h-full bg-success"
                    style={{ width: `${gamingPercent}%` }}
                  />
                )}
                {workPercent > 0 && (
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${workPercent}%` }}
                  />
                )}
              </div>

              <div className="w-16 text-xs text-muted-foreground text-right">
                {day.avgDailyScreenTime.toFixed(1)}h
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-success" />
          <span>Gaming</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-primary" />
          <span>Work</span>
        </div>
      </div>
    </motion.div>
  );
}

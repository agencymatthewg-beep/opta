/**
 * ThermalViz - Visualization showing thermal throttling.
 *
 * Displays temperature gauge, zone legend, and throttling explanation,
 * helping users understand thermal limits and their performance impact.
 * Only renders when Learn Mode is active.
 */

import { motion } from 'framer-motion';

import { useLearnMode } from '@/components/LearnModeContext';
import { cn } from '@/lib/utils';
import { Thermometer, Flame, Snowflake } from 'lucide-react';

interface ThermalVizProps {
  currentTemp: number;  // Celsius
  throttleTemp: number;  // Celsius (typically 85-95)
  component: 'cpu' | 'gpu';
}

export function ThermalViz({ currentTemp, throttleTemp, component }: ThermalVizProps) {
  const { isLearnMode } = useLearnMode();

  if (!isLearnMode) return null;

  const percentage = Math.min((currentTemp / throttleTemp) * 100, 100);
  const isThrottling = currentTemp >= throttleTemp;
  const isWarning = currentTemp >= throttleTemp - 10;

  const zones = [
    { label: 'Cool', range: '< 60 C', Icon: Snowflake, colorClass: 'text-success' },
    { label: 'Normal', range: '60-75 C', Icon: Thermometer, colorClass: 'text-primary' },
    { label: 'Warm', range: '75-85 C', Icon: Thermometer, colorClass: 'text-warning' },
    { label: 'Throttle', range: '> 85 C', Icon: Flame, colorClass: 'text-danger' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="glass-subtle rounded-xl p-4 my-4"
    >
      <h4 className="text-sm font-semibold mb-3">
        {component.toUpperCase()} Thermal State
      </h4>

      {/* Temperature gauge */}
      <div className="relative h-6 bg-card rounded-full overflow-hidden mb-3">
        <motion.div
          className={cn(
            "h-full rounded-full",
            isThrottling ? "bg-danger" : isWarning ? "bg-warning" : "bg-primary"
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
          {currentTemp}C / {throttleTemp}C
        </div>
      </div>

      {/* Zone legend */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        {zones.map((zone) => (
          <div key={zone.label} className="text-center">
            <zone.Icon className={cn("w-4 h-4 mx-auto", zone.colorClass)} strokeWidth={1.75} />
            <div className="text-xs font-medium">{zone.label}</div>
            <div className="text-xs text-muted-foreground">{zone.range}</div>
          </div>
        ))}
      </div>

      {/* Throttling explanation */}
      {isThrottling && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="p-2 rounded-lg bg-danger/20 border border-danger/30"
        >
          <div className="text-xs text-danger font-medium">Thermal Throttling Active</div>
          <div className="text-xs text-danger/80">
            Your {component.toUpperCase()} is reducing clock speed to cool down.
            Performance is currently limited.
          </div>
        </motion.div>
      )}

      <p className="text-xs text-muted-foreground mt-3">
        Hardware reduces performance when too hot to prevent damage.
        Better cooling or undervolting can prevent throttling and maintain peak FPS.
      </p>
    </motion.div>
  );
}

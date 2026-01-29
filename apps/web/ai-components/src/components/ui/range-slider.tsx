'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  step?: number;
  formatLabel?: (value: number) => string;
  className?: string;
}

/**
 * Dual-thumb range slider for min/max filtering
 */
export function RangeSlider({
  min,
  max,
  value,
  onChange,
  step = 1,
  formatLabel = (v) => v.toString(),
  className,
}: RangeSliderProps) {
  const [localValue, setLocalValue] = useState(value);
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef<'min' | 'max' | null>(null);

  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const getPercentage = useCallback(
    (val: number) => ((val - min) / (max - min)) * 100,
    [min, max]
  );

  const getValueFromPosition = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return min;
      const rect = trackRef.current.getBoundingClientRect();
      const percentage = (clientX - rect.left) / rect.width;
      const rawValue = min + percentage * (max - min);
      const steppedValue = Math.round(rawValue / step) * step;
      return Math.max(min, Math.min(max, steppedValue));
    },
    [min, max, step]
  );

  const handleMouseDown = useCallback(
    (thumb: 'min' | 'max') => (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = thumb;

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return;
        const newValue = getValueFromPosition(e.clientX);

        setLocalValue((prev) => {
          if (isDragging.current === 'min') {
            const clampedMin = Math.min(newValue, prev[1] - step);
            return [Math.max(min, clampedMin), prev[1]];
          } else {
            const clampedMax = Math.max(newValue, prev[0] + step);
            return [prev[0], Math.min(max, clampedMax)];
          }
        });
      };

      const handleMouseUp = () => {
        if (isDragging.current) {
          onChange(localValue);
        }
        isDragging.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [getValueFromPosition, onChange, localValue, min, max, step]
  );

  // Touch support
  const handleTouchStart = useCallback(
    (thumb: 'min' | 'max') => (e: React.TouchEvent) => {
      isDragging.current = thumb;

      const handleTouchMove = (e: TouchEvent) => {
        if (!isDragging.current) return;
        const touch = e.touches[0];
        const newValue = getValueFromPosition(touch.clientX);

        setLocalValue((prev) => {
          if (isDragging.current === 'min') {
            const clampedMin = Math.min(newValue, prev[1] - step);
            return [Math.max(min, clampedMin), prev[1]];
          } else {
            const clampedMax = Math.max(newValue, prev[0] + step);
            return [prev[0], Math.min(max, clampedMax)];
          }
        });
      };

      const handleTouchEnd = () => {
        if (isDragging.current) {
          onChange(localValue);
        }
        isDragging.current = null;
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };

      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
    },
    [getValueFromPosition, onChange, localValue, min, max, step]
  );

  // Commit changes when local value changes (for touch/mouse)
  useEffect(() => {
    if (isDragging.current === null) return;
    const timer = setTimeout(() => {
      onChange(localValue);
    }, 50);
    return () => clearTimeout(timer);
  }, [localValue, onChange]);

  const minPercent = getPercentage(localValue[0]);
  const maxPercent = getPercentage(localValue[1]);

  return (
    <div className={cn('space-y-2', className)}>
      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-2 rounded-full bg-white/10 cursor-pointer"
      >
        {/* Active range */}
        <div
          className="absolute h-full bg-gradient-to-r from-neon-cyan to-purple-glow rounded-full"
          style={{
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
          }}
        />

        {/* Min Thumb */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
            'w-5 h-5 rounded-full bg-white border-2 border-neon-cyan',
            'shadow-lg shadow-neon-cyan/30 cursor-grab active:cursor-grabbing',
            'hover:scale-110 transition-transform',
            'focus:outline-none focus:ring-2 focus:ring-neon-cyan/50'
          )}
          style={{ left: `${minPercent}%` }}
          onMouseDown={handleMouseDown('min')}
          onTouchStart={handleTouchStart('min')}
          tabIndex={0}
          role="slider"
          aria-label="Minimum value"
          aria-valuemin={min}
          aria-valuemax={localValue[1]}
          aria-valuenow={localValue[0]}
        />

        {/* Max Thumb */}
        <div
          className={cn(
            'absolute top-1/2 -translate-y-1/2 -translate-x-1/2',
            'w-5 h-5 rounded-full bg-white border-2 border-purple-glow',
            'shadow-lg shadow-purple-glow/30 cursor-grab active:cursor-grabbing',
            'hover:scale-110 transition-transform',
            'focus:outline-none focus:ring-2 focus:ring-purple-glow/50'
          )}
          style={{ left: `${maxPercent}%` }}
          onMouseDown={handleMouseDown('max')}
          onTouchStart={handleTouchStart('max')}
          tabIndex={0}
          role="slider"
          aria-label="Maximum value"
          aria-valuemin={localValue[0]}
          aria-valuemax={max}
          aria-valuenow={localValue[1]}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-text-muted">
        <span>{formatLabel(localValue[0])}</span>
        <span>{formatLabel(localValue[1])}</span>
      </div>
    </div>
  );
}

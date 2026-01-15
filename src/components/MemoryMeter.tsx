import './MemoryMeter.css';

interface MemoryMeterProps {
  usedGb: number;
  totalGb: number;
  percent: number;
}

function MemoryMeter({ usedGb, totalGb, percent }: MemoryMeterProps) {
  // Determine color based on usage level
  const getColor = (value: number) => {
    if (value >= 85) return '#ff4444'; // danger red
    if (value >= 60) return '#ffaa00'; // warning yellow
    return '#00ff88'; // accent green
  };

  const color = getColor(percent);
  const isHighUsage = percent >= 90;

  return (
    <div className="memory-meter">
      <div className="memory-display">
        <span className="memory-value" style={{ color }}>{Math.round(percent)}%</span>
        <span className="memory-label">RAM</span>
      </div>

      <div className={`memory-bar-container ${isHighUsage ? 'pulse' : ''}`}>
        <div
          className="memory-bar-fill"
          style={{
            width: `${percent}%`,
            background: `linear-gradient(90deg, #00ff88 0%, ${color} 100%)`,
            boxShadow: `0 0 10px ${color}40`
          }}
        />
      </div>

      <div className="memory-info">
        <span>{usedGb.toFixed(1)} / {totalGb.toFixed(1)} GB</span>
      </div>
    </div>
  );
}

export default MemoryMeter;

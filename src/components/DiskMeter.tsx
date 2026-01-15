import './DiskMeter.css';

interface DiskMeterProps {
  usedGb: number;
  totalGb: number;
  percent: number;
}

function DiskMeter({ usedGb, totalGb, percent }: DiskMeterProps) {
  // Determine color based on usage level
  const getColor = (value: number) => {
    if (value >= 85) return '#ff4444'; // danger red
    if (value >= 60) return '#ffaa00'; // warning yellow
    return '#00ff88'; // accent green
  };

  const color = getColor(percent);
  const isHighUsage = percent >= 90;

  // Format to show TB if >= 1000 GB
  const formatSize = (gb: number) => {
    if (gb >= 1000) {
      return `${(gb / 1000).toFixed(1)} TB`;
    }
    return `${gb.toFixed(0)} GB`;
  };

  return (
    <div className="disk-meter">
      <div className="disk-display">
        <span className="disk-value" style={{ color }}>{Math.round(percent)}%</span>
        <span className="disk-label">Disk</span>
      </div>

      <div className={`disk-bar-container ${isHighUsage ? 'pulse' : ''}`}>
        <div
          className="disk-bar-fill"
          style={{
            width: `${percent}%`,
            background: `linear-gradient(90deg, #00ff88 0%, ${color} 100%)`,
            boxShadow: `0 0 10px ${color}40`
          }}
        />
      </div>

      <div className="disk-info">
        <span>{formatSize(usedGb)} / {formatSize(totalGb)}</span>
      </div>
    </div>
  );
}

export default DiskMeter;

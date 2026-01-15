import './GpuMeter.css';

interface GpuMeterProps {
  available: boolean;
  name?: string;
  percent?: number;
  temperature?: number;
}

function GpuMeter({ available, name, percent = 0, temperature }: GpuMeterProps) {
  if (!available) {
    return (
      <div className="gpu-meter gpu-unavailable">
        <div className="gpu-unavailable-icon">--</div>
        <span className="gpu-unavailable-text">No GPU detected</span>
      </div>
    );
  }

  // Calculate stroke dashoffset for the progress ring
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  // Determine color based on usage level
  const getColor = (value: number) => {
    if (value >= 85) return '#ff4444'; // danger red
    if (value >= 60) return '#ffaa00'; // warning yellow
    return '#00ff88'; // accent green
  };

  const color = getColor(percent);
  const isHighUsage = percent >= 90;

  // Temperature color
  const getTempColor = (temp: number) => {
    if (temp >= 80) return '#ff4444';
    if (temp >= 65) return '#ffaa00';
    return '#00ff88';
  };

  return (
    <div className="gpu-meter">
      <div className={`gpu-ring-container ${isHighUsage ? 'pulse' : ''}`}>
        <svg className="gpu-ring" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            className="gpu-ring-bg"
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            className="gpu-ring-progress"
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ stroke: color }}
          />
        </svg>
        <div className="gpu-ring-text">
          <span className="gpu-percent" style={{ color }}>{Math.round(percent)}%</span>
          <span className="gpu-label">GPU</span>
        </div>
        {temperature !== undefined && (
          <div
            className="gpu-temp-badge"
            style={{
              color: getTempColor(temperature),
              borderColor: getTempColor(temperature) + '40'
            }}
          >
            {temperature}°C
          </div>
        )}
      </div>
      <div className="gpu-name">
        <span>{name || 'Unknown GPU'}</span>
      </div>
    </div>
  );
}

export default GpuMeter;

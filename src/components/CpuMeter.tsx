import './CpuMeter.css';

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

  // Determine color based on usage level
  const getColor = (value: number) => {
    if (value >= 85) return '#ff4444'; // danger red
    if (value >= 60) return '#ffaa00'; // warning yellow
    return '#00ff88'; // accent green
  };

  const color = getColor(percent);
  const isHighUsage = percent >= 90;

  return (
    <div className="cpu-meter">
      <div className={`cpu-ring-container ${isHighUsage ? 'pulse' : ''}`}>
        <svg className="cpu-ring" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            className="cpu-ring-bg"
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            className="cpu-ring-progress"
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
        <div className="cpu-ring-text">
          <span className="cpu-percent" style={{ color }}>{Math.round(percent)}%</span>
          <span className="cpu-label">CPU</span>
        </div>
      </div>
      <div className="cpu-info">
        <span>{cores} cores / {threads} threads</span>
      </div>
    </div>
  );
}

export default CpuMeter;

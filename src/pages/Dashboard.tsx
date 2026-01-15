import { useTelemetry } from '../hooks/useTelemetry';
import TelemetryCard from '../components/TelemetryCard';
import CpuMeter from '../components/CpuMeter';
import MemoryMeter from '../components/MemoryMeter';
import GpuMeter from '../components/GpuMeter';
import DiskMeter from '../components/DiskMeter';
import ProcessList from '../components/ProcessList';
import './Dashboard.css';

function Dashboard() {
  const { telemetry, loading, error, lastUpdated, refetch } = useTelemetry(2000);

  // Calculate time since last update
  const getTimeSinceUpdate = () => {
    if (!lastUpdated) return null;
    const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  };

  if (loading && !telemetry) {
    return (
      <div className="page dashboard-page">
        <h1 className="page-title">Dashboard</h1>
        <div className="telemetry-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-header" />
              <div className="skeleton-content" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page dashboard-page">
        <h1 className="page-title">Dashboard</h1>
        <div className="error-container">
          <div className="error-icon">!</div>
          <p className="error-message">{error}</p>
          <button className="retry-button" onClick={refetch}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page dashboard-page">
      <div className="dashboard-header">
        <h1 className="page-title">Dashboard</h1>
        {lastUpdated && (
          <span className="last-updated">
            Last updated: {getTimeSinceUpdate()}
          </span>
        )}
      </div>

      <div className="telemetry-grid">
        <TelemetryCard title="CPU" icon="🖥️">
          {telemetry && (
            <CpuMeter
              percent={telemetry.cpu.percent ?? 0}
              cores={telemetry.cpu.cores ?? 0}
              threads={telemetry.cpu.threads ?? 0}
            />
          )}
        </TelemetryCard>

        <TelemetryCard title="Memory" icon="🧠">
          {telemetry && (
            <MemoryMeter
              usedGb={telemetry.memory.used_gb ?? 0}
              totalGb={telemetry.memory.total_gb ?? 0}
              percent={telemetry.memory.percent ?? 0}
            />
          )}
        </TelemetryCard>

        <TelemetryCard title="GPU" icon="🎮">
          {telemetry && (
            <GpuMeter
              available={telemetry.gpu.available}
              name={telemetry.gpu.name ?? undefined}
              percent={telemetry.gpu.utilization_percent ?? undefined}
              temperature={telemetry.gpu.temperature_c ?? undefined}
            />
          )}
        </TelemetryCard>

        <TelemetryCard title="Disk" icon="💾">
          {telemetry && (
            <DiskMeter
              usedGb={telemetry.disk.used_gb ?? 0}
              totalGb={telemetry.disk.total_gb ?? 0}
              percent={telemetry.disk.percent ?? 0}
            />
          )}
        </TelemetryCard>
      </div>

      {/* Process List Section */}
      <div className="process-section">
        <ProcessList />
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-icon">📈</span>
            <h2 className="card-title">Optimization Score</h2>
          </div>
          <div className="card-content">
            <div className="score-display">
              <span className="score-value">--</span>
              <span className="score-label">/ 100</span>
            </div>
            <p className="placeholder-text">Score calculation coming soon...</p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-icon">✨</span>
            <h2 className="card-title">Active Optimizations</h2>
          </div>
          <div className="card-content">
            <p className="placeholder-text">No optimizations applied yet.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

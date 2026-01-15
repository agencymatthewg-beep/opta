import './Dashboard.css';

function Dashboard() {
  return (
    <div className="page dashboard-page">
      <h1 className="page-title">Dashboard</h1>

      <div className="card-grid">
        <div className="card">
          <div className="card-header">
            <span className="card-icon">💻</span>
            <h2 className="card-title">System Status</h2>
          </div>
          <div className="card-content">
            <p className="placeholder-text">CPU, GPU, and RAM monitoring coming soon...</p>
          </div>
        </div>

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

import './Optimize.css';

function Optimize() {
  return (
    <div className="page optimize-page">
      <h1 className="page-title">Optimize</h1>

      <div className="optimize-hero">
        <button className="optimize-button" disabled>
          <span className="button-icon">⚡</span>
          <span className="button-text">One-Click Optimize</span>
        </button>
        <p className="hero-subtitle">
          Automatically optimize your system for maximum gaming performance
        </p>
      </div>

      <div className="games-section">
        <h2 className="section-title">Detected Games</h2>
        <div className="games-list">
          <div className="empty-state">
            <span className="empty-icon">🎮</span>
            <p className="empty-text">No games detected yet.</p>
            <p className="empty-subtext">Game detection coming in Phase 7...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Optimize;

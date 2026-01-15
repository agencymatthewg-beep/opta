import './Settings.css';

function Settings() {
  return (
    <div className="page settings-page">
      <h1 className="page-title">Settings</h1>

      <div className="settings-sections">
        <section className="settings-section">
          <h2 className="section-title">AI Configuration</h2>
          <div className="setting-card">
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">AI Mode</span>
                <span className="setting-description">Choose between local or cloud AI processing</span>
              </div>
              <div className="setting-control">
                <select className="setting-select" disabled>
                  <option>Local (Llama 3)</option>
                  <option>Cloud (Claude)</option>
                  <option>Hybrid (Auto)</option>
                </select>
              </div>
            </div>
            <p className="coming-soon">AI configuration coming in Phase 5-6...</p>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="section-title">Appearance</h2>
          <div className="setting-card">
            <div className="setting-row">
              <div className="setting-info">
                <span className="setting-label">Theme</span>
                <span className="setting-description">Customize the app appearance</span>
              </div>
              <div className="setting-control">
                <select className="setting-select" disabled>
                  <option>Dark (Default)</option>
                  <option>Light</option>
                  <option>System</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className="settings-section">
          <h2 className="section-title">About</h2>
          <div className="setting-card about-card">
            <div className="about-row">
              <span className="about-label">Version</span>
              <span className="about-value">0.1.0</span>
            </div>
            <div className="about-row">
              <span className="about-label">Build</span>
              <span className="about-value">Foundation</span>
            </div>
            <div className="about-row">
              <span className="about-label">Platform</span>
              <span className="about-value">Tauri v2</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Settings;

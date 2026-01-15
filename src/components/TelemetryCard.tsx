import { ReactNode } from 'react';
import './TelemetryCard.css';

interface TelemetryCardProps {
  title: string;
  icon: string;
  children: ReactNode;
}

function TelemetryCard({ title, icon, children }: TelemetryCardProps) {
  return (
    <div className="telemetry-card">
      <div className="telemetry-card-header">
        <span className="telemetry-card-icon">{icon}</span>
        <h3 className="telemetry-card-title">{title}</h3>
      </div>
      <div className="telemetry-card-content">
        {children}
      </div>
    </div>
  );
}

export default TelemetryCard;

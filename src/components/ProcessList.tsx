/**
 * ProcessList component for displaying running processes.
 *
 * Shows a scrollable table of processes with resource usage and categorization.
 * Supports click-to-select for future Stealth Mode integration.
 */

import { useState } from 'react';
import { useProcesses } from '../hooks/useProcesses';
import type { ProcessInfo, ProcessCategory } from '../types/processes';
import './ProcessList.css';

interface ProcessRowProps {
  process: ProcessInfo;
  isSelected: boolean;
  onSelect: (pid: number) => void;
}

/**
 * Badge component for process category.
 */
function CategoryBadge({ category }: { category: ProcessCategory }) {
  return (
    <span className={`category-badge category-${category}`}>
      {category}
    </span>
  );
}

/**
 * Single process row component.
 */
function ProcessRow({ process, isSelected, onSelect }: ProcessRowProps) {
  return (
    <tr
      className={`process-row ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(process.pid)}
    >
      <td className="process-name" title={process.name}>
        {process.name}
      </td>
      <td className="process-cpu">{process.cpu_percent.toFixed(1)}%</td>
      <td className="process-memory">{process.memory_percent.toFixed(1)}%</td>
      <td className="process-category">
        <CategoryBadge category={process.category} />
      </td>
      <td className="process-pid">{process.pid}</td>
    </tr>
  );
}

/**
 * Loading skeleton for process list.
 */
function ProcessListSkeleton() {
  return (
    <div className="process-list-container">
      <div className="process-list-skeleton">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton-cell skeleton-name" />
            <div className="skeleton-cell skeleton-stat" />
            <div className="skeleton-cell skeleton-stat" />
            <div className="skeleton-cell skeleton-badge" />
            <div className="skeleton-cell skeleton-pid" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * ProcessList component showing running processes with resource usage.
 */
function ProcessList() {
  const { processes, loading, error, refresh } = useProcesses(3000);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);

  const handleSelect = (pid: number) => {
    setSelectedPid(selectedPid === pid ? null : pid);
  };

  if (loading && !processes) {
    return <ProcessListSkeleton />;
  }

  if (error) {
    return (
      <div className="process-list-container">
        <div className="process-list-error">
          <span className="error-icon">!</span>
          <p>{error}</p>
          <button onClick={refresh} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  const processCount = processes?.length ?? 0;

  return (
    <div className="process-list-container">
      <div className="process-list-header">
        <h3 className="process-list-title">
          Running Processes
          <span className="process-count">({processCount})</span>
        </h3>
      </div>
      <div className="process-list-table-wrapper">
        <table className="process-list-table">
          <thead>
            <tr>
              <th className="th-name">Name</th>
              <th className="th-cpu">CPU%</th>
              <th className="th-memory">Memory%</th>
              <th className="th-category">Category</th>
              <th className="th-pid">PID</th>
            </tr>
          </thead>
          <tbody>
            {processes?.map((process) => (
              <ProcessRow
                key={process.pid}
                process={process}
                isSelected={selectedPid === process.pid}
                onSelect={handleSelect}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProcessList;

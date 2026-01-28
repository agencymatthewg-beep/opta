/**
 * Investigation Mode types for full transparency on what Opta is doing.
 * Power users can see exact registry keys, config files, commands, and impacts.
 */

export type ChangeType = 'registry' | 'config' | 'command' | 'service' | 'file';
export type ChangePlatform = 'windows' | 'macos' | 'linux' | 'all';

/**
 * A single change that Opta will make or has made.
 */
export interface InvestigationChange {
  id: string;
  type: ChangeType;
  platform: ChangePlatform;
  location: string;  // Registry path, file path, or command
  description: string;
  before: string | null;  // Previous value (null if new)
  after: string;  // New value
  technical: string;  // Full technical detail
  reversible: boolean;
  rollbackCommand?: string;
}

/**
 * A dependency that an optimization requires, conflicts with, or affects.
 */
export interface InvestigationDependency {
  name: string;
  type: 'requires' | 'conflicts' | 'affects';
  description: string;
  status: 'ok' | 'warning' | 'blocked';
}

/**
 * Impact analysis for an optimization change.
 */
export interface InvestigationImpact {
  category: 'performance' | 'stability' | 'compatibility' | 'security';
  severity: 'low' | 'medium' | 'high';
  description: string;
  mitigation?: string;
}

/**
 * Complete investigation report for an optimization.
 */
export interface InvestigationReport {
  optimizationId: string;
  optimizationName: string;
  timestamp: number;
  changes: InvestigationChange[];
  dependencies: InvestigationDependency[];
  impacts: InvestigationImpact[];
  rollback: {
    available: boolean;
    steps: string[];
    warnings: string[];
  };
}

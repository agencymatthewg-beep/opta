export type ActionEventKind =
  | 'turn'
  | 'tool'
  | 'thinking'
  | 'slash'
  | 'model'
  | 'permission'
  | 'error'
  | 'info';

export type ActionEventStatus = 'running' | 'ok' | 'error' | 'info';

export interface ActionEvent {
  id: string;
  at: number;
  sessionId: string;
  kind: ActionEventKind;
  status: ActionEventStatus;
  icon: string;
  label: string;
  detail?: string;
}

/** Keep action history bounded so long sessions stay memory-safe. */
export const MAX_ACTION_HISTORY = 400;

export function formatActionTimestamp(epochMs: number): string {
  const d = new Date(epochMs);
  return d.toLocaleString('en-US', {
    hour12: true,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function actionStatusColor(status: ActionEventStatus): string {
  if (status === 'running') return '#22d3ee';
  if (status === 'ok') return '#10b981';
  if (status === 'error') return '#ef4444';
  return '#a78bfa';
}


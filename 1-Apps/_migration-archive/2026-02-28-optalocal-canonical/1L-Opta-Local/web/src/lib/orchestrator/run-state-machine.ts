export type RunLifecycleState =
  | 'queued'
  | 'running'
  | 'waiting_input'
  | 'blocked'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export const RUN_STATE_TRANSITIONS: Record<RunLifecycleState, RunLifecycleState[]> = {
  queued: ['running', 'blocked', 'cancelled'],
  running: ['waiting_input', 'blocked', 'retrying', 'completed', 'failed', 'cancelled'],
  waiting_input: ['running', 'blocked', 'cancelled'],
  blocked: ['queued', 'running', 'cancelled'],
  retrying: ['running', 'failed', 'cancelled'],
  completed: [],
  failed: ['retrying', 'cancelled'],
  cancelled: [],
};

export function canTransitionRunState(
  current: RunLifecycleState,
  next: RunLifecycleState,
): boolean {
  return RUN_STATE_TRANSITIONS[current].includes(next);
}

export function assertRunStateTransition(
  current: RunLifecycleState,
  next: RunLifecycleState,
): void {
  if (current === next) return;
  if (!canTransitionRunState(current, next)) {
    throw new Error(`Invalid run transition: ${current} -> ${next}`);
  }
}


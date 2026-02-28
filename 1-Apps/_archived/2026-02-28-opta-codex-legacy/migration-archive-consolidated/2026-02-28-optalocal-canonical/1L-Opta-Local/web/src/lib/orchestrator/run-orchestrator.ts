import {
  assertRunStateTransition,
  type RunLifecycleState,
} from '@/lib/orchestrator/run-state-machine';

export interface OrchestratorTransition {
  from: RunLifecycleState;
  to: RunLifecycleState;
  at: number;
  reason?: string;
}

export interface OrchestratedRun {
  id: string;
  capability: string;
  state: RunLifecycleState;
  retryCount: number;
  transitions: OrchestratorTransition[];
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_STATE_ACTIONS: Record<RunLifecycleState, string[]> = {
  queued: ['start', 'cancel'],
  running: ['wait_input', 'block', 'retry', 'complete', 'fail', 'cancel'],
  waiting_input: ['resume', 'cancel'],
  blocked: ['unblock', 'cancel'],
  retrying: ['resume', 'fail', 'cancel'],
  completed: [],
  failed: ['retry', 'cancel'],
  cancelled: [],
};

interface QueueRunInput {
  id: string;
  capability: string;
  at?: number;
}

export class RunOrchestrator {
  private readonly runs = new Map<string, OrchestratedRun>();
  private readonly capabilityRegistry: Set<string>;

  constructor(capabilities: string[]) {
    this.capabilityRegistry = new Set(capabilities);
  }

  queueRun(input: QueueRunInput): OrchestratedRun {
    if (!this.capabilityRegistry.has(input.capability)) {
      throw new Error(`Capability not registered: ${input.capability}`);
    }
    if (this.runs.has(input.id)) {
      throw new Error(`Run already exists: ${input.id}`);
    }

    const at = input.at ?? Date.now();
    const run: OrchestratedRun = {
      id: input.id,
      capability: input.capability,
      state: 'queued',
      retryCount: 0,
      transitions: [],
      createdAt: at,
      updatedAt: at,
    };
    this.runs.set(run.id, run);
    return run;
  }

  transition(
    runId: string,
    to: RunLifecycleState,
    options?: { at?: number; reason?: string },
  ): OrchestratedRun {
    const run = this.getRunOrThrow(runId);
    assertRunStateTransition(run.state, to);

    const at = options?.at ?? Date.now();
    const nextTransition: OrchestratorTransition = {
      from: run.state,
      to,
      at,
      reason: options?.reason,
    };
    run.transitions.push(nextTransition);
    run.state = to;
    if (to === 'retrying') {
      run.retryCount += 1;
    }
    run.updatedAt = at;
    return run;
  }

  listRuns(): OrchestratedRun[] {
    return Array.from(this.runs.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  getRun(runId: string): OrchestratedRun | null {
    return this.runs.get(runId) ?? null;
  }

  availableActions(runId: string): string[] {
    const run = this.getRunOrThrow(runId);
    const stateActions = DEFAULT_STATE_ACTIONS[run.state];
    const capabilityActions = this.capabilityActions(run.capability);
    return stateActions.filter((action) => capabilityActions.includes(action));
  }

  private capabilityActions(capability: string): string[] {
    if (capability.startsWith('/v1/agents/runs')) {
      return [
        'start',
        'wait_input',
        'resume',
        'block',
        'unblock',
        'retry',
        'complete',
        'fail',
        'cancel',
      ];
    }

    if (capability.startsWith('/v1/skills')) {
      return ['start', 'retry', 'complete', 'fail', 'cancel'];
    }

    return ['start', 'complete', 'fail', 'cancel'];
  }

  private getRunOrThrow(runId: string): OrchestratedRun {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    return run;
  }
}


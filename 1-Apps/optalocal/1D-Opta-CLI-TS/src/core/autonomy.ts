import type { OptaConfig } from './config.js';

export type AutonomyLevel = 1 | 2 | 3 | 4 | 5;
export type AutonomyMode = 'execution' | 'ceo';
export const AUTONOMY_CYCLE_STAGES = [
  'research',
  'analysis',
  'planning',
  'sub-planning',
  'execution',
  'review',
  'reassessment',
] as const;
export type AutonomyCycleStage = (typeof AUTONOMY_CYCLE_STAGES)[number];
export type AutonomyRunCompletionStatus =
  | 'completed'
  | 'runtime_budget_reached'
  | 'hard_stop'
  | 'paused'
  | 'aborted'
  | 'error'
  | 'stopped';

export interface AutonomyCycleCheckpoint {
  turnIndex: number;
  cycle: number;
  phase: number;
  stage: AutonomyCycleStage;
  nextStage: AutonomyCycleStage;
  stageCount: number;
}

interface AutonomyCheckpointOptions {
  finalReassessment?: boolean;
}

interface CeoAutonomyReportStep {
  target: string;
  component: string;
  step: string;
  status: 'ok' | 'skip' | 'fail';
  message: string;
}

export interface CeoAutonomyReportInput {
  objective: string;
  completionStatus: AutonomyRunCompletionStatus;
  completionMessage?: string;
  turnCount: number;
  cycle: number;
  phase: number;
  stage: AutonomyCycleStage;
  toolCallCount: number;
  toolCallTurns: number;
  objectiveReassessmentEnabled: boolean;
  forcedFinalReassessment: boolean;
}

export interface CeoAutonomyReportPayload {
  summary: string;
  slug: string;
  commandInputs: Record<string, unknown>;
  steps: CeoAutonomyReportStep[];
}

interface BaseAutonomyProfile {
  level: AutonomyLevel;
  defaultMode: OptaConfig['defaultMode'];
  maxDurationMs: number;
  warnAt: number;
  pauseAt: number;
  hardStopAt: number;
  maxParallelTools: number;
  compactAt: number;
  subAgentMaxDepth: number;
  subAgentMaxConcurrent: number;
  subAgentBudgetToolCalls: number;
  subAgentBudgetTokens: number;
  subAgentBudgetTimeoutMs: number;
  allowRunCommand: boolean;
  allowDelegation: boolean;
}

export interface ResolvedAutonomyProfile extends BaseAutonomyProfile {
  mode: AutonomyMode;
  label: string;
  requireLiveData: boolean;
}

const BASE_LEVELS: Record<AutonomyLevel, BaseAutonomyProfile> = {
  1: {
    level: 1,
    defaultMode: 'safe',
    maxDurationMs: 10 * 60_000,
    warnAt: 25,
    pauseAt: 50,
    hardStopAt: 80,
    maxParallelTools: 3,
    compactAt: 0.65,
    subAgentMaxDepth: 2,
    subAgentMaxConcurrent: 2,
    subAgentBudgetToolCalls: 20,
    subAgentBudgetTokens: 12_288,
    subAgentBudgetTimeoutMs: 90_000,
    allowRunCommand: false,
    allowDelegation: false,
  },
  2: {
    level: 2,
    defaultMode: 'auto',
    maxDurationMs: 15 * 60_000,
    warnAt: 40,
    pauseAt: 80,
    hardStopAt: 120,
    maxParallelTools: 4,
    compactAt: 0.68,
    subAgentMaxDepth: 2,
    subAgentMaxConcurrent: 3,
    subAgentBudgetToolCalls: 30,
    subAgentBudgetTokens: 16_384,
    subAgentBudgetTimeoutMs: 120_000,
    allowRunCommand: false,
    allowDelegation: false,
  },
  3: {
    level: 3,
    defaultMode: 'auto',
    maxDurationMs: 25 * 60_000,
    warnAt: 60,
    pauseAt: 0,
    hardStopAt: 180,
    maxParallelTools: 5,
    compactAt: 0.72,
    subAgentMaxDepth: 3,
    subAgentMaxConcurrent: 4,
    subAgentBudgetToolCalls: 45,
    subAgentBudgetTokens: 24_576,
    subAgentBudgetTimeoutMs: 180_000,
    allowRunCommand: true,
    allowDelegation: true,
  },
  4: {
    level: 4,
    defaultMode: 'auto',
    maxDurationMs: 35 * 60_000,
    warnAt: 90,
    pauseAt: 0,
    hardStopAt: 260,
    maxParallelTools: 6,
    compactAt: 0.74,
    subAgentMaxDepth: 4,
    subAgentMaxConcurrent: 5,
    subAgentBudgetToolCalls: 70,
    subAgentBudgetTokens: 32_768,
    subAgentBudgetTimeoutMs: 240_000,
    allowRunCommand: true,
    allowDelegation: true,
  },
  5: {
    level: 5,
    defaultMode: 'auto',
    maxDurationMs: 60 * 60_000,
    warnAt: 140,
    pauseAt: 0,
    hardStopAt: 420,
    maxParallelTools: 8,
    compactAt: 0.78,
    subAgentMaxDepth: 5,
    subAgentMaxConcurrent: 6,
    subAgentBudgetToolCalls: 110,
    subAgentBudgetTokens: 65_536,
    subAgentBudgetTimeoutMs: 420_000,
    allowRunCommand: true,
    allowDelegation: true,
  },
};

const AUTONOMY_STAGE_GUIDANCE: Record<AutonomyCycleStage, string> = {
  research: 'Gather current facts, constraints, and missing context before acting.',
  analysis: 'Analyze evidence, tradeoffs, and root causes with explicit assumptions.',
  planning: 'Define a concrete implementation plan with clear checkpoints.',
  'sub-planning': 'Break the active plan into the next actionable sub-steps.',
  execution: 'Execute changes, run tools/tests, and capture concrete outputs.',
  review: 'Review results for correctness, regressions, and requirement coverage.',
  reassessment: 'Reassess objective completion, risks, and whether another cycle is required.',
};

function completionStatusLabel(status: AutonomyRunCompletionStatus): string {
  const labels: Record<AutonomyRunCompletionStatus, string> = {
    completed: 'completed',
    runtime_budget_reached: 'runtime budget reached',
    hard_stop: 'hard stop',
    paused: 'paused',
    aborted: 'aborted',
    error: 'error',
    stopped: 'stopped',
  };

  return labels[status];
}

function completionStatusToStepStatus(status: AutonomyRunCompletionStatus): 'ok' | 'skip' | 'fail' {
  switch (status) {
    case 'completed':
      return 'ok';
    case 'paused':
    case 'runtime_budget_reached':
    case 'stopped':
      return 'skip';
    case 'aborted':
    case 'error':
    case 'hard_stop':
      return 'fail';
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

function compactCompletionMessage(message: string | undefined, limit = 160): string | undefined {
  if (!message) return undefined;
  const normalized = message.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return undefined;
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 1))}…`;
}

function normalizeTurnIndex(turnIndex: number): number {
  if (!Number.isFinite(turnIndex)) return 0;
  return Math.max(0, Math.floor(turnIndex));
}

export function isAutonomyCycleStage(value: unknown): value is AutonomyCycleStage {
  return AUTONOMY_CYCLE_STAGES.includes(value as AutonomyCycleStage);
}

export function nextAutonomyCycleStage(stage: AutonomyCycleStage): AutonomyCycleStage {
  const currentIndex = AUTONOMY_CYCLE_STAGES.indexOf(stage);
  const normalizedIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (normalizedIndex + 1) % AUTONOMY_CYCLE_STAGES.length;
  return AUTONOMY_CYCLE_STAGES[nextIndex] ?? AUTONOMY_CYCLE_STAGES[0];
}

export function buildAutonomyCycleCheckpoint(turnIndex: number): AutonomyCycleCheckpoint {
  const normalizedTurn = normalizeTurnIndex(turnIndex);
  const stageCount = AUTONOMY_CYCLE_STAGES.length;
  const stageIndex = normalizedTurn % stageCount;
  const stage = AUTONOMY_CYCLE_STAGES[stageIndex] ?? AUTONOMY_CYCLE_STAGES[0];

  return {
    turnIndex: normalizedTurn,
    cycle: Math.floor(normalizedTurn / stageCount) + 1,
    phase: stageIndex + 1,
    stage,
    nextStage: nextAutonomyCycleStage(stage),
    stageCount,
  };
}

export function buildAutonomyStageCheckpointGuidance(
  checkpoint: AutonomyCycleCheckpoint,
  options?: AutonomyCheckpointOptions
): string {
  const finalReassessment = options?.finalReassessment === true;
  const enforcedStage: AutonomyCycleStage = finalReassessment ? 'reassessment' : checkpoint.stage;
  const enforcedNextStage = nextAutonomyCycleStage(enforcedStage);
  const lines = [
    '### Autonomy Stage Checkpoint',
    `- cycle: ${checkpoint.cycle} phase ${checkpoint.phase}/${checkpoint.stageCount}`,
    `- stage: ${enforcedStage}`,
    `- requirement: ${AUTONOMY_STAGE_GUIDANCE[enforcedStage]}`,
  ];

  if (finalReassessment) {
    lines.push(
      '- final pass: run a final review/reassessment now before ending this task.',
      '- confirm objective status, unresolved risks, and recommended next action.'
    );
  } else {
    lines.push(`- next stage: ${enforcedNextStage}`);
  }

  return lines.join('\n');
}

export function buildCeoAutonomyReport(input: CeoAutonomyReportInput): CeoAutonomyReportPayload {
  const objectiveCompact =
    (input.objective || '').replace(/\s+/g, ' ').trim().slice(0, 140) || '(no objective provided)';
  const completionLabel = completionStatusLabel(input.completionStatus);
  const completionMessage = compactCompletionMessage(input.completionMessage);
  const summary = [
    `CEO autonomy run ${completionLabel}.`,
    `cycle=${input.cycle} phase=${input.phase} stage=${input.stage}.`,
    `tool_calls=${input.toolCallCount} across ${input.toolCallTurns} tool turns.`,
    `objective: ${objectiveCompact}`,
  ].join(' ');

  const commandInputs: Record<string, unknown> = {
    turnCount: input.turnCount,
    cycle: input.cycle,
    phase: input.phase,
    stage: input.stage,
    toolCallCount: input.toolCallCount,
    toolCallTurns: input.toolCallTurns,
    completionStatus: input.completionStatus,
    objectiveReassessmentEnabled: input.objectiveReassessmentEnabled,
    forcedFinalReassessment: input.forcedFinalReassessment,
  };
  if (completionMessage) {
    commandInputs['completionMessage'] = completionMessage;
  }

  return {
    summary,
    slug: `ceo-autonomy-${input.completionStatus}`,
    commandInputs,
    steps: [
      {
        target: 'autonomy',
        component: 'cycle',
        step: 'phase',
        status: 'ok',
        message: `cycle=${input.cycle}, phase=${input.phase}/${AUTONOMY_CYCLE_STAGES.length}, stage=${input.stage}, turns=${input.turnCount}`,
      },
      {
        target: 'autonomy',
        component: 'tools',
        step: 'usage',
        status: 'ok',
        message: `tool calls=${input.toolCallCount}, tool turns=${input.toolCallTurns}`,
      },
      {
        target: 'autonomy',
        component: 'review',
        step: 'objective-reassessment',
        status: input.objectiveReassessmentEnabled ? 'ok' : 'skip',
        message: input.objectiveReassessmentEnabled
          ? input.forcedFinalReassessment
            ? 'Final reassessment pass enforced before completion.'
            : 'Objective reassessment enabled; standard completion path used.'
          : 'Objective reassessment disabled.',
      },
      {
        target: 'autonomy',
        component: 'completion',
        step: 'status',
        status: completionStatusToStepStatus(input.completionStatus),
        message: completionMessage
          ? `run status: ${completionLabel} (${completionMessage})`
          : `run status: ${completionLabel}`,
      },
    ],
  };
}

export function resolveAutonomyLevel(value: unknown): AutonomyLevel {
  const numeric =
    typeof value === 'number'
      ? value
      : Number.parseInt(
          typeof value === 'string'
            ? value
            : typeof value === 'object'
              ? JSON.stringify(value)
              : String(value as number | boolean | bigint | null | undefined),
          10
        );
  if (!Number.isFinite(numeric)) return 2;
  const clamped = Math.min(5, Math.max(1, Math.floor(numeric)));
  return clamped as AutonomyLevel;
}

export function resolveAutonomyMode(value: unknown): AutonomyMode {
  const normalized = (
    typeof value === 'string'
      ? value
      : typeof value === 'object' && value !== null
        ? JSON.stringify(value)
        : String(value as number | boolean | bigint | null | undefined)
  )
    .trim()
    .toLowerCase();
  return normalized === 'ceo' ? 'ceo' : 'execution';
}

export function formatAutonomySlider(levelInput: unknown): string {
  const level = resolveAutonomyLevel(levelInput);
  const filled = '■'.repeat(level);
  const empty = '□'.repeat(5 - level);
  return `[${filled}${empty}]`;
}

export function buildAutonomyProfile(
  levelInput: unknown,
  modeInput: unknown
): ResolvedAutonomyProfile {
  const level = resolveAutonomyLevel(levelInput);
  const mode = resolveAutonomyMode(modeInput);
  const base = BASE_LEVELS[level];

  if (mode === 'execution') {
    return {
      ...base,
      mode,
      label: `L${base.level} Autonomous`,
      requireLiveData: false,
    };
  }

  return {
    ...base,
    mode: 'ceo',
    label: `L${base.level} CEO`,
    // CEO mode favors deliberation and review over aggressive parallelism.
    maxParallelTools: Math.max(2, base.maxParallelTools - 1),
    warnAt: Math.max(base.warnAt, Math.round(base.hardStopAt * 0.4)),
    requireLiveData: true,
  };
}

export function autonomyDurationMinutes(profile: ResolvedAutonomyProfile): number {
  return Math.round(profile.maxDurationMs / 60_000);
}

export function computeAutonomyConfigUpdates(
  levelInput: unknown,
  modeInput: unknown
): Record<string, unknown> {
  const profile = buildAutonomyProfile(levelInput, modeInput);
  const ceoMode = profile.mode === 'ceo';
  const raw: Record<string, unknown> = {
    'autonomy.level': profile.level,
    'autonomy.mode': profile.mode,
    'autonomy.requireLiveData': ceoMode,
    'autonomy.reportStyle': ceoMode ? 'executive' : 'standard',
    defaultMode: profile.defaultMode,
    'safety.maxParallelTools': profile.maxParallelTools,
    'safety.compactAt': profile.compactAt,
    'safety.circuitBreaker.warnAt': profile.warnAt,
    'safety.circuitBreaker.pauseAt': profile.pauseAt,
    'safety.circuitBreaker.hardStopAt': profile.hardStopAt,
    'safety.circuitBreaker.maxDuration': profile.maxDurationMs,
    'subAgent.maxDepth': profile.subAgentMaxDepth,
    'subAgent.maxConcurrent': profile.subAgentMaxConcurrent,
    'subAgent.defaultBudget.maxToolCalls': profile.subAgentBudgetToolCalls,
    'subAgent.defaultBudget.maxTokens': profile.subAgentBudgetTokens,
    'subAgent.defaultBudget.timeoutMs': profile.subAgentBudgetTimeoutMs,
    'permissions.run_command': profile.allowRunCommand ? 'allow' : 'ask',
    'permissions.spawn_agent': profile.allowDelegation ? 'allow' : 'ask',
    'permissions.delegate_task': profile.allowDelegation ? 'allow' : 'ask',
    'permissions.web_search': 'allow',
    'permissions.web_fetch': 'allow',
    'policy.gateAllAutonomy': profile.level <= 2,
    'research.enabled': true,
    'research.alwaysIncludeDocumentation': ceoMode ? true : undefined,
    'policy.audit.enabled': ceoMode ? true : undefined,
  };

  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined) updates[key] = value;
  }
  return updates;
}

function withOptionalOverrides(
  source: Record<string, unknown>,
  target: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) target[key] = value;
  }
}

export function applyAutonomyRuntimeProfile(config: OptaConfig): OptaConfig {
  if (!config.autonomy.enforceProfile) return config;

  const profile = buildAutonomyProfile(config.autonomy.level, config.autonomy.mode);
  const ceoMode = profile.mode === 'ceo';

  const permissions = { ...config.permissions };
  permissions['run_command'] = profile.allowRunCommand
    ? 'allow'
    : (permissions['run_command'] ?? 'ask');
  permissions['spawn_agent'] = profile.allowDelegation
    ? 'allow'
    : (permissions['spawn_agent'] ?? 'ask');
  permissions['delegate_task'] = profile.allowDelegation
    ? 'allow'
    : (permissions['delegate_task'] ?? 'ask');
  permissions['web_search'] = 'allow';
  permissions['web_fetch'] = 'allow';

  const updatedAutonomy = { ...config.autonomy };
  const optionalAutonomy: Record<string, unknown> = {
    requireLiveData: ceoMode ? true : updatedAutonomy.requireLiveData,
    reportStyle: ceoMode ? 'executive' : updatedAutonomy.reportStyle,
  };
  withOptionalOverrides(optionalAutonomy, updatedAutonomy as unknown as Record<string, unknown>);

  return {
    ...config,
    autonomy: updatedAutonomy,
    defaultMode: profile.defaultMode,
    permissions,
    research: {
      ...config.research,
      enabled: true,
      alwaysIncludeDocumentation: ceoMode ? true : config.research.alwaysIncludeDocumentation,
    },
    policy: {
      ...config.policy,
      gateAllAutonomy: profile.level <= 2,
      audit: {
        ...config.policy.audit,
        enabled: ceoMode ? true : config.policy.audit.enabled,
      },
    },
    safety: {
      ...config.safety,
      maxParallelTools: profile.maxParallelTools,
      compactAt: profile.compactAt,
      circuitBreaker: {
        ...config.safety.circuitBreaker,
        warnAt: profile.warnAt,
        pauseAt: profile.pauseAt,
        hardStopAt: profile.hardStopAt,
        maxDuration: profile.maxDurationMs,
      },
    },
    subAgent: {
      ...config.subAgent,
      maxDepth: profile.subAgentMaxDepth,
      maxConcurrent: profile.subAgentMaxConcurrent,
      defaultBudget: {
        ...config.subAgent.defaultBudget,
        maxToolCalls: profile.subAgentBudgetToolCalls,
        maxTokens: profile.subAgentBudgetTokens,
        timeoutMs: profile.subAgentBudgetTimeoutMs,
      },
    },
  };
}

export function buildAutonomyPromptBlock(config: OptaConfig): string {
  const profile = buildAutonomyProfile(config.autonomy.level, config.autonomy.mode);
  const minutes = autonomyDurationMinutes(profile);
  const slider = formatAutonomySlider(profile.level);
  const stageChain = AUTONOMY_CYCLE_STAGES.join(' -> ');

  const lines = [
    '### Autonomous Execution Profile',
    `- profile: ${profile.label} ${slider}`,
    `- max autonomous runtime per task: ${minutes} minutes`,
    `- tool-call envelope: warn=${profile.warnAt}, hard-stop=${profile.hardStopAt}`,
    `- enforced cycle stages: ${stageChain}`,
    '- execution loop:',
    '  1) Research current facts and constraints.',
    '  2) Analyze root causes and design options.',
    '  3) Create a concrete plan.',
    '  4) Break the plan into sub-plans for immediate execution.',
    '  5) Execute changes and run verification.',
    '  6) Review outputs for quality and regressions.',
    '  7) Reassess objective completion, then start the next cycle if needed.',
    '- be proactive, precise, and explicit about assumptions.',
  ];

  if (profile.level >= 5) {
    lines.push(
      '- level 5 directive: sustain autonomous cycles for 30-60+ minutes when needed, using staged checkpoints and self-review before final output.'
    );
  }

  if (profile.mode === 'ceo') {
    lines.push(
      '- CEO mode directives:',
      '  - ask clarifying questions at key decision gates instead of guessing business intent.',
      '  - verify time-sensitive claims with live data using web_search/web_fetch.',
      '  - keep a work log of changes, decisions, and results.',
      '  - propose long-term, permanent solutions and organization improvements.',
      '  - finish with an executive summary + implementation report.'
    );
  }

  return lines.join('\n');
}

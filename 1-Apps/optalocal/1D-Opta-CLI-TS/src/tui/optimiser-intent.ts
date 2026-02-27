import { sanitizeTerminalText } from '../utils/text.js';

export interface OptimiserIntentMessage {
  role: string;
  content: string;
}

export interface OptimiserIntentActivity {
  type: 'tool' | 'thinking';
  toolName?: string;
  toolStatus?: 'running' | 'done' | 'error';
}

export interface OptimiserIntentInput {
  sessionTitle?: string;
  messages: OptimiserIntentMessage[];
  liveActivity?: OptimiserIntentActivity[];
  turnPhase?: string;
  streamingLabel?: string;
  actionLabel?: string;
}

export interface OptimiserIntentView {
  goal: string;
  why: string;
  flowSteps: string[];
  nextSteps: string[];
}

const FALLBACK_STEPS = [
  'Validate constraints and expected output format.',
  'Execute the minimum required actions to gather evidence.',
  'Verify results and check for regressions or side effects.',
  'Format response with clear spacing and scan-friendly structure.',
  'Confirm completion criteria and surface precise next action.',
];

const MAX_GOAL_CHARS = 120;
const MAX_REASON_CHARS = 120;
const MAX_STEP_CHARS = 92;
const MAX_FLOW_STEP_CHARS = 40;

function compactInline(input: string, maxChars: number): string {
  const normalized = sanitizeTerminalText(input).replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, Math.max(maxChars - 1, 1)).trimEnd()}…`;
}

function cleanStepCandidate(input: string): string {
  return compactInline(
    input
      .replace(/^[\-*•]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/^#+\s+/, '')
      .replace(/[`*]/g, ''),
    MAX_STEP_CHARS,
  );
}

function extractStepCandidates(text: string): string[] {
  const normalized = sanitizeTerminalText(text).trim();
  if (!normalized) return [];

  const candidates: string[] = [];

  for (const line of normalized.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const listMatch = trimmed.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
    if (listMatch?.[1]) {
      candidates.push(cleanStepCandidate(listMatch[1]));
      continue;
    }
    if (trimmed.includes(' - ')) {
      for (const part of trimmed.split(/\s-\s+/)) {
        const candidate = cleanStepCandidate(part);
        if (candidate.length >= 8) candidates.push(candidate);
      }
    }
  }

  const sentenceSource = normalized.replace(/\n+/g, ' ');
  for (const sentence of sentenceSource.split(/(?<=[.!?])\s+/)) {
    const cleaned = cleanStepCandidate(sentence);
    if (cleaned.length >= 12) candidates.push(cleaned);
  }

  return candidates;
}

function uniqueSteps(steps: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const step of steps) {
    const normalized = step.toLowerCase();
    if (!step || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(step);
    if (unique.length >= 5) break;
  }
  return unique;
}

function containsAny(source: string, terms: string[]): boolean {
  return terms.some((term) => source.includes(term));
}

function deriveFlowSteps(input: OptimiserIntentInput, goal: string): string[] {
  const source = `${goal} ${input.actionLabel ?? ''} ${input.streamingLabel ?? ''}`.toLowerCase();
  const runningTool = (input.liveActivity ?? []).find(
    (activity) => activity.type === 'tool' && activity.toolStatus === 'running' && activity.toolName,
  );
  const flow: string[] = [];

  if (runningTool?.toolName) {
    flow.push(compactInline(`Run ${runningTool.toolName.replace(/_/g, ' ')}`, MAX_FLOW_STEP_CHARS));
  }
  if (containsAny(source, ['research', 'search', 'investigate', 'discover', 'look up'])) {
    flow.push('Research context');
  }
  if (containsAny(source, ['analyse', 'analyze', 'debug', 'inspect', 'review'])) {
    flow.push('Analyse codebase');
  }
  if (containsAny(source, ['plan', 'strategy', 'design', 'scope'])) {
    flow.push('Plan implementation');
  }
  if (containsAny(source, ['implement', 'build', 'fix', 'stabilize', 'stabilise', 'refactor'])) {
    flow.push('Implement changes');
  }
  if (containsAny(source, ['test', 'verify', 'benchmark', 'validate', 'regression'])) {
    flow.push('Verify outcomes');
  }
  if (containsAny(source, ['summarize', 'summarise', 'report', 'explain', 'document'])) {
    flow.push('Summarize findings');
  }

  const deduped = uniqueSteps(flow).slice(0, 4);
  if (deduped.length > 0) return deduped;
  return [
    'Understand request',
    'Execute core steps',
    'Verify outcome',
  ];
}

function deriveGoal(messages: OptimiserIntentMessage[], sessionTitle?: string): string {
  const userPrompts = messages
    .filter((msg) => msg.role === 'user')
    .map((msg) => compactInline(msg.content, MAX_GOAL_CHARS))
    .filter((text) => text.length > 0);

  const meaningfulPrompt = [...userPrompts].reverse().find((text) => text.length >= 12 && !text.startsWith('/'));
  if (meaningfulPrompt) return meaningfulPrompt;

  const title = compactInline(sessionTitle ?? '', MAX_GOAL_CHARS);
  if (title) return title;

  return 'Deliver verified, optimized output for the current request.';
}

function deriveWhy(input: OptimiserIntentInput): string {
  const runningTool = (input.liveActivity ?? []).find(
    (activity) => activity.type === 'tool' && activity.toolStatus === 'running',
  );
  if (runningTool?.toolName) {
    return compactInline(
      `Running ${runningTool.toolName} to gather execution evidence before final response.`,
      MAX_REASON_CHARS,
    );
  }

  if (input.turnPhase === 'tool-call') {
    const streamLabel = compactInline(input.streamingLabel ?? '', MAX_REASON_CHARS);
    if (streamLabel) {
      return compactInline(`Executing ${streamLabel} and validating returned state.`, MAX_REASON_CHARS);
    }
    return 'Executing tool actions and validating return status.';
  }

  if (input.turnPhase === 'waiting') {
    return 'Analyzing the request and preparing the lowest-risk execution path.';
  }
  if (input.turnPhase === 'streaming') {
    return 'Synthesizing verified outputs into a concise, readable answer.';
  }

  const action = compactInline(input.actionLabel ?? '', MAX_REASON_CHARS);
  if (action && action.toLowerCase() !== 'idle') {
    return action;
  }

  return 'Maintaining stable app state and waiting for the next instruction.';
}

function deriveNextSteps(input: OptimiserIntentInput): string[] {
  const assistantMessages = input.messages.filter((message) => message.role === 'assistant');
  const latestAssistant = assistantMessages[assistantMessages.length - 1]?.content ?? '';
  const candidates = extractStepCandidates(latestAssistant);

  const runningTool = (input.liveActivity ?? []).find(
    (activity) => activity.type === 'tool' && activity.toolStatus === 'running',
  );
  const toolPreface = runningTool?.toolName
    ? [
      cleanStepCandidate(`Wait for ${runningTool.toolName} result and capture outcome.`),
      'Validate tool output against prompt intent.',
    ]
    : [];

  const steps = uniqueSteps([...toolPreface, ...candidates, ...FALLBACK_STEPS]).slice(0, 5);
  if (steps.length === 5) return steps;

  const padded = [...steps];
  for (const fallback of FALLBACK_STEPS) {
    if (padded.length >= 5) break;
    const normalized = fallback.toLowerCase();
    if (padded.some((step) => step.toLowerCase() === normalized)) continue;
    padded.push(fallback);
  }
  return padded.slice(0, 5);
}

export function deriveOptimiserIntent(input: OptimiserIntentInput): OptimiserIntentView {
  const goal = deriveGoal(input.messages, input.sessionTitle);
  return {
    goal,
    why: deriveWhy(input),
    flowSteps: deriveFlowSteps(input, goal),
    nextSteps: deriveNextSteps(input),
  };
}

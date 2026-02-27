import { sanitizeTerminalText } from '../utils/text.js';

export type ResponseIntentTone = 'concise' | 'technical' | 'product';
export type ResponseIntentOutcome = 'direct' | 'verified' | 'partial';

export interface ResponseIntentOutcomeInput {
  toolCallCount: number;
  failedToolCallCount: number;
  hasVisibleOutput: boolean;
}

export interface ResponseIntentSentenceInput extends ResponseIntentOutcomeInput {
  promptText: string;
  tone: ResponseIntentTone;
}

const INTENT_TONES: ResponseIntentTone[] = ['concise', 'technical', 'product'];

function normalizePrompt(input: string): string {
  return sanitizeTerminalText(input).replace(/\s+/g, ' ').trim();
}

function includesAny(source: string, terms: string[]): boolean {
  return terms.some((term) => source.includes(term));
}

function deriveSubject(promptText: string): string {
  const normalized = normalizePrompt(promptText).toLowerCase();
  if (!normalized) return 'the requested task';
  if (normalized.startsWith('/')) return 'a slash command task';
  if (normalized.includes('?')) return 'the user question';
  if (includesAny(normalized, ['implement', 'build', 'fix', 'refactor', 'patch'])) {
    return 'an implementation task';
  }
  if (includesAny(normalized, ['review', 'audit', 'assess', 'compare', 'inspect'])) {
    return 'a review task';
  }
  if (includesAny(normalized, ['research', 'investigate', 'search', 'analyse', 'analyze', 'benchmark'])) {
    return 'an investigation task';
  }
  if (includesAny(normalized, ['explain', 'summarize', 'summarise', 'describe'])) {
    return 'an explanation task';
  }
  return 'the requested task';
}

function toolWord(count: number): string {
  return count === 1 ? 'tool call' : 'tool calls';
}

export function isResponseIntentTone(value: unknown): value is ResponseIntentTone {
  return typeof value === 'string' && INTENT_TONES.includes(value as ResponseIntentTone);
}

export function deriveResponseIntentOutcome(input: ResponseIntentOutcomeInput): ResponseIntentOutcome {
  const total = Math.max(0, Math.floor(input.toolCallCount));
  const failed = Math.max(0, Math.floor(input.failedToolCallCount));
  if (total === 0) return 'direct';
  if (failed > 0 || !input.hasVisibleOutput) return 'partial';
  return 'verified';
}

export function deriveResponseIntentSentence(input: ResponseIntentSentenceInput): string {
  const total = Math.max(0, Math.floor(input.toolCallCount));
  const failed = Math.max(0, Math.floor(input.failedToolCallCount));
  const subject = deriveSubject(input.promptText);
  const outcome = deriveResponseIntentOutcome(input);

  if (input.tone === 'concise') {
    if (outcome === 'direct') return `Completed ${subject}.`;
    if (outcome === 'verified') return `Completed ${subject} with ${total} verified ${toolWord(total)}.`;
    return `Completed ${subject} with partial verification (${failed}/${total} ${toolWord(total)} failed).`;
  }

  if (input.tone === 'product') {
    if (outcome === 'direct') return `Delivered ${subject} from available context.`;
    if (outcome === 'verified') return `Delivered ${subject} with evidence from ${total} ${toolWord(total)}.`;
    return `Delivered ${subject} with partial evidence (${failed}/${total} ${toolWord(total)} failed).`;
  }

  if (outcome === 'direct') return `Synthesized ${subject} from session context.`;
  if (outcome === 'verified') return `Synthesized ${subject} using ${total} ${toolWord(total)}; evidence verified.`;
  return `Synthesized ${subject} with degraded evidence (${failed}/${total} ${toolWord(total)} failed).`;
}

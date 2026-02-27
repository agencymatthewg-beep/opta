/**
 * Report Trigger — decides when to generate HTML reports and orchestrates
 * building, writing, and opening them.
 *
 * Auto-triggers for:
 *   - Benchmarks (always)
 *   - Plan mode completions (always)
 *   - Autonomous sessions above configurable thresholds (tool calls OR elapsed time)
 *
 * Also provides buildSessionReport() for the manual /report slash command.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { hostname } from 'node:os';
import { execa } from 'execa';
import { renderGlassReport, type ReportSection, type StatItem, type TimelineEvent } from './html-report.js';
import type { TurnStats } from '../tui/adapter.js';
import type { Session } from '../memory/store.js';
import type { OptaConfig } from '../core/config.js';
import {
  deriveResponseIntentOutcome,
  deriveResponseIntentSentence,
  type ResponseIntentOutcomeInput,
  type ResponseIntentSentenceInput,
} from '../tui/response-intent.js';

// ── Config defaults (overridden by config.reports.*) ──

const DEFAULT_TOOL_CALL_THRESHOLD = 15;
const DEFAULT_ELAPSED_THRESHOLD = 120; // seconds
const DEFAULT_OUTPUT_DIR = '.opta/reports';

export interface ReportConfig {
  enabled: boolean;
  autoOpen: boolean;
  outputDir: string;
  threshold: {
    toolCalls: number;
    elapsedSeconds: number;
  };
}

export function resolveReportConfig(config: OptaConfig): ReportConfig {
  const raw = (config as Record<string, unknown>)['reports'] as Partial<ReportConfig> | undefined;
  return {
    enabled: raw?.enabled ?? true,
    autoOpen: raw?.autoOpen ?? true,
    outputDir: raw?.outputDir ?? DEFAULT_OUTPUT_DIR,
    threshold: {
      toolCalls: raw?.threshold?.toolCalls ?? DEFAULT_TOOL_CALL_THRESHOLD,
      elapsedSeconds: raw?.threshold?.elapsedSeconds ?? DEFAULT_ELAPSED_THRESHOLD,
    },
  };
}

// ── Trigger gate ──────────────────────────────────────────────────

export type ReportTriggerReason = 'benchmark' | 'plan' | 'autonomous' | 'manual';

/**
 * Determine whether an automatic report should be generated.
 *
 * Returns the trigger reason, or null if no auto-report is warranted.
 */
export function shouldAutoReport(
  turnStats: TurnStats,
  mode: string | undefined,
  reportConfig: ReportConfig,
): ReportTriggerReason | null {
  if (!reportConfig.enabled) return null;

  // Plan mode always generates a report
  if (mode === 'plan') return 'plan';

  // Autonomous threshold: tool calls OR elapsed time
  const { toolCalls, elapsedSeconds } = reportConfig.threshold;
  if (turnStats.toolCalls >= toolCalls || turnStats.elapsed >= elapsedSeconds) {
    return 'autonomous';
  }

  return null;
}

// ── Data helpers ──────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatSpeed(tokensPerSec: number): string {
  if (tokensPerSec < 1) return '<1';
  return tokensPerSec.toFixed(1);
}

function formatLatency(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface GitChanges {
  created: string[];
  modified: string[];
  deleted: string[];
}

async function collectGitChanges(cwd: string): Promise<GitChanges> {
  try {
    const result = await execa('git', ['status', '--porcelain'], { cwd, reject: false });
    if (result.exitCode !== 0) return { created: [], modified: [], deleted: [] };

    const created: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];

    for (const line of result.stdout.split('\n')) {
      if (!line.trim()) continue;
      const status = line.slice(0, 2);
      let file = line.slice(3).trim();
      if (!file) continue;

      if (status.includes('R') || status.includes('C')) {
        const parts = file.split(' -> ');
        file = parts[parts.length - 1]?.trim() ?? file;
      }

      if (status === '??' || status.includes('A')) created.push(file);
      else if (status.includes('D')) deleted.push(file);
      else modified.push(file);
    }

    return { created: created.sort(), modified: modified.sort(), deleted: deleted.sort() };
  } catch {
    return { created: [], modified: [], deleted: [] };
  }
}

function extractToolTimeline(session: Session): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const toolColors: Record<string, string> = {
    read_file: 'var(--neon-blue)',
    write_file: 'var(--neon-green)',
    edit_file: 'var(--neon-amber)',
    run_command: 'var(--neon-red)',
    search_files: 'var(--neon-cyan)',
    list_dir: 'var(--neon-blue)',
    find_files: 'var(--neon-cyan)',
    ask_user: 'var(--primary)',
  };

  let toolIndex = 0;
  for (const msg of session.messages ?? []) {
    if (msg.role === 'assistant' && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        toolIndex++;
        const name = tc.function.name;
        let detail: string | undefined;
        try {
          const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          const path = args['path'] ?? args['file_path'] ?? args['command'] ?? args['pattern'];
          if (typeof path === 'string') {
            detail = path.length > 80 ? path.slice(0, 77) + '...' : path;
          }
        } catch { /* ignore parse errors */ }

        events.push({
          time: `#${toolIndex}`,
          label: name,
          detail,
          color: toolColors[name] ?? 'var(--text-muted)',
        });
      }
    }
  }

  // Keep at most 50 events to avoid enormous timelines
  if (events.length > 50) {
    const head = events.slice(0, 25);
    const tail = events.slice(-24);
    return [
      ...head,
      { time: '...', label: `${events.length - 49} more tool calls`, color: 'var(--text-muted)' },
      ...tail,
    ];
  }

  return events;
}

function extractDecisions(session: Session): string[] {
  const decisions: string[] = [];
  const regex = /\b(decision|decided|choose|selected|plan|approach)\b/i;

  for (const msg of session.messages ?? []) {
    if (msg.role !== 'assistant') continue;
    const text = typeof msg.content === 'string' ? msg.content : '';
    if (!text || !regex.test(text)) continue;
    decisions.push(text.replace(/\s+/g, ' ').slice(0, 160));
    if (decisions.length >= 5) break;
  }

  return decisions;
}

function extractIssues(session: Session): string[] {
  const issues: string[] = [];
  const regex = /\b(error|failed|failure|exception|timeout|denied|invalid)\b/i;

  for (const msg of session.messages ?? []) {
    const text = typeof msg.content === 'string' ? msg.content : '';
    if (!text || !regex.test(text)) continue;
    issues.push(text.replace(/\s+/g, ' ').slice(0, 160));
    if (issues.length >= 5) break;
  }

  return issues;
}

function extractLastAssistantSentence(session: Session): string {
  const assistantMsgs = (session.messages ?? []).filter((m) => m.role === 'assistant');
  const last = assistantMsgs[assistantMsgs.length - 1];
  if (!last) return 'No assistant response.';
  const text = typeof last.content === 'string' ? last.content : '';
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.split(/(?<=[.!?])\s+/)[0]?.slice(0, 200) ?? compact.slice(0, 200);
}

// ── Section builders ─────────────────────────────────────────────

export function buildSessionReportSections(
  session: Session,
  turnStats: TurnStats,
  reason: ReportTriggerReason,
  gitChanges: GitChanges,
): ReportSection[] {
  const sections: ReportSection[] = [];

  // Intent classification
  const intentInput: ResponseIntentOutcomeInput = {
    toolCallCount: turnStats.toolCalls,
    failedToolCallCount: 0,
    hasVisibleOutput: true,
  };
  const outcome = deriveResponseIntentOutcome(intentInput);

  // Prompt for sentence derivation
  const userMessages = (session.messages ?? []).filter((m) => m.role === 'user');
  const firstPrompt = userMessages[0]
    ? (typeof userMessages[0].content === 'string' ? userMessages[0].content : '')
    : '';
  const sentenceInput: ResponseIntentSentenceInput = {
    ...intentInput,
    promptText: firstPrompt,
    tone: 'product',
  };
  const intentSentence = deriveResponseIntentSentence(sentenceInput);

  // §1 — Performance metrics
  sections.push({
    type: 'section-header',
    number: '01',
    title: 'Performance',
  });

  const stats: StatItem[] = [
    { value: String(turnStats.toolCalls), label: 'Tool Calls' },
    { value: formatElapsed(turnStats.elapsed), label: 'Duration' },
    { value: formatSpeed(turnStats.speed), label: 'Tokens/sec' },
    { value: formatLatency(turnStats.firstTokenLatencyMs), label: 'First Token' },
    { value: String(turnStats.completionTokens), label: 'Tokens' },
    { value: outcome.toUpperCase(), label: 'Outcome' },
  ];
  sections.push({ type: 'stats-grid', items: stats });

  // §2 — Session info
  sections.push({
    type: 'section-header',
    number: '02',
    title: 'Session',
  });

  sections.push({
    type: 'key-value',
    pairs: [
      { key: 'Session ID', value: session.id },
      { key: 'Title', value: session.title || '(untitled)' },
      { key: 'Model', value: session.model || 'unknown' },
      { key: 'Working Directory', value: session.cwd || process.cwd() },
      { key: 'Created', value: session.created || '—' },
      { key: 'Report Trigger', value: reason, color: 'c-violet' },
      { key: 'Intent', value: intentSentence },
    ],
  });

  // §3 — Tool timeline (only if there are tools)
  const timeline = extractToolTimeline(session);
  if (timeline.length > 0) {
    sections.push({ type: 'divider' });
    sections.push({
      type: 'section-header',
      number: '03',
      title: 'Tool Timeline',
    });
    sections.push({ type: 'timeline', events: timeline });
  }

  // §4 — File changes
  const totalChanges = gitChanges.created.length + gitChanges.modified.length + gitChanges.deleted.length;
  if (totalChanges > 0) {
    sections.push({ type: 'divider' });
    sections.push({
      type: 'section-header',
      number: '04',
      title: 'File Changes',
    });
    sections.push({
      type: 'file-changes',
      created: gitChanges.created,
      modified: gitChanges.modified,
      deleted: gitChanges.deleted,
    });
  }

  // §5 — Decisions
  const decisions = extractDecisions(session);
  if (decisions.length > 0) {
    sections.push({ type: 'divider' });
    sections.push({
      type: 'section-header',
      number: '05',
      title: 'Decisions Made',
    });
    sections.push({ type: 'list', items: decisions, style: 'bullet' });
  }

  // §6 — Issues
  const issues = extractIssues(session);
  if (issues.length > 0) {
    sections.push({ type: 'divider' });
    sections.push({
      type: 'section-header',
      number: '06',
      title: 'Issues Encountered',
    });
    sections.push({ type: 'list', items: issues, style: 'bullet' });
  }

  // §7 — Summary
  sections.push({ type: 'divider' });
  sections.push({
    type: 'section-header',
    number: String(totalChanges > 0 ? '07' : '05').padStart(2, '0'),
    title: 'Summary',
  });
  sections.push({
    type: 'text-block',
    content: extractLastAssistantSentence(session),
  });

  return sections;
}

export function buildPlanReportSections(
  session: Session,
  turnStats: TurnStats,
): ReportSection[] {
  const sections: ReportSection[] = [];

  // Extract the final assistant message as the plan content
  const assistantMsgs = (session.messages ?? []).filter((m) => m.role === 'assistant');
  const planText = assistantMsgs.length > 0
    ? (typeof assistantMsgs[assistantMsgs.length - 1]!.content === 'string'
        ? assistantMsgs[assistantMsgs.length - 1]!.content as string
        : '')
    : '';

  // Stats
  sections.push({
    type: 'section-header',
    number: '01',
    title: 'Plan Metrics',
  });
  sections.push({
    type: 'stats-grid',
    items: [
      { value: String(turnStats.toolCalls), label: 'Research Calls' },
      { value: formatElapsed(turnStats.elapsed), label: 'Duration' },
      { value: formatSpeed(turnStats.speed), label: 'Tokens/sec' },
      { value: String(turnStats.completionTokens), label: 'Tokens' },
    ],
  });

  // Context
  sections.push({
    type: 'section-header',
    number: '02',
    title: 'Context',
  });
  sections.push({
    type: 'key-value',
    pairs: [
      { key: 'Model', value: session.model || 'unknown' },
      { key: 'Working Directory', value: session.cwd || process.cwd() },
      { key: 'Session', value: session.id },
    ],
  });

  // Plan content
  sections.push({ type: 'divider' });
  sections.push({
    type: 'section-header',
    number: '03',
    title: 'Plan',
  });
  sections.push({
    type: 'text-block',
    content: planText.slice(0, 10_000) || 'No plan content generated.',
  });

  return sections;
}

// ── Write + Open ─────────────────────────────────────────────────

function slugify(text: string, maxLen = 48): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen)
    .replace(/-+$/g, '') || 'report';
}

export async function writeAndOpenReport(
  html: string,
  outputDir: string,
  slug: string,
  autoOpen: boolean,
): Promise<string> {
  await mkdir(outputDir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `${ts}-${slug}.html`;
  const filePath = join(outputDir, fileName);

  await writeFile(filePath, html, 'utf-8');

  if (autoOpen) {
    // Fire-and-forget — don't block on browser opening
    execa('open', [filePath], { reject: false }).catch(() => { /* ignore */ });
  }

  return filePath;
}

// ── Orchestrator ─────────────────────────────────────────────────

/**
 * Full orchestrator: check threshold → build sections → render → write → open.
 *
 * Called from turn:end handler in the TUI adapter or from /report slash command.
 * Returns the file path if a report was generated, or null if skipped.
 */
export async function maybeGenerateReport(
  session: Session,
  turnStats: TurnStats,
  config: OptaConfig,
  mode?: string,
  reason?: ReportTriggerReason,
): Promise<string | null> {
  const rc = resolveReportConfig(config);

  // Determine reason
  const effectiveReason = reason ?? shouldAutoReport(turnStats, mode, rc);
  if (!effectiveReason) return null;

  const cwd = session.cwd || process.cwd();
  const outputDir = join(cwd, rc.outputDir);

  let sections: ReportSection[];
  let badge: string;
  let subtitle: string;

  if (effectiveReason === 'plan') {
    sections = buildPlanReportSections(session, turnStats);
    badge = 'Plan Report';
    subtitle = `Generated in ${formatElapsed(turnStats.elapsed)} with ${turnStats.toolCalls} research calls`;
  } else {
    const gitChanges = await collectGitChanges(cwd);
    sections = buildSessionReportSections(session, turnStats, effectiveReason, gitChanges);
    badge = effectiveReason === 'benchmark' ? 'Benchmark Report' : 'Session Report';
    subtitle = `${turnStats.toolCalls} tool calls in ${formatElapsed(turnStats.elapsed)} — ${formatSpeed(turnStats.speed)} tok/s`;
  }

  const title = session.title || 'Opta Session';
  const html = renderGlassReport({ title, badge, subtitle, sections });
  const slug = slugify(session.title || effectiveReason);
  const deviceName = hostname().split('.')[0] ?? 'device';

  return writeAndOpenReport(html, outputDir, `${deviceName}-${slug}`, rc.autoOpen);
}

/**
 * Manual report generation — always generates regardless of thresholds.
 * Used by /report slash command.
 */
export async function generateManualReport(
  session: Session,
  turnStats: TurnStats,
  config: OptaConfig,
): Promise<string> {
  const rc = resolveReportConfig(config);
  const cwd = session.cwd || process.cwd();
  const outputDir = join(cwd, rc.outputDir);
  const gitChanges = await collectGitChanges(cwd);
  const sections = buildSessionReportSections(session, turnStats, 'manual', gitChanges);

  const title = session.title || 'Opta Session Report';
  const subtitle = `${turnStats.toolCalls} tool calls in ${formatElapsed(turnStats.elapsed)}`;
  const html = renderGlassReport({ title, badge: 'Manual Report', subtitle, sections });
  const slug = slugify(session.title || 'session-report');
  const deviceName = hostname().split('.')[0] ?? 'device';

  return writeAndOpenReport(html, outputDir, `${deviceName}-${slug}`, rc.autoOpen);
}

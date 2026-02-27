import { cpus, totalmem, freemem, platform, arch, loadavg } from 'node:os';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { OptaConfig } from '../core/config.js';
import { appendLedgerEntry } from './ledger.js';
import { clamp } from '../utils/common.js';
import type { CaptureLevel, LearningEntryKind, LearningLedgerEntry } from './types.js';

const CALIBRATION_SCHEMA_VERSION = 1;
const CALIBRATION_RELATIVE_PATH = join('.opta', 'learning', 'device-calibration.json');

export interface LearningSystemPressureSample {
  cpuPct: number;
  memoryPct: number;
  eventLoopLagMs: number;
  diskWriteKbPerSec: number;
}

interface CalibratedThresholds {
  cpuHighPct: number;
  memoryHighPct: number;
  eventLoopLagMs: number;
  diskWriteKbPerSec: number;
}

interface CalibrationSnapshot {
  schemaVersion: number;
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
  thresholds: CalibratedThresholds;
}

export interface CaptureLevelResolution {
  captureLevel: CaptureLevel;
  thresholds: CalibratedThresholds;
  sample: LearningSystemPressureSample;
  source: 'config' | 'calibrated';
  reason: string;
}

export interface CaptureLearningEventInput {
  kind: LearningEntryKind;
  topic: string;
  content: string;
  tags?: string[];
  evidence?: Array<{ label: string; uri: string }>;
  metadata?: Record<string, unknown>;
  verified?: boolean;
}

export interface CaptureLearningOptions {
  cwd?: string;
  now?: () => Date;
  sample?: LearningSystemPressureSample;
}

export interface CaptureLearningResult {
  captured: boolean;
  id?: string;
  captureLevel: CaptureLevel;
  reason?: string;
}

export function calibrationPath(cwd = process.cwd()): string {
  return join(cwd, CALIBRATION_RELATIVE_PATH);
}

function deviceFingerprint(): string {
  return [
    platform(),
    arch(),
    String(cpus().length),
    String(totalmem()),
  ].join(':');
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function baseThresholds(config: OptaConfig): CalibratedThresholds {
  return {
    cpuHighPct: config.learning.governor.thresholds.cpuHighPct,
    memoryHighPct: config.learning.governor.thresholds.memoryHighPct,
    eventLoopLagMs: config.learning.governor.thresholds.eventLoopLagMs,
    diskWriteKbPerSec: config.learning.governor.thresholds.diskWriteKbPerSec,
  };
}

function deriveThresholdsForDevice(config: OptaConfig): CalibratedThresholds {
  const baseline = baseThresholds(config);
  const cores = cpus().length;
  const memoryGb = totalmem() / (1024 ** 3);

  const cpuHeadroom = cores >= 12 ? 8 : cores >= 8 ? 5 : cores >= 4 ? 2 : -2;
  const memoryHeadroom = memoryGb >= 32 ? 7 : memoryGb >= 16 ? 4 : memoryGb >= 8 ? 1 : -3;
  const lagDelta = cores >= 8 ? -15 : 15;
  const diskDelta = memoryGb >= 16 ? 15_000 : -10_000;

  return {
    cpuHighPct: clamp(baseline.cpuHighPct + cpuHeadroom, 65, 95),
    memoryHighPct: clamp(baseline.memoryHighPct + memoryHeadroom, 70, 96),
    eventLoopLagMs: clamp(baseline.eventLoopLagMs + lagDelta, 50, 2000),
    diskWriteKbPerSec: clamp(baseline.diskWriteKbPerSec + diskDelta, 5_000, 500_000),
  };
}

function isCalibrationSnapshot(value: unknown): value is CalibrationSnapshot {
  if (!value || typeof value !== 'object') return false;
  const raw = value as Record<string, unknown>;
  const thresholds = raw['thresholds'];
  if (!thresholds || typeof thresholds !== 'object') return false;
  const t = thresholds as Record<string, unknown>;

  return (
    raw['schemaVersion'] === CALIBRATION_SCHEMA_VERSION &&
    typeof raw['fingerprint'] === 'string' &&
    typeof raw['createdAt'] === 'string' &&
    typeof raw['updatedAt'] === 'string' &&
    typeof t['cpuHighPct'] === 'number' &&
    typeof t['memoryHighPct'] === 'number' &&
    typeof t['eventLoopLagMs'] === 'number' &&
    typeof t['diskWriteKbPerSec'] === 'number'
  );
}

async function loadCalibration(cwd: string): Promise<CalibrationSnapshot | null> {
  try {
    const raw = JSON.parse(await readFile(calibrationPath(cwd), 'utf-8')) as unknown;
    if (!isCalibrationSnapshot(raw)) return null;
    return raw;
  } catch {
    return null;
  }
}

async function writeCalibration(cwd: string, snapshot: CalibrationSnapshot): Promise<void> {
  const path = calibrationPath(cwd);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf-8');
}

export async function resolveGovernorThresholds(
  config: OptaConfig,
  options: CaptureLearningOptions = {},
): Promise<{ thresholds: CalibratedThresholds; source: 'config' | 'calibrated' }> {
  if (!config.learning.governor.autoCalibrate) {
    return { thresholds: baseThresholds(config), source: 'config' };
  }

  const cwd = options.cwd ?? process.cwd();
  const currentFingerprint = deviceFingerprint();
  const existing = await loadCalibration(cwd);
  if (existing && existing.fingerprint === currentFingerprint) {
    return { thresholds: existing.thresholds, source: 'calibrated' };
  }

  const nowIso = (options.now ?? (() => new Date()))().toISOString();
  const thresholds = deriveThresholdsForDevice(config);
  const snapshot: CalibrationSnapshot = {
    schemaVersion: CALIBRATION_SCHEMA_VERSION,
    fingerprint: currentFingerprint,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
    thresholds,
  };
  await writeCalibration(cwd, snapshot);

  return { thresholds, source: 'calibrated' };
}

export function sampleSystemPressure(): LearningSystemPressureSample {
  const coreCount = Math.max(1, cpus().length);
  const load = loadavg()[0] ?? 0;
  const cpuPct = clamp((load / coreCount) * 100, 0, 100);
  const memoryPct = clamp(((totalmem() - freemem()) / totalmem()) * 100, 0, 100);

  return {
    cpuPct,
    memoryPct,
    // Conservative placeholders; Node does not expose event-loop lag/disk throughput natively.
    eventLoopLagMs: 0,
    diskWriteKbPerSec: 0,
  };
}

function downshift(level: CaptureLevel): CaptureLevel {
  if (level === 'exhaustive') return 'balanced';
  if (level === 'balanced') return 'lean';
  return 'lean';
}

function truncateByCaptureLevel(content: string, level: CaptureLevel): string {
  const limitByLevel: Record<CaptureLevel, number> = {
    exhaustive: 6000,
    balanced: 2400,
    lean: 900,
  };
  const maxChars = limitByLevel[level];
  return content.length > maxChars ? `${content.slice(0, maxChars)}...` : content;
}

function sanitizeText(input: string): string {
  return input
    .replace(/(api[_-]?key|token|secret|password)\s*[:=]\s*([^\s"']+)/gi, '$1=[REDACTED]')
    .replace(/\b(sk-[A-Za-z0-9\-_]{16,})\b/g, '[REDACTED]')
    .replace(/\b(gsk_[A-Za-z0-9\-_]{16,})\b/g, '[REDACTED]');
}

function normalizeTags(tags: string[] | undefined): string[] {
  if (!tags || tags.length === 0) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const tag of tags) {
    const value = tag.trim().toLowerCase();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}

export async function resolveCaptureLevel(
  config: OptaConfig,
  options: CaptureLearningOptions = {},
): Promise<CaptureLevelResolution> {
  const baseLevel = config.learning.captureLevel;
  const { thresholds, source } = await resolveGovernorThresholds(config, options);
  const sample = options.sample ?? sampleSystemPressure();

  const overloaded =
    sample.cpuPct >= thresholds.cpuHighPct ||
    sample.memoryPct >= thresholds.memoryHighPct ||
    sample.eventLoopLagMs >= thresholds.eventLoopLagMs ||
    sample.diskWriteKbPerSec >= thresholds.diskWriteKbPerSec;

  if (!overloaded || !config.learning.governor.allowAutoDownshift) {
    return {
      captureLevel: baseLevel,
      thresholds,
      sample,
      source,
      reason: overloaded
        ? 'Governor pressure detected but auto-downshift is disabled.'
        : 'System pressure below thresholds.',
    };
  }

  const lowered = downshift(baseLevel);
  return {
    captureLevel: lowered,
    thresholds,
    sample,
    source,
    reason: `Auto-downshifted from ${baseLevel} to ${lowered} due to pressure (cpu ${sample.cpuPct.toFixed(1)}%, memory ${sample.memoryPct.toFixed(1)}%).`,
  };
}

export async function captureLearningEvent(
  config: OptaConfig,
  input: CaptureLearningEventInput,
  options: CaptureLearningOptions = {},
): Promise<CaptureLearningResult> {
  const now = options.now ?? (() => new Date());

  if (!config.learning.enabled) {
    return { captured: false, captureLevel: config.learning.captureLevel, reason: 'Learning is disabled.' };
  }

  if (input.verified === false && !config.learning.includeUnverified) {
    return {
      captured: false,
      captureLevel: config.learning.captureLevel,
      reason: 'Unverified entries are disabled by config.',
    };
  }

  try {
    const level = await resolveCaptureLevel(config, options);
    const topic = sanitizeText(input.topic).trim();
    const rawContent = sanitizeText(input.content).trim();
    const content = truncateByCaptureLevel(rawContent, level.captureLevel);

    if (!topic || !content) {
      return { captured: false, captureLevel: level.captureLevel, reason: 'Empty topic/content after sanitization.' };
    }

    const entry: LearningLedgerEntry = {
      id: `learn-${randomUUID()}`,
      ts: now().toISOString(),
      kind: input.kind,
      captureLevel: level.captureLevel,
      topic,
      content,
      tags: normalizeTags(input.tags),
      evidence: (input.evidence ?? []).map((item) => ({
        label: sanitizeText(item.label).trim() || 'evidence',
        uri: sanitizeText(item.uri).trim(),
      })).filter((item) => item.uri.length > 0),
      metadata: {
        ...(input.metadata ?? {}),
        verified: input.verified ?? true,
        governorReason: level.reason,
        governorThresholdSource: level.source,
      },
    };

    await appendLedgerEntry(entry, { cwd: options.cwd });
    return { captured: true, id: entry.id, captureLevel: level.captureLevel };
  } catch (error) {
    return {
      captured: false,
      captureLevel: config.learning.captureLevel,
      reason: `Capture failed: ${toErrorMessage(error)}`,
    };
  }
}

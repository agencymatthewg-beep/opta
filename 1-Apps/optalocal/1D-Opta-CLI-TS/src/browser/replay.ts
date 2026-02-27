import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import {
  browserSessionArtifactsDir,
  browserSessionMetadataPath,
  browserSessionRecordingsPath,
  browserSessionStepsPath,
  browserSessionVisualDiffManifestPath,
  readBrowserVisualDiffResults as readPersistedBrowserVisualDiffResults,
} from './artifacts.js';
import {
  assessVisualDiffPair,
  inferVisualDiffRegression,
  inferVisualDiffSeverity,
} from './visual-diff.js';
import type {
  BrowserArtifactMetadata,
  BrowserSessionMetadata,
  BrowserSessionRecordingEntry,
  BrowserSessionRecordingIndex,
  BrowserSessionStepRecord,
  BrowserVisualDiffManifestEntry,
  BrowserVisualDiffRegressionSignal,
  BrowserVisualDiffResultEntry,
  BrowserVisualDiffResultStatus,
  BrowserVisualDiffSeverity,
} from './types.js';

export interface BrowserReplaySummary {
  sessionId: string;
  runId?: string;
  status: BrowserSessionMetadata['status'];
  runtime: BrowserSessionMetadata['runtime'];
  actionCount: number;
  artifactCount: number;
  failureCount: number;
  lastActionAt: string;
  lastUpdatedAt: string;
  regressionScore: number;
  regressionSignal: BrowserVisualDiffRegressionSignal;
  regressionPairCount: number;
}

export interface BrowserReplayArtifactPreview {
  path: string;
  mimeType?: string;
  sizeBytes?: number;
  htmlSnippet?: string;
  textSnippet?: string;
  inlinePreview?: string[];
  imageWidth?: number;
  imageHeight?: number;
}

export interface BrowserReplayStepArtifactPreview {
  sequence: number;
  artifacts: BrowserReplayArtifactPreview[];
}

export type BrowserReplayVisualDiffStatus = BrowserVisualDiffResultStatus;

export interface BrowserReplayVisualDiffPair {
  index: number;
  fromSequence: number;
  fromActionType: BrowserSessionStepRecord['actionType'];
  toSequence: number;
  toActionType: BrowserSessionStepRecord['actionType'];
  fromScreenshotPath?: string;
  toScreenshotPath?: string;
  status: BrowserReplayVisualDiffStatus;
  changedByteRatio?: number;
  perceptualDiffScore?: number;
  severity: BrowserVisualDiffSeverity;
  regressionScore?: number;
  regressionSignal?: BrowserVisualDiffRegressionSignal;
}

interface BrowserReplayArtifactIndexes {
  byId: Map<string, BrowserArtifactMetadata>;
  byPath: Map<string, BrowserArtifactMetadata>;
  byActionId: Map<string, BrowserArtifactMetadata[]>;
}

interface ResolvedReplayArtifact {
  key: string;
  path: string;
  absolutePath: string;
  kind?: BrowserArtifactMetadata['kind'];
  mimeType?: string;
  sizeBytes?: number;
}

const HTML_SNIPPET_LIMIT = 180;
const TEXT_SNIPPET_LIMIT = 180;
const INLINE_PREVIEW_COLUMNS = 24;
const INLINE_PREVIEW_ROWS = 6;
const INLINE_PREVIEW_PALETTE = ' .:-=+*#%@';

function buildReplayArtifactIndexes(
  metadata: BrowserSessionMetadata | null,
): BrowserReplayArtifactIndexes {
  const byId = new Map<string, BrowserArtifactMetadata>();
  const byPath = new Map<string, BrowserArtifactMetadata>();
  const byActionId = new Map<string, BrowserArtifactMetadata[]>();

  for (const artifact of metadata?.artifacts ?? []) {
    byId.set(artifact.id, artifact);
    byPath.set(artifact.relativePath, artifact);
    byPath.set(artifact.absolutePath, artifact);
    const entries = byActionId.get(artifact.actionId) ?? [];
    entries.push(artifact);
    byActionId.set(artifact.actionId, entries);
  }

  return { byId, byPath, byActionId };
}

function resolveReplayArtifactAbsolutePath(
  cwd: string,
  sessionId: string,
  artifactPath: string,
  absolutePath?: string,
): string {
  if (absolutePath && absolutePath.length > 0) {
    return absolutePath;
  }
  if (isAbsolute(artifactPath)) {
    return artifactPath;
  }
  if (artifactPath.startsWith('.opta/')) {
    return join(cwd, artifactPath);
  }
  return join(browserSessionArtifactsDir(cwd, sessionId), artifactPath);
}

function normalizeHtmlSnippet(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= HTML_SNIPPET_LIMIT) {
    return compact;
  }
  return `${compact.slice(0, HTML_SNIPPET_LIMIT - 3)}...`;
}

function normalizeTextSnippet(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= TEXT_SNIPPET_LIMIT) {
    return compact;
  }
  return `${compact.slice(0, TEXT_SNIPPET_LIMIT - 3)}...`;
}

function isHtmlArtifact(path: string, mimeType?: string): boolean {
  if (mimeType?.toLowerCase() === 'text/html') {
    return true;
  }
  return path.toLowerCase().endsWith('.html');
}

function isScreenshotArtifact(artifact: ResolvedReplayArtifact): boolean {
  if (artifact.kind === 'screenshot') {
    return true;
  }
  if (artifact.mimeType?.toLowerCase().startsWith('image/')) {
    return true;
  }
  const lowerPath = artifact.path.toLowerCase();
  return (
    lowerPath.endsWith('.png') ||
    lowerPath.endsWith('.jpg') ||
    lowerPath.endsWith('.jpeg') ||
    lowerPath.endsWith('.webp') ||
    lowerPath.endsWith('.gif') ||
    lowerPath.endsWith('.bmp')
  );
}

function extractHtmlTextSnippet(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const textOnly = withoutScripts
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
  return normalizeTextSnippet(textOnly);
}

function parsePngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) return null;
  }
  // PNG IHDR: width/height begin at byte offsets 16/20.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

function buildInlineBytePreview(
  bytes: Uint8Array,
  columns = INLINE_PREVIEW_COLUMNS,
  rows = INLINE_PREVIEW_ROWS,
): string[] {
  if (bytes.length === 0 || columns <= 0 || rows <= 0) return [];
  const cells = columns * rows;
  const lines: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    let line = '';
    for (let col = 0; col < columns; col += 1) {
      const cellIndex = row * columns + col;
      const start = Math.floor((cellIndex * bytes.length) / cells);
      const end = Math.max(start + 1, Math.floor(((cellIndex + 1) * bytes.length) / cells));
      let sum = 0;
      for (let index = start; index < end && index < bytes.length; index += 1) {
        sum += bytes[index] ?? 0;
      }
      const avg = sum / Math.max(1, end - start);
      const paletteIndex = Math.max(
        0,
        Math.min(
          INLINE_PREVIEW_PALETTE.length - 1,
          Math.floor((avg / 255) * (INLINE_PREVIEW_PALETTE.length - 1)),
        ),
      );
      line += INLINE_PREVIEW_PALETTE[paletteIndex] ?? ' ';
    }
    lines.push(line);
  }
  return lines;
}

function buildVisualDiffPairKey(
  pair: Pick<BrowserVisualDiffResultEntry, 'fromSequence' | 'fromActionId' | 'toSequence' | 'toActionId'>,
): string {
  return `${pair.fromSequence}:${pair.fromActionId}:${pair.toSequence}:${pair.toActionId}`;
}

function resolveReplayStepArtifacts(
  cwd: string,
  step: BrowserSessionStepRecord,
  indexes: BrowserReplayArtifactIndexes,
): ResolvedReplayArtifact[] {
  const resolved: ResolvedReplayArtifact[] = [];
  const seen = new Set<string>();

  const pushArtifact = (artifact: BrowserArtifactMetadata) => {
    const key = artifact.id || artifact.relativePath || artifact.absolutePath;
    if (!key || seen.has(key)) return;
    seen.add(key);
    resolved.push({
      key,
      path: artifact.relativePath || artifact.absolutePath,
      absolutePath: artifact.absolutePath || resolveReplayArtifactAbsolutePath(cwd, step.sessionId, artifact.relativePath),
      kind: artifact.kind,
      mimeType: artifact.mimeType,
      sizeBytes: artifact.sizeBytes,
    });
  };

  const pushPath = (artifactPath: string) => {
    const fromIndex = indexes.byPath.get(artifactPath);
    if (fromIndex) {
      pushArtifact(fromIndex);
      return;
    }
    const key = artifactPath;
    if (seen.has(key)) return;
    seen.add(key);
    resolved.push({
      key,
      path: artifactPath,
      absolutePath: resolveReplayArtifactAbsolutePath(cwd, step.sessionId, artifactPath),
    });
  };

  for (const artifactId of step.artifactIds) {
    const artifact = indexes.byId.get(artifactId);
    if (artifact) {
      pushArtifact(artifact);
    }
  }

  for (const artifactPath of step.artifactPaths) {
    pushPath(artifactPath);
  }

  for (const artifact of indexes.byActionId.get(step.actionId) ?? []) {
    pushArtifact(artifact);
  }

  return resolved;
}

export async function readBrowserReplayStepArtifactPreview(
  cwd: string,
  sessionId: string,
  step: BrowserSessionStepRecord,
  metadata: BrowserSessionMetadata | null = null,
): Promise<BrowserReplayStepArtifactPreview> {
  const replayMetadata = metadata ?? await readBrowserReplay(cwd, sessionId);
  const indexes = buildReplayArtifactIndexes(replayMetadata);
  const artifacts = resolveReplayStepArtifacts(cwd, step, indexes);
  const previews: BrowserReplayArtifactPreview[] = [];

  for (const artifact of artifacts) {
    let sizeBytes = artifact.sizeBytes;
    if (typeof sizeBytes !== 'number') {
      try {
        const fileStat = await stat(artifact.absolutePath);
        sizeBytes = fileStat.size;
      } catch {
        // Keep size undefined when unknown
      }
    }

    let htmlSnippet: string | undefined;
    let textSnippet: string | undefined;
    let inlinePreview: string[] | undefined;
    let imageWidth: number | undefined;
    let imageHeight: number | undefined;

    if (isHtmlArtifact(artifact.path, artifact.mimeType)) {
      try {
        const html = await readFile(artifact.absolutePath, 'utf-8');
        htmlSnippet = normalizeHtmlSnippet(html);
        textSnippet = extractHtmlTextSnippet(html);
      } catch {
        // Keep snippet undefined when file is unreadable
      }
    } else if (isScreenshotArtifact(artifact)) {
      try {
        const bytes = await readFile(artifact.absolutePath);
        inlinePreview = buildInlineBytePreview(bytes);
        const pngDimensions = parsePngDimensions(bytes);
        if (pngDimensions) {
          imageWidth = pngDimensions.width;
          imageHeight = pngDimensions.height;
        }
      } catch {
        // Keep preview undefined when file is unreadable
      }
    }

    previews.push({
      path: artifact.path,
      mimeType: artifact.mimeType,
      sizeBytes,
      htmlSnippet,
      textSnippet,
      inlinePreview,
      imageWidth,
      imageHeight,
    });
  }

  return {
    sequence: step.sequence,
    artifacts: previews,
  };
}

export async function deriveBrowserReplayVisualDiffPairs(
  cwd: string,
  sessionId: string,
  steps: BrowserSessionStepRecord[],
  metadata: BrowserSessionMetadata | null = null,
): Promise<BrowserReplayVisualDiffPair[]> {
  if (steps.length <= 1) {
    return [];
  }

  const persistedResults = await readBrowserReplayVisualDiffResults(cwd, sessionId);
  const persistedResultByKey = new Map<string, BrowserVisualDiffResultEntry>();
  for (const entry of persistedResults) {
    persistedResultByKey.set(buildVisualDiffPairKey(entry), entry);
  }

  const replayMetadata = metadata ?? await readBrowserReplay(cwd, sessionId);
  const indexes = buildReplayArtifactIndexes(replayMetadata);
  const screenshotsByStep = steps.map((step) => {
    const artifacts = resolveReplayStepArtifacts(cwd, step, indexes);
    return artifacts.find((artifact) => isScreenshotArtifact(artifact));
  });
  const bytesByPath = new Map<string, Uint8Array | null>();

  const loadBytes = async (path: string): Promise<Uint8Array | null> => {
    if (bytesByPath.has(path)) {
      return bytesByPath.get(path) ?? null;
    }
    try {
      const bytes = await readFile(path);
      bytesByPath.set(path, bytes);
      return bytes;
    } catch {
      bytesByPath.set(path, null);
      return null;
    }
  };

  const diffs: BrowserReplayVisualDiffPair[] = [];

  for (let index = 1; index < steps.length; index += 1) {
    const fromStep = steps[index - 1]!;
    const toStep = steps[index]!;
    const fromScreenshot = screenshotsByStep[index - 1];
    const toScreenshot = screenshotsByStep[index];
    const persisted = persistedResultByKey.get(
      buildVisualDiffPairKey({
        fromSequence: fromStep.sequence,
        fromActionId: fromStep.actionId,
        toSequence: toStep.sequence,
        toActionId: toStep.actionId,
      }),
    );
    let status: BrowserReplayVisualDiffStatus = persisted?.status ?? 'missing';
    let changedByteRatio = persisted?.changedByteRatio;
    let perceptualDiffScore = persisted?.perceptualDiffScore;
    let severity = persisted?.severity;
    let regressionScore = persisted?.regressionScore;
    let regressionSignal = persisted?.regressionSignal;

    const shouldComputeAssessment = (
      (!persisted) ||
      (
        status === 'changed' &&
        (
          (typeof changedByteRatio !== 'number' || !Number.isFinite(changedByteRatio)) ||
          (typeof perceptualDiffScore !== 'number' || !Number.isFinite(perceptualDiffScore))
        )
      ) ||
      !severity ||
      (typeof regressionScore !== 'number' || !Number.isFinite(regressionScore)) ||
      !regressionSignal
    ) && fromScreenshot && toScreenshot;

    if (shouldComputeAssessment) {
      const [fromBytes, toBytes] = await Promise.all([
        loadBytes(fromScreenshot.absolutePath),
        loadBytes(toScreenshot.absolutePath),
      ]);
      if (fromBytes && toBytes) {
        const assessment = assessVisualDiffPair(fromBytes, toBytes);
        if (!persisted) {
          status = assessment.status;
          changedByteRatio = assessment.changedByteRatio;
          perceptualDiffScore = assessment.perceptualDiffScore;
          severity = assessment.severity;
          regressionScore = assessment.regressionScore;
          regressionSignal = assessment.regressionSignal;
        } else if (assessment.status === status) {
          if (typeof changedByteRatio !== 'number' || !Number.isFinite(changedByteRatio)) {
            changedByteRatio = assessment.changedByteRatio;
          }
          if (typeof perceptualDiffScore !== 'number' || !Number.isFinite(perceptualDiffScore)) {
            perceptualDiffScore = assessment.perceptualDiffScore;
          }
          if (!severity) {
            severity = assessment.severity;
          }
          if (typeof regressionScore !== 'number' || !Number.isFinite(regressionScore)) {
            regressionScore = assessment.regressionScore;
          }
          if (!regressionSignal) {
            regressionSignal = assessment.regressionSignal;
          }
        }
      }
    }

    severity ??= inferVisualDiffSeverity(status, changedByteRatio);
    const regression = inferVisualDiffRegression(
      status,
      severity,
      changedByteRatio,
      perceptualDiffScore,
      regressionScore,
    );
    regressionScore = regression.regressionScore;
    regressionSignal ??= regression.regressionSignal;

    diffs.push({
      index: diffs.length,
      fromSequence: fromStep.sequence,
      fromActionType: fromStep.actionType,
      toSequence: toStep.sequence,
      toActionType: toStep.actionType,
      fromScreenshotPath: fromScreenshot?.path ?? persisted?.fromScreenshotPath,
      toScreenshotPath: toScreenshot?.path ?? persisted?.toScreenshotPath,
      status,
      changedByteRatio,
      perceptualDiffScore,
      severity,
      regressionScore,
      regressionSignal,
    });
  }

  return diffs;
}

export async function readBrowserReplay(
  cwd: string,
  sessionId: string,
): Promise<BrowserSessionMetadata | null> {
  const path = browserSessionMetadataPath(cwd, sessionId);
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw) as BrowserSessionMetadata;
    return parsed;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return null;
    throw error;
  }
}

export async function summarizeBrowserReplay(
  cwd: string,
  sessionId: string,
): Promise<BrowserReplaySummary | null> {
  const metadata = await readBrowserReplay(cwd, sessionId);
  if (!metadata) return null;

  const steps = await readBrowserReplaySteps(cwd, sessionId);
  const recordings = steps.length === 0 || !metadata.runId
    ? await readBrowserReplayRecordings(cwd, sessionId)
    : [];
  const timeline: Array<Pick<BrowserSessionStepRecord, 'timestamp' | 'ok'>> = steps.length > 0
    ? steps
    : recordings;

  const actionCount = timeline.length > 0 ? timeline.length : metadata.actions.length;
  const failureCount = timeline.length > 0
    ? timeline.filter((step) => !step.ok).length
    : metadata.actions.filter((action) => !action.ok).length;
  const lastActionAt = timeline.length > 0
    ? timeline.at(-1)?.timestamp ?? metadata.updatedAt
    : metadata.actions.at(-1)?.action.createdAt ?? metadata.updatedAt;
  const runId = metadata.runId
    ?? steps.find((step) => typeof step.runId === 'string' && step.runId.length > 0)?.runId
    ?? recordings.find((recording) => typeof recording.runId === 'string' && recording.runId.length > 0)?.runId;
  const visualDiffs = steps.length > 1
    ? await deriveBrowserReplayVisualDiffPairs(cwd, sessionId, steps, metadata)
    : [];
  const visualPairs = visualDiffs.filter((pair) => Boolean(pair.fromScreenshotPath || pair.toScreenshotPath));
  const regressionPairCount = visualPairs.filter((pair) => pair.regressionSignal === 'regression').length;
  const regressionScore = visualPairs.reduce((max, pair) => (
    typeof pair.regressionScore === 'number' && Number.isFinite(pair.regressionScore)
      ? Math.max(max, pair.regressionScore)
      : max
  ), 0);
  const regressionSignal: BrowserVisualDiffRegressionSignal = regressionPairCount > 0
    ? 'regression'
    : visualPairs.some((pair) => pair.regressionSignal === 'investigate')
      ? 'investigate'
      : 'none';

  return {
    sessionId: metadata.sessionId,
    runId,
    status: metadata.status,
    runtime: metadata.runtime,
    actionCount,
    artifactCount: metadata.artifacts.length,
    failureCount,
    lastActionAt,
    lastUpdatedAt: metadata.updatedAt,
    regressionScore,
    regressionSignal,
    regressionPairCount,
  };
}

export async function readBrowserReplaySteps(
  cwd: string,
  sessionId: string,
): Promise<BrowserSessionStepRecord[]> {
  const path = browserSessionStepsPath(cwd, sessionId);
  try {
    const raw = await readFile(path, 'utf-8');
    const lines = raw.split(/\r?\n/);
    const entries: BrowserSessionStepRecord[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]?.trim();
      if (!line) continue;

      try {
        const parsed = JSON.parse(line) as BrowserSessionStepRecord;
        entries.push(parsed);
      } catch (error) {
        const isTrailingLine = index === lines.length - 1;
        if (isTrailingLine) {
          continue;
        }
        throw error;
      }
    }

    return entries;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      const recordings = await readBrowserReplayRecordings(cwd, sessionId);
      return recordings.map((recording) => ({
        sequence: recording.sequence,
        sessionId: recording.sessionId,
        runId: recording.runId,
        actionId: recording.actionId,
        actionType: recording.actionType,
        timestamp: recording.timestamp,
        ok: recording.ok,
        error: recording.error,
        artifactIds: recording.artifactIds,
        artifactPaths: recording.artifactPaths,
      }));
    }
    throw error;
  }
}

export async function readBrowserReplayRecordings(
  cwd: string,
  sessionId: string,
): Promise<BrowserSessionRecordingEntry[]> {
  const path = browserSessionRecordingsPath(cwd, sessionId);
  try {
    const raw = await readFile(path, 'utf-8');
    const parsed = JSON.parse(raw) as BrowserSessionRecordingIndex;
    if (!Array.isArray(parsed.recordings)) {
      return [];
    }

    return [...parsed.recordings].sort((left, right) => left.sequence - right.sequence);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return [];
    throw error;
  }
}

export async function readBrowserReplayVisualDiffManifest(
  cwd: string,
  sessionId: string,
): Promise<BrowserVisualDiffManifestEntry[]> {
  const path = browserSessionVisualDiffManifestPath(cwd, sessionId);
  try {
    const raw = await readFile(path, 'utf-8');
    const lines = raw.split(/\r?\n/);
    const entries: BrowserVisualDiffManifestEntry[] = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]?.trim();
      if (!line) continue;

      try {
        const parsed = JSON.parse(line) as BrowserVisualDiffManifestEntry;
        entries.push(parsed);
      } catch (error) {
        const isTrailingLine = index === lines.length - 1;
        if (isTrailingLine) {
          continue;
        }
        throw error;
      }
    }

    return entries;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') return [];
    throw error;
  }
}

export async function readBrowserReplayVisualDiffResults(
  cwd: string,
  sessionId: string,
): Promise<BrowserVisualDiffResultEntry[]> {
  return readPersistedBrowserVisualDiffResults(cwd, sessionId);
}

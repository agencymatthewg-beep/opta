import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  PolicyConfigSchema,
  PolicyRequestSchema,
  type PolicyAuditEntry,
  type PolicyConfig,
  type PolicyDecisionResult,
  type PolicyRequest,
} from './types.js';
import { sleep } from '../utils/common.js';

const AUDIT_RELATIVE_PATH = join('.opta', 'policy', 'audit.jsonl');

export interface PolicyEngineOptions {
  cwd?: string;
  now?: () => Date;
  lockTimeoutMs?: number;
  lockRetryMs?: number;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function fallbackAction(request: unknown): string {
  if (
    request !== null &&
    request !== undefined &&
    typeof request === 'object' &&
    'action' in request &&
    typeof (request as { action?: unknown }).action === 'string'
  ) {
    return (request as { action: string }).action;
  }
  return 'unknown-action';
}

function fallbackAutonomous(request: unknown): boolean {
  if (
    request !== null &&
    request !== undefined &&
    typeof request === 'object' &&
    'autonomous' in request &&
    typeof (request as { autonomous?: unknown }).autonomous === 'boolean'
  ) {
    return (request as { autonomous: boolean }).autonomous;
  }
  return true;
}

export function policyAuditPath(cwd = process.cwd()): string {
  return join(cwd, AUDIT_RELATIVE_PATH);
}

function policyAuditDir(cwd = process.cwd()): string {
  return dirname(policyAuditPath(cwd));
}

function policyAuditLockPath(cwd = process.cwd()): string {
  return `${policyAuditPath(cwd)}.lock`;
}

async function acquireLock(lockPath: string, timeoutMs: number, retryMs: number) {
  const start = Date.now();
  while (true) {
    try {
      return await open(lockPath, 'wx');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'EEXIST') {
        throw err;
      }
      if (Date.now() - start >= timeoutMs) {
        throw new Error(`Timed out waiting for policy audit lock: ${lockPath}`);
      }
      await sleep(retryMs);
    }
  }
}

async function readAuditFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf-8');
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      return '';
    }
    throw err;
  }
}

async function appendAuditEntryAtomic(
  entry: PolicyAuditEntry,
  options: PolicyEngineOptions,
): Promise<void> {
  const cwd = options.cwd ?? process.cwd();
  const timeoutMs = options.lockTimeoutMs ?? 5000;
  const retryMs = options.lockRetryMs ?? 20;
  const auditPath = policyAuditPath(cwd);
  const auditDir = policyAuditDir(cwd);
  const lockPath = policyAuditLockPath(cwd);

  await mkdir(auditDir, { recursive: true });
  const lockHandle = await acquireLock(lockPath, timeoutMs, retryMs);
  let tempPath = '';

  try {
    const current = await readAuditFile(auditPath);
    tempPath = `${auditPath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, `${current}${JSON.stringify(entry)}\n`, 'utf-8');
    await rename(tempPath, auditPath);
  } finally {
    if (tempPath) {
      await unlink(tempPath).catch(() => {});
    }
    await lockHandle.close().catch(() => {});
    await unlink(lockPath).catch(() => {});
  }
}

function evaluateFullMode(
  config: PolicyConfig,
  request: PolicyRequest,
  ts: string,
): PolicyDecisionResult {
  if (!config.enabled || config.mode === 'off') {
    return {
      decision: 'allow',
      reason: 'Policy disabled or mode is off.',
      mode: config.mode,
      action: request.action,
      ts,
    };
  }

  if (config.mode === 'full' && config.gateAllAutonomy && request.autonomous) {
    return {
      decision: 'gate',
      reason: 'Full mode gate-all rule requires approval for autonomous actions.',
      mode: config.mode,
      action: request.action,
      ts,
    };
  }

  return {
    decision: 'allow',
    reason: 'Allowed by full policy mode checks.',
    mode: config.mode,
    action: request.action,
    ts,
  };
}

function shouldFailClosed(config: unknown): boolean {
  const parsed = PolicyConfigSchema.safeParse(config);
  if (parsed.success) {
    return parsed.data.failureMode === 'closed';
  }
  return true;
}

function failClosedDecision(
  request: unknown,
  ts: string,
  reason: string,
): PolicyDecisionResult {
  return {
    decision: 'deny',
    reason: `Fail-closed: ${reason}`,
    mode: 'full',
    action: fallbackAction(request),
    ts,
  };
}

function failOpenDecision(
  request: unknown,
  ts: string,
  reason: string,
): PolicyDecisionResult {
  return {
    decision: 'allow',
    reason: `Fail-open fallback: ${reason}`,
    mode: 'full',
    action: fallbackAction(request),
    ts,
  };
}

async function auditIfEnabled(
  config: PolicyConfig,
  request: PolicyRequest,
  decision: PolicyDecisionResult,
  options: PolicyEngineOptions,
): Promise<void> {
  if (!config.audit.enabled) return;

  await appendAuditEntryAtomic(
    {
      ...decision,
      autonomous: request.autonomous,
      actor: request.actor,
      metadata: request.metadata,
    },
    options,
  );
}

export async function evaluatePolicyRequest(
  configInput: PolicyConfig,
  requestInput: PolicyRequest,
  options: PolicyEngineOptions = {},
): Promise<PolicyDecisionResult> {
  const now = options.now ?? (() => new Date());
  const ts = now().toISOString();

  try {
    const parsedConfig = PolicyConfigSchema.parse(configInput);
    const parsedRequest = PolicyRequestSchema.parse(requestInput);

    const decision = evaluateFullMode(parsedConfig, parsedRequest, ts);
    await auditIfEnabled(parsedConfig, parsedRequest, decision, options);
    return decision;
  } catch (error) {
    const reason = toErrorMessage(error);
    if (shouldFailClosed(configInput)) {
      const denied = failClosedDecision(requestInput, ts, reason);
      const parsedConfig = PolicyConfigSchema.safeParse(configInput);
      if (parsedConfig.success && parsedConfig.data.audit.enabled) {
        await appendAuditEntryAtomic(
          {
            ...denied,
            autonomous: fallbackAutonomous(requestInput),
            actor: 'policy-engine',
            metadata: { error: reason },
          },
          options,
        ).catch(() => {});
      }
      return denied;
    }

    return failOpenDecision(requestInput, ts, reason);
  }
}

export class PolicyEngine {
  constructor(
    private readonly config: PolicyConfig,
    private readonly options: PolicyEngineOptions = {},
  ) {}

  async decide(request: PolicyRequest): Promise<PolicyDecisionResult> {
    return evaluatePolicyRequest(this.config, request, this.options);
  }
}

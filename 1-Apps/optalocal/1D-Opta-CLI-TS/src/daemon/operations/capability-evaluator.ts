import type { OptaConfig } from '../../core/config.js';
import type { OperationId, OperationSafetyClass } from '../../protocol/v3/operations.js';
import { errorMessage } from '../../utils/errors.js';

const HIGH_RISK_WRITE_OPERATIONS = new Set<OperationId>([
  'env.delete',
  'config.reset',
  'account.keys.push',
  'account.keys.delete',
  'mcp.remove',
  'daemon.stop',
  'serve.start',
  'serve.stop',
  'serve.restart',
  'update.run',
  'keychain.delete-anthropic',
  'keychain.delete-lmx',
]);

interface CapabilityDecisionPayload {
  allowed?: boolean;
  allow?: boolean;
  denied?: boolean;
  reason?: string;
  denialReason?: string;
  decisionId?: string;
}

interface CapabilityEvaluatorResponse {
  decision?: CapabilityDecisionPayload;
  result?: CapabilityDecisionPayload;
  allowed?: boolean;
  allow?: boolean;
  denied?: boolean;
  reason?: string;
  denialReason?: string;
  decisionId?: string;
}

export interface CapabilityEvaluationInput {
  id: OperationId;
  safety: OperationSafetyClass;
  operationInput: unknown;
}

export type CapabilityEvaluationOutcome =
  | {
      kind: 'allow';
    }
  | {
      kind: 'deny';
      code: 'capability_denied' | 'capability_evaluator_unavailable';
      message: string;
      details?: unknown;
    };

function isHighRiskTarget(
  config: OptaConfig['policy']['runtimeEnforcement'],
  input: CapabilityEvaluationInput
): boolean {
  if (input.safety === 'dangerous') return config.applyTo.dangerous;
  if (input.safety === 'write') {
    return config.applyTo.highRiskWrites && HIGH_RISK_WRITE_OPERATIONS.has(input.id);
  }
  return false;
}

function normalizeDecision(payload: CapabilityEvaluatorResponse): {
  allowed: boolean;
  reason?: string;
  decisionId?: string;
} {
  const source = payload.decision ?? payload.result ?? payload;
  const explicitAllow = source.allow ?? source.allowed;
  const explicitDeny = source.denied;

  if (explicitAllow === true) {
    return { allowed: true, reason: source.reason, decisionId: source.decisionId };
  }
  if (explicitAllow === false || explicitDeny === true) {
    return {
      allowed: false,
      reason: source.denialReason ?? source.reason,
      decisionId: source.decisionId,
    };
  }

  throw new Error('Evaluator response missing explicit allow/deny decision.');
}

function resolveScope(input: CapabilityEvaluationInput): string {
  if (input.safety === 'dangerous') return 'automation.high_risk';
  if (input.safety === 'write') return 'automation.high_risk';
  return 'automation.read';
}

function logCapabilityEvent(level: 'warn' | 'info', message: string, meta: Record<string, unknown>): void {
  const line = `[capability-eval] ${message} ${JSON.stringify(meta)}`;
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

export async function evaluateOperationCapability(
  config: OptaConfig,
  input: CapabilityEvaluationInput
): Promise<CapabilityEvaluationOutcome> {
  const runtimeEnforcement = config.policy.runtimeEnforcement;
  if (!runtimeEnforcement.enabled) return { kind: 'allow' };
  if (!isHighRiskTarget(runtimeEnforcement, input)) return { kind: 'allow' };

  const startedAt = Date.now();
  const rawDeviceId = process.env['OPTA_ACCOUNTS_DEVICE_ID']?.trim();
  const deviceId = rawDeviceId && rawDeviceId.length > 0 ? rawDeviceId : undefined;

  try {
    const response = await fetch(runtimeEnforcement.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        scope: resolveScope(input),
        ...(deviceId ? { deviceId } : {}),
        context: {
          source: 'opta-cli',
          operationId: input.id,
          safety: input.safety,
        },
      }),
      signal: AbortSignal.timeout(runtimeEnforcement.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const parsed = normalizeDecision((await response.json()) as CapabilityEvaluatorResponse);
    if (!parsed.allowed) {
      logCapabilityEvent('info', 'operation denied by evaluator', {
        operationId: input.id,
        safety: input.safety,
        durationMs: Date.now() - startedAt,
        reason: parsed.reason,
        decisionId: parsed.decisionId,
      });
      return {
        kind: 'deny',
        code: 'capability_denied',
        message: parsed.reason ?? `Operation "${input.id}" denied by capability evaluator.`,
        details: parsed.decisionId ? { decisionId: parsed.decisionId } : undefined,
      };
    }

    return { kind: 'allow' };
  } catch (err) {
    const reason = errorMessage(err);
    const detail = {
      operationId: input.id,
      safety: input.safety,
      endpoint: runtimeEnforcement.endpoint,
      timeoutMs: runtimeEnforcement.timeoutMs,
      failOpen: runtimeEnforcement.failOpen,
      error: reason,
    };

    if (runtimeEnforcement.failOpen) {
      logCapabilityEvent('warn', 'evaluator unavailable, failing open', detail);
      return { kind: 'allow' };
    }

    logCapabilityEvent('warn', 'evaluator unavailable, failing closed', detail);
    return {
      kind: 'deny',
      code: 'capability_evaluator_unavailable',
      message: 'Capability evaluator unavailable and failOpen=false.',
      details: { reason },
    };
  }
}

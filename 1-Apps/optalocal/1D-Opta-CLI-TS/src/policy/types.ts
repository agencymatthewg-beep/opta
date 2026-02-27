import { z } from 'zod';

export const PolicyModeSchema = z.enum(['full', 'off']);
export type PolicyMode = z.infer<typeof PolicyModeSchema>;

export const PolicyFailureModeSchema = z.enum(['closed', 'open']);
export type PolicyFailureMode = z.infer<typeof PolicyFailureModeSchema>;

export const PolicyDecisionSchema = z.enum(['allow', 'gate', 'deny']);
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;

export const PolicyConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mode: PolicyModeSchema.default('full'),
  gateAllAutonomy: z.boolean().default(true),
  failureMode: PolicyFailureModeSchema.default('closed'),
  audit: z
    .object({
      enabled: z.boolean().default(true),
    })
    .default({}),
});
export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

export const PolicyRequestSchema = z.object({
  action: z.string().min(1),
  autonomous: z.boolean(),
  actor: z.string().default('agent'),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type PolicyRequest = z.infer<typeof PolicyRequestSchema>;

export interface PolicyDecisionResult {
  decision: PolicyDecision;
  reason: string;
  mode: PolicyMode;
  action: string;
  ts: string;
}

export interface PolicyAuditEntry extends PolicyDecisionResult {
  autonomous: boolean;
  actor: string;
  metadata: Record<string, unknown>;
}

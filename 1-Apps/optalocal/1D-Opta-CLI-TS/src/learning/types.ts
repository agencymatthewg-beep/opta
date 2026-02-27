import { z } from 'zod';

export const CaptureLevelSchema = z.enum(['exhaustive', 'balanced', 'lean']);
export type CaptureLevel = z.infer<typeof CaptureLevelSchema>;

export const LearningEntryKindSchema = z.enum([
  'plan',
  'problem',
  'solution',
  'reflection',
  'research',
]);
export type LearningEntryKind = z.infer<typeof LearningEntryKindSchema>;

export const EvidenceLinkSchema = z.object({
  label: z.string().min(1),
  uri: z.string().min(1),
});
export type EvidenceLink = z.infer<typeof EvidenceLinkSchema>;

export const LearningLedgerEntrySchema = z.object({
  id: z.string().min(1),
  ts: z.string().datetime({ offset: true }),
  kind: LearningEntryKindSchema,
  captureLevel: CaptureLevelSchema,
  topic: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()).default([]),
  evidence: z.array(EvidenceLinkSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type LearningLedgerEntry = z.infer<typeof LearningLedgerEntrySchema>;

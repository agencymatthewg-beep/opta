export interface CapabilityExecutionRecord {
  capability: string;
  status: 'success' | 'failed';
  durationMs: number;
  retryCount: number;
  failureSignature?: string;
}

export interface CapabilityEffectiveness {
  capability: string;
  totalRuns: number;
  successRate: number;
  retryCount: number;
  meanTimeToResolutionMs: number;
  recurringFailureSignatures: string[];
}

export function computeEffectivenessMetrics(
  records: CapabilityExecutionRecord[],
): CapabilityEffectiveness[] {
  const buckets = new Map<string, CapabilityExecutionRecord[]>();
  for (const record of records) {
    const bucket = buckets.get(record.capability) ?? [];
    bucket.push(record);
    buckets.set(record.capability, bucket);
  }

  return Array.from(buckets.entries())
    .map(([capability, bucket]) => {
      const totalRuns = bucket.length;
      const successes = bucket.filter((record) => record.status === 'success').length;
      const retryCount = bucket.reduce((sum, record) => sum + record.retryCount, 0);
      const meanTimeToResolutionMs =
        totalRuns === 0
          ? 0
          : bucket.reduce((sum, record) => sum + record.durationMs, 0) / totalRuns;

      const failureCounts = new Map<string, number>();
      for (const record of bucket) {
        if (!record.failureSignature) continue;
        failureCounts.set(
          record.failureSignature,
          (failureCounts.get(record.failureSignature) ?? 0) + 1,
        );
      }

      const recurringFailureSignatures = Array.from(failureCounts.entries())
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([signature]) => signature);

      return {
        capability,
        totalRuns,
        successRate: totalRuns === 0 ? 0 : successes / totalRuns,
        retryCount,
        meanTimeToResolutionMs,
        recurringFailureSignatures,
      };
    })
    .sort((a, b) => a.capability.localeCompare(b.capability));
}


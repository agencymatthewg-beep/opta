import type { SupabaseClient } from '@supabase/supabase-js';

type Risk = 'low' | 'medium' | 'high' | 'critical';
type Decision = 'allow' | 'deny' | 'step_up';

export async function writeAuditEvent(
  supabase: SupabaseClient,
  event: {
    userId: string;
    eventType: string;
    riskLevel?: Risk;
    decision?: Decision;
    deviceId?: string | null;
    context?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase
      .from('accounts_audit_events')
      .insert({
        user_id: event.userId,
        event_type: event.eventType,
        risk_level: event.riskLevel ?? 'low',
        decision: event.decision ?? 'allow',
        device_id: event.deviceId ?? null,
        context: event.context ?? {},
      });
  } catch (error) {
    // Ignore error
  }
}

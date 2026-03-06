import { recordAuditEvent } from './route-mocks.ts';

export async function writeAuditEvent(
  _supabase: unknown,
  event: Record<string, unknown>,
): Promise<void> {
  recordAuditEvent(event);
}

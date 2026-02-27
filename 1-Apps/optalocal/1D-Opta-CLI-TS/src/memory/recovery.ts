import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { AgentMessage } from '../core/agent.js';

const RECOVERY_DIR = '.opta/recovery';

function recoveryPath(sessionId: string): string {
  return join(RECOVERY_DIR, `${sessionId}.json`);
}

export interface RecoveryCheckpoint {
  sessionId: string;
  savedAt: string;        // ISO8601
  toolCallCount: number;
  messageCount: number;
  messages: AgentMessage[];
}

export async function writeRecoveryCheckpoint(
  sessionId: string,
  messages: AgentMessage[],
  toolCallCount: number,
): Promise<void> {
  await mkdir(RECOVERY_DIR, { recursive: true });
  const checkpoint: RecoveryCheckpoint = {
    sessionId,
    savedAt: new Date().toISOString(),
    toolCallCount,
    messageCount: messages.length,
    messages,
  };
  await writeFile(recoveryPath(sessionId), JSON.stringify(checkpoint), 'utf8');
}

export async function deleteRecoveryCheckpoint(sessionId: string): Promise<void> {
  await unlink(recoveryPath(sessionId)).catch(() => {});
}

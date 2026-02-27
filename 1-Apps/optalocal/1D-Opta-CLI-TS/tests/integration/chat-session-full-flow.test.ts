/**
 * Integration: Full chat session lifecycle.
 *
 * Tests the agent loop end-to-end. Uses Anthropic API if ANTHROPIC_API_KEY is set,
 * otherwise verifies the session store lifecycle with a mock (always available).
 */
import { describe, it, expect } from 'vitest';
import {
  createSession,
  loadSession,
  saveSession,
  listSessions,
  deleteSession,
} from '../../src/memory/store.js';

const HAVE_ANTHROPIC = !!process.env['ANTHROPIC_API_KEY'];

describe.skipIf(!HAVE_ANTHROPIC)('chat session full flow (requires ANTHROPIC_API_KEY)', () => {
  it('completes a single-turn chat with a real model response', async () => {
    const { agentLoop } = await import('../../src/core/agent.js');
    const { loadConfig } = await import('../../src/core/config.js');

    const config = await loadConfig();
    let gotResponse = false;

    await agentLoop(
      'Reply with exactly: OPTA_OK',
      { ...config, provider: { ...config.provider, active: 'anthropic' } } as typeof config,
      {
        onStream: {
          onToken: (text: string) => {
            if (text.includes('OPTA_OK')) gotResponse = true;
          },
        },
        signal: AbortSignal.timeout(30_000),
      },
    );

    expect(gotResponse).toBe(true);
  }, 35_000);
});

describe('chat session store lifecycle (always runs)', () => {
  it('creates a session, appends messages, reads them back, then deletes it', async () => {
    const session = await createSession('mock-model');
    expect(session.id).toBeTruthy();

    session.messages.push({ role: 'user', content: 'hello world' });
    session.messages.push({ role: 'assistant', content: 'hello back' });
    await saveSession(session);

    const loaded = await loadSession(session.id);
    expect(loaded).toBeTruthy();
    expect(loaded.messages).toHaveLength(2);
    expect(loaded.messages[0]?.role).toBe('user');
    expect(loaded.messages[1]?.role).toBe('assistant');

    await deleteSession(session.id);
    const gone = await loadSession(session.id).catch(() => null);
    expect(gone).toBeNull();
  });

  it('lists all stored sessions and finds the one just created', async () => {
    const s1 = await createSession('mock');
    const s2 = await createSession('mock');
    await saveSession(s1);
    await saveSession(s2);

    const all = await listSessions();
    const ids = all.map((s) => s.id);

    expect(ids).toContain(s1.id);
    expect(ids).toContain(s2.id);

    await deleteSession(s1.id);
    await deleteSession(s2.id);
  });

  it('throws or returns null when reading a nonexistent session', async () => {
    const result = await loadSession('nonexistent-session-id-xyz-abc123').catch((err: unknown) => ({
      error: err instanceof Error ? err.message : String(err),
    }));

    if (typeof result === 'object' && result !== null && 'error' in result) {
      expect(typeof (result as { error: string }).error).toBe('string');
    } else {
      expect(result == null).toBe(true);
    }
  });
});

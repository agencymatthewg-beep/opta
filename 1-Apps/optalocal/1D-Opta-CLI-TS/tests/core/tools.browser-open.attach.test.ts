import { describe, expect, it } from 'vitest';
import { executeTool } from '../../src/core/tools/executors.js';

describe('legacy browser_open executor removal', () => {
  it('returns unknown tool for browser_open after MCP hard cutover', async () => {
    const raw = await executeTool('browser_open', JSON.stringify({ session_id: 'sess-open-attach' }));
    expect(raw).toContain('Unknown tool "browser_open"');
  });
});

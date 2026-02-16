import { describe, it, expect } from 'vitest';
import { TOOL_SCHEMAS } from '../../src/core/tools.js';

describe('web_search tool', () => {
  it('is registered in tool schemas', () => {
    const schema = TOOL_SCHEMAS.find(t => t.function.name === 'web_search');
    expect(schema).toBeDefined();
    expect(schema!.function.parameters.required).toContain('query');
  });
});

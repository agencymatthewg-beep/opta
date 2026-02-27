import { describe, it, expect } from 'vitest';
import { TOOL_SCHEMAS } from '../../src/core/tools/index.js';

describe('web_fetch tool', () => {
  it('is registered in tool schemas', () => {
    const schema = TOOL_SCHEMAS.find(t => t.function.name === 'web_fetch');
    expect(schema).toBeDefined();
    expect(schema!.function.parameters.required).toContain('url');
  });
});

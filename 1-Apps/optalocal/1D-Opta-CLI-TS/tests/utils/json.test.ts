import { describe, it, expect } from 'vitest';
import { safeParseJson } from '../../src/utils/json.js';

describe('safeParseJson', () => {
  it('parses valid JSON', () => {
    expect(safeParseJson('{"a":1}')).toEqual({ a: 1 });
    expect(safeParseJson('[1,2,3]')).toEqual([1, 2, 3]);
    expect(safeParseJson('"hello"')).toBe('hello');
  });

  it('returns undefined on invalid JSON without fallback', () => {
    expect(safeParseJson('not json')).toBeUndefined();
    expect(safeParseJson('')).toBeUndefined();
  });

  it('returns fallback on invalid JSON', () => {
    expect(safeParseJson('bad', {})).toEqual({});
    expect(safeParseJson('bad', { raw: 'bad' })).toEqual({ raw: 'bad' });
    expect(safeParseJson('bad', null)).toBeNull();
  });

  it('preserves type with generics', () => {
    const result = safeParseJson<{ name: string }>('{"name":"test"}');
    expect(result?.name).toBe('test');
  });
});

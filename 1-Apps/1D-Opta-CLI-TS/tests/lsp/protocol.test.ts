import { describe, it, expect } from 'vitest';
import {
  filePathToUri,
  uriToFilePath,
  toPosition,
  formatLocation,
  formatLocations,
  formatHoverContent,
  formatSymbolInformation,
  formatDocumentSymbols,
  formatWorkspaceEdit,
} from '../../src/lsp/protocol.js';

describe('filePathToUri', () => {
  it('converts absolute path to file URI', () => {
    expect(filePathToUri('/Users/matt/code/app.ts')).toBe(
      'file:///Users/matt/code/app.ts'
    );
  });

  it('encodes spaces in path', () => {
    expect(filePathToUri('/Users/matt/my project/app.ts')).toBe(
      'file:///Users/matt/my%20project/app.ts'
    );
  });

  it('handles paths with special characters', () => {
    expect(filePathToUri('/Users/matt/code/[test]/app.ts')).toBe(
      'file:///Users/matt/code/%5Btest%5D/app.ts'
    );
  });
});

describe('uriToFilePath', () => {
  it('converts file URI back to path', () => {
    expect(uriToFilePath('file:///Users/matt/code/app.ts')).toBe(
      '/Users/matt/code/app.ts'
    );
  });

  it('decodes percent-encoded spaces', () => {
    expect(uriToFilePath('file:///Users/matt/my%20project/app.ts')).toBe(
      '/Users/matt/my project/app.ts'
    );
  });

  it('decodes percent-encoded special characters', () => {
    expect(uriToFilePath('file:///Users/matt/code/%5Btest%5D/app.ts')).toBe(
      '/Users/matt/code/[test]/app.ts'
    );
  });
});

describe('toPosition', () => {
  it('converts 1-based line to 0-based LSP position', () => {
    expect(toPosition(10, 5)).toEqual({ line: 9, character: 5 });
  });

  it('clamps line to minimum 0', () => {
    expect(toPosition(0, 0)).toEqual({ line: 0, character: 0 });
  });

  it('handles line 1 correctly', () => {
    expect(toPosition(1, 0)).toEqual({ line: 0, character: 0 });
  });
});

describe('formatLocation', () => {
  it('formats a single location as path:line:character', () => {
    const loc = {
      uri: 'file:///Users/matt/code/app.ts',
      range: {
        start: { line: 9, character: 5 },
        end: { line: 9, character: 15 },
      },
    };
    expect(formatLocation(loc, '/Users/matt/code')).toBe('app.ts:10:5');
  });

  it('uses full path when outside cwd', () => {
    const loc = {
      uri: 'file:///other/path/app.ts',
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 5 },
      },
    };
    // Should still produce a valid path (relative or absolute)
    const result = formatLocation(loc, '/Users/matt/code');
    expect(result).toContain('app.ts');
    expect(result).toContain(':1:0');
  });
});

describe('formatLocations', () => {
  it('formats multiple locations', () => {
    const locs = [
      {
        uri: 'file:///a/b.ts',
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 5 },
        },
      },
      {
        uri: 'file:///a/c.ts',
        range: {
          start: { line: 4, character: 2 },
          end: { line: 4, character: 8 },
        },
      },
    ];
    const result = formatLocations(locs, '/a');
    expect(result).toContain('b.ts:1:0');
    expect(result).toContain('c.ts:5:2');
  });

  it('returns "No results found." for empty array', () => {
    expect(formatLocations([], '/a')).toBe('No results found.');
  });

  it('returns "No results found." for null', () => {
    expect(formatLocations(null, '/a')).toBe('No results found.');
  });
});

describe('formatHoverContent', () => {
  it('extracts string content', () => {
    expect(formatHoverContent({ contents: 'hello world' })).toBe('hello world');
  });

  it('extracts MarkupContent value', () => {
    expect(
      formatHoverContent({
        contents: { kind: 'markdown', value: '```ts\nconst x: number\n```' },
      })
    ).toBe('```ts\nconst x: number\n```');
  });

  it('handles MarkedString with language', () => {
    expect(
      formatHoverContent({
        contents: { language: 'typescript', value: 'const x: number' },
      })
    ).toBe('```typescript\nconst x: number\n```');
  });

  it('handles array of MarkedStrings', () => {
    const result = formatHoverContent({
      contents: [
        { language: 'ts', value: 'type Foo = string' },
        'Documentation here',
      ],
    });
    expect(result).toContain('type Foo = string');
    expect(result).toContain('Documentation here');
  });

  it('returns "No hover information." for null', () => {
    expect(formatHoverContent(null)).toBe('No hover information.');
  });
});

describe('formatSymbolInformation', () => {
  it('formats symbol list', () => {
    const symbols = [
      {
        name: 'myFunction',
        kind: 12, // Function
        location: {
          uri: 'file:///project/src/app.ts',
          range: {
            start: { line: 10, character: 0 },
            end: { line: 20, character: 1 },
          },
        },
      },
    ];
    const result = formatSymbolInformation(symbols, '/project');
    expect(result).toContain('myFunction');
    expect(result).toContain('src/app.ts:11');
  });

  it('returns "No symbols found." for empty array', () => {
    expect(formatSymbolInformation([], '/project')).toBe('No symbols found.');
  });
});

describe('formatDocumentSymbols', () => {
  it('formats document symbols with kinds', () => {
    const symbols = [
      {
        name: 'MyClass',
        kind: 5, // Class
        range: {
          start: { line: 0, character: 0 },
          end: { line: 50, character: 1 },
        },
        selectionRange: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 13 },
        },
        children: [
          {
            name: 'constructor',
            kind: 9, // Constructor
            range: {
              start: { line: 2, character: 2 },
              end: { line: 5, character: 3 },
            },
            selectionRange: {
              start: { line: 2, character: 2 },
              end: { line: 2, character: 13 },
            },
          },
        ],
      },
    ];
    const result = formatDocumentSymbols(symbols);
    expect(result).toContain('MyClass');
    expect(result).toContain('constructor');
  });

  it('returns "No symbols found." for empty array', () => {
    expect(formatDocumentSymbols([])).toBe('No symbols found.');
  });
});

describe('formatWorkspaceEdit', () => {
  it('formats workspace edit changes', () => {
    const edit = {
      changes: {
        'file:///project/src/app.ts': [
          {
            range: {
              start: { line: 5, character: 10 },
              end: { line: 5, character: 20 },
            },
            newText: 'newName',
          },
        ],
        'file:///project/src/util.ts': [
          {
            range: {
              start: { line: 10, character: 0 },
              end: { line: 10, character: 10 },
            },
            newText: 'newName',
          },
        ],
      },
    };
    const result = formatWorkspaceEdit(edit, '/project');
    expect(result).toContain('src/app.ts');
    expect(result).toContain('src/util.ts');
    expect(result).toContain('newName');
  });

  it('returns "No changes." for null', () => {
    expect(formatWorkspaceEdit(null, '/project')).toBe('No changes.');
  });

  it('returns "No changes." for empty edit', () => {
    expect(formatWorkspaceEdit({ changes: {} }, '/project')).toBe('No changes.');
  });
});

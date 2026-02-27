import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LspManager } from '../../src/lsp/manager.js';

// Mock child_process.execFile for which-style checks
vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execFile: vi.fn((_cmd: string, _args: string[], callback: Function) => {
      callback(new Error('not found'), '', '');
    }),
  };
});

// Mock LspClient
vi.mock('../../src/lsp/client.js', () => ({
  LspClient: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    openDocument: vi.fn().mockResolvedValue(undefined),
    closeDocument: vi.fn(),
    notifyChange: vi.fn(),
    isDocumentOpen: vi.fn().mockReturnValue(false),
    definition: vi.fn().mockResolvedValue([]),
    references: vi.fn().mockResolvedValue([]),
    hover: vi.fn().mockResolvedValue(null),
    workspaceSymbols: vi.fn().mockResolvedValue([]),
    documentSymbols: vi.fn().mockResolvedValue([]),
    rename: vi.fn().mockResolvedValue({ changes: {} }),
  })),
}));

// Mock fs/promises for readFile
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('file content'),
}));

describe('LspManager', () => {
  let manager: LspManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new LspManager({
      cwd: '/project',
      config: { enabled: true, servers: {}, timeout: 10000 },
    });
  });

  afterEach(async () => {
    await manager.shutdownAll();
  });

  describe('language detection', () => {
    it('detects TypeScript from .ts extension', () => {
      expect(manager.getLanguage('src/app.ts')).toBe('typescript');
    });

    it('detects TypeScript from .tsx extension', () => {
      expect(manager.getLanguage('src/App.tsx')).toBe('typescript');
    });

    it('detects TypeScript from .js extension', () => {
      expect(manager.getLanguage('src/util.js')).toBe('typescript');
    });

    it('detects TypeScript from .jsx extension', () => {
      expect(manager.getLanguage('src/App.jsx')).toBe('typescript');
    });

    it('detects Python from .py extension', () => {
      expect(manager.getLanguage('main.py')).toBe('python');
    });

    it('detects Go from .go extension', () => {
      expect(manager.getLanguage('main.go')).toBe('go');
    });

    it('detects Rust from .rs extension', () => {
      expect(manager.getLanguage('src/lib.rs')).toBe('rust');
    });

    it('returns null for unknown extensions', () => {
      expect(manager.getLanguage('readme.md')).toBeNull();
    });

    it('returns null for files without extension', () => {
      expect(manager.getLanguage('Makefile')).toBeNull();
    });
  });

  describe('server availability', () => {
    it('returns fallback message when server binary not found', async () => {
      const result = await manager.execute('lsp_definition', {
        path: 'src/app.ts',
        line: 1,
        character: 0,
      });
      expect(result).toContain('not available');
      expect(result).toContain('search_files');
    });

    it('returns fallback for unsupported file types', async () => {
      const result = await manager.execute('lsp_definition', {
        path: 'data.csv',
        line: 1,
        character: 0,
      });
      expect(result).toContain('No LSP server');
    });

    it('includes install hint in fallback', async () => {
      const result = await manager.execute('lsp_definition', {
        path: 'src/app.ts',
        line: 1,
        character: 0,
      });
      expect(result).toContain('npm install -g');
    });
  });

  describe('server pooling', () => {
    it('reuses existing client for same language', async () => {
      // Make the binary check succeed
      const { execFile } = await import('node:child_process');
      vi.mocked(execFile).mockImplementation(
        (_cmd: any, _args: any, callback: any) => {
          callback(null, '/usr/bin/typescript-language-server', '');
          return {} as any;
        }
      );

      await manager.execute('lsp_definition', {
        path: 'a.ts',
        line: 1,
        character: 0,
      });
      await manager.execute('lsp_definition', {
        path: 'b.ts',
        line: 1,
        character: 0,
      });

      const { LspClient } = await import('../../src/lsp/client.js');
      // Should only construct one client for typescript
      expect(LspClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('execute routing', () => {
    beforeEach(async () => {
      // Make binary check succeed
      const { execFile } = await import('node:child_process');
      vi.mocked(execFile).mockImplementation(
        (_cmd: any, _args: any, callback: any) => {
          callback(null, '/usr/bin/typescript-language-server', '');
          return {} as any;
        }
      );
    });

    it('routes lsp_definition correctly', async () => {
      const result = await manager.execute('lsp_definition', {
        path: 'src/app.ts',
        line: 5,
        character: 10,
      });
      // Since mock returns [], we get formatted "No results found."
      expect(result).toBe('No results found.');
    });

    it('routes lsp_references correctly', async () => {
      const result = await manager.execute('lsp_references', {
        path: 'src/app.ts',
        line: 5,
        character: 10,
      });
      expect(result).toBe('No results found.');
    });

    it('routes lsp_hover correctly', async () => {
      const result = await manager.execute('lsp_hover', {
        path: 'src/app.ts',
        line: 5,
        character: 10,
      });
      expect(result).toBe('No hover information.');
    });

    it('routes lsp_symbols correctly', async () => {
      const result = await manager.execute('lsp_symbols', {
        query: 'MyClass',
      });
      expect(result).toBe('No symbols found.');
    });

    it('routes lsp_document_symbols correctly', async () => {
      const result = await manager.execute('lsp_document_symbols', {
        path: 'src/app.ts',
      });
      expect(result).toBe('No symbols found.');
    });

    it('routes lsp_rename correctly', async () => {
      const result = await manager.execute('lsp_rename', {
        path: 'src/app.ts',
        line: 5,
        character: 10,
        new_name: 'newName',
      });
      expect(result).toBe('No changes.');
    });

    it('returns error for unknown LSP tool', async () => {
      const result = await manager.execute('lsp_unknown', {
        path: 'src/app.ts',
      });
      expect(result).toContain('Unknown LSP tool');
    });
  });

  describe('notifyFileChanged', () => {
    beforeEach(async () => {
      const { execFile } = await import('node:child_process');
      vi.mocked(execFile).mockImplementation(
        (_cmd: any, _args: any, callback: any) => {
          callback(null, '/usr/bin/typescript-language-server', '');
          return {} as any;
        }
      );
    });

    it('sends didChange notification for tracked files', async () => {
      // First, trigger a request to spawn the client
      await manager.execute('lsp_definition', {
        path: 'src/app.ts',
        line: 1,
        character: 0,
      });

      // Now notify of a file change
      await manager.notifyFileChanged('/project/src/app.ts');
      // Should not throw
    });

    it('does not throw for files without an LSP client', async () => {
      await expect(
        manager.notifyFileChanged('/project/readme.md')
      ).resolves.not.toThrow();
    });
  });

  describe('shutdownAll', () => {
    it('shuts down all running servers', async () => {
      const { execFile } = await import('node:child_process');
      vi.mocked(execFile).mockImplementation(
        (_cmd: any, _args: any, callback: any) => {
          callback(null, '/usr/bin/tls', '');
          return {} as any;
        }
      );

      await manager.execute('lsp_hover', {
        path: 'a.ts',
        line: 1,
        character: 0,
      });
      await manager.shutdownAll();
      // Should not throw
    });
  });

  describe('disabled LSP', () => {
    it('returns fallback when LSP is disabled in config', async () => {
      const disabledManager = new LspManager({
        cwd: '/project',
        config: { enabled: false, servers: {}, timeout: 10000 },
      });

      const result = await disabledManager.execute('lsp_definition', {
        path: 'src/app.ts',
        line: 1,
        character: 0,
      });
      expect(result).toContain('LSP is disabled');
    });
  });
});

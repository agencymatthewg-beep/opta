import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { LspClient } from '../../src/lsp/client.js';

// Create a mock process factory
function createMockProcess() {
  const proc = new EventEmitter() as any;
  proc.stdin = { write: vi.fn(), end: vi.fn() };
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.kill = vi.fn(() => {
    // Simulate process exiting when killed
    proc.emit('exit', 0, null);
  });
  proc.pid = 12345;
  proc.exitCode = null;
  return proc;
}

let mockProc: ReturnType<typeof createMockProcess>;

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => mockProc),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('const x = 1;\nconst y = 2;\n'),
}));

function sendResponse(proc: any, id: number, result: unknown) {
  const response = JSON.stringify({
    jsonrpc: '2.0',
    id,
    result,
  });
  const header = `Content-Length: ${Buffer.byteLength(response)}\r\n\r\n`;
  proc.stdout.emit('data', Buffer.from(header + response));
}

/**
 * Helper: initialize a client with mock response.
 * Returns the client in initialized state.
 */
async function initializeClient(
  client: LspClient,
  proc: any,
  capabilities: Record<string, boolean> = { definitionProvider: true }
) {
  setTimeout(() => {
    sendResponse(proc, 1, { capabilities });
  }, 2);
  await client.initialize({ timeout: 2000 });
}

describe('LspClient', () => {
  let client: LspClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProc = createMockProcess();
    client = new LspClient({
      command: 'typescript-language-server',
      args: ['--stdio'],
      rootUri: 'file:///project',
      language: 'typescript',
    });
  });

  afterEach(async () => {
    // Force kill without waiting for response
    try {
      mockProc.kill();
    } catch {
      // ignore
    }
  });

  describe('initialize', () => {
    it('spawns the server process on initialize', async () => {
      const { spawn } = await import('node:child_process');

      await initializeClient(client, mockProc);

      expect(spawn).toHaveBeenCalledWith(
        'typescript-language-server',
        ['--stdio'],
        expect.objectContaining({ stdio: ['pipe', 'pipe', 'pipe'] })
      );
    });

    it('rejects unsafe command strings before spawn', async () => {
      const { spawn } = await import('node:child_process');
      const unsafeClient = new LspClient({
        command: 'typescript-language-server; touch /tmp/pwned',
        args: ['--stdio'],
        rootUri: 'file:///project',
        language: 'typescript',
      });

      await expect(unsafeClient.initialize({ timeout: 50 })).rejects.toThrow(
        /command rejected/i
      );
      expect(spawn).not.toHaveBeenCalled();
    });

    it('sends initialized notification after initialize response', async () => {
      await initializeClient(client, mockProc);

      // stdin.write should have been called at least twice:
      // 1. initialize request
      // 2. initialized notification
      expect(mockProc.stdin.write).toHaveBeenCalledTimes(2);
    });

    it('rejects with timeout when server does not respond', async () => {
      // Don't send a response -- should timeout
      await expect(client.initialize({ timeout: 50 })).rejects.toThrow(
        /timed out/i
      );
    }, 5000);
  });

  describe('document tracking', () => {
    it('tracks opened documents', () => {
      expect(client.isDocumentOpen('file:///project/src/app.ts')).toBe(false);
    });
  });

  describe('requests before initialize', () => {
    it('throws on request before initialize', async () => {
      await expect(
        client.definition('file:///test.ts', { line: 0, character: 0 })
      ).rejects.toThrow(/not initialized/i);
    });
  });

  describe('LSP requests (after initialize)', () => {
    beforeEach(async () => {
      await initializeClient(client, mockProc, {
        definitionProvider: true,
        referencesProvider: true,
        hoverProvider: true,
        workspaceSymbolProvider: true,
        documentSymbolProvider: true,
        renameProvider: true,
      });
    });

    it('sends definition request and returns locations', async () => {
      const resultPromise = client.definition('file:///project/src/app.ts', {
        line: 0,
        character: 5,
      });

      // The definition request will be id=2 (after initialize which was id=1)
      setTimeout(() => {
        sendResponse(mockProc, 2, [
          {
            uri: 'file:///project/src/lib.ts',
            range: {
              start: { line: 10, character: 0 },
              end: { line: 10, character: 15 },
            },
          },
        ]);
      }, 5);

      const result = await resultPromise;
      expect(result).toHaveLength(1);
      expect(result[0]!.uri).toBe('file:///project/src/lib.ts');
    });

    it('sends references request', async () => {
      const resultPromise = client.references(
        'file:///project/src/app.ts',
        { line: 0, character: 5 },
        true
      );

      setTimeout(() => {
        sendResponse(mockProc, 2, [
          {
            uri: 'file:///project/src/app.ts',
            range: {
              start: { line: 0, character: 5 },
              end: { line: 0, character: 10 },
            },
          },
          {
            uri: 'file:///project/src/other.ts',
            range: {
              start: { line: 5, character: 0 },
              end: { line: 5, character: 5 },
            },
          },
        ]);
      }, 5);

      const result = await resultPromise;
      expect(result).toHaveLength(2);
    });

    it('sends hover request', async () => {
      const resultPromise = client.hover('file:///project/src/app.ts', {
        line: 0,
        character: 5,
      });

      setTimeout(() => {
        sendResponse(mockProc, 2, {
          contents: { kind: 'markdown', value: 'const x: number' },
        });
      }, 5);

      const result = await resultPromise;
      expect(result).toEqual({
        contents: { kind: 'markdown', value: 'const x: number' },
      });
    });

    it('sends workspace symbols request', async () => {
      const resultPromise = client.workspaceSymbols('MyClass');

      setTimeout(() => {
        sendResponse(mockProc, 2, [
          {
            name: 'MyClass',
            kind: 5,
            location: {
              uri: 'file:///project/src/models.ts',
              range: {
                start: { line: 0, character: 0 },
                end: { line: 50, character: 1 },
              },
            },
          },
        ]);
      }, 5);

      const result = await resultPromise;
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('MyClass');
    });

    it('sends document symbols request', async () => {
      const resultPromise = client.documentSymbols(
        'file:///project/src/app.ts'
      );

      setTimeout(() => {
        sendResponse(mockProc, 2, [
          {
            name: 'myFunc',
            kind: 12,
            range: {
              start: { line: 0, character: 0 },
              end: { line: 5, character: 1 },
            },
            selectionRange: {
              start: { line: 0, character: 9 },
              end: { line: 0, character: 15 },
            },
          },
        ]);
      }, 5);

      const result = await resultPromise;
      expect(result).toHaveLength(1);
      expect(result[0]!.name).toBe('myFunc');
    });

    it('sends rename request', async () => {
      const resultPromise = client.rename(
        'file:///project/src/app.ts',
        { line: 0, character: 5 },
        'newName'
      );

      setTimeout(() => {
        sendResponse(mockProc, 2, {
          changes: {
            'file:///project/src/app.ts': [
              {
                range: {
                  start: { line: 0, character: 5 },
                  end: { line: 0, character: 10 },
                },
                newText: 'newName',
              },
            ],
          },
        });
      }, 5);

      const result = await resultPromise;
      expect(result.changes).toBeDefined();
    });
  });

  describe('document sync', () => {
    beforeEach(async () => {
      await initializeClient(client, mockProc);
    });

    it('sends didOpen when opening a new document', async () => {
      await client.openDocument('file:///project/src/app.ts', 'const x = 1;');
      expect(client.isDocumentOpen('file:///project/src/app.ts')).toBe(true);
    });

    it('does not re-open already opened documents', async () => {
      await client.openDocument(
        'file:///project/src/app.ts',
        'const x = 1;'
      );
      const callCount = mockProc.stdin.write.mock.calls.length;

      await client.openDocument(
        'file:///project/src/app.ts',
        'const x = 2;'
      );
      // Should not have sent another didOpen
      expect(mockProc.stdin.write).toHaveBeenCalledTimes(callCount);
    });

    it('sends didClose when closing a document', async () => {
      await client.openDocument('file:///project/src/app.ts', 'const x = 1;');
      expect(client.isDocumentOpen('file:///project/src/app.ts')).toBe(true);

      client.closeDocument('file:///project/src/app.ts');
      expect(client.isDocumentOpen('file:///project/src/app.ts')).toBe(false);
    });

    it('sends didChange for file content updates', async () => {
      await client.openDocument('file:///project/src/app.ts', 'const x = 1;');
      const callsBefore = mockProc.stdin.write.mock.calls.length;

      client.notifyChange('file:///project/src/app.ts', 'const x = 2;');

      // Should have sent a didChange notification
      expect(mockProc.stdin.write).toHaveBeenCalledTimes(callsBefore + 1);
    });
  });

  describe('shutdown', () => {
    it('sends shutdown and exit', async () => {
      await initializeClient(client, mockProc);

      // Respond to shutdown request (id=2, since initialize was id=1)
      setTimeout(() => {
        sendResponse(mockProc, 2, null);
      }, 2);

      await client.shutdown();
      expect(mockProc.kill).toHaveBeenCalled();
    });

    it('does not throw when shutdown called before initialize', async () => {
      await expect(client.shutdown()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    it('handles process exit during request', async () => {
      await initializeClient(client, mockProc);

      const promise = client.definition('file:///project/src/app.ts', {
        line: 0,
        character: 0,
      });

      // Simulate process crash
      setTimeout(() => {
        mockProc.emit('exit', 1, null);
      }, 5);

      await expect(promise).rejects.toThrow();
    });

    it('handles JSON-RPC error responses', async () => {
      await initializeClient(client, mockProc);

      const promise = client.definition('file:///project/src/app.ts', {
        line: 0,
        character: 0,
      });

      // Send error response
      setTimeout(() => {
        const errorResponse = JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          error: { code: -32600, message: 'Invalid request' },
        });
        const header = `Content-Length: ${Buffer.byteLength(errorResponse)}\r\n\r\n`;
        mockProc.stdout.emit('data', Buffer.from(header + errorResponse));
      }, 5);

      await expect(promise).rejects.toThrow('Invalid request');
    });
  });
});

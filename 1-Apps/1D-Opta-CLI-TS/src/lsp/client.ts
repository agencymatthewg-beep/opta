/**
 * LSP Client
 *
 * Manages a single LSP server process over stdio with JSON-RPC 2.0.
 * Handles: spawn, initialize handshake, document sync, requests, shutdown.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import type {
  Position,
  Location,
  SymbolInformation,
  DocumentSymbol,
  WorkspaceEdit,
} from './protocol.js';
import { uriToFilePath } from './protocol.js';

export interface LspClientOptions {
  command: string;
  args: string[];
  rootUri: string;
  language: string;
  cwd?: string;
}

export class LspClient {
  private process: ChildProcess | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();
  private openDocs = new Set<string>();
  private docVersions = new Map<string, number>();
  private buffer = Buffer.alloc(0);
  private readonly MAX_BUFFER_SIZE = 64 * 1024 * 1024; // 64MB
  private initialized = false;

  constructor(private opts: LspClientOptions) {}

  // --- Lifecycle ---

  async initialize(options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? 10000;

    this.process = spawn(this.opts.command, this.opts.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.opts.cwd,
    });

    this.process.stdout!.on('data', (data: Buffer) => {
      this.handleData(data);
    });

    this.process.stderr!.on('data', () => {
      // Ignore stderr, but read it to prevent pipe blocking
    });

    this.process.on('exit', (_code, _signal) => {
      // Reject all pending requests
      for (const [, pending] of this.pending) {
        pending.reject(new Error('LSP server process exited'));
      }
      this.pending.clear();
      this.initialized = false;
    });

    const result = await this.sendRequest(
      'initialize',
      {
        processId: process.pid,
        rootUri: this.opts.rootUri,
        capabilities: {
          textDocument: {
            synchronization: {
              dynamicRegistration: false,
              willSave: false,
              didSave: true,
              willSaveWaitUntil: false,
            },
            definition: { dynamicRegistration: false },
            references: { dynamicRegistration: false },
            hover: { dynamicRegistration: false },
            documentSymbol: {
              dynamicRegistration: false,
              hierarchicalDocumentSymbolSupport: true,
            },
            rename: { dynamicRegistration: false },
          },
          workspace: {
            symbol: { dynamicRegistration: false },
          },
        },
      },
      timeout
    );

    this.initialized = true;

    // Send initialized notification
    this.sendNotification('initialized', {});

    return result as undefined;
  }

  async shutdown(): Promise<void> {
    if (!this.process || !this.initialized) {
      if (this.process) {
        this.process.kill();
        this.process = null;
      }
      return;
    }

    try {
      await this.sendRequest('shutdown', null, 5000);
    } catch {
      // Best effort
    }

    this.sendNotification('exit', null);
    this.process.kill();
    this.process = null;
    this.initialized = false;
  }

  // --- Document Sync ---

  async openDocument(uri: string, text: string): Promise<void> {
    if (this.openDocs.has(uri)) return;

    this.docVersions.set(uri, 1);
    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId: this.opts.language,
        version: 1,
        text,
      },
    });
    this.openDocs.add(uri);
  }

  closeDocument(uri: string): void {
    if (!this.openDocs.has(uri)) return;

    this.sendNotification('textDocument/didClose', {
      textDocument: { uri },
    });
    this.openDocs.delete(uri);
    this.docVersions.delete(uri);
  }

  notifyChange(uri: string, newText: string): void {
    if (!this.openDocs.has(uri)) return;

    const version = (this.docVersions.get(uri) ?? 1) + 1;
    this.docVersions.set(uri, version);

    this.sendNotification('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text: newText }],
    });
  }

  isDocumentOpen(uri: string): boolean {
    return this.openDocs.has(uri);
  }

  // --- LSP Requests ---

  async definition(uri: string, position: Position): Promise<Location[]> {
    this.assertInitialized();
    await this.ensureDocumentOpen(uri);

    const result = await this.sendRequest('textDocument/definition', {
      textDocument: { uri },
      position,
    });

    return this.normalizeLocations(result);
  }

  async references(
    uri: string,
    position: Position,
    includeDeclaration = true
  ): Promise<Location[]> {
    this.assertInitialized();
    await this.ensureDocumentOpen(uri);

    const result = await this.sendRequest('textDocument/references', {
      textDocument: { uri },
      position,
      context: { includeDeclaration },
    });

    return this.normalizeLocations(result);
  }

  async hover(uri: string, position: Position): Promise<unknown> {
    this.assertInitialized();
    await this.ensureDocumentOpen(uri);

    return this.sendRequest('textDocument/hover', {
      textDocument: { uri },
      position,
    });
  }

  async workspaceSymbols(query: string): Promise<SymbolInformation[]> {
    this.assertInitialized();

    const result = await this.sendRequest('workspace/symbol', { query });
    return (result as SymbolInformation[]) ?? [];
  }

  async documentSymbols(uri: string): Promise<DocumentSymbol[]> {
    this.assertInitialized();
    await this.ensureDocumentOpen(uri);

    const result = await this.sendRequest('textDocument/documentSymbol', {
      textDocument: { uri },
    });
    return (result as DocumentSymbol[]) ?? [];
  }

  async rename(
    uri: string,
    position: Position,
    newName: string
  ): Promise<WorkspaceEdit> {
    this.assertInitialized();
    await this.ensureDocumentOpen(uri);

    const result = await this.sendRequest('textDocument/rename', {
      textDocument: { uri },
      position,
      newName,
    });
    return (result as WorkspaceEdit) ?? { changes: {} };
  }

  // --- Internal JSON-RPC ---

  private sendRequest(
    method: string,
    params: unknown,
    timeout = 10000
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('LSP server not running'));
        return;
      }

      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });

      const message = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      });

      const header = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
      this.process.stdin.write(header + message);

      // Timeout
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`LSP request "${method}" timed out after ${timeout}ms`));
        }
      }, timeout);

      // Replace resolve/reject with timer-clearing versions
      const origResolve = resolve;
      const origReject = reject;
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          origResolve(value);
        },
        reject: (reason) => {
          clearTimeout(timer);
          origReject(reason);
        },
      });
    });
  }

  private sendNotification(method: string, params: unknown): void {
    if (!this.process?.stdin) return;

    const message = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
    });

    const header = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n`;
    this.process.stdin.write(header + message);
  }

  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    // Guard against unbounded buffer growth from a misbehaving LSP server
    if (this.buffer.length > this.MAX_BUFFER_SIZE) {
      this.buffer = Buffer.alloc(0);
      for (const [, pending] of this.pending) {
        pending.reject(new Error('LSP buffer overflow — server sent too much data'));
      }
      this.pending.clear();
      return;
    }

    while (true) {
      // Parse Content-Length header
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const headerStr = this.buffer.subarray(0, headerEnd).toString();
      const match = headerStr.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        // Skip invalid header
        this.buffer = this.buffer.subarray(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(match[1]!, 10);
      const totalLength = headerEnd + 4 + contentLength;

      if (this.buffer.length < totalLength) break; // Need more data

      const body = this.buffer.subarray(headerEnd + 4, totalLength).toString();
      this.buffer = this.buffer.subarray(totalLength);

      try {
        const message = JSON.parse(body) as Record<string, unknown>;
        this.handleMessage(message);
      } catch {
        // Skip malformed JSON
      }
    }
  }

  private handleMessage(message: Record<string, unknown>): void {
    // Response (has id)
    if ('id' in message && typeof message['id'] === 'number') {
      const pending = this.pending.get(message['id']);
      if (pending) {
        this.pending.delete(message['id']);
        if ('error' in message && message['error']) {
          const err = message['error'] as Record<string, unknown>;
          pending.reject(new Error(String(err['message'] ?? 'LSP error')));
        } else {
          pending.resolve(message['result']);
        }
      }
    }
    // Notifications from server (no id) -- ignore for now
  }

  // --- Helpers ---

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new Error('LSP client not initialized');
    }
  }

  private async ensureDocumentOpen(uri: string): Promise<void> {
    if (this.openDocs.has(uri)) return;
    const filePath = uriToFilePath(uri);
    const text = await readFile(filePath, 'utf-8');
    await this.openDocument(uri, text);
  }

  private normalizeLocations(result: unknown): Location[] {
    if (!result) return [];
    if (Array.isArray(result)) return result as Location[];
    // Single location result
    if (typeof result === 'object' && 'uri' in (result as any)) {
      return [result as Location];
    }
    return [];
  }
}

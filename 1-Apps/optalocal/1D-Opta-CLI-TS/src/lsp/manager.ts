/**
 * LSP Manager
 *
 * Manages a pool of LspClient instances, one per language.
 * Handles language detection, lazy server initialization, and tool execution routing.
 */

import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { LspClient } from './client.js';
import { BUILTIN_SERVERS, detectLanguage } from './servers.js';
import { errorMessage } from '../utils/errors.js';
import { getUnsafeExecutableReason } from '../utils/command-safety.js';
import {
  filePathToUri,
  toPosition,
  formatLocations,
  formatHoverContent,
  formatSymbolInformation,
  formatDocumentSymbols,
  formatWorkspaceEdit,
} from './protocol.js';
import type { LspServerConfig } from './servers.js';
import { isBinaryAvailable } from '../platform/index.js';

export interface LspConfig {
  enabled: boolean;
  servers: Record<
    string,
    { command: string; args?: string[]; initializationOptions?: Record<string, unknown> }
  >;
  timeout: number;
}

export class LspManager {
  private clients = new Map<string, LspClient>();
  private serverAvailable = new Map<string, boolean>();
  private cwd: string;
  private config: LspConfig;

  constructor(opts: { cwd: string; config: LspConfig }) {
    this.cwd = opts.cwd;
    this.config = opts.config;
  }

  // --- Language Detection ---

  getLanguage(filePath: string): string | null {
    return detectLanguage(filePath);
  }

  // --- Tool Execution ---

  async execute(toolName: string, args: Record<string, unknown>): Promise<string> {
    if (!this.config.enabled) {
      return 'LSP is disabled in config. Enable it with: opta config set lsp.enabled true';
    }

    // lsp_symbols and lsp_document_symbols have different arg patterns
    if (toolName === 'lsp_symbols') {
      return this.executeSymbols(args);
    }

    const pathVal = args['path'];
    const path =
      typeof pathVal === 'string'
        ? pathVal
        : typeof pathVal === 'object'
          ? JSON.stringify(pathVal)
          : String(pathVal as number | boolean | bigint | null | undefined);

    if (toolName === 'lsp_document_symbols') {
      return this.executeDocumentSymbols(path);
    }

    // All other tools need path, line, character
    const line = Number(args['line'] ?? 1);
    const character = Number(args['character'] ?? 0);

    switch (toolName) {
      case 'lsp_definition':
        return this.executeDefinition(path, line, character);
      case 'lsp_references':
        return this.executeReferences(path, line, character, args['include_declaration'] !== false);
      case 'lsp_hover':
        return this.executeHover(path, line, character);
      case 'lsp_rename': {
        const newNameVal = args['new_name'];
        const newName =
          typeof newNameVal === 'string'
            ? newNameVal
            : typeof newNameVal === 'object'
              ? JSON.stringify(newNameVal)
              : String(newNameVal as number | boolean | bigint | null | undefined);
        return this.executeRename(path, line, character, newName);
      }
      default:
        return `Unknown LSP tool: ${toolName}`;
    }
  }

  // --- File Change Notification ---

  async notifyFileChanged(absolutePath: string): Promise<void> {
    const language = detectLanguage(absolutePath);
    if (!language) return;

    const client = this.clients.get(language);
    if (!client) return;

    const uri = filePathToUri(absolutePath);

    try {
      const text = await readFile(absolutePath, 'utf-8');
      if (client.isDocumentOpen(uri)) {
        client.notifyChange(uri, text);
      } else {
        // Close and re-open to refresh
        client.closeDocument(uri);
        client.openDocument(uri, text);
      }
    } catch {
      // File may have been deleted, ignore
    }
  }

  // --- Shutdown ---

  async shutdownAll(): Promise<void> {
    const shutdowns = Array.from(this.clients.values()).map((client) =>
      client.shutdown().catch(() => {})
    );
    await Promise.all(shutdowns);
    this.clients.clear();
    this.serverAvailable.clear();
  }

  // --- Private: Tool Executors ---

  private async executeDefinition(path: string, line: number, character: number): Promise<string> {
    const client = await this.getClientForFile(path);
    if (typeof client === 'string') return client; // fallback message

    const uri = this.resolveUri(path);
    const pos = toPosition(line, character);
    const result = await client.definition(uri, pos);
    return formatLocations(result, this.cwd);
  }

  private async executeReferences(
    path: string,
    line: number,
    character: number,
    includeDeclaration: boolean
  ): Promise<string> {
    const client = await this.getClientForFile(path);
    if (typeof client === 'string') return client;

    const uri = this.resolveUri(path);
    const pos = toPosition(line, character);
    const result = await client.references(uri, pos, includeDeclaration);
    return formatLocations(result, this.cwd);
  }

  private async executeHover(path: string, line: number, character: number): Promise<string> {
    const client = await this.getClientForFile(path);
    if (typeof client === 'string') return client;

    const uri = this.resolveUri(path);
    const pos = toPosition(line, character);
    const result = await client.hover(uri, pos);
    return formatHoverContent(result);
  }

  private async executeSymbols(args: Record<string, unknown>): Promise<string> {
    const queryVal = args['query'];
    const query =
      typeof queryVal === 'string'
        ? queryVal
        : typeof queryVal === 'object'
          ? JSON.stringify(queryVal)
          : String(queryVal as number | boolean | bigint | null | undefined);

    // For workspace symbols, we need at least one client running.
    // Try to use any existing client, or check if we can start one.
    let client: LspClient | null = null;

    if (this.clients.size > 0) {
      client = this.clients.values().next().value ?? null;
    } else {
      // Try TypeScript first as the most common
      const tsClient = await this.getClientForFile('_.ts');
      if (typeof tsClient === 'string') {
        return 'No symbols found.';
      }
      client = tsClient;
    }

    if (!client) return 'No symbols found.';

    const result = await client.workspaceSymbols(query);
    return formatSymbolInformation(result, this.cwd);
  }

  private async executeDocumentSymbols(path: string): Promise<string> {
    const client = await this.getClientForFile(path);
    if (typeof client === 'string') return client;

    const uri = this.resolveUri(path);
    const result = await client.documentSymbols(uri);
    return formatDocumentSymbols(result);
  }

  private async executeRename(
    path: string,
    line: number,
    character: number,
    newName: string
  ): Promise<string> {
    const client = await this.getClientForFile(path);
    if (typeof client === 'string') return client;

    const uri = this.resolveUri(path);
    const pos = toPosition(line, character);
    const result = await client.rename(uri, pos, newName);
    return formatWorkspaceEdit(result, this.cwd);
  }

  // --- Private: Client Management ---

  private async getClientForFile(path: string): Promise<LspClient | string> {
    const language = detectLanguage(path);
    if (!language) {
      const ext = extname(path) || '(no extension)';
      return `No LSP server configured for ${ext} files. Use search_files to find definitions instead.`;
    }

    // Check if client already exists
    const existing = this.clients.get(language);
    if (existing) return existing;

    // Check if we already know the server is unavailable
    if (this.serverAvailable.has(language) && !this.serverAvailable.get(language)) {
      return this.fallbackMessage(language);
    }

    // Try to find and start the server
    const serverConfig = this.getServerConfig(language);
    if (!serverConfig) {
      this.serverAvailable.set(language, false);
      return this.fallbackMessage(language);
    }

    const unsafeCommandReason = getUnsafeExecutableReason(serverConfig.command);
    if (unsafeCommandReason) {
      this.serverAvailable.set(language, false);
      return (
        `LSP server command rejected for ${language}: ${unsafeCommandReason}\n\n` +
        'Use search_files as a fallback.'
      );
    }

    // Check if binary is on PATH
    const available = await this.checkBinary(serverConfig.command);
    this.serverAvailable.set(language, available);

    if (!available) {
      return this.fallbackMessage(language);
    }

    // Spawn and initialize
    try {
      const rootUri = filePathToUri(this.cwd);
      const client = new LspClient({
        command: serverConfig.command,
        args: serverConfig.args,
        rootUri,
        language,
        cwd: this.cwd,
      });

      await client.initialize({ timeout: this.config.timeout });
      this.clients.set(language, client);
      return client;
    } catch (err) {
      const msg = errorMessage(err);
      this.serverAvailable.set(language, false);
      return `LSP server for ${language} failed to start: ${msg}\n\nUse search_files as a fallback.`;
    }
  }

  private getServerConfig(language: string): LspServerConfig | null {
    // User overrides take precedence
    const userConfig = this.config.servers[language];
    if (userConfig) {
      const builtin = BUILTIN_SERVERS[language];
      return {
        command: userConfig.command,
        args: userConfig.args ?? [],
        initializationOptions: userConfig.initializationOptions ?? {},
        rootPatterns: builtin?.rootPatterns ?? [],
        fileExtensions: builtin?.fileExtensions ?? [],
        installHint: `(custom server: ${userConfig.command})`,
      };
    }

    return BUILTIN_SERVERS[language] ?? null;
  }

  private async checkBinary(command: string): Promise<boolean> {
    return isBinaryAvailable(command);
  }

  private resolveUri(path: string): string {
    const absolute = resolve(this.cwd, path);
    return filePathToUri(absolute);
  }

  private fallbackMessage(language: string): string {
    const server = BUILTIN_SERVERS[language];
    if (!server) {
      return `No LSP server configured for ${language}. Use search_files to find definitions instead.`;
    }

    return (
      `LSP server "${server.command}" is not available.\n` +
      `Install it with: ${server.installHint}\n\n` +
      `Suggested alternative: Use search_files to find definitions:\n` +
      `  search_files({ pattern: "<symbol_name>", glob: "*${server.fileExtensions[0] ?? '.*'}" })`
    );
  }
}

/**
 * LSP Module — Public API
 *
 * Provides Language Server Protocol integration for Opta CLI.
 * Supports: TypeScript, Python, Go, Rust.
 */

export { LspClient } from './client.js';
export { LspManager } from './manager.js';
export type { LspConfig } from './manager.js';
export { BUILTIN_SERVERS, detectLanguage } from './servers.js';
export type { LspServerConfig } from './servers.js';
export {
  filePathToUri,
  uriToFilePath,
  toPosition,
  formatLocation,
  formatLocations,
  formatHoverContent,
  formatSymbolInformation,
  formatDocumentSymbols,
  formatWorkspaceEdit,
} from './protocol.js';
export type {
  Position,
  Range,
  Location,
  SymbolInformation,
  DocumentSymbol,
  TextEdit,
  WorkspaceEdit,
} from './protocol.js';

/**
 * LSP Server Configurations
 *
 * Built-in configs for supported language servers.
 * Users can override via config.lsp.servers.
 */

export interface LspServerConfig {
  command: string;
  args: string[];
  initializationOptions?: Record<string, unknown>;
  rootPatterns: string[];
  fileExtensions: string[];
  installHint: string;
}

export const BUILTIN_SERVERS: Record<string, LspServerConfig> = {
  typescript: {
    command: 'typescript-language-server',
    args: ['--stdio'],
    initializationOptions: {
      preferences: { includeInlayParameterNameHints: 'none' },
    },
    rootPatterns: ['tsconfig.json', 'jsconfig.json', 'package.json'],
    fileExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
    installHint: 'npm install -g typescript-language-server typescript',
  },
  python: {
    command: 'pyright-langserver',
    args: ['--stdio'],
    initializationOptions: {},
    rootPatterns: ['pyproject.toml', 'setup.py', 'pyrightconfig.json'],
    fileExtensions: ['.py', '.pyi'],
    installHint: 'pip install pyright',
  },
  go: {
    command: 'gopls',
    args: ['serve'],
    initializationOptions: {},
    rootPatterns: ['go.mod'],
    fileExtensions: ['.go'],
    installHint: 'go install golang.org/x/tools/gopls@latest',
  },
  rust: {
    command: 'rust-analyzer',
    args: [],
    initializationOptions: {},
    rootPatterns: ['Cargo.toml'],
    fileExtensions: ['.rs'],
    installHint: 'rustup component add rust-analyzer',
  },
};

/**
 * Detect language from a file extension.
 * Returns the language key (e.g., 'typescript') or null if unsupported.
 */
export function detectLanguage(filePath: string): string | null {
  const ext = filePath.substring(filePath.lastIndexOf('.'));
  for (const [language, config] of Object.entries(BUILTIN_SERVERS)) {
    if (config.fileExtensions.includes(ext)) {
      return language;
    }
  }
  return null;
}

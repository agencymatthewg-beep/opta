/**
 * Environment Configuration
 * Loads and validates configuration from environment variables.
 */

export interface Config {
  // Server
  wsPort: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  // LLM
  geminiApiKey: string;
  geminiModel: string;

  // Opta Integration
  optaApiUrl: string;

  // Heartbeat
  heartbeatIntervalMs: number;
  heartbeatTimeoutMs: number;

  // Connections
  maxConnections: number;
  connectionTimeoutMs: number;
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`Invalid integer for ${key}: ${value}`);
  }
  return parsed;
}

function getEnvLogLevel(): Config['logLevel'] {
  const value = process.env.LOG_LEVEL ?? 'info';
  const valid = ['debug', 'info', 'warn', 'error'];
  if (!valid.includes(value)) {
    throw new Error(`Invalid LOG_LEVEL: ${value}. Must be one of: ${valid.join(', ')}`);
  }
  return value as Config['logLevel'];
}

export function loadConfig(): Config {
  return {
    // Server
    wsPort: getEnvInt('WS_PORT', 8080),
    logLevel: getEnvLogLevel(),

    // LLM
    geminiApiKey: getEnv('GEMINI_API_KEY'),
    geminiModel: getEnv('GEMINI_MODEL', 'gemini-2.0-flash'),

    // Opta Integration
    optaApiUrl: getEnv('OPTA_API_URL', 'https://opta-life-manager.vercel.app'),

    // Heartbeat
    heartbeatIntervalMs: getEnvInt('HEARTBEAT_INTERVAL_MS', 30000),
    heartbeatTimeoutMs: getEnvInt('HEARTBEAT_TIMEOUT_MS', 10000),

    // Connections
    maxConnections: getEnvInt('MAX_CONNECTIONS', 100),
    connectionTimeoutMs: getEnvInt('CONNECTION_TIMEOUT_MS', 60000),
  };
}

// Export singleton config (lazy loaded)
let _config: Config | null = null;

export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

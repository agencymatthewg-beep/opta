// @opta/logger — Centralized structured logging for all Opta TypeScript apps.
//
// Usage:
//   import { createLogger } from "@opta/logger";
//   const log = createLogger("auth");
//   log.info("User signed in", { userId: "abc" });
//   log.error("Token expired", { error });
//
// Environment-based log levels:
//   NODE_ENV=development → debug+
//   NODE_ENV=production  → info+
//   OPTA_LOG_LEVEL=warn  → override to warn+

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getMinLevel(): LogLevel {
  const envLevel = (
    typeof process !== "undefined" ? process.env?.OPTA_LOG_LEVEL : undefined
  ) as LogLevel | undefined;

  if (envLevel && envLevel in LEVEL_ORDER) {
    return envLevel;
  }

  const nodeEnv =
    typeof process !== "undefined" ? process.env?.NODE_ENV : undefined;
  return nodeEnv === "production" ? "info" : "debug";
}

export interface LogEntry {
  level: LogLevel;
  component: string;
  message: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  child: (subComponent: string) => Logger;
}

type LogSink = (entry: LogEntry) => void;

// Default sink: structured console output
const consoleSink: LogSink = (entry) => {
  const prefix = `[${entry.component}]`;
  const fn =
    entry.level === "error"
      ? console.error
      : entry.level === "warn"
        ? console.warn
        : entry.level === "debug"
          ? console.debug
          : console.log;

  if (entry.meta && Object.keys(entry.meta).length > 0) {
    fn(prefix, entry.message, entry.meta);
  } else {
    fn(prefix, entry.message);
  }
};

let _sink: LogSink = consoleSink;
let _minLevel: LogLevel = getMinLevel();

/** Override the log sink (for testing, remote logging, etc.) */
export function setLogSink(sink: LogSink): void {
  _sink = sink;
}

/** Override the minimum log level at runtime */
export function setLogLevel(level: LogLevel): void {
  _minLevel = level;
}

/** Reset to default console sink and environment-based level */
export function resetLogger(): void {
  _sink = consoleSink;
  _minLevel = getMinLevel();
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[_minLevel];
}

function emit(
  level: LogLevel,
  component: string,
  message: string,
  meta?: Record<string, unknown>
): void {
  if (!shouldLog(level)) return;

  // Normalize Error objects in meta
  const normalizedMeta = meta ? normalizeErrors(meta) : undefined;

  _sink({
    level,
    component,
    message,
    timestamp: new Date().toISOString(),
    meta: normalizedMeta,
  });
}

function normalizeErrors(
  meta: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value instanceof Error) {
      result[key] = {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Create a logger for a specific component.
 *
 * @param component - Component name shown in log prefix (e.g. "auth", "sync", "api")
 */
export function createLogger(component: string): Logger {
  return {
    debug: (msg, meta) => emit("debug", component, msg, meta),
    info: (msg, meta) => emit("info", component, msg, meta),
    warn: (msg, meta) => emit("warn", component, msg, meta),
    error: (msg, meta) => emit("error", component, msg, meta),
    child: (sub) => createLogger(`${component}:${sub}`),
  };
}

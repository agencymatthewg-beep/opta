#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopRoot = path.resolve(__dirname, "..", "..");
const cliRoot = path.resolve(desktopRoot, "..", "1D-Opta-CLI-TS");

const cliExportScript = path.join(cliRoot, "scripts", "parity", "export-cli-surface.mjs");
const cliSurfacePath = path.join(cliRoot, "docs", "parity", "cli-surface.json");
const desktopSurfacePath = path.join(desktopRoot, "docs", "parity", "desktop-surface.json");

const cliOperationsPagePath = path.join(desktopRoot, "src", "pages", "CliOperationsPage.tsx");
const operationsPagePath = path.join(desktopRoot, "src", "pages", "OperationsPage.tsx");
const sessionTypesPath = path.join(desktopRoot, "src", "types.ts");

const REQUIRED_SESSION_MODES = ["chat", "do", "plan", "review", "research"];
const REQUIRED_SESSION_OVERRIDE_KEYS = [
  "model",
  "provider",
  "dangerous",
  "auto",
  "noCommit",
  "noCheckpoints",
  "format",
];
const REQUIRED_CLI_OPERATION_SCOPES = [
  "doctor",
  "env.*",
  "config.*",
  "account.*",
  "key.*",
  "version.check",
  "completions.generate",
  "daemon.*",
  "mcp.*",
  "serve.*",
  "sessions.*",
  "diff",
  "embed",
  "rerank",
  "benchmark",
  "ceo.benchmark",
  "apps.*",
  "models.*",
  "keychain.*",
];

const COMMAND_STATUS_MAP = {
  chat: { status: "covered", required: true, rationale: "Main session runtime in desktop timeline." },
  tui: {
    status: "adapted",
    required: true,
    rationale: "Desktop replaces terminal TUI; equivalent runtime controls are present.",
  },
  do: { status: "covered", required: true, rationale: "Do mode supported in composer + submit API." },
  embed: { status: "covered", required: true, rationale: "Available through CLI Operations page." },
  rerank: { status: "covered", required: true, rationale: "Available through CLI Operations page." },
  benchmark: { status: "covered", required: true, rationale: "Available through CLI Operations page." },
  apps: {
    status: "covered",
    required: true,
    rationale: "apps.* operations are available through the CLI Operations page.",
  },
  "ceo-bench": {
    status: "adapted",
    required: true,
    rationale: "Autonomy benchmarking is represented through benchmark operations and runtime/autonomy telemetry.",
  },
  status: {
    status: "covered",
    required: true,
    rationale: "Model + daemon status are available in dedicated pages.",
  },
  models: { status: "covered", required: true, rationale: "Dedicated Models page + models.* operations." },
  env: { status: "covered", required: true, rationale: "Dedicated Environment Profiles page (env.*)." },
  config: { status: "covered", required: true, rationale: "Dedicated Config Studio page." },
  account: { status: "covered", required: true, rationale: "Dedicated account controls page." },
  key: { status: "covered", required: true, rationale: "Exposed in account/local key controls." },
  sessions: { status: "covered", required: true, rationale: "Session rail + sessions.* operations." },
  mcp: { status: "covered", required: true, rationale: "Dedicated MCP management page (mcp.*)." },
  memory: {
    status: "adapted",
    required: true,
    rationale: "Session persistence and recovery semantics are represented through timeline + sessions operations.",
  },
  onboard: {
    status: "adapted",
    required: true,
    rationale: "Setup wizard + onboard.apply operation, not full TTY wizard parity.",
  },
  setup: {
    status: "adapted",
    required: true,
    rationale: "Alias handled by setup wizard + onboard.apply operation.",
  },
  init: { status: "covered", required: true, rationale: "init.run available via CLI Operations page." },
  diff: { status: "covered", required: true, rationale: "diff operation available via CLI Operations page." },
  serve: { status: "covered", required: true, rationale: "serve.* operations available via CLI Operations page." },
  update: { status: "covered", required: true, rationale: "update.run available via CLI Operations page." },
  server: {
    status: "adapted",
    required: true,
    rationale: "Legacy server behavior is adapted through daemon lifecycle + serve controls in desktop.",
  },
  daemon: { status: "covered", required: true, rationale: "Dedicated daemon panel + daemon.* operations." },
  doctor: { status: "covered", required: true, rationale: "doctor operation available via CLI Operations page." },
  version: { status: "covered", required: true, rationale: "version.check operation available." },
  completions: {
    status: "covered",
    required: true,
    rationale: "completions.generate available via CLI Operations page.",
  },
  keychain: { status: "covered", required: true, rationale: "keychain.* operations available." },
};

function readUtf8(filePath) {
  return readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readUtf8(filePath));
}

function ensureCliSurface() {
  const result = spawnSync("node", [cliExportScript], {
    cwd: cliRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `Failed to export CLI surface.\n${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim(),
    );
  }
}

function extractStringLiterals(block) {
  return Array.from(block.matchAll(/"([^"]+)"|'([^']+)'/g), (match) => match[1] ?? match[2]).filter(
    Boolean,
  );
}

function parseSessionModes(typesSource) {
  const match = typesSource.match(/export type SessionSubmitMode\s*=\s*([^;]+);/m);
  if (!match) {
    throw new Error("Unable to locate SessionSubmitMode union in src/types.ts");
  }
  return Array.from(new Set(extractStringLiterals(match[1]))).sort();
}

function parseSessionOverrideKeys(typesSource) {
  const match = typesSource.match(
    /export interface SessionTurnOverrides\s*\{(?<body>[\s\S]*?)\}/m,
  );
  if (!match?.groups?.body) {
    throw new Error("Unable to locate SessionTurnOverrides interface in src/types.ts");
  }
  return Array.from(
    new Set(
      Array.from(match.groups.body.matchAll(/^\s*([A-Za-z][A-Za-z0-9_]*)\??\s*:/gm), (entry) =>
        entry[1]?.trim(),
      ).filter(Boolean),
    ),
  ).sort();
}

function parseCliOperationScopes(source) {
  const match = source.match(/const CLI_OPERATION_SCOPES:\s*string\[\]\s*=\s*\[(?<scopes>[\s\S]*?)\];/m);
  if (!match?.groups?.scopes) {
    throw new Error("Unable to locate CLI_OPERATION_SCOPES in CliOperationsPage.tsx");
  }
  return Array.from(new Set(extractStringLiterals(match.groups.scopes))).sort();
}

function wildcardToRegExp(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function commandCoverageFromCli(cliCommands) {
  return cliCommands.map((command) => {
    const mapped = COMMAND_STATUS_MAP[command];
    if (mapped) {
      return {
        command,
        status: mapped.status,
        required: mapped.required,
        rationale: mapped.rationale,
      };
    }
    if (command === "help") {
      return {
        command,
        status: "n/a",
        required: false,
        rationale: "Commander built-in help command.",
      };
    }
    return {
      command,
      status: "missing",
      required: true,
      rationale: "No parity mapping found for this command family.",
    };
  });
}

function computeOperationScopeCoverage(cliOperationIds, scopes) {
  const regexScopes = scopes.map((scope) => ({ scope, regex: wildcardToRegExp(scope) }));
  const unmatched = cliOperationIds.filter((id) => !regexScopes.some(({ regex }) => regex.test(id)));
  return {
    totalCliOperations: cliOperationIds.length,
    scopedMatches: cliOperationIds.length - unmatched.length,
    unmatched,
  };
}

function summarizeStatuses(items, key = "status") {
  const summary = {};
  for (const item of items) {
    const status = item[key];
    summary[status] = (summary[status] ?? 0) + 1;
  }
  return summary;
}

function main() {
  const exportOnly = process.argv.includes("--export-only");

  ensureCliSurface();

  const cliSurface = readJson(cliSurfacePath);
  const sessionTypesSource = readUtf8(sessionTypesPath);
  const cliOpsPageSource = readUtf8(cliOperationsPagePath);
  const operationsPageSource = readUtf8(operationsPagePath);

  const sessionModes = parseSessionModes(sessionTypesSource);
  const sessionOverrideKeys = parseSessionOverrideKeys(sessionTypesSource);
  const cliOperationScopes = parseCliOperationScopes(cliOpsPageSource);
  const commandCoverage = commandCoverageFromCli(cliSurface.commands.topLevel ?? []);
  const operationScopeCoverage = computeOperationScopeCoverage(
    cliSurface.operations.ids ?? [],
    cliOperationScopes,
  );

  const missingRequiredSessionModes = REQUIRED_SESSION_MODES.filter((mode) => !sessionModes.includes(mode));
  const missingRequiredOverrideKeys = REQUIRED_SESSION_OVERRIDE_KEYS.filter(
    (key) => !sessionOverrideKeys.includes(key),
  );
  const missingRequiredScopes = REQUIRED_CLI_OPERATION_SCOPES.filter(
    (scope) => !cliOperationScopes.includes(scope),
  );
  const missingRequiredCommands = commandCoverage
    .filter((entry) => entry.required && entry.status === "missing")
    .map((entry) => entry.command);
  const hasOperationCatalogParitySignal = /OPERATION_IDS/.test(operationsPageSource);

  const requiredFailures = [
    ...missingRequiredSessionModes.map((mode) => `session-mode:${mode}`),
    ...missingRequiredOverrideKeys.map((key) => `session-override:${key}`),
    ...missingRequiredScopes.map((scope) => `cli-scope:${scope}`),
    ...missingRequiredCommands.map((command) => `command:${command}`),
    ...(hasOperationCatalogParitySignal ? [] : ["operations-page:missing-opta-protocol-parity-signal"]),
  ];

  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      desktopRoot,
      cliRoot,
      cliSurfacePath,
      desktopSurfacePath,
    },
    desktop: {
      sessionModes,
      sessionOverrideKeys,
      cliOperationScopes,
      hasOperationCatalogParitySignal,
      commandCoverage,
      commandStatusCounts: summarizeStatuses(commandCoverage),
      operationScopeCoverage,
    },
    checks: {
      requiredSessionModes: REQUIRED_SESSION_MODES,
      requiredSessionOverrideKeys: REQUIRED_SESSION_OVERRIDE_KEYS,
      requiredCliOperationScopes: REQUIRED_CLI_OPERATION_SCOPES,
      missingRequiredSessionModes,
      missingRequiredOverrideKeys,
      missingRequiredScopes,
      missingRequiredCommands,
      requiredFailures,
      pass: requiredFailures.length === 0,
    },
    serverStance: {
      status: "adapted_via_daemon_and_serve",
      rationale:
        "`opta server` runtime behavior is represented in desktop via daemon panel and serve operation controls.",
    },
  };

  mkdirSync(path.dirname(desktopSurfacePath), { recursive: true });
  writeFileSync(desktopSurfacePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const summary = {
    commands: commandCoverage.length,
    requiredFailures: requiredFailures.length,
    missingRequiredSessionModes: missingRequiredSessionModes.length,
    missingRequiredOverrideKeys: missingRequiredOverrideKeys.length,
    missingRequiredScopes: missingRequiredScopes.length,
    missingRequiredCommands: missingRequiredCommands.length,
    unmatchedOperationsOutsideCliScope: operationScopeCoverage.unmatched.length,
  };

  process.stdout.write(
    `${payload.checks.pass ? "PASS" : "FAIL"} parity check -> ${desktopSurfacePath}\n${JSON.stringify(
      summary,
      null,
      2,
    )}\n`,
  );

  if ((summary.unmatchedOperationsOutsideCliScope ?? 0) > 0) {
    process.stderr.write(
      `WARN unmatched operations outside scoped CLI operations: ${operationScopeCoverage.unmatched.join(
        ", ",
      )}\n`,
    );
  }

  const adaptedCommands = commandCoverage
    .filter((entry) => entry.status === "adapted")
    .map((entry) => entry.command);
  if (adaptedCommands.length > 0) {
    process.stderr.write(
      `WARN adapted command families (intentional non-1:1): ${adaptedCommands.join(", ")}\n`,
    );
  }

  if (!exportOnly && requiredFailures.length > 0) {
    process.exit(1);
  }
}

main();

#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const outputPath = path.join(repoRoot, "docs", "parity", "cli-surface.json");
const packageJsonPath = path.join(repoRoot, "package.json");
const indexPath = path.join(repoRoot, "src", "index.ts");
const operationsPath = path.join(repoRoot, "src", "protocol", "v3", "operations.ts");
const modelsIndexPath = path.join(repoRoot, "src", "commands", "models", "index.ts");

function runHelp(args) {
  const runner = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(runner, ["tsx", "src/index.ts", ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `Failed to run help command opta ${args.join(" ")}\n${result.stderr || result.stdout}`,
    );
  }
  return result.stdout;
}

function parseCommandNames(helpText) {
  const commands = [];
  let inCommands = false;
  for (const rawLine of helpText.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!inCommands) {
      if (line.trim() === "Commands:") inCommands = true;
      continue;
    }
    if (!line.trim()) continue;
    if (!rawLine.startsWith("  ")) break;
    const match = rawLine.match(/^\s{2}([a-z0-9][a-z0-9-]*)(?:\s+.+?)?\s{2,}\S/i);
    if (!match) continue;
    const commandName = match[1];
    if (!commandName || commandName === "help" || commandName.startsWith("(")) continue;
    commands.push(commandName);
  }
  return Array.from(new Set(commands)).sort();
}

function extractStringLiterals(block) {
  return Array.from(block.matchAll(/'([^']+)'/g), (match) => match[1]).filter(Boolean);
}

function parseOperationIds(sourceText) {
  const match = sourceText.match(
    /export const OPERATION_IDS = \[(?<ids>[\s\S]*?)\]\s+as const;/m,
  );
  if (!match?.groups?.ids) {
    throw new Error("Unable to locate OPERATION_IDS in operations.ts");
  }
  return Array.from(new Set(extractStringLiterals(match.groups.ids))).sort();
}

function parseModelActions(sourceText) {
  const actions = Array.from(sourceText.matchAll(/case '([^']+)'/g), (m) => m[1]);
  return Array.from(new Set(actions)).sort();
}

function summarizeFamilies(values) {
  const counts = new Map();
  for (const value of values) {
    const family = value.includes(".") ? value.split(".")[0] : value;
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function readSubcommandCatalog() {
  return {
    account: parseCommandNames(runHelp(["account", "--help"])),
    apps: parseCommandNames(runHelp(["apps", "--help"])),
    mcp: parseCommandNames(runHelp(["mcp", "--help"])),
    daemon: parseCommandNames(runHelp(["daemon", "--help"])),
    keychain: parseCommandNames(runHelp(["keychain", "--help"])),
    sessions: parseCommandNames(runHelp(["sessions", "--help"])),
  };
}

function main() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  const topLevelHelp = runHelp(["--help"]);
  const topLevelCommands = parseCommandNames(topLevelHelp);
  const subcommands = readSubcommandCatalog();

  const operationsSource = readFileSync(operationsPath, "utf8");
  const operationIds = parseOperationIds(operationsSource);
  const operationFamilies = summarizeFamilies(operationIds);

  const modelsSource = readFileSync(modelsIndexPath, "utf8");
  const modelActions = parseModelActions(modelsSource);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      root: repoRoot,
      package: packageJson.name,
      version: packageJson.version,
      commandEntry: path.relative(repoRoot, indexPath),
      operationsContract: path.relative(repoRoot, operationsPath),
    },
    commands: {
      topLevel: topLevelCommands,
      families: topLevelCommands,
      subcommands,
      modelActions,
    },
    operations: {
      count: operationIds.length,
      ids: operationIds,
      families: operationFamilies,
    },
  };

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  process.stdout.write(
    `Exported CLI surface to ${outputPath} (${topLevelCommands.length} commands, ${operationIds.length} operations)\n`,
  );
}

main();

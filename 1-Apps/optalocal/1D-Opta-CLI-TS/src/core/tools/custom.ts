import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { debug } from '../debug.js';
import { errorMessage } from '../../utils/errors.js';
import { getToolNames } from './index.js';
import { ALLOWED_ENV_KEYS } from '../../hooks/manager.js';

// --- Custom Tool Definition ---

export interface CustomToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  command: string;
  timeout: number;
}

// Valid tool name: lowercase letters, numbers, underscores only
const VALID_NAME_RE = /^[a-z][a-z0-9_]*$/;

// Max custom tools to prevent token budget explosion
const MAX_CUSTOM_TOOLS = 10;

// --- Load Custom Tools ---

/**
 * Discover custom tools from:
 *  1. .opta/tools/*.json (project-local, higher priority)
 *  2. globalToolsDir (e.g. ~/.config/opta/tools/*.json, lower priority)
 *
 * Project tools override global tools with the same name.
 */
export async function loadCustomTools(
  projectDir: string,
  globalToolsDir?: string
): Promise<CustomToolDef[]> {
  const builtinNames = new Set(getToolNames());
  const seen = new Map<string, CustomToolDef>();

  // Load global tools first (lower priority)
  if (globalToolsDir) {
    const globalTools = await loadToolsFromDir(globalToolsDir, builtinNames);
    for (const tool of globalTools) {
      seen.set(tool.name, tool);
    }
  }

  // Load project tools (higher priority, overwrites globals)
  const projectToolsDir = join(projectDir, '.opta', 'tools');
  const projectTools = await loadToolsFromDir(projectToolsDir, builtinNames);
  for (const tool of projectTools) {
    seen.set(tool.name, tool);
  }

  const tools = [...seen.values()];

  // Enforce max limit
  if (tools.length > MAX_CUSTOM_TOOLS) {
    console.warn(
      `  Warning: ${tools.length} custom tools found, limiting to ${MAX_CUSTOM_TOOLS} (token budget).`
    );
    return tools.slice(0, MAX_CUSTOM_TOOLS);
  }

  return tools;
}

// --- Convert to OpenAI Function Schema ---

export function toToolSchema(tool: CustomToolDef): {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
} {
  return {
    type: 'function',
    function: {
      name: `custom__${tool.name}`,
      description: `[Custom] ${tool.description}`,
      parameters: tool.parameters,
    },
  };
}

// --- Execute Custom Tool ---

export async function executeCustomTool(
  tool: CustomToolDef,
  args: Record<string, unknown>
): Promise<string> {
  const { execa } = await import('execa');

  // Build environment variables from args (filtered allowlist — prevents API key leaks)
  const env: Record<string, string> = {};

  // Only pass safe env vars from the allowlist
  for (const key of ALLOWED_ENV_KEYS) {
    const val = process.env[key];
    if (val !== undefined) env[key] = val;
  }

  // Also pass OPTA_* vars from process.env
  for (const [pKey, pVal] of Object.entries(process.env)) {
    if (pKey.startsWith('OPTA_') && pVal !== undefined) env[pKey] = pVal;
  }

  // Add tool-specific vars
  env.OPTA_TOOL_ARGS = JSON.stringify(args);

  for (const [key, value] of Object.entries(args)) {
    const envKey = `OPTA_TOOL_ARG_${key.toUpperCase()}`;
    env[envKey] = String(value);
  }

  debug(`Custom tool "${tool.name}": ${tool.command}`);

  try {
    const result = await execa('sh', ['-c', tool.command], {
      reject: false,
      timeout: tool.timeout,
      cwd: process.cwd(),
      env,
      extendEnv: false,
    });

    if (result.timedOut) {
      return `Error: Custom tool "${tool.name}" timed out after ${tool.timeout}ms`;
    }

    let output = '';
    if (result.stdout) output += result.stdout;
    if (result.stderr) output += (output ? '\n' : '') + `[stderr] ${result.stderr}`;
    output += `\n[exit code: ${result.exitCode}]`;

    return output;
  } catch (err) {
    const message = errorMessage(err);
    return `Error: Custom tool "${tool.name}" failed — ${message}`;
  }
}

// --- Internal Helpers ---

async function loadToolsFromDir(
  dir: string,
  builtinNames: Set<string>
): Promise<CustomToolDef[]> {
  let entries: string[];
  try {
    const dirEntries = await readdir(dir);
    entries = dirEntries.filter((f) => f.endsWith('.json'));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code !== 'ENOENT') {
      console.error(`Failed to read custom tools directory ${dir}:`, err);
    } else {
      debug(`No custom tools directory at ${dir}`);
    }
    return []; // Directory missing/unreadable
  }

  const tools: CustomToolDef[] = [];
  const seenNames = new Set<string>();

  for (const file of entries.sort()) {
    try {
      const content = await readFile(join(dir, file), 'utf-8');
      const raw = JSON.parse(content) as Record<string, unknown>;

      const tool = validateToolDef(raw, file, builtinNames, seenNames);
      if (tool) {
        seenNames.add(tool.name);
        tools.push(tool);
      }
    } catch (err) {
      const message = errorMessage(err);
      debug(`Skipping custom tool "${file}": ${message}`);
    }
  }

  return tools;
}

function validateToolDef(
  raw: Record<string, unknown>,
  filename: string,
  builtinNames: Set<string>,
  seenNames: Set<string>
): CustomToolDef | null {
  const name = raw['name'];
  const description = raw['description'];
  const parameters = raw['parameters'] as Record<string, unknown> | undefined;
  const command = raw['command'];
  const timeout = raw['timeout'];

  // Required fields
  if (typeof name !== 'string' || !name) {
    debug(`Skipping "${filename}": missing or invalid "name" field`);
    return null;
  }

  if (typeof description !== 'string' || !description) {
    debug(`Skipping "${filename}": missing or invalid "description" field`);
    return null;
  }

  if (typeof command !== 'string' || !command) {
    debug(`Skipping "${filename}": missing or invalid "command" field`);
    return null;
  }

  // Name validation
  if (!VALID_NAME_RE.test(name)) {
    debug(`Skipping "${filename}": invalid name "${name}" (must match ${VALID_NAME_RE})`);
    return null;
  }

  // Conflict with built-in tools
  if (builtinNames.has(name)) {
    debug(`Skipping "${filename}": name "${name}" conflicts with built-in tool`);
    return null;
  }

  // Duplicate within same scope
  if (seenNames.has(name)) {
    debug(`Skipping "${filename}": duplicate name "${name}"`);
    return null;
  }

  // Parameters must be an object-type JSON schema
  if (!parameters || typeof parameters !== 'object' || parameters['type'] !== 'object') {
    debug(`Skipping "${filename}": "parameters" must be a JSON Schema of type "object"`);
    return null;
  }

  // Timeout validation
  const resolvedTimeout = typeof timeout === 'number' && timeout > 0 ? timeout : 30000;
  if (resolvedTimeout > 30000) {
    debug(`Custom tool "${name}" has timeout ${resolvedTimeout}ms (>30s)`);
  }

  return {
    name,
    description,
    parameters,
    command,
    timeout: resolvedTimeout,
  };
}

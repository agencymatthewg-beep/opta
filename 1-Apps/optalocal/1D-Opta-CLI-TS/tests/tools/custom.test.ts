import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { homedir } from 'node:os';

const TEST_DIR = join(tmpdir(), 'opta-custom-tools-' + Date.now());
const PROJECT_TOOLS_DIR = join(TEST_DIR, '.opta', 'tools');

beforeEach(async () => {
  await mkdir(PROJECT_TOOLS_DIR, { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

// Helper: write a valid tool definition
async function writeToolDef(dir: string, filename: string, def: Record<string, unknown>) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), JSON.stringify(def, null, 2));
}

describe('loadCustomTools', () => {
  it('loads tool definitions from .opta/tools/*.json', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    await writeToolDef(PROJECT_TOOLS_DIR, 'deploy.json', {
      name: 'deploy',
      description: 'Deploy to production',
      parameters: {
        type: 'object',
        properties: {
          environment: { type: 'string', description: 'Target environment' },
        },
        required: ['environment'],
      },
      command: 'bash scripts/deploy.sh $OPTA_TOOL_ARG_ENVIRONMENT',
    });

    const tools = await loadCustomTools(TEST_DIR);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe('deploy');
    expect(tools[0]!.description).toBe('Deploy to production');
    expect(tools[0]!.command).toBe('bash scripts/deploy.sh $OPTA_TOOL_ARG_ENVIRONMENT');
  });

  it('loads multiple tool definitions', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    await writeToolDef(PROJECT_TOOLS_DIR, 'lint.json', {
      name: 'lint',
      description: 'Run linter',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'npm run lint',
    });

    await writeToolDef(PROJECT_TOOLS_DIR, 'test.json', {
      name: 'test_suite',
      description: 'Run test suite',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'npm test',
    });

    const tools = await loadCustomTools(TEST_DIR);
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain('lint');
    expect(names).toContain('test_suite');
  });

  it('returns empty array when no tools directory exists', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');
    const emptyDir = join(TEST_DIR, 'empty-project');
    await mkdir(emptyDir, { recursive: true });
    const tools = await loadCustomTools(emptyDir);
    expect(tools).toEqual([]);
  });

  it('sets default timeout of 30000', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    await writeToolDef(PROJECT_TOOLS_DIR, 'quick.json', {
      name: 'quick',
      description: 'Quick command',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'echo hello',
    });

    const tools = await loadCustomTools(TEST_DIR);
    expect(tools[0]!.timeout).toBe(30000);
  });

  it('respects custom timeout', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    await writeToolDef(PROJECT_TOOLS_DIR, 'slow.json', {
      name: 'slow_build',
      description: 'Slow build',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'make build',
      timeout: 60000,
    });

    const tools = await loadCustomTools(TEST_DIR);
    expect(tools[0]!.timeout).toBe(60000);
  });

  it('skips non-JSON files in tools directory', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    await writeFile(join(PROJECT_TOOLS_DIR, 'readme.md'), '# Tools');
    await writeToolDef(PROJECT_TOOLS_DIR, 'valid.json', {
      name: 'valid',
      description: 'Valid tool',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'echo valid',
    });

    const tools = await loadCustomTools(TEST_DIR);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe('valid');
  });

  it('skips malformed JSON files with a warning', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    await writeFile(join(PROJECT_TOOLS_DIR, 'broken.json'), '{ not valid json }}}');
    await writeToolDef(PROJECT_TOOLS_DIR, 'good.json', {
      name: 'good',
      description: 'Good tool',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'echo good',
    });

    const tools = await loadCustomTools(TEST_DIR);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.name).toBe('good');
  });
});

describe('toToolSchema', () => {
  it('converts CustomToolDef to OpenAI function-call schema', async () => {
    const { toToolSchema } = await import('../../src/core/tools/custom.js');

    const schema = toToolSchema({
      name: 'deploy',
      description: 'Deploy to production',
      parameters: {
        type: 'object',
        properties: {
          environment: { type: 'string', description: 'Target environment' },
        },
        required: ['environment'],
      },
      command: 'bash scripts/deploy.sh',
      timeout: 30000,
    });

    expect(schema).toEqual({
      type: 'function',
      function: {
        name: 'custom__deploy',
        description: '[Custom] Deploy to production',
        parameters: {
          type: 'object',
          properties: {
            environment: { type: 'string', description: 'Target environment' },
          },
          required: ['environment'],
        },
      },
    });
  });

  it('prefixes name with custom__ namespace', async () => {
    const { toToolSchema } = await import('../../src/core/tools/custom.js');

    const schema = toToolSchema({
      name: 'my_tool',
      description: 'My tool',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'echo hi',
      timeout: 30000,
    });

    expect(schema.function.name).toBe('custom__my_tool');
  });
});

describe('executeCustomTool', () => {
  it('executes a shell command and returns output', async () => {
    const { executeCustomTool } = await import('../../src/core/tools/custom.js');

    const result = await executeCustomTool(
      {
        name: 'greet',
        description: 'Greet',
        parameters: { type: 'object', properties: {}, required: [] },
        command: 'echo "hello from custom tool"',
        timeout: 30000,
      },
      {}
    );

    expect(result).toContain('hello from custom tool');
    expect(result).toContain('[exit code: 0]');
  });

  it('passes args as environment variables', async () => {
    const { executeCustomTool } = await import('../../src/core/tools/custom.js');

    const result = await executeCustomTool(
      {
        name: 'env_tool',
        description: 'Tool with env',
        parameters: {
          type: 'object',
          properties: {
            target: { type: 'string' },
          },
          required: ['target'],
        },
        command: 'echo "target=$OPTA_TOOL_ARG_TARGET"',
        timeout: 30000,
      },
      { target: 'staging' }
    );

    expect(result).toContain('target=staging');
  });

  it('passes OPTA_TOOL_ARGS as full JSON', async () => {
    const { executeCustomTool } = await import('../../src/core/tools/custom.js');

    const result = await executeCustomTool(
      {
        name: 'json_tool',
        description: 'Tool with JSON args',
        parameters: { type: 'object', properties: {}, required: [] },
        command: 'echo "$OPTA_TOOL_ARGS"',
        timeout: 30000,
      },
      { env: 'prod', count: 3 }
    );

    expect(result).toContain('"env":"prod"');
    expect(result).toContain('"count":3');
  });

  it('uppercases arg names for env vars', async () => {
    const { executeCustomTool } = await import('../../src/core/tools/custom.js');

    const result = await executeCustomTool(
      {
        name: 'upper_tool',
        description: 'Uppercase args',
        parameters: { type: 'object', properties: {}, required: [] },
        command: 'echo "val=$OPTA_TOOL_ARG_MY_VALUE"',
        timeout: 30000,
      },
      { my_value: 'test123' }
    );

    expect(result).toContain('val=test123');
  });

  it('respects timeout and kills slow commands', async () => {
    const { executeCustomTool } = await import('../../src/core/tools/custom.js');

    const result = await executeCustomTool(
      {
        name: 'slow',
        description: 'Slow command',
        parameters: { type: 'object', properties: {}, required: [] },
        command: 'sleep 60',
        timeout: 500,
      },
      {}
    );

    expect(result).toContain('Error');
  }, 10000);

  it('returns stderr output', async () => {
    const { executeCustomTool } = await import('../../src/core/tools/custom.js');

    const result = await executeCustomTool(
      {
        name: 'stderr_tool',
        description: 'Tool with stderr',
        parameters: { type: 'object', properties: {}, required: [] },
        command: 'echo "error message" >&2',
        timeout: 30000,
      },
      {}
    );

    expect(result).toContain('error message');
    expect(result).toContain('[stderr]');
  });

  it('reports non-zero exit codes', async () => {
    const { executeCustomTool } = await import('../../src/core/tools/custom.js');

    const result = await executeCustomTool(
      {
        name: 'fail_tool',
        description: 'Failing tool',
        parameters: { type: 'object', properties: {}, required: [] },
        command: 'exit 42',
        timeout: 30000,
      },
      {}
    );

    expect(result).toContain('[exit code: 42]');
  });
});

describe('validation', () => {
  it('rejects tools with built-in tool names', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    await writeToolDef(PROJECT_TOOLS_DIR, 'read_file.json', {
      name: 'read_file',
      description: 'Override read_file',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'cat file',
    });

    const tools = await loadCustomTools(TEST_DIR);
    expect(tools).toHaveLength(0);
  });

  it('rejects tools missing required fields', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    // Missing 'command' field
    await writeToolDef(PROJECT_TOOLS_DIR, 'bad.json', {
      name: 'bad_tool',
      description: 'Bad tool',
      parameters: { type: 'object', properties: {}, required: [] },
    });

    const tools = await loadCustomTools(TEST_DIR);
    expect(tools).toHaveLength(0);
  });

  it('rejects tools missing name', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    await writeToolDef(PROJECT_TOOLS_DIR, 'noname.json', {
      description: 'No name tool',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'echo hi',
    });

    const tools = await loadCustomTools(TEST_DIR);
    expect(tools).toHaveLength(0);
  });

  it('rejects tools missing description', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    await writeToolDef(PROJECT_TOOLS_DIR, 'nodesc.json', {
      name: 'nodesc',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'echo hi',
    });

    const tools = await loadCustomTools(TEST_DIR);
    expect(tools).toHaveLength(0);
  });

  it('rejects tools with invalid parameters schema (not an object type)', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    await writeToolDef(PROJECT_TOOLS_DIR, 'bad_params.json', {
      name: 'bad_params',
      description: 'Bad params',
      parameters: { type: 'string' },
      command: 'echo hi',
    });

    const tools = await loadCustomTools(TEST_DIR);
    expect(tools).toHaveLength(0);
  });

  it('enforces max 10 custom tools', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    for (let i = 0; i < 12; i++) {
      await writeToolDef(PROJECT_TOOLS_DIR, `tool_${i}.json`, {
        name: `custom_tool_${i}`,
        description: `Tool number ${i}`,
        parameters: { type: 'object', properties: {}, required: [] },
        command: `echo ${i}`,
      });
    }

    const tools = await loadCustomTools(TEST_DIR);
    expect(tools).toHaveLength(10);
  });

  it('rejects duplicate tool names', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    await writeToolDef(PROJECT_TOOLS_DIR, 'tool_a.json', {
      name: 'same_name',
      description: 'First tool',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'echo first',
    });

    await writeToolDef(PROJECT_TOOLS_DIR, 'tool_b.json', {
      name: 'same_name',
      description: 'Second tool',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'echo second',
    });

    const tools = await loadCustomTools(TEST_DIR);
    expect(tools).toHaveLength(1);
  });

  it('rejects tool names with invalid characters', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    await writeToolDef(PROJECT_TOOLS_DIR, 'bad-name.json', {
      name: 'tool with spaces',
      description: 'Bad name',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'echo hi',
    });

    const tools = await loadCustomTools(TEST_DIR);
    expect(tools).toHaveLength(0);
  });
});

describe('global tools', () => {
  it('loads tools from global config directory as well', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    const globalToolsDir = join(TEST_DIR, 'global-config', 'opta', 'tools');
    await writeToolDef(globalToolsDir, 'global_tool.json', {
      name: 'global_tool',
      description: 'A global tool',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'echo global',
    });

    await writeToolDef(PROJECT_TOOLS_DIR, 'local_tool.json', {
      name: 'local_tool',
      description: 'A local tool',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'echo local',
    });

    const tools = await loadCustomTools(TEST_DIR, globalToolsDir);
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain('global_tool');
    expect(names).toContain('local_tool');
  });

  it('project tools override global tools with same name', async () => {
    const { loadCustomTools } = await import('../../src/core/tools/custom.js');

    const globalToolsDir = join(TEST_DIR, 'global-config', 'opta', 'tools');
    await writeToolDef(globalToolsDir, 'deploy.json', {
      name: 'deploy',
      description: 'Global deploy',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'echo global-deploy',
    });

    await writeToolDef(PROJECT_TOOLS_DIR, 'deploy.json', {
      name: 'deploy',
      description: 'Project deploy',
      parameters: { type: 'object', properties: {}, required: [] },
      command: 'echo project-deploy',
    });

    const tools = await loadCustomTools(TEST_DIR, globalToolsDir);
    expect(tools).toHaveLength(1);
    expect(tools[0]!.description).toBe('Project deploy');
    expect(tools[0]!.command).toBe('echo project-deploy');
  });
});

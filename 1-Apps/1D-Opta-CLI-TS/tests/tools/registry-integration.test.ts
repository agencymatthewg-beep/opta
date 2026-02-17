import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock the MCP client
vi.mock('../../src/mcp/client.js', () => ({
  connectMcpServer: vi.fn().mockResolvedValue({
    name: 'test',
    tools: [],
    call: vi.fn(),
    close: vi.fn(),
  }),
}));

const TEST_DIR = join(tmpdir(), 'opta-registry-custom-' + Date.now());

beforeEach(async () => {
  await mkdir(join(TEST_DIR, '.opta', 'tools'), { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('Custom tools in registry', () => {
  it('includes custom tool schemas in the registry', async () => {
    // Write a custom tool
    await writeFile(
      join(TEST_DIR, '.opta', 'tools', 'deploy.json'),
      JSON.stringify({
        name: 'deploy',
        description: 'Deploy the project',
        parameters: {
          type: 'object',
          properties: {
            env: { type: 'string', description: 'Environment' },
          },
          required: ['env'],
        },
        command: 'echo deploying to $OPTA_TOOL_ARG_ENV',
      })
    );

    const { buildToolRegistry } = await import('../../src/mcp/registry.js');
    const originalCwd = process.cwd();
    try {
      process.chdir(TEST_DIR);
      const registry = await buildToolRegistry({
        mcp: { servers: {} },
      } as any);

      const names = registry.schemas.map((s: any) => s.function.name);
      expect(names).toContain('custom__deploy');

      // Verify the schema details
      const deploySchema = registry.schemas.find(
        (s: any) => s.function.name === 'custom__deploy'
      ) as any;
      expect(deploySchema).toBeDefined();
      expect(deploySchema.function.description).toContain('[Custom]');
      expect(deploySchema.function.description).toContain('Deploy the project');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('executes custom tools through the registry', async () => {
    await writeFile(
      join(TEST_DIR, '.opta', 'tools', 'hello.json'),
      JSON.stringify({
        name: 'hello',
        description: 'Say hello',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
        command: 'echo "Hello, $OPTA_TOOL_ARG_NAME"',
      })
    );

    const { buildToolRegistry } = await import('../../src/mcp/registry.js');
    const originalCwd = process.cwd();
    try {
      process.chdir(TEST_DIR);
      const registry = await buildToolRegistry({
        mcp: { servers: {} },
      } as any);

      const result = await registry.execute(
        'custom__hello',
        JSON.stringify({ name: 'World' })
      );
      expect(result).toContain('Hello, World');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('returns error for unknown custom tool', async () => {
    const { buildToolRegistry } = await import('../../src/mcp/registry.js');
    const originalCwd = process.cwd();
    try {
      process.chdir(TEST_DIR);
      const registry = await buildToolRegistry({
        mcp: { servers: {} },
      } as any);

      const result = await registry.execute(
        'custom__nonexistent',
        JSON.stringify({})
      );
      expect(result).toContain('Error');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('custom tools are excluded in plan mode (they run commands)', async () => {
    await writeFile(
      join(TEST_DIR, '.opta', 'tools', 'build.json'),
      JSON.stringify({
        name: 'build',
        description: 'Build the project',
        parameters: { type: 'object', properties: {}, required: [] },
        command: 'npm run build',
      })
    );

    const { buildToolRegistry } = await import('../../src/mcp/registry.js');
    const originalCwd = process.cwd();
    try {
      process.chdir(TEST_DIR);
      const registry = await buildToolRegistry({
        mcp: { servers: {} },
      } as any, 'plan');

      const names = registry.schemas.map((s: any) => s.function.name);
      expect(names).not.toContain('custom__build');
    } finally {
      process.chdir(originalCwd);
    }
  });
});

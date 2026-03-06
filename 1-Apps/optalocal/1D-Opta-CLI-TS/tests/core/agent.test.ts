import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildSystemPrompt,
  shouldForceFinalReassessmentPass,
  sanitizeToolProtocolMessages,
} from '../../src/core/agent.js';
import type { AgentMessage } from '../../src/core/agent.js';
import { resolveToolDecisions } from '../../src/core/agent-permissions.js';
import { filterToolsForMode } from '../../src/core/agent-profiles.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';
import { createHookManager } from '../../src/hooks/integration.js';

const TEST_DIR = join(tmpdir(), 'opta-agent-test-' + Date.now());

beforeEach(async () => {
  await mkdir(join(TEST_DIR, 'docs'), { recursive: true });
  await mkdir(join(TEST_DIR, 'src'), { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('buildSystemPrompt', () => {
  it('includes base instructions and working directory', async () => {
    const prompt = await buildSystemPrompt(DEFAULT_CONFIG, TEST_DIR);
    expect(prompt).toContain('Opta');
    expect(prompt).toContain('coding');
    expect(prompt).toContain(TEST_DIR);
    expect(prompt).toContain('never emit pseudo tool tags');
  });

  it('includes OPIS summary when APP.md exists', async () => {
    await writeFile(join(TEST_DIR, 'APP.md'), `---
title: My CLI Tool
type: cli
status: active
---
## Purpose
A test CLI application.
`);

    const prompt = await buildSystemPrompt(DEFAULT_CONFIG, TEST_DIR);
    expect(prompt).toContain('My CLI Tool');
    expect(prompt).toContain('cli');
    expect(prompt).toContain('Available docs');
  });

  it('includes export map when source files exist', async () => {
    await writeFile(join(TEST_DIR, 'src', 'main.ts'), `export function start() {}
export const VERSION = "1.0";
`);

    const { execa } = await import('execa');
    await execa('git', ['init'], { cwd: TEST_DIR });
    await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: TEST_DIR });
    await execa('git', ['config', 'user.name', 'Test'], { cwd: TEST_DIR });
    await execa('git', ['add', '-A'], { cwd: TEST_DIR });
    await execa('git', ['commit', '-m', 'init'], { cwd: TEST_DIR });

    const prompt = await buildSystemPrompt(DEFAULT_CONFIG, TEST_DIR);
    expect(prompt).toContain('Repository Map (Symbols):');
    expect(prompt).toContain('start');
    expect(prompt).toContain('VERSION');
    expect(prompt).toContain('main.ts (symbols: start, VERSION)');
  });

  it('includes fallback memory when no OPIS scaffold', async () => {
    await mkdir(join(TEST_DIR, '.opta'), { recursive: true });
    await writeFile(join(TEST_DIR, '.opta', 'memory.md'), 'Legacy project memory content');

    const prompt = await buildSystemPrompt(DEFAULT_CONFIG, TEST_DIR);
    expect(prompt).toContain('Legacy project memory content');
  });

  it('suggests opta init when no context available', async () => {
    const prompt = await buildSystemPrompt(DEFAULT_CONFIG, TEST_DIR);
    expect(prompt).toContain('opta init');
  });

  it('includes dirty working tree warning for dirty git repos', async () => {
    // Create a git repo and make it dirty
    const { execa } = await import('execa');
    await execa('git', ['init'], { cwd: TEST_DIR });
    await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: TEST_DIR });
    await execa('git', ['config', 'user.name', 'Test'], { cwd: TEST_DIR });
    await writeFile(join(TEST_DIR, 'initial.txt'), 'initial');
    await execa('git', ['add', '-A'], { cwd: TEST_DIR });
    await execa('git', ['commit', '-m', 'init'], { cwd: TEST_DIR });

    // Make dirty
    await writeFile(join(TEST_DIR, 'dirty.txt'), 'uncommitted');

    const prompt = await buildSystemPrompt(DEFAULT_CONFIG, TEST_DIR);
    expect(prompt).toContain('uncommitted changes');
  });

  it('does not include dirty warning for clean git repos', async () => {
    const { execa } = await import('execa');
    await execa('git', ['init'], { cwd: TEST_DIR });
    await execa('git', ['config', 'user.email', 'test@test.com'], { cwd: TEST_DIR });
    await execa('git', ['config', 'user.name', 'Test'], { cwd: TEST_DIR });
    await writeFile(join(TEST_DIR, 'initial.txt'), 'initial');
    await execa('git', ['add', '-A'], { cwd: TEST_DIR });
    await execa('git', ['commit', '-m', 'init'], { cwd: TEST_DIR });

    const prompt = await buildSystemPrompt(DEFAULT_CONFIG, TEST_DIR);
    expect(prompt).not.toContain('uncommitted changes');
  });

  it('does not include dirty warning for non-git directories', async () => {
    const prompt = await buildSystemPrompt(DEFAULT_CONFIG, TEST_DIR);
    expect(prompt).not.toContain('uncommitted changes');
  });

  it('injects runtime capability manifest with active tool context', async () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.browser.enabled = true;

    const prompt = await buildSystemPrompt(config, TEST_DIR, 'research', {
      profile: 'researcher',
      activeToolSchemas: [
        { function: { name: 'read_file' } },
        { function: { name: 'web_search' } },
        { function: { name: 'web_fetch' } },
        { function: { name: 'save_memory' } },
      ],
    });

    expect(prompt).toContain('Active capabilities:');
    expect(prompt).toContain('mode=research');
    expect(prompt).toContain('profile=researcher');
    expect(prompt).toContain('research: on');
    expect(prompt).toContain('browser: on');
    expect(prompt).toContain('learning: on');
    expect(prompt).toContain('policy: on');
  });
});

describe('agentLoop tool registry integration', () => {
  it('uses buildToolRegistry from mcp/registry', async () => {
    const agentSource = await readFile(resolve(process.cwd(), 'src/core/agent.ts'), 'utf-8');
    const execSource = await readFile(resolve(process.cwd(), 'src/core/agent-execution.ts'), 'utf-8');
    // agent.ts builds the registry and closes it
    expect(agentSource).toContain('buildToolRegistry');
    expect(agentSource).toContain('registry.close');
    // agent-execution.ts calls registry.execute
    expect(execSource).toContain('registry.execute');
  });

  it('does not import TOOL_SCHEMAS or executeTool from tools.js', async () => {
    const agentSource = await readFile(resolve(process.cwd(), 'src/core/agent.ts'), 'utf-8');
    const permSource = await readFile(resolve(process.cwd(), 'src/core/agent-permissions.ts'), 'utf-8');
    // resolvePermission is used in the permissions module
    expect(permSource).toContain("import { resolvePermission } from './tools/index.js'");
    // Neither agent.ts nor agent-permissions.ts should import TOOL_SCHEMAS or executeTool from tools.js
    const combined = agentSource + permSource;
    expect(combined).not.toMatch(/import\s*\{[^}]*TOOL_SCHEMAS[^}]*\}\s*from\s*['"]\.\/tools/);
    expect(combined).not.toMatch(/import\s*\{[^}]*executeTool[^}]*\}\s*from\s*['"]\.\/tools/);
  });

  it('filters tools by mode and injects runtime capability manifest', async () => {
    const agentSource = await readFile(resolve(process.cwd(), 'src/core/agent.ts'), 'utf-8');
    expect(agentSource).toContain('filterToolsForMode');
    expect(agentSource).toContain('buildCapabilityManifest');
    expect(agentSource).toContain('injectCapabilityManifest');
    expect(agentSource).toContain('readToolCompatibilityEntry');
    expect(agentSource).toContain('buildToolCompatibilityInstruction');
    expect(agentSource).toContain('recordToolCompatibilityEvent');
  });

  it('guards against pseudo tool protocol responses', async () => {
    const agentSource = await readFile(resolve(process.cwd(), 'src/core/agent.ts'), 'utf-8');
    expect(agentSource).toContain('detectPseudoToolMarkup');
    expect(agentSource).toContain('buildPseudoToolCorrectionMessage');
    expect(agentSource).toContain('if (toolCalls.length === 0 && text)');
    expect(agentSource).not.toContain("toolCalls.length === 0 && text && text.includes('<')");
  });

  it('enforces autonomy checkpoints, final reassessment pass, and ceo report logging', async () => {
    const agentSource = await readFile(resolve(process.cwd(), 'src/core/agent.ts'), 'utf-8');
    expect(agentSource).toContain('buildAutonomyStageCheckpointGuidance');
    expect(agentSource).toContain('shouldForceFinalReassessmentPass');
    expect(agentSource).toContain('Autonomy checkpoint: forcing final review/reassessment pass before completion.');
    expect(agentSource).toContain('buildCeoAutonomyReport');
    expect(agentSource).toContain("import('../journal/update-log.js')");
  });
});

describe('final reassessment gate helper', () => {
  it('forces a final pass only for autonomy level >=3 with objective reassessment enabled', () => {
    expect(shouldForceFinalReassessmentPass({
      autonomyLevel: 3,
      objectiveReassessmentEnabled: true,
      alreadyForcedFinalPass: false,
    })).toBe(true);

    expect(shouldForceFinalReassessmentPass({
      autonomyLevel: 2,
      objectiveReassessmentEnabled: true,
      alreadyForcedFinalPass: false,
    })).toBe(false);

    expect(shouldForceFinalReassessmentPass({
      autonomyLevel: 4,
      objectiveReassessmentEnabled: false,
      alreadyForcedFinalPass: false,
    })).toBe(false);

    expect(shouldForceFinalReassessmentPass({
      autonomyLevel: 5,
      objectiveReassessmentEnabled: true,
      alreadyForcedFinalPass: true,
    })).toBe(false);
  });
});

describe('tool protocol sanitization', () => {
  it('drops orphan tool messages without a matching assistant tool-call block', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'task' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'tc-1',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"README.md"}' },
          },
        ],
      },
      { role: 'tool', content: 'README', tool_call_id: 'tc-1' },
      { role: 'assistant', content: 'done' },
      { role: 'tool', content: 'orphan', tool_call_id: 'missing' },
    ];

    const sanitized = sanitizeToolProtocolMessages(messages);

    expect(sanitized.changed).toBe(true);
    expect(sanitized.droppedToolMessages).toBe(1);
    expect(
      sanitized.messages.some((m) => m.role === 'tool' && m.tool_call_id === 'missing')
    ).toBe(false);
  });

  it('repairs partially preserved tool-call blocks by trimming missing call ids', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'task' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'tc-1',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"a.ts"}' },
          },
          {
            id: 'tc-2',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"b.ts"}' },
          },
        ],
      },
      { role: 'tool', content: 'B', tool_call_id: 'tc-2' },
      { role: 'assistant', content: 'next turn' },
    ];

    const sanitized = sanitizeToolProtocolMessages(messages);

    expect(sanitized.changed).toBe(true);
    expect(sanitized.repairedAssistantMessages).toBe(1);
    const assistant = sanitized.messages.find(
      (m) => m.role === 'assistant' && Array.isArray(m.tool_calls)
    );
    expect(assistant?.tool_calls?.map((tc) => tc.id)).toEqual(['tc-2']);
  });

  it('removes empty dangling assistant tool-call blocks with null content', () => {
    const messages: AgentMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'task' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [
          {
            id: 'tc-1',
            type: 'function',
            function: { name: 'read_file', arguments: '{"path":"a.ts"}' },
          },
        ],
      },
      { role: 'user', content: 'follow-up' },
    ];

    const sanitized = sanitizeToolProtocolMessages(messages);

    expect(sanitized.changed).toBe(true);
    expect(sanitized.removedAssistantMessages).toBe(1);
    expect(
      sanitized.messages.some((m) => m.role === 'assistant' && Array.isArray(m.tool_calls))
    ).toBe(false);
  });
});

describe('mode-aware tool filtering', () => {
  const schemas = [
    { function: { name: 'read_file' } },
    { function: { name: 'web_search' } },
    { function: { name: 'run_command' } },
    { function: { name: 'edit_file' } },
    { function: { name: 'save_memory' } },
    { function: { name: 'lsp_rename' } },
    { function: { name: 'custom__danger' } },
  ];

  it('prunes plan mode to read-only safe tools', () => {
    const names = filterToolsForMode(schemas, 'plan').map((schema) => schema.function.name);
    expect(names).toEqual(['read_file', 'web_search']);
  });

  it('keeps research shell/web tools while removing write pathways', () => {
    const names = filterToolsForMode(schemas, 'research').map((schema) => schema.function.name);
    expect(names).toEqual([
      'read_file',
      'web_search',
      'run_command',
      'save_memory',
      'custom__danger',
    ]);
  });
});

describe('policy engine integration in resolveToolDecisions', () => {
  it('maps degraded-safe failure mode into policy engine accepted values', async () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.policy.failureMode = 'degraded-safe';
    config.policy.gateAllAutonomy = false;
    config.policy.audit.enabled = false;

    const decisions = await resolveToolDecisions(
      [{ id: 'call-1', name: 'read_file', args: '{"path":"README.md"}' }],
      config,
      {
        isSubAgent: false,
        silent: true,
        saveConfig: async () => {},
        hooks: createHookManager({ hooks: [] }),
        sessionCtx: {
          sessionId: 'session-test',
          cwd: TEST_DIR,
          model: config.model.default,
        },
      },
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.approved).toBe(true);
  });

  it('routes policy gate decisions through approval callbacks', async () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.policy.gateAllAutonomy = true;
    config.policy.audit.enabled = false;
    let promptCount = 0;

    const decisions = await resolveToolDecisions(
      [{ id: 'call-1', name: 'read_file', args: '{"path":"README.md"}' }],
      config,
      {
        isSubAgent: false,
        silent: true,
        saveConfig: async () => {},
        streamCallbacks: {
          onPermissionRequest: async () => {
            promptCount += 1;
            return 'deny';
          },
        },
        hooks: createHookManager({ hooks: [] }),
        sessionCtx: {
          sessionId: 'session-test',
          cwd: TEST_DIR,
          model: config.model.default,
        },
      },
    );

    expect(promptCount).toBe(1);
    expect(decisions[0]?.approved).toBe(false);
    expect(decisions[0]?.denialReason).toContain('User declined');
  });

  it('bypasses gate-all policy prompts in dangerous mode', async () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.defaultMode = 'dangerous';
    config.autonomy.level = 3; // Autonomy >= 3 needed to allow destructive tools without floor override
    config.policy.gateAllAutonomy = true;
    config.policy.audit.enabled = false;

    const decisions = await resolveToolDecisions(
      [{ id: 'call-1', name: 'run_command', args: '{"command":"echo ok"}' }],
      config,
      {
        isSubAgent: false,
        silent: true,
        saveConfig: async () => {},
        hooks: createHookManager({ hooks: [] }),
        sessionCtx: {
          sessionId: 'session-test',
          cwd: TEST_DIR,
          model: config.model.default,
        },
      },
    );

    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.approved).toBe(true);
  });
});

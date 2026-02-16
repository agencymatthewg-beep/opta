import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildSystemPrompt } from '../../src/core/agent.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

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

    const prompt = await buildSystemPrompt(DEFAULT_CONFIG, TEST_DIR);
    expect(prompt).toContain('Codebase exports:');
    expect(prompt).toContain('start');
    expect(prompt).toContain('VERSION');
    expect(prompt).toContain('src/main.ts');
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
});

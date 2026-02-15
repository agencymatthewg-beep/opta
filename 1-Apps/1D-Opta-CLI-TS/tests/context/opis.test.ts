import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadOpisContext, readProjectDoc } from '../../src/context/opis.js';

const TEST_DIR = join(tmpdir(), 'opta-opis-test-' + Date.now());

beforeEach(async () => {
  await mkdir(TEST_DIR, { recursive: true });
  await mkdir(join(TEST_DIR, 'docs'), { recursive: true });
  await mkdir(join(TEST_DIR, '.opta'), { recursive: true });
});

afterEach(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe('loadOpisContext', () => {
  it('returns hasOpis=true when APP.md exists — summary contains title, type, and guardrails', async () => {
    // Create APP.md with YAML frontmatter
    await writeFile(
      join(TEST_DIR, 'APP.md'),
      [
        '---',
        'title: My Test App',
        'type: CLI tool',
        'status: BETA',
        '---',
        '',
        '# My Test App',
        '',
        'This app does amazing things for developers.',
      ].join('\n'),
    );

    // Create GUARDRAILS.md with rules
    await writeFile(
      join(TEST_DIR, 'docs', 'GUARDRAILS.md'),
      [
        '# Guardrails',
        '',
        '- G-01: Never delete user data without confirmation',
        '- G-02: Always validate inputs before processing',
        '- G-03: No network calls without explicit user opt-in',
      ].join('\n'),
    );

    const ctx = await loadOpisContext(TEST_DIR);

    expect(ctx.hasOpis).toBe(true);
    expect(ctx.summary).toContain('My Test App');
    expect(ctx.summary).toContain('CLI tool');
    expect(ctx.summary).toContain('G-01');
    expect(ctx.summary).toContain('G-02');
  });

  it('returns hasOpis=false when no APP.md', async () => {
    const ctx = await loadOpisContext(TEST_DIR);
    expect(ctx.hasOpis).toBe(false);
  });

  it('falls back to .opta/memory.md when no OPIS scaffold', async () => {
    await writeFile(
      join(TEST_DIR, '.opta', 'memory.md'),
      'This project uses React and TypeScript.',
    );

    const ctx = await loadOpisContext(TEST_DIR);

    expect(ctx.hasOpis).toBe(false);
    expect(ctx.fallbackMemory).toContain('React and TypeScript');
  });

  it('falls back to CLAUDE.md when no OPIS and no memory.md', async () => {
    await writeFile(
      join(TEST_DIR, 'CLAUDE.md'),
      '# Project Guide\n\nThis is a legacy project guide.',
    );

    const ctx = await loadOpisContext(TEST_DIR);

    expect(ctx.hasOpis).toBe(false);
    expect(ctx.fallbackMemory).toContain('legacy project guide');
  });

  it('handles APP.md without YAML frontmatter gracefully', async () => {
    await writeFile(
      join(TEST_DIR, 'APP.md'),
      [
        '# My App Without Frontmatter',
        '',
        'This is a plain markdown app doc with no YAML header.',
      ].join('\n'),
    );

    const ctx = await loadOpisContext(TEST_DIR);

    expect(ctx.hasOpis).toBe(true);
    // Should still produce a summary even without frontmatter
    expect(ctx.summary).toBeTruthy();
    expect(ctx.summary.length).toBeGreaterThan(0);
  });

  it('includes recent decisions from DECISIONS.md', async () => {
    await writeFile(
      join(TEST_DIR, 'APP.md'),
      [
        '---',
        'title: Decision App',
        'type: Web app',
        '---',
        '',
        '# Decision App',
        '',
        'An app with decisions.',
      ].join('\n'),
    );

    await writeFile(
      join(TEST_DIR, 'docs', 'DECISIONS.md'),
      [
        '# Decisions',
        '',
        '## D-01: Use TypeScript',
        'We chose TypeScript.',
        '',
        '## D-02: Use ESM',
        'ESM is the future.',
        '',
        '## D-03: Use Vitest',
        'Vitest is fast.',
        '',
        '## D-04: No ORM',
        'Direct SQL is simpler.',
        '',
        '## D-05: Use Zod',
        'Runtime validation.',
        '',
        '## D-06: Commander for CLI',
        'Best CLI framework.',
      ].join('\n'),
    );

    const ctx = await loadOpisContext(TEST_DIR);

    // Should include last 5 decisions (D-02 through D-06)
    expect(ctx.summary).toContain('D-02');
    expect(ctx.summary).toContain('D-06');
  });

  it('lists available docs in summary footer', async () => {
    await writeFile(join(TEST_DIR, 'APP.md'), '---\ntitle: Docs App\ntype: tool\n---\n# App\nAn app.');
    await writeFile(join(TEST_DIR, 'docs', 'GUARDRAILS.md'), '# Guardrails\n- G-01: Be safe');
    await writeFile(join(TEST_DIR, 'docs', 'KNOWLEDGE.md'), '# Knowledge\nSome knowledge.');

    const ctx = await loadOpisContext(TEST_DIR);

    expect(ctx.summary).toContain('GUARDRAILS.md');
    expect(ctx.summary).toContain('KNOWLEDGE.md');
  });

  it('sets docsDir to the docs/ subdirectory path', async () => {
    await writeFile(join(TEST_DIR, 'APP.md'), '---\ntitle: App\ntype: tool\n---\n# App\nAn app.');

    const ctx = await loadOpisContext(TEST_DIR);

    expect(ctx.docsDir).toBe(join(TEST_DIR, 'docs'));
  });
});

describe('readProjectDoc', () => {
  it('reads from docs/ directory', async () => {
    await writeFile(
      join(TEST_DIR, 'docs', 'GUARDRAILS.md'),
      '# Guardrails\n\nThese are the guardrails.',
    );

    const content = await readProjectDoc(TEST_DIR, 'GUARDRAILS.md');

    expect(content).toContain('These are the guardrails');
  });

  it('reads APP.md from project root', async () => {
    await writeFile(
      join(TEST_DIR, 'APP.md'),
      '---\ntitle: Root App\n---\n# Root App\n\nFound at root.',
    );

    const content = await readProjectDoc(TEST_DIR, 'APP.md');

    expect(content).toContain('Found at root');
  });

  it('returns helpful message when file not found (mentions opta init)', async () => {
    const content = await readProjectDoc(TEST_DIR, 'ARCHITECTURE.md');

    expect(content).toContain('not found');
    expect(content).toContain('opta init');
  });

  it('prefers docs/ over root for non-APP.md files', async () => {
    // Put file in both locations
    await writeFile(join(TEST_DIR, 'GUARDRAILS.md'), 'Root version');
    await writeFile(join(TEST_DIR, 'docs', 'GUARDRAILS.md'), 'Docs version');

    const content = await readProjectDoc(TEST_DIR, 'GUARDRAILS.md');

    expect(content).toContain('Docs version');
  });
});

import { describe, it, expect } from 'vitest';
import { renderGlassReport, escapeHtml, type ReportSection } from '../../src/ui/html-report.js';

describe('escapeHtml', () => {
  it('escapes all HTML special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands and single quotes', () => {
    expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#39;s');
  });

  it('passes through safe strings unchanged', () => {
    expect(escapeHtml('Hello World 123')).toBe('Hello World 123');
  });
});

describe('renderGlassReport', () => {
  it('produces a complete HTML document', () => {
    const html = renderGlassReport({
      title: 'Test Report',
      sections: [],
    });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<title>Test Report — Opta</title>');
    expect(html).toContain('opta-container');
    expect(html).toContain('</html>');
  });

  it('includes badge when provided', () => {
    const html = renderGlassReport({
      title: 'T',
      badge: 'Session Report',
      sections: [],
    });

    expect(html).toContain('opta-badge');
    expect(html).toContain('Session Report');
  });

  it('includes subtitle when provided', () => {
    const html = renderGlassReport({
      title: 'T',
      subtitle: '42 tool calls in 3m',
      sections: [],
    });

    expect(html).toContain('opta-subtitle');
    expect(html).toContain('42 tool calls in 3m');
  });

  it('renders stats-grid sections', () => {
    const sections: ReportSection[] = [
      {
        type: 'stats-grid',
        items: [
          { value: '42', label: 'Tool Calls' },
          { value: '3m 12s', label: 'Duration' },
        ],
      },
    ];

    const html = renderGlassReport({ title: 'T', sections });
    expect(html).toContain('opta-stats');
    expect(html).toContain('42');
    expect(html).toContain('Tool Calls');
    expect(html).toContain('3m 12s');
    expect(html).toContain('Duration');
  });

  it('renders key-value sections', () => {
    const sections: ReportSection[] = [
      {
        type: 'key-value',
        pairs: [
          { key: 'Model', value: 'llama-3-8b' },
          { key: 'Status', value: 'Complete', color: 'c-green' },
        ],
      },
    ];

    const html = renderGlassReport({ title: 'T', sections });
    expect(html).toContain('opta-kv');
    expect(html).toContain('Model');
    expect(html).toContain('llama-3-8b');
    expect(html).toContain('c-green');
  });

  it('renders table sections', () => {
    const sections: ReportSection[] = [
      {
        type: 'table',
        headers: ['Name', 'Count'],
        rows: [['read_file', '15'], ['edit_file', '8']],
      },
    ];

    const html = renderGlassReport({ title: 'T', sections });
    expect(html).toContain('opta-table');
    expect(html).toContain('Name');
    expect(html).toContain('read_file');
    expect(html).toContain('15');
  });

  it('renders timeline sections', () => {
    const sections: ReportSection[] = [
      {
        type: 'timeline',
        events: [
          { time: '#1', label: 'read_file', detail: 'src/main.ts', color: 'var(--neon-blue)' },
          { time: '#2', label: 'edit_file' },
        ],
      },
    ];

    const html = renderGlassReport({ title: 'T', sections });
    expect(html).toContain('opta-timeline');
    expect(html).toContain('#1');
    expect(html).toContain('read_file');
    expect(html).toContain('src/main.ts');
  });

  it('renders file-changes sections', () => {
    const sections: ReportSection[] = [
      {
        type: 'file-changes',
        created: ['src/new.ts'],
        modified: ['src/old.ts'],
        deleted: [],
      },
    ];

    const html = renderGlassReport({ title: 'T', sections });
    expect(html).toContain('opta-files');
    expect(html).toContain('Created (1)');
    expect(html).toContain('src/new.ts');
    expect(html).toContain('Modified (1)');
    expect(html).toContain('Deleted (0)');
  });

  it('renders card-grid sections', () => {
    const sections: ReportSection[] = [
      {
        type: 'card-grid',
        cards: [
          { title: 'Task A', description: 'Do stuff', status: 'DONE', statusColor: 'green', tags: ['core'] },
        ],
      },
    ];

    const html = renderGlassReport({ title: 'T', sections });
    expect(html).toContain('opta-cards');
    expect(html).toContain('Task A');
    expect(html).toContain('DONE');
    expect(html).toContain('green');
    expect(html).toContain('core');
  });

  it('renders list sections with bullet style', () => {
    const sections: ReportSection[] = [
      { type: 'list', title: 'Decisions', items: ['Use LMX', 'Skip cache'], style: 'bullet' },
    ];

    const html = renderGlassReport({ title: 'T', sections });
    expect(html).toContain('opta-list');
    expect(html).toContain('Decisions');
    expect(html).toContain('Use LMX');
  });

  it('renders list sections with check style', () => {
    const sections: ReportSection[] = [
      { type: 'list', items: ['Passed'], style: 'check' },
    ];

    const html = renderGlassReport({ title: 'T', sections });
    expect(html).toContain('check');
  });

  it('renders list sections with numbered style', () => {
    const sections: ReportSection[] = [
      { type: 'list', items: ['First', 'Second'], style: 'numbered' },
    ];

    const html = renderGlassReport({ title: 'T', sections });
    expect(html).toContain('numbered');
    expect(html).toContain('data-n="1"');
    expect(html).toContain('data-n="2"');
  });

  it('renders text-block sections', () => {
    const sections: ReportSection[] = [
      { type: 'text-block', title: 'Summary', content: 'All tasks completed successfully.' },
    ];

    const html = renderGlassReport({ title: 'T', sections });
    expect(html).toContain('opta-text');
    expect(html).toContain('Summary');
    expect(html).toContain('All tasks completed successfully.');
  });

  it('renders divider sections', () => {
    const sections: ReportSection[] = [{ type: 'divider' }];

    const html = renderGlassReport({ title: 'T', sections });
    expect(html).toContain('opta-divider');
  });

  it('renders section-header sections', () => {
    const sections: ReportSection[] = [
      { type: 'section-header', number: '01', title: 'Performance' },
    ];

    const html = renderGlassReport({ title: 'T', sections });
    expect(html).toContain('opta-section-header');
    expect(html).toContain('01');
    expect(html).toContain('Performance');
  });

  it('escapes user content in all section types', () => {
    const xss = '<img src=x onerror=alert(1)>';
    const sections: ReportSection[] = [
      { type: 'text-block', title: xss, content: xss },
      { type: 'stats-grid', items: [{ value: xss, label: xss }] },
      { type: 'key-value', pairs: [{ key: xss, value: xss }] },
    ];

    const html = renderGlassReport({ title: xss, sections });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  it('includes Opta glass CSS tokens', () => {
    const html = renderGlassReport({ title: 'T', sections: [] });
    expect(html).toContain('--void: #09090b');
    expect(html).toContain('--primary: #8b5cf6');
    expect(html).toContain('backdrop-filter');
    expect(html).toContain('Sora');
  });

  it('includes default footer with timestamp', () => {
    const html = renderGlassReport({ title: 'T', sections: [] });
    expect(html).toContain('opta-footer');
    expect(html).toContain('Generated');
  });

  it('uses custom footer when provided', () => {
    const html = renderGlassReport({ title: 'T', sections: [], footer: 'Custom Footer' });
    expect(html).toContain('Custom Footer');
  });
});

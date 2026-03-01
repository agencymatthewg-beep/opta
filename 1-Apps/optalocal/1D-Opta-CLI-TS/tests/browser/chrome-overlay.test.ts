import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests for the Opta Browser Chrome Overlay script.
 *
 * The chrome-overlay.ts is an IIFE that gets injected into Playwright pages.
 * We read its source once in beforeAll and assert the expected patterns/variables.
 */

const thisDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(thisDir, '..', '..');

async function readOverlaySource(): Promise<string> {
  // Try compiled JS first (like mcp-bootstrap does)
  try {
    const jsPath = join(projectRoot, 'dist', 'browser', 'chrome-overlay.js');
    return await readFile(jsPath, 'utf-8');
  } catch {
    // Fall back to TypeScript source
  }
  return await readFile(
    join(projectRoot, 'src', 'browser', 'chrome-overlay.ts'),
    'utf-8',
  );
}

describe('chrome-overlay script', () => {
  let script: string;

  // Read once before all tests — avoids 35 redundant file reads
  beforeAll(async () => {
    script = await readOverlaySource();
  });

  it('returns a non-empty string', () => {
    expect(typeof script).toBe('string');
    expect(script.length).toBeGreaterThan(100);
  });

  // --- Initialization Guard ---

  it('contains __OPTA_CHROME_INITIALIZED__ re-entry guard', () => {
    expect(script).toContain('__OPTA_CHROME_INITIALIZED__');
  });

  // --- State Colors ---

  it('defines --opta-state-idle CSS variable', () => {
    expect(script).toContain('--opta-state-idle');
  });

  it('defines --opta-state-thinking CSS variable', () => {
    expect(script).toContain('--opta-state-thinking');
  });

  it('defines --opta-state-executing CSS variable', () => {
    expect(script).toContain('--opta-state-executing');
  });

  it('defines --opta-state-gated CSS variable', () => {
    expect(script).toContain('--opta-state-gated');
  });

  it('defines --opta-state-error CSS variable', () => {
    expect(script).toContain('--opta-state-error');
  });

  it('defines --opta-state-success CSS variable', () => {
    expect(script).toContain('--opta-state-success');
  });

  it('contains all 6 state CSS variables', () => {
    const states = ['idle', 'thinking', 'executing', 'gated', 'error', 'success'];
    for (const state of states) {
      expect(script).toContain(`--opta-state-${state}`);
    }
  });

  // --- Info Bar ---

  it('contains the .opta-info-bar class', () => {
    expect(script).toContain('.opta-info-bar');
  });

  it('contains info bar creation code', () => {
    expect(script).toContain('opta-info-bar');
    expect(script).toContain('opta-info-bar-left');
  });

  // --- Shimmer Animation ---

  it('contains opta-shimmer keyframes animation', () => {
    expect(script).toContain('opta-shimmer');
    expect(script).toContain('@keyframes opta-shimmer');
  });

  it('contains shimmer trigger function', () => {
    expect(script).toContain('triggerShimmer');
  });

  // --- Event Listeners ---

  it('registers opta:state event listener', () => {
    expect(script).toContain("'opta:state'");
  });

  it('registers opta:policy event listener', () => {
    expect(script).toContain("'opta:policy'");
  });

  it('registers opta:navigate event listener', () => {
    expect(script).toContain("'opta:navigate'");
  });

  it('registers opta:action event listener', () => {
    expect(script).toContain("'opta:action'");
  });

  it('contains all 4 event listener registrations', () => {
    const events = ['opta:state', 'opta:policy', 'opta:navigate', 'opta:action'];
    for (const event of events) {
      expect(script).toContain(`'${event}'`);
    }
  });

  // --- MutationObserver Guardian ---

  it('contains MutationObserver for re-injection on removal', () => {
    expect(script).toContain('MutationObserver');
  });

  it('contains guardian observer that watches for overlay host removal', () => {
    expect(script).toContain('guardianObserver');
    expect(script).toContain('removedNodes');
  });

  // --- Shadow DOM ---

  it('uses Shadow DOM via attachShadow', () => {
    expect(script).toContain('attachShadow');
  });

  it('creates a closed shadow root', () => {
    // The overlay uses `{ mode: 'closed' }` to isolate from page scripts
    expect(script).toContain("mode: 'closed'");
  });

  // --- Click-Through ---

  it('sets pointer-events: none for click-through', () => {
    expect(script).toContain('pointer-events');
    expect(script).toContain('none');
    // Specifically check the host element setup
    expect(script).toContain("pointerEvents = 'none'");
  });

  // --- State Label Map ---

  it('defines state labels for all 6 states', () => {
    expect(script).toContain('STATE_LABELS');
    expect(script).toContain("idle: 'Ready'");
    expect(script).toContain("thinking: 'Thinking...'");
    expect(script).toContain("executing: 'Executing...'");
    expect(script).toContain("gated: 'Permission Required'");
    expect(script).toContain("error: 'Error'");
    expect(script).toContain("success: 'Done'");
  });

  // --- Visual Elements ---

  it('contains the badge element with dot and text', () => {
    expect(script).toContain('opta-badge');
    expect(script).toContain('opta-dot');
    expect(script).toContain('Opta Agent Active');
  });

  it('contains border element with state-aware opacity', () => {
    expect(script).toContain('opta-border');
    expect(script).toContain('--opta-border-opacity');
  });

  it('contains the ring icon CSS class', () => {
    expect(script).toContain('opta-ring-icon');
  });

  // --- Action Effects ---

  it('contains ripple effect for click actions', () => {
    expect(script).toContain('opta-ripple');
    expect(script).toContain('createRipple');
    expect(script).toContain('opta-ripple-anim');
  });

  it('contains highlight effect for type actions', () => {
    expect(script).toContain('opta-highlight');
    expect(script).toContain('createHighlight');
    expect(script).toContain('opta-highlight-fade');
  });

  // --- Policy Flash ---

  it('contains policy flash animation', () => {
    expect(script).toContain('opta-policy-flash');
    expect(script).toContain('triggerPolicyFlash');
    expect(script).toContain('policy-flash');
  });

  // --- Overlay Host ---

  it('creates a fixed overlay host element with max z-index', () => {
    expect(script).toContain('opta-chrome-host');
    expect(script).toContain('2147483647'); // Max z-index
    expect(script).toContain("position = 'fixed'");
  });

  // --- Glass Aesthetic ---

  it('uses glass background token', () => {
    expect(script).toContain('--opta-glass-bg');
    expect(script).toContain('rgba(15, 23, 42, 0.75)');
  });

  it('uses glass border token', () => {
    expect(script).toContain('--opta-glass-border');
    expect(script).toContain('rgba(139, 92, 246, 0.3)');
  });

  // --- Opta Accent Color ---

  it('uses the Opta violet accent color', () => {
    expect(script).toContain('--opta-accent: #8B5CF6');
  });

  // --- IIFE Structure ---

  it('is wrapped in an IIFE', () => {
    // The .ts source starts with JSDoc comments then the IIFE `(() => {`
    // The compiled .js may strip the JSDoc. Either way the IIFE pattern is present.
    expect(script).toContain('(() => {');
    expect(script.trimEnd().endsWith('})();')).toBe(true);
  });
});

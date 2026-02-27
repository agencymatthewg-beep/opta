// tests/tui/OnboardingOverlay.test.tsx
import { render } from 'ink-testing-library';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { OnboardingOverlay } from '../../src/tui/OnboardingOverlay.js';

const flush = (ms = 20) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('OnboardingOverlay', () => {
  it('renders step 1 (Welcome) with correct header', () => {
    const { lastFrame } = render(
      <OnboardingOverlay
        animationPhase="open"
        animationProgress={1}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    expect(lastFrame()).toContain('Opta Setup');
    expect(lastFrame()).toContain('Step 1');
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    const { stdin } = render(
      <OnboardingOverlay
        animationPhase="open"
        animationProgress={1}
        onClose={onClose}
        onComplete={vi.fn()}
      />
    );
    await flush();
    stdin.write('\x1b'); // ESC
    await flush();
    expect(onClose).toHaveBeenCalled();
  });

  it('shows LMX connection step after Tab', async () => {
    const { lastFrame, stdin } = render(
      <OnboardingOverlay
        animationPhase="open"
        animationProgress={1}
        onClose={vi.fn()}
        onComplete={vi.fn()}
      />
    );
    await flush();
    stdin.write('\r'); // Enter to advance past welcome
    await flush();
    expect(lastFrame()).toContain('Step 2');
    expect(lastFrame()).toContain('LMX Connection');
  });

  it('calls onComplete with partial config on finish', async () => {
    const onComplete = vi.fn();
    const { stdin } = render(
      <OnboardingOverlay
        animationPhase="open"
        animationProgress={1}
        onClose={vi.fn()}
        onComplete={onComplete}
        initialStep={8} // Start on final step
      />
    );
    await flush();
    stdin.write('\r'); // Enter to save
    await flush();
    expect(onComplete).toHaveBeenCalledWith(expect.any(Object));
  });

  it('preferences step shows arrow-key slider for autonomy level', async () => {
    const { lastFrame, stdin } = render(
      <OnboardingOverlay
        animationPhase="open"
        animationProgress={1}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        initialStep={7} // Preferences step
      />
    );
    await flush();
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Autonomy Level');
    expect(frame).toContain('adjust');
  });

  it('preferences step shows default mode selector', async () => {
    const { lastFrame } = render(
      <OnboardingOverlay
        animationPhase="open"
        animationProgress={1}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        initialStep={7}
      />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Default Mode');
    expect(frame).toContain('Safe');
    expect(frame).toContain('Auto');
  });

  it('done step includes default mode in summary', async () => {
    const { lastFrame } = render(
      <OnboardingOverlay
        animationPhase="open"
        animationProgress={1}
        onClose={vi.fn()}
        onComplete={vi.fn()}
        initialStep={8}
      />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Mode: safe');
  });

  it('onComplete includes defaultMode in config', async () => {
    const onComplete = vi.fn();
    const { stdin } = render(
      <OnboardingOverlay
        animationPhase="open"
        animationProgress={1}
        onClose={vi.fn()}
        onComplete={onComplete}
        initialStep={8}
      />
    );
    await flush();
    stdin.write('\r');
    await flush();
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ defaultMode: 'safe' })
    );
  });
});

import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from 'ink-testing-library';
import { Header } from '../../src/tui/Header.js';

describe('Header', () => {
  it('should show model name and session ID', () => {
    const { lastFrame } = render(
      <Header model="Qwen2.5-72B" sessionId="abc12345" connectionStatus={true} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('Qwen2.5-72B');
    expect(frame).toContain('abc12345');
  });

  it('should show Opta branding', () => {
    const { lastFrame } = render(
      <Header model="test" sessionId="abc12345" connectionStatus={true} />
    );
    expect(lastFrame()).toContain('Opta');
  });

  it('should truncate model name and hide session ID when compact', () => {
    const longModel = 'Qwen2.5-72B-Instruct-GPTQ';
    const { lastFrame } = render(
      <Header model={longModel} sessionId="abc12345" connectionStatus={true} compact={true} />
    );
    const frame = lastFrame() ?? '';
    // Model name should be truncated to 16 chars
    expect(frame).toContain(longModel.slice(0, 16));
    // Session ID should be hidden in compact mode
    expect(frame).not.toContain('abc12345');
  });

  it('should show full model name and session ID when not compact', () => {
    const longModel = 'Qwen2.5-72B-Instruct-GPTQ';
    const { lastFrame } = render(
      <Header model={longModel} sessionId="abc12345" connectionStatus={true} compact={false} />
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain(longModel);
    expect(frame).toContain('abc12345');
  });
});

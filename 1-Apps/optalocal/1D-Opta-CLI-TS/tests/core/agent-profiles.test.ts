import { describe, it, expect } from 'vitest';
import {
  AGENT_PROFILES,
  getAgentProfile,
  listAgentProfiles,
  type AgentProfile,
} from '../../src/core/agent-profiles.js';

describe('Agent Profiles', () => {
  it('should have a default profile', () => {
    const profile = getAgentProfile('default');
    expect(profile).toBeDefined();
    expect(profile!.name).toBe('default');
    expect(profile!.tools.length).toBeGreaterThan(0);
  });

  it('should return undefined for unknown profile', () => {
    const profile = getAgentProfile('nonexistent');
    expect(profile).toBeUndefined();
  });

  it('should have a reader profile with read-only tools', () => {
    const profile = getAgentProfile('reader');
    expect(profile).toBeDefined();
    expect(profile!.tools).toContain('read_file');
    expect(profile!.tools).toContain('search_files');
    expect(profile!.tools).not.toContain('edit_file');
    expect(profile!.tools).not.toContain('write_file');
    expect(profile!.tools).not.toContain('run_command');
  });

  it('should have a coder profile with file editing tools', () => {
    const profile = getAgentProfile('coder');
    expect(profile).toBeDefined();
    expect(profile!.tools).toContain('read_file');
    expect(profile!.tools).toContain('edit_file');
    expect(profile!.tools).toContain('write_file');
    expect(profile!.tools).toContain('run_command');
  });

  it('should have a researcher profile with web tools', () => {
    const profile = getAgentProfile('researcher');
    expect(profile).toBeDefined();
    expect(profile!.tools).toContain('read_file');
    expect(profile!.tools).toContain('web_search');
    expect(profile!.tools).toContain('web_fetch');
  });

  it('should list all available profiles', () => {
    const profiles = listAgentProfiles();
    expect(profiles.length).toBeGreaterThanOrEqual(4);
    const names = profiles.map(p => p.name);
    expect(names).toContain('default');
    expect(names).toContain('reader');
    expect(names).toContain('coder');
    expect(names).toContain('researcher');
  });

  it('should have descriptions for all profiles', () => {
    const profiles = listAgentProfiles();
    for (const profile of profiles) {
      expect(profile.description).toBeTruthy();
      expect(profile.description.length).toBeGreaterThan(0);
    }
  });

  it('should have a systemPromptSuffix for specialized profiles', () => {
    const reader = getAgentProfile('reader');
    expect(reader!.systemPromptSuffix).toBeTruthy();
    const coder = getAgentProfile('coder');
    expect(coder!.systemPromptSuffix).toBeTruthy();
  });
});

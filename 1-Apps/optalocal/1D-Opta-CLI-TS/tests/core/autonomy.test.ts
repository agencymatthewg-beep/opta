import { describe, expect, it } from 'vitest';
import {
  AUTONOMY_CYCLE_STAGES,
  applyAutonomyRuntimeProfile,
  buildAutonomyCycleCheckpoint,
  buildAutonomyStageCheckpointGuidance,
  buildCeoAutonomyReport,
  buildAutonomyProfile,
  buildAutonomyPromptBlock,
  computeAutonomyConfigUpdates,
  formatAutonomySlider,
  isAutonomyCycleStage,
  nextAutonomyCycleStage,
  resolveAutonomyLevel,
  resolveAutonomyMode,
} from '../../src/core/autonomy.js';
import { DEFAULT_CONFIG } from '../../src/core/config.js';

describe('autonomy', () => {
  it('resolves autonomy levels with clamp and fallback', () => {
    expect(resolveAutonomyLevel(undefined)).toBe(2);
    expect(resolveAutonomyLevel('5')).toBe(5);
    expect(resolveAutonomyLevel(99)).toBe(5);
    expect(resolveAutonomyLevel(-5)).toBe(1);
    expect(resolveAutonomyLevel(2.7)).toBe(2); // Math.floor: conservative, never escalates
  });

  it('resolves autonomy mode with safe fallback', () => {
    expect(resolveAutonomyMode('ceo')).toBe('ceo');
    expect(resolveAutonomyMode('execution')).toBe('execution');
    expect(resolveAutonomyMode('unknown')).toBe('execution');
  });

  it('formats autonomy slider', () => {
    expect(formatAutonomySlider(3)).toBe('[■■■□□]');
    expect(formatAutonomySlider(5)).toBe('[■■■■■]');
  });

  it('defines explicit autonomy cycle stages and supports progression helpers', () => {
    expect(AUTONOMY_CYCLE_STAGES).toEqual([
      'research',
      'analysis',
      'planning',
      'sub-planning',
      'execution',
      'review',
      'reassessment',
    ]);
    expect(isAutonomyCycleStage('planning')).toBe(true);
    expect(isAutonomyCycleStage('ship-it')).toBe(false);
    expect(nextAutonomyCycleStage('review')).toBe('reassessment');
    expect(nextAutonomyCycleStage('reassessment')).toBe('research');
  });

  it('builds cycle checkpoints with cycle/phase progression', () => {
    const first = buildAutonomyCycleCheckpoint(0);
    const eighth = buildAutonomyCycleCheckpoint(7);

    expect(first.cycle).toBe(1);
    expect(first.phase).toBe(1);
    expect(first.stage).toBe('research');
    expect(first.nextStage).toBe('analysis');

    expect(eighth.cycle).toBe(2);
    expect(eighth.phase).toBe(1);
    expect(eighth.stage).toBe('research');
  });

  it('builds runtime checkpoint guidance including final reassessment pass', () => {
    const checkpoint = buildAutonomyCycleCheckpoint(3);
    const normal = buildAutonomyStageCheckpointGuidance(checkpoint);
    const finalPass = buildAutonomyStageCheckpointGuidance(checkpoint, { finalReassessment: true });

    expect(normal).toContain('stage: sub-planning');
    expect(normal).toContain('next stage: execution');

    expect(finalPass).toContain('stage: reassessment');
    expect(finalPass).toContain('final pass');
  });

  it('builds compact CEO report payload with cycle and tool-call stats', () => {
    const report = buildCeoAutonomyReport({
      objective: 'Ship runtime autonomy enforcement',
      completionStatus: 'completed',
      turnCount: 9,
      cycle: 2,
      phase: 2,
      stage: 'analysis',
      toolCallCount: 14,
      toolCallTurns: 5,
      objectiveReassessmentEnabled: true,
      forcedFinalReassessment: true,
    });

    expect(report.summary).toContain('completed');
    expect(report.commandInputs['cycle']).toBe(2);
    expect(report.commandInputs['phase']).toBe(2);
    expect(report.commandInputs['toolCallCount']).toBe(14);
    expect(report.commandInputs['completionStatus']).toBe('completed');
    expect(report.steps.some((step) => step.step === 'status' && step.status === 'ok')).toBe(true);
  });

  it('builds CEO profile with live-data requirement and moderated parallelism', () => {
    const execution = buildAutonomyProfile(4, 'execution');
    const ceo = buildAutonomyProfile(4, 'ceo');

    expect(ceo.mode).toBe('ceo');
    expect(ceo.requireLiveData).toBe(true);
    expect(ceo.maxParallelTools).toBeLessThan(execution.maxParallelTools);
    expect(ceo.label).toContain('CEO');
  });

  it('computes config updates with mode-sensitive fields', () => {
    const execution = computeAutonomyConfigUpdates(3, 'execution');
    const ceo = computeAutonomyConfigUpdates(5, 'ceo');

    expect(execution['autonomy.mode']).toBe('execution');
    expect(execution['autonomy.reportStyle']).toBe('standard');
    expect(execution['policy.audit.enabled']).toBeUndefined();

    expect(ceo['autonomy.mode']).toBe('ceo');
    expect(ceo['autonomy.requireLiveData']).toBe(true);
    expect(ceo['autonomy.reportStyle']).toBe('executive');
    expect(ceo['policy.audit.enabled']).toBe(true);
    expect(ceo['safety.circuitBreaker.maxDuration']).toBe(3_600_000);
  });

  it('does not mutate config when autonomy profile enforcement is disabled', () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.autonomy.enforceProfile = false;

    const result = applyAutonomyRuntimeProfile(config);
    expect(result).toBe(config);
  });

  it('applies runtime overrides for high-autonomy CEO execution', () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.autonomy.level = 5;
    config.autonomy.mode = 'ceo';
    config.permissions['run_command'] = 'ask';
    config.permissions['spawn_agent'] = 'ask';
    config.permissions['delegate_task'] = 'ask';

    const result = applyAutonomyRuntimeProfile(config);

    expect(result.defaultMode).toBe('auto');
    expect(result.autonomy.requireLiveData).toBe(true);
    expect(result.autonomy.reportStyle).toBe('executive');
    expect(result.permissions['run_command']).toBe('allow');
    expect(result.permissions['spawn_agent']).toBe('allow');
    expect(result.permissions['delegate_task']).toBe('allow');
    expect(result.safety.circuitBreaker.maxDuration).toBe(3_600_000);
    expect(result.policy.gateAllAutonomy).toBe(false);
    expect(result.policy.audit.enabled).toBe(true);
  });

  it('builds autonomy prompt block with level-5 and CEO directives', () => {
    const config = structuredClone(DEFAULT_CONFIG);
    config.autonomy.level = 5;
    config.autonomy.mode = 'ceo';

    const block = buildAutonomyPromptBlock(config);
    expect(block).toContain('Autonomous Execution Profile');
    expect(block).toContain('level 5 directive');
    expect(block).toContain('CEO mode directives');
    expect(block).toContain('web_search/web_fetch');
  });
});

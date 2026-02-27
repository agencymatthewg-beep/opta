/**
 * Shared config override builder.
 *
 * Canonical function for constructing config overrides from CLI flags.
 * Imported by chat.ts and do.ts.
 */

export interface ConfigOverrideFlags {
  model?: string;
  commit?: boolean;
  checkpoints?: boolean;
  dangerous?: boolean;
  yolo?: boolean;
  auto?: boolean;
  plan?: boolean;
}

export function buildConfigOverrides(opts: ConfigOverrideFlags): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};

  if (opts.model) {
    overrides['model'] = { default: opts.model };
  }

  if (opts.commit === false) {
    overrides['git'] = {
      ...((overrides['git'] as Record<string, unknown>) ?? {}),
      autoCommit: false,
    };
  }

  if (opts.checkpoints === false) {
    overrides['git'] = {
      ...((overrides['git'] as Record<string, unknown>) ?? {}),
      checkpoints: false,
    };
  }

  if (opts.dangerous || opts.yolo) {
    overrides['defaultMode'] = 'dangerous';
  } else if (opts.auto) {
    overrides['defaultMode'] = 'auto';
  } else if (opts.plan) {
    overrides['defaultMode'] = 'plan';
  }

  return overrides;
}

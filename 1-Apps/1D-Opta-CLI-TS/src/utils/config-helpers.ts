/**
 * Shared config override builder.
 *
 * Extracts the duplicated override-construction logic from chat.ts and do.ts
 * into a single canonical function.
 *
 * TODO: chat.ts and do.ts should import this instead of inlining the logic.
 */

export function buildConfigOverrides(opts: {
  model?: string;
  commit?: boolean;
  checkpoints?: boolean;
  dangerous?: boolean;
  yolo?: boolean;
  auto?: boolean;
  plan?: boolean;
}): Record<string, unknown> {
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

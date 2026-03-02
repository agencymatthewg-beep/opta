/**
 * Shared config override builder.
 *
 * Canonical function for constructing config overrides from CLI flags.
 * Imported by chat.ts and do.ts.
 */

export interface ConfigOverrideFlags {
  model?: string;
  provider?: string;
  commit?: boolean;
  checkpoints?: boolean;
  dangerous?: boolean;
  yolo?: boolean;
  auto?: boolean;
  plan?: boolean;
}

export const PROVIDER_OVERRIDE_NAMES = [
  'lmx',
  'anthropic',
  'gemini',
  'openai',
  'opencode_zen',
] as const;

export type ProviderOverrideName = (typeof PROVIDER_OVERRIDE_NAMES)[number];

export function parseProviderOverride(input: string): ProviderOverrideName {
  const normalized = input.trim().toLowerCase();
  if (
    PROVIDER_OVERRIDE_NAMES.includes(normalized as ProviderOverrideName)
  ) {
    return normalized as ProviderOverrideName;
  }
  throw new Error(
    `Invalid provider "${input}". Expected one of: ${PROVIDER_OVERRIDE_NAMES.join(', ')}.`
  );
}

export function buildConfigOverrides(opts: ConfigOverrideFlags): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  const getGitOverrides = (): Record<string, unknown> => {
    const current = overrides['git'];
    return typeof current === 'object' && current !== null ? (current as Record<string, unknown>) : {};
  };

  if (opts.model) {
    overrides['model'] = { default: opts.model };
  }

  if (opts.provider) {
    overrides['provider'] = { active: parseProviderOverride(opts.provider) };
  }

  if (opts.commit === false) {
    overrides['git'] = {
      ...getGitOverrides(),
      autoCommit: false,
    };
  }

  if (opts.checkpoints === false) {
    overrides['git'] = {
      ...getGitOverrides(),
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

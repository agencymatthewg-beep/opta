import { diffSettings, type SettingsDiffItem } from '@/lib/safety/settings-diff';

export interface ChangeScopeValidation {
  ok: boolean;
  diffs: SettingsDiffItem[];
  blockedKeys: string[];
}

export class ChangeScopeGuard {
  constructor(private readonly allowlistByAction: Record<string, string[]>) {}

  validate(
    action: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): ChangeScopeValidation {
    const allowed = new Set(this.allowlistByAction[action] ?? []);
    const diffs = diffSettings(before, after);
    const blockedKeys = diffs
      .map((diff) => diff.key)
      .filter((key) => !allowed.has(key));

    return {
      ok: blockedKeys.length === 0,
      diffs,
      blockedKeys,
    };
  }
}

export const SETTINGS_CHANGE_GUARD = new ChangeScopeGuard({
  'connection:update': ['host', 'port', 'adminKey', 'useTunnel', 'tunnelUrl'],
});


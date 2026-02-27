export interface SettingsDiffItem {
  key: string;
  before: unknown;
  after: unknown;
}

export function diffSettings(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): SettingsDiffItem[] {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();
  return keys
    .filter((key) => before[key] !== after[key])
    .map((key) => ({
      key,
      before: before[key],
      after: after[key],
    }));
}


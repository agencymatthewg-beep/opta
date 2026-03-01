import { DEFAULT_CONFIG } from '../src/core/config.js';

type AnyObj = Record<string, unknown>;

function flatten(obj: AnyObj, prefix = ''): Array<{key: string; value: unknown}> {
  const out: Array<{key: string; value: unknown}> = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      out.push({ key, value: v });
      continue;
    }
    if (v && typeof v === 'object') {
      out.push(...flatten(v as AnyObj, key));
      continue;
    }
    out.push({ key, value: v });
  }
  return out;
}

const entries = flatten(DEFAULT_CONFIG as unknown as AnyObj).sort((a,b)=>a.key.localeCompare(b.key));
console.log(`TOTAL_KEYS=${entries.length}`);
for (const e of entries) {
  const val = JSON.stringify(e.value);
  console.log(`${e.key}=${val}`);
}

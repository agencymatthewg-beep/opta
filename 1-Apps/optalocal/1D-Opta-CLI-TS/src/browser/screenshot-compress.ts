/**
 * Optional screenshot compression for Playwright MCP results.
 * Uses `sharp` via dynamic import when available; falls back to returning the original result unchanged.
 */

export interface ScreenshotCompressOptions {
  /** Max width in pixels to resize to (maintains aspect ratio). Default: 1280. */
  maxWidth?: number;
  /** Max height in pixels to resize to (maintains aspect ratio). Default: 720. */
  maxHeight?: number;
  /** JPEG quality 1–100. Default: 80. */
  quality?: number;
}

const DATA_URL_RE = /data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/]+=*)/;

/** Returns true if the result string looks like a Playwright screenshot response containing a data URL. */
export function isScreenshotResult(result: unknown): result is string {
  return typeof result === 'string' && DATA_URL_RE.test(result);
}

/**
 * Attempts to compress a screenshot data-URL using `sharp` (if installed).
 * If `sharp` is not available, returns `result` unchanged.
 */
export async function compressBrowserScreenshot(
  result: string,
  options: ScreenshotCompressOptions = {},
): Promise<string> {
  const match = DATA_URL_RE.exec(result);
  if (!match) return result;

  const fullMatch = match[0];
  const b64 = match[2] ?? '';
  const maxWidth = options.maxWidth ?? 1280;
  const maxHeight = options.maxHeight ?? 720;
  const quality = Math.min(100, Math.max(1, options.quality ?? 80));

  // sharp is an optional peer dependency — use dynamic import with unknown typing to avoid
  // requiring @types/sharp in devDependencies when the package isn't installed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sharpFactory: ((input: Buffer) => any) | undefined;
  try {
    const mod = await import('sharp' as string);
    const fn = (mod as { default?: unknown }).default ?? mod;
    if (typeof fn === 'function') {
      sharpFactory = fn as (input: Buffer) => unknown;
    }
  } catch {
    // sharp is not installed — return original unchanged
    return result;
  }

  if (!sharpFactory) return result;

  try {
    const buf = Buffer.from(b64, 'base64');
    const compressed = await sharpFactory(buf)
      .resize({ width: maxWidth, height: maxHeight, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    const newB64 = (compressed as Buffer).toString('base64');
    const newDataUrl = `data:image/jpeg;base64,${newB64}`;
    return result.replace(fullMatch, newDataUrl);
  } catch {
    return result;
  }
}

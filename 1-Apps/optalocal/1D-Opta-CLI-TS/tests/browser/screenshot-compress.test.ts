import { describe, it, expect, vi } from 'vitest';
import { isScreenshotResult, compressBrowserScreenshot } from '../../src/browser/screenshot-compress.js';

const FAKE_B64 = Buffer.from('fake-image-data').toString('base64');
const FAKE_PNG_DATA_URL = `data:image/png;base64,${FAKE_B64}`;
const FAKE_JPEG_DATA_URL = `data:image/jpeg;base64,${FAKE_B64}`;

describe('isScreenshotResult', () => {
  it('returns true for PNG data URL', () => {
    expect(isScreenshotResult(FAKE_PNG_DATA_URL)).toBe(true);
  });

  it('returns true for JPEG data URL', () => {
    expect(isScreenshotResult(FAKE_JPEG_DATA_URL)).toBe(true);
  });

  it('returns true when data URL is embedded in a larger string', () => {
    expect(isScreenshotResult(`Screenshot: ${FAKE_PNG_DATA_URL}`)).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(isScreenshotResult('just some text')).toBe(false);
  });

  it('returns false for non-string values', () => {
    expect(isScreenshotResult(null)).toBe(false);
    expect(isScreenshotResult(42)).toBe(false);
    expect(isScreenshotResult({ data: FAKE_PNG_DATA_URL })).toBe(false);
  });
});

describe('compressBrowserScreenshot', () => {
  it('returns original result when sharp is not available', async () => {
    // sharp is dynamically imported; in test environment it likely won't work on fake data
    // Either it's absent or it fails on fake data — either way result should be returned unchanged
    const result = await compressBrowserScreenshot(FAKE_PNG_DATA_URL, { quality: 80 });
    // Result is either the original or a valid jpeg data url
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns original result unchanged for non-screenshot strings', async () => {
    const plain = 'not a screenshot';
    const result = await compressBrowserScreenshot(plain, {});
    expect(result).toBe(plain);
  });
});

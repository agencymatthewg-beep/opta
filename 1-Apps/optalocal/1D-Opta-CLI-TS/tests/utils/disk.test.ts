import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { ensureDiskHeadroom, isStorageRelatedError, readDiskHeadroom } from '../../src/utils/disk.js';

describe('utils/disk', () => {
  it('reads disk headroom for an existing path', async () => {
    const headroom = await readDiskHeadroom(tmpdir());
    expect(headroom.totalBytes).toBeGreaterThan(0);
    expect(headroom.availableBytes).toBeGreaterThanOrEqual(0);
    expect(headroom.path.length).toBeGreaterThan(0);
  });

  it('passes disk headroom check when requirement is tiny', async () => {
    await expect(
      ensureDiskHeadroom(tmpdir(), { minFreeBytes: 1 }),
    ).resolves.toMatchObject({
      path: expect.any(String),
      availableBytes: expect.any(Number),
    });
  });

  it('throws ENOSPC when required headroom exceeds availability', async () => {
    await expect(
      ensureDiskHeadroom(tmpdir(), { minFreeBytes: Number.MAX_SAFE_INTEGER }),
    ).rejects.toMatchObject({
      code: 'ENOSPC',
    });
  });

  it('classifies ENOSPC-style errors as storage related', () => {
    const err = Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
    expect(isStorageRelatedError(err)).toBe(true);
    expect(isStorageRelatedError(new Error('disk quota exceeded'))).toBe(true);
    expect(isStorageRelatedError(new Error('connection refused'))).toBe(false);
  });
});

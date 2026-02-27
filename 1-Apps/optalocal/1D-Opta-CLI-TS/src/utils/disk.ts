import { access, statfs } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const BYTES_PER_MIB = 1024 * 1024;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export const DEFAULT_DISK_HEADROOM_MB = 64;

export interface DiskHeadroom {
  path: string;
  totalBytes: number;
  freeBytes: number;
  availableBytes: number;
}

export interface DiskHeadroomOptions {
  minFreeBytes?: number;
  minFreeMb?: number;
}

function toSafeNumber(value: bigint | number): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return Number.MAX_SAFE_INTEGER;
    if (value < 0) return 0;
    return Math.min(value, Number.MAX_SAFE_INTEGER);
  }
  if (value <= 0n) return 0;
  if (value > MAX_SAFE_BIGINT) return Number.MAX_SAFE_INTEGER;
  return Number(value);
}

function multiplySafe(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.MAX_SAFE_INTEGER;
  const product = a * b;
  if (!Number.isFinite(product)) return Number.MAX_SAFE_INTEGER;
  if (product < 0) return 0;
  return Math.min(product, Number.MAX_SAFE_INTEGER);
}

async function resolveExistingPath(path: string): Promise<string> {
  let current = resolve(path);
  while (true) {
    try {
      await access(current);
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) return current;
      current = parent;
    }
  }
}

export function diskHeadroomMbToBytes(minFreeMb?: number): number {
  if (typeof minFreeMb === 'number' && Number.isFinite(minFreeMb) && minFreeMb > 0) {
    return Math.floor(minFreeMb) * BYTES_PER_MIB;
  }
  return DEFAULT_DISK_HEADROOM_MB * BYTES_PER_MIB;
}

export function isStorageRelatedError(error: unknown): boolean {
  if (!error) return false;

  const code = typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code.toUpperCase()
    : '';
  if (code === 'ENOSPC' || code === 'EDQUOT') return true;

  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const lower = message.toLowerCase();
  return (
    lower.includes('no space left on device') ||
    lower.includes('disk full') ||
    lower.includes('quota exceeded') ||
    lower.includes('insufficient storage')
  );
}

export async function readDiskHeadroom(path: string): Promise<DiskHeadroom> {
  const existingPath = await resolveExistingPath(path);
  const fsStats = await statfs(existingPath, { bigint: true });
  const blockSize = toSafeNumber(fsStats.bsize);

  return {
    path: existingPath,
    totalBytes: multiplySafe(toSafeNumber(fsStats.blocks), blockSize),
    freeBytes: multiplySafe(toSafeNumber(fsStats.bfree), blockSize),
    availableBytes: multiplySafe(toSafeNumber(fsStats.bavail), blockSize),
  };
}

export async function ensureDiskHeadroom(
  path: string,
  options: DiskHeadroomOptions = {},
): Promise<DiskHeadroom> {
  const minFreeBytes = typeof options.minFreeBytes === 'number' && Number.isFinite(options.minFreeBytes)
    ? Math.max(0, Math.floor(options.minFreeBytes))
    : diskHeadroomMbToBytes(options.minFreeMb);
  const headroom = await readDiskHeadroom(path);

  if (headroom.availableBytes < minFreeBytes) {
    const err = new Error(
      `Disk headroom below required minimum at ${headroom.path}: ${headroom.availableBytes} B available, ${minFreeBytes} B required.`,
    ) as NodeJS.ErrnoException;
    err.code = 'ENOSPC';
    throw err;
  }

  return headroom;
}

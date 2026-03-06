import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSyncFilesQueryMode } from '../lib/sync/files-delta.ts';

test('sync files query parser returns single mode when updated_since is absent', () => {
  const url = new URL('https://accounts.optalocal.com/api/sync/files');
  const mode = parseSyncFilesQueryMode(url);
  assert.deepEqual(mode, { mode: 'single' });
});

test('sync files query parser validates updated_since and limit', () => {
  const invalidDate = parseSyncFilesQueryMode(
    new URL('https://accounts.optalocal.com/api/sync/files?updated_since=not-a-date'),
  );
  assert.deepEqual(invalidDate, { mode: 'error', error: 'invalid_updated_since' });

  const invalidLimit = parseSyncFilesQueryMode(
    new URL('https://accounts.optalocal.com/api/sync/files?updated_since=2026-03-06T00:00:00.000Z&limit=0'),
  );
  assert.deepEqual(invalidLimit, { mode: 'error', error: 'invalid_limit' });
});

test('sync files query parser clamps delta limit to configured max', () => {
  const mode = parseSyncFilesQueryMode(
    new URL('https://accounts.optalocal.com/api/sync/files?updated_since=2026-03-06T00:00:00.000Z&limit=999'),
    { defaultLimit: 25, maxLimit: 100 },
  );

  assert.deepEqual(mode, {
    mode: 'delta',
    updatedSince: '2026-03-06T00:00:00.000Z',
    limit: 100,
  });
});

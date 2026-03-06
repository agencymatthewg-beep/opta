import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildMissingSyncFileEtag,
  buildSyncFileEtag,
  matchesIfMatch,
  matchesIfNoneMatch,
} from '../lib/sync/http-cache.ts';

const BASE_ROW = {
  id: 'row-1',
  filename: 'non-negotiables.md',
  content: 'Always verify before deployment.',
  updated_at: '2026-03-06T00:00:00.000Z',
};

test('sync file etag changes when content changes', () => {
  const first = buildSyncFileEtag(BASE_ROW);
  const second = buildSyncFileEtag({ ...BASE_ROW, content: 'Updated content' });
  assert.notEqual(first, second);
});

test('if-none-match supports weak tags and wildcard', () => {
  const etag = buildSyncFileEtag(BASE_ROW);
  assert.equal(matchesIfNoneMatch(`W/${etag}`, etag), true);
  assert.equal(matchesIfNoneMatch('*', etag), true);
  assert.equal(matchesIfNoneMatch('"different"', etag), false);
});

test('if-match enforces preconditions for existing and missing resources', () => {
  const current = buildSyncFileEtag(BASE_ROW);
  const missing = buildMissingSyncFileEtag(BASE_ROW.filename);

  assert.equal(matchesIfMatch(current, current), true);
  assert.equal(matchesIfMatch('*', current), true);
  assert.equal(matchesIfMatch('"different"', current), false);

  assert.equal(matchesIfMatch(null, current), true);
  assert.equal(matchesIfMatch('*', null), false);
  assert.equal(matchesIfMatch(missing, null), false);
});

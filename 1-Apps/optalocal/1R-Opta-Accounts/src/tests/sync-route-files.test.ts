import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  buildMissingSyncFileEtag,
  buildSyncFileEtag,
} from '../lib/sync/http-cache.ts';
import { installRouteModuleHooks } from './support/route-module-hooks.ts';
import {
  resetRouteMockState,
  setMockUser,
  upsertMockSyncFile,
} from './support/route-mocks.ts';

installRouteModuleHooks();

const syncFilesRoute = await import('../app/api/sync/files/route.ts');

test.beforeEach(() => {
  resetRouteMockState();
});

// ─────────────────────────── GET /api/sync/files ────────────────────────────

test('GET returns 401 when user is not authenticated', async () => {
  const res = await syncFilesRoute.GET(
    new Request('http://localhost:3002/api/sync/files?name=non-negotiables.md'),
  );
  assert.equal(res.status, 401);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'unauthenticated');
});

test('GET returns 400 for invalid filename', async () => {
  setMockUser(randomUUID());
  const res = await syncFilesRoute.GET(
    new Request('http://localhost:3002/api/sync/files?name=../../../etc/passwd'),
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'invalid_filename');
});

test('GET returns 200 with ETag and content when file exists', async () => {
  const userId = randomUUID();
  const fileId = randomUUID();
  const now = new Date().toISOString();
  setMockUser(userId);
  upsertMockSyncFile({
    id: fileId,
    userId,
    filename: 'non-negotiables.md',
    content: '# My Rules\nBe excellent.',
    is_active: true,
    created_at: now,
    updated_at: now,
  });

  const res = await syncFilesRoute.GET(
    new Request('http://localhost:3002/api/sync/files?name=non-negotiables.md'),
  );

  assert.equal(res.status, 200);
  const etag = res.headers.get('etag');
  assert.ok(etag, 'response must include ETag');
  assert.equal(
    etag,
    buildSyncFileEtag({ id: fileId, filename: 'non-negotiables.md', content: '# My Rules\nBe excellent.', updated_at: now }),
  );
  const body = (await res.json()) as { content: string; configured: boolean };
  assert.equal(body.configured, true);
  assert.equal(body.content, '# My Rules\nBe excellent.');
});

test('GET returns 304 when If-None-Match matches current ETag', async () => {
  const userId = randomUUID();
  const fileId = randomUUID();
  const now = new Date().toISOString();
  setMockUser(userId);
  const record = {
    id: fileId,
    userId,
    filename: 'non-negotiables.md',
    content: '# Rules',
    is_active: true,
    created_at: now,
    updated_at: now,
  };
  upsertMockSyncFile(record);

  const etag = buildSyncFileEtag(record);
  const res = await syncFilesRoute.GET(
    new Request('http://localhost:3002/api/sync/files?name=non-negotiables.md', {
      headers: { 'if-none-match': etag },
    }),
  );
  assert.equal(res.status, 304);
  assert.equal(res.headers.get('etag'), etag);
});

test('GET returns 200 configured:false when file is absent', async () => {
  setMockUser(randomUUID());
  const res = await syncFilesRoute.GET(
    new Request('http://localhost:3002/api/sync/files?name=non-negotiables.md'),
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { configured: boolean; content: null };
  assert.equal(body.configured, false);
  assert.equal(body.content, null);
  assert.equal(res.headers.get('etag'), buildMissingSyncFileEtag('non-negotiables.md'));
});

test('GET returns 304 when If-None-Match matches missing-file ETag', async () => {
  setMockUser(randomUUID());
  const etag = buildMissingSyncFileEtag('non-negotiables.md');
  const res = await syncFilesRoute.GET(
    new Request('http://localhost:3002/api/sync/files?name=non-negotiables.md', {
      headers: { 'if-none-match': etag },
    }),
  );
  assert.equal(res.status, 304);
});

// ──────────────────────── GET delta mode ────────────────────────────────────

test('GET returns 400 for invalid updated_since value', async () => {
  setMockUser(randomUUID());
  const res = await syncFilesRoute.GET(
    new Request('http://localhost:3002/api/sync/files?updated_since=not-a-date'),
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'invalid_updated_since');
});

test('GET delta mode returns only files updated after the cursor', async () => {
  const userId = randomUUID();
  setMockUser(userId);

  upsertMockSyncFile({
    id: randomUUID(),
    userId,
    filename: 'old.md',
    content: 'old',
    is_active: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  });
  upsertMockSyncFile({
    id: randomUUID(),
    userId,
    filename: 'new.md',
    content: 'new',
    is_active: true,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
  });

  const res = await syncFilesRoute.GET(
    new Request('http://localhost:3002/api/sync/files?updated_since=2026-02-01T00:00:00.000Z'),
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { mode: string; files: Array<{ filename: string }>; count: number };
  assert.equal(body.mode, 'delta');
  assert.equal(body.count, 1);
  assert.equal(body.files[0]?.filename, 'new.md');
});

test('GET delta mode returns 304 when If-None-Match matches', async () => {
  const userId = randomUUID();
  setMockUser(userId);

  upsertMockSyncFile({
    id: randomUUID(),
    userId,
    filename: 'config.md',
    content: 'cfg',
    is_active: true,
    created_at: '2026-03-01T00:00:00.000Z',
    updated_at: '2026-03-01T00:00:00.000Z',
  });

  const url = 'http://localhost:3002/api/sync/files?updated_since=2026-02-01T00:00:00.000Z';
  const firstRes = await syncFilesRoute.GET(new Request(url));
  assert.equal(firstRes.status, 200);
  const etag = firstRes.headers.get('etag');
  assert.ok(etag, 'first response must include ETag');

  const secondRes = await syncFilesRoute.GET(
    new Request(url, { headers: { 'if-none-match': etag } }),
  );
  assert.equal(secondRes.status, 304);
});

// ──────────────────────── PATCH /api/sync/files ─────────────────────────────

test('PATCH returns 401 when user is not authenticated', async () => {
  const res = await syncFilesRoute.PATCH(
    new Request('http://localhost:3002/api/sync/files', {
      method: 'PATCH',
      body: JSON.stringify({ filename: 'non-negotiables.md', content: '# Rules' }),
      headers: { 'content-type': 'application/json' },
    }),
  );
  assert.equal(res.status, 401);
});

test('PATCH creates new file when none exists and no If-Match header', async () => {
  setMockUser(randomUUID());
  const res = await syncFilesRoute.PATCH(
    new Request('http://localhost:3002/api/sync/files', {
      method: 'PATCH',
      body: JSON.stringify({ filename: 'non-negotiables.md', content: '# New Rules' }),
      headers: { 'content-type': 'application/json' },
    }),
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; filename: string };
  assert.equal(body.ok, true);
  assert.equal(body.filename, 'non-negotiables.md');
  assert.ok(res.headers.get('etag'), 'response must include ETag');
});

test('PATCH returns 412 when If-Match does not match current ETag', async () => {
  const userId = randomUUID();
  const fileId = randomUUID();
  const now = new Date().toISOString();
  setMockUser(userId);
  upsertMockSyncFile({
    id: fileId,
    userId,
    filename: 'non-negotiables.md',
    content: '# Original',
    is_active: true,
    created_at: now,
    updated_at: now,
  });

  const res = await syncFilesRoute.PATCH(
    new Request('http://localhost:3002/api/sync/files', {
      method: 'PATCH',
      body: JSON.stringify({ filename: 'non-negotiables.md', content: '# Updated' }),
      headers: {
        'content-type': 'application/json',
        'if-match': '"wrong-etag-value"',
      },
    }),
  );
  assert.equal(res.status, 412);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'precondition_failed');
});

test('PATCH updates file and returns new ETag when If-Match matches', async () => {
  const userId = randomUUID();
  const fileId = randomUUID();
  const now = new Date().toISOString();
  setMockUser(userId);
  const record = {
    id: fileId,
    userId,
    filename: 'non-negotiables.md',
    content: '# Original',
    is_active: true,
    created_at: now,
    updated_at: now,
  };
  upsertMockSyncFile(record);

  const currentEtag = buildSyncFileEtag(record);
  const res = await syncFilesRoute.PATCH(
    new Request('http://localhost:3002/api/sync/files', {
      method: 'PATCH',
      body: JSON.stringify({ filename: 'non-negotiables.md', content: '# Updated' }),
      headers: {
        'content-type': 'application/json',
        'if-match': currentEtag,
      },
    }),
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; filename: string };
  assert.equal(body.ok, true);
  assert.equal(body.filename, 'non-negotiables.md');
  const newEtag = res.headers.get('etag');
  assert.ok(newEtag, 'response must include ETag');
  assert.notEqual(newEtag, currentEtag, 'ETag must change after content update');
});

test('PATCH returns 400 for invalid filename', async () => {
  setMockUser(randomUUID());
  const res = await syncFilesRoute.PATCH(
    new Request('http://localhost:3002/api/sync/files', {
      method: 'PATCH',
      body: JSON.stringify({ filename: '../escape.md', content: '# Content' }),
      headers: { 'content-type': 'application/json' },
    }),
  );
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: string };
  assert.equal(body.error, 'invalid_filename');
});

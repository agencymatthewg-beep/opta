import assert from 'node:assert/strict';
import test from 'node:test';
import { installRouteModuleHooks } from './support/route-module-hooks.ts';

installRouteModuleHooks();

const { SyncDistributedRateLimiter } = await import('../lib/sync/rate-limit.ts');

test('sync distributed limiter falls back to in-memory when remote is not configured', async () => {
  const limiter = new SyncDistributedRateLimiter({
    namespace: 'sync_files',
    limit: 2,
    windowMs: 60_000,
  });

  assert.equal(await limiter.check('user:1'), true);
  assert.equal(await limiter.check('user:1'), true);
  assert.equal(await limiter.check('user:1'), false);
});

test('sync distributed limiter uses remote counter when redis is configured', async () => {
  let incrCount = 0;
  const fetchCalls: string[] = [];

  const fetchMock: typeof fetch = async (input) => {
    const url = String(input);
    fetchCalls.push(url);

    if (url.includes('/INCR/')) {
      incrCount += 1;
      return new Response(JSON.stringify({ result: incrCount }), { status: 200 });
    }
    if (url.includes('/EXPIRE/')) {
      return new Response(JSON.stringify({ result: 1 }), { status: 200 });
    }
    return new Response(JSON.stringify({ result: 0 }), { status: 200 });
  };

  const limiter = new SyncDistributedRateLimiter({
    namespace: 'sync_files',
    limit: 1,
    windowMs: 60_000,
    redisUrl: 'https://upstash.example.com',
    redisToken: 'token',
    fetchImpl: fetchMock,
  });

  assert.equal(await limiter.check('user:2'), true);
  assert.equal(await limiter.check('user:2'), false);
  assert.equal(fetchCalls.some((call) => call.includes('/INCR/')), true);
});

test('sync distributed limiter backs off remote after errors and continues via local limiter', async () => {
  let remoteCalls = 0;
  const failingFetch: typeof fetch = async () => {
    remoteCalls += 1;
    throw new Error('network_down');
  };

  const limiter = new SyncDistributedRateLimiter({
    namespace: 'sync_files',
    limit: 1,
    windowMs: 60_000,
    redisUrl: 'https://upstash.example.com',
    redisToken: 'token',
    fetchImpl: failingFetch,
  });

  assert.equal(await limiter.check('user:3'), true);
  assert.equal(await limiter.check('user:3'), false);
  assert.equal(remoteCalls, 1);
});

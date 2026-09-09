import assert from 'node:assert/strict';
import test from 'node:test';
import { connectionLabel, createConnectionStore, probeSyncServer } from '@/lib/connectivity/connection-store';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

test('a browser network flag is not enough to show a connected server', async () => {
  const pending = deferred<boolean>();
  const store = createConnectionStore({ browserOnline: () => true, probe: () => pending.promise });
  assert.equal(store.getSnapshot(), 'checking');
  const check = store.check();
  assert.equal(store.getSnapshot(), 'checking');
  pending.resolve(true);
  assert.equal(await check, 'online');
});

test('failed server request reports offline even when navigator would report online', async () => {
  const store = createConnectionStore({ browserOnline: () => true, probe: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal(await store.check(), 'offline');
  assert.equal(store.getSnapshot(), 'offline');
});

test('browser offline state is immediate and makes no server request', async () => {
  let calls = 0;
  const store = createConnectionStore({ browserOnline: () => false, probe: async () => { calls++; return true; } });
  assert.equal(store.getSnapshot(), 'offline');
  assert.equal(await store.check(), 'offline');
  assert.equal(calls, 0);
});

test('a hanging connection check times out and cancels the request', async () => {
  let signal: AbortSignal | undefined;
  const store = createConnectionStore({ browserOnline: () => true, timeoutMs: 10,
    probe: input => { signal = input; return new Promise<boolean>(() => {}); } });
  assert.equal(await store.check(), 'offline');
  assert.equal(signal?.aborted, true);
});

test('a late successful response cannot turn the badge green after a disconnect', async () => {
  let online = true;
  const pending = deferred<boolean>();
  const store = createConnectionStore({ browserOnline: () => online, probe: () => pending.promise });
  const check = store.check();
  online = false;
  store.networkChanged();
  assert.equal(store.getSnapshot(), 'offline');
  pending.resolve(true);
  await check;
  assert.equal(store.getSnapshot(), 'offline');
});

test('an online browser event shows checking until the server answers', async () => {
  let online = false;
  const pending = deferred<boolean>();
  const store = createConnectionStore({ browserOnline: () => online, probe: () => pending.promise });
  await store.check();
  online = true;
  store.networkChanged();
  assert.equal(store.getSnapshot(), 'checking');
  pending.resolve(true);
  assert.equal(await store.check(), 'online');
});

test('manual recheck detects recovery without a browser online event', async () => {
  let reachable = false;
  const store = createConnectionStore({ browserOnline: () => true, probe: async () => reachable });
  assert.equal(await store.check(), 'offline');
  reachable = true;
  assert.equal(await store.check(), 'online');
});

test('concurrent checks and multiple UI subscribers share one probe', async () => {
  let calls = 0;
  let listenersStarted = 0;
  let listenersStopped = 0;
  const pending = deferred<boolean>();
  const store = createConnectionStore({ browserOnline: () => true,
    probe: () => { calls++; return pending.promise; },
    listen: () => { listenersStarted++; return () => { listenersStopped++; }; },
  });
  const first = store.subscribe(() => {});
  const second = store.subscribe(() => {});
  try {
    const a = store.check();
    const b = store.check();
    assert.equal(a, b);
    pending.resolve(true);
    await a;
    assert.equal(calls, 1);
    assert.equal(listenersStarted, 1);
    first();
    assert.equal(listenersStopped, 0);
  } finally { second(); }
  assert.equal(listenersStopped, 1);
});

test('unmount cancels the probe and ignores its late response', async () => {
  const pending = deferred<boolean>();
  let signal: AbortSignal | undefined;
  const store = createConnectionStore({ browserOnline: () => true,
    probe: input => { signal = input; return pending.promise; } });
  const stop = store.subscribe(() => {});
  const check = store.check();
  await Promise.resolve();
  stop();
  assert.equal(signal?.aborted, true);
  pending.resolve(true);
  await check;
  assert.notEqual(store.getSnapshot(), 'online');
});

test('polling detects recovery even when the browser emits no connectivity event', { timeout: 2000 }, async () => {
  let reachable = false;
  const recovered = deferred<void>();
  const store = createConnectionStore({ browserOnline: () => true, probe: async () => reachable, pollMs: 10 });
  const stop = store.subscribe(() => { if (store.getSnapshot() === 'online') recovered.resolve(); });
  try {
    assert.equal(await store.check(), 'offline');
    reachable = true;
    await recovered.promise;
    assert.equal(store.getSnapshot(), 'online');
  } finally { stop(); }
});

test('reconnect discards an old failed check instead of overwriting fresh online status', async () => {
  const old = deferred<boolean>();
  let calls = 0;
  const store = createConnectionStore({ browserOnline: () => true, probe: () => ++calls === 1 ? old.promise : Promise.resolve(true) });
  const first = store.check();
  await Promise.resolve();
  store.networkChanged();
  assert.equal(await store.check(), 'online');
  old.resolve(false);
  await first;
  assert.equal(store.getSnapshot(), 'online');
});

test('labels distinguish checking, unreachable server, and a reachable sync server', () => {
  assert.equal(connectionLabel('checking'), 'Checking connection...');
  assert.equal(connectionLabel('offline'), 'Offline mode');
  assert.equal(connectionLabel('online'), 'Sync server connected');
  assert.ok(!connectionLabel('online').includes('internet'));
});

test('server probe is unauthenticated, uncached, and validates the response', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  try {
    globalThis.fetch = async (input, init) => {
      assert.equal(input, '/api/v1/sync/server-time?_connection=1');
      assert.equal(init?.cache, 'no-store');
      assert.equal(init?.credentials, 'omit');
      assert.equal(init?.signal, controller.signal);
      assert.equal(new Headers(init?.headers).has('Authorization'), false);
      return new Response(JSON.stringify({ success: true, data: { serverTime: new Date().toISOString() } }));
    };
    assert.equal(await probeSyncServer('/api/v1/sync/server-time?_connection=1', controller.signal), true);
  } finally { globalThis.fetch = originalFetch; }
});

test('HTTP errors, captive portal pages and invalid timestamps never show online', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const response of [
      new Response('{}', { status: 500 }),
      new Response('{}', { status: 401 }),
      new Response('<html>Sign in to Wi-Fi</html>'),
      new Response(JSON.stringify({ success: true, data: { serverTime: 'invalid' } })),
      new Response(JSON.stringify({ success: false, data: { serverTime: new Date().toISOString() } })),
    ]) {
      globalThis.fetch = async () => response;
      assert.equal(await probeSyncServer('/probe', new AbortController().signal), false);
    }
  } finally { globalThis.fetch = originalFetch; }
});

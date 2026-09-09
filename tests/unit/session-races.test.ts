import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, apiFetch, apiDownload } from '@/lib/api/client';
import { AUTH_SESSION_CLEARED_EVENT, tokenStorage, type UserRole } from '@/lib/auth/session';
import { loginWithPassword } from '@/features/auth';
import { DashboardApi } from '@/features/dashboard/dashboard.api';
import { platformAdminStorage } from '@/lib/platform-admin/session';
import { platformAdminFetch, refreshPlatformAdminAccessToken } from '@/lib/platform-admin/client';
import { restorePlatformAdminSession, endPlatformAdminSession } from '@/features/platform-admin/auth';
import { performAutoSync } from '@/lib/sync/sync-manager';
import { customerApi } from '@/features/customers/customer-api';
import { offlineDB } from '@/lib/sync/offline-db';
import { completeBranchSwitch, getAssignedBranches } from '@/features/tenancy/branch-switching';
import { redirectPathForRoles } from '@/lib/auth/session';
import { createSessionRefresh } from '@/lib/auth/session-refresh';

const ID = '00000000-0000-4000-8000-000000000001';
const BRANCH = '00000000-0000-4000-8000-000000000002';
const admin = { id: ID, email: 'admin@example.test', fullName: 'Admin', role: 'SUPER_ADMIN' as const };
const user = { id: ID, email: 'user@example.test', fullName: 'User', branchId: BRANCH, language: 'en' as const, roles: ['OWNER'] as UserRole[] };
function jwt(data: object) {
  return `header.${Buffer.from(JSON.stringify(data)).toString('base64url')}.signature`;
}
function tenantToken(marker: string, roles: UserRole[] = ['OWNER']) {
  return jwt({ userId: ID, tenantId: ID, branchId: BRANCH, deviceId: ID, roles, marker });
}
function adminToken(marker: string) {
  return jwt({ tokenType: 'platform_admin', platformAdminId: ID, sub: ID, role: 'SUPER_ADMIN', marker });
}
function response(data: unknown = {}, status = 200) {
  return new Response(JSON.stringify({ success: status < 400, data, error: status >= 400 ? { message: 'Expired session', code: 'UNAUTHORIZED' } : null }), { status });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function errorCode(value: unknown) {
  assert.ok(value instanceof ApiError);
  return value.code;
}
async function browser(run: () => Promise<void>) {
  const values = new Map<string, string>();
  const events = new EventTarget();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) },
    atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
    dispatchEvent: (event: Event) => events.dispatchEvent(event),
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
  } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    onLine: true, platform: 'Test browser', userAgent: 'CueCloud session tests',
  } });
  globalThis.fetch = async () => { throw new Error('Unexpected real network request'); };
  try { await run(); } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
  }
}

test('customer deletion accepts empty 204 and removes its offline cache entry', async (t) => browser(async () => {
  tokenStorage.replaceSession({ accessToken: tenantToken('customer-delete') }, user);
  const removed: string[] = [];
  t.mock.method(offlineDB.cachedCustomers, 'delete', async (id: string) => { removed.push(id); });
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), `/api/v1/customers/${ID}`);
    assert.equal(init?.method, 'DELETE');
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${tenantToken('customer-delete')}`);
    const result = new Response(null, { status: 204 });
    t.mock.method(result, 'json', () => { assert.fail('204 has no JSON body to parse'); });
    return result;
  };
  assert.equal(await customerApi.remove(ID), undefined);
  assert.deepEqual(removed, [ID]);
}));

test('customer deletion still succeeds when offline cache cleanup fails', async (t) => browser(async () => {
  t.mock.method(offlineDB.cachedCustomers, 'delete', async () => { throw new Error('Cache unavailable'); });
  const warning = t.mock.method(console, 'warn', () => {});
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await customerApi.remove(ID), undefined);
  assert.equal(warning.mock.callCount(), 1);
}));

test('failed customer deletion preserves the cached customer and reports the error', async (t) => browser(async () => {
  const remove = t.mock.method(offlineDB.cachedCustomers, 'delete', async () => {});
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: { message: 'Deletion blocked', code: 'CONFLICT' } }), { status: 409 });
  await assert.rejects(customerApi.remove(ID), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 409);
    assert.equal(error.message, 'Deletion blocked');
    return true;
  });
  assert.equal(remove.mock.callCount(), 0);
}));

test('empty 200 is still rejected instead of being treated as a successful deletion', async (t) => browser(async () => {
  const remove = t.mock.method(offlineDB.cachedCustomers, 'delete', async () => {});
  globalThis.fetch = async () => new Response(null, { status: 200 });
  await assert.rejects(customerApi.remove(ID), /Unexpected response from server/);
  assert.equal(remove.mock.callCount(), 0);
}));

test('late 204 deletion cannot update a newly logged-in session', async (t) => browser(async () => {
  const remove = t.mock.method(offlineDB.cachedCustomers, 'delete', async () => {});
  tokenStorage.replaceSession({ accessToken: tenantToken('old') }, user);
  const pending = deferred<Response>();
  globalThis.fetch = async () => pending.promise;
  const deletion = customerApi.remove(ID).catch(error => error);
  tokenStorage.replaceSession({ accessToken: tenantToken('new') }, user);
  pending.resolve(new Response(null, { status: 204 }));
  assert.equal(errorCode(await deletion), 'SESSION_CHANGED');
  assert.equal(remove.mock.callCount(), 0);
}));

test('global branch switch persists the branch and sends matching auth on every subsequent page request', async () => browser(async () => {
  const nextBranch = '00000000-0000-4000-8000-000000000003';
  const nextUser = { ...user, branchId: nextBranch };
  const nextToken = jwt({ userId: ID, tenantId: ID, branchId: nextBranch, deviceId: ID, roles: ['OWNER'] });
  tokenStorage.replaceSession({ accessToken: tenantToken('old') }, user);
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    paths.push(path);
    const headers = new Headers(init?.headers);
    if (path === '/api/v1/auth/switch-branch') {
      assert.equal(init?.method, 'POST');
      assert.deepEqual(JSON.parse(String(init?.body)), { branchId: nextBranch });
      assert.equal(init?.credentials, 'include');
      assert.equal(headers.get('X-Branch-Id'), BRANCH);
      return response({ user: nextUser, accessToken: nextToken, expiresIn: '15m' });
    }
    assert.equal(headers.get('Authorization'), `Bearer ${nextToken}`);
    assert.equal(headers.get('X-Branch-Id'), nextBranch);
    return response([]);
  };
  await completeBranchSwitch(user, nextBranch, {
    replaceSession: (next, tokens) => tokenStorage.replaceSession(tokens, next),
    reScopeOfflineData: async (previous, next) => { assert.equal(previous, BRANCH); assert.equal(next, nextBranch); },
    refreshBranchState: async () => { await apiFetch('/notifications'); },
    navigate: path => { assert.equal(path, '/dashboard'); },
  });
  // Reading storage is also the application's restore-on-reload path.
  assert.equal(tokenStorage.getUser()?.branchId, nextBranch);
  assert.equal(tokenStorage.getAccessContext()?.branchId, nextBranch);
  for (const path of ['/dashboard/kpis', '/sessions', '/catalog', '/customers', '/billing/invoices', '/udhaar/customers']) await apiFetch(path);
  assert.equal(paths.length, 8);
  assert.equal(redirectPathForRoles(['OWNER']), '/dashboard');
}));

test('failed global branch switch retains the previous branch and performs no maintenance', async () => browser(async () => {
  tokenStorage.replaceSession({ accessToken: tenantToken('old') }, user);
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: { message: 'Branch access denied' } }), { status: 403 });
  const unexpected = () => { assert.fail('Failed switch must not change the current application scope'); };
  await assert.rejects(completeBranchSwitch(user, ID, { replaceSession: unexpected, reScopeOfflineData: async () => unexpected(), refreshBranchState: async () => unexpected(), navigate: unexpected }), /Branch access denied/);
  assert.equal(tokenStorage.getUser()?.branchId, BRANCH);
  assert.equal(tokenStorage.get()?.accessToken, tenantToken('old'));
}));

test('a completed switch does not navigate after another tab replaces its session during maintenance', async () => browser(async () => {
  tokenStorage.replaceSession({ accessToken: tenantToken('old') }, user);
  const started = deferred<void>();
  const pending = deferred<void>();
  let navigated = false;
  const completion = completeBranchSwitch(user, BRANCH, {
    requestSwitch: async () => ({ user, accessToken: tenantToken('switched'), expiresIn: '15m' }),
    replaceSession: (next, tokens) => tokenStorage.replaceSession(tokens, next),
    reScopeOfflineData: async () => { started.resolve(); await pending.promise; },
    refreshBranchState: async () => {}, navigate: () => { navigated = true; },
  });
  await started.promise;
  tokenStorage.replaceSession({ accessToken: tenantToken('new-login') }, user);
  pending.resolve();
  await completion;
  assert.equal(navigated, false);
  assert.equal(tokenStorage.get()?.accessToken, tenantToken('new-login'));
}));

const domains = [
  {
    name: 'tenant', refreshPath: '/api/v1/auth/refresh', protectedPath: '/api/v1/auth/me',
    token: tenantToken, login: (marker: string) => tokenStorage.replaceSession({ accessToken: tenantToken(marker) }, user),
    getToken: () => tokenStorage.get()?.accessToken ?? null, getUser: () => tokenStorage.getUser(),
    clear: () => tokenStorage.clear(), version: () => tokenStorage.getSessionVersion(),
    request: () => apiFetch('/auth/me'),
  },
  {
    name: 'platform', refreshPath: '/api/v1/super-admin/auth/refresh', protectedPath: '/api/v1/super-admin/auth/me',
    token: adminToken, login: (marker: string) => platformAdminStorage.replaceSession(adminToken(marker), admin),
    getToken: () => platformAdminStorage.getAccessToken(), getUser: () => platformAdminStorage.getAdmin(),
    clear: () => platformAdminStorage.clear(), version: () => platformAdminStorage.getSessionVersion(),
    request: () => platformAdminFetch('/super-admin/auth/me'),
  },
];

for (const domain of domains) {
  for (const status of [200, 401]) {
    test(`${domain.name}: late refresh ${status} cannot replace or clear a new login`, { timeout: 5000 }, async () => browser(async () => {
      domain.login('old');
      const started = deferred<void>();
      const pending = deferred<Response>();
      let protectedCalls = 0;
      let refreshSignal: AbortSignal | null | undefined;
      globalThis.fetch = async (input, init) => {
        if (String(input) === domain.refreshPath) { refreshSignal = init?.signal; started.resolve(); return pending.promise; }
        protectedCalls++;
        return response({}, 401);
      };
      const oldRequest = domain.request().catch(error => error);
      await started.promise;
      domain.login('new');
      assert.equal(refreshSignal?.aborted, true, 'stop the old refresh as soon as the session changes');
      pending.resolve(response({ accessToken: domain.token('old-refreshed'), expiresIn: '15m' }, status));
      assert.equal(errorCode(await oldRequest), 'SESSION_CHANGED');
      assert.equal(domain.getToken(), domain.token('new'));
      assert.ok(domain.getUser());
      assert.equal(protectedCalls, 1, 'must not retry old work under the new login');
    }));
  }

  test(`${domain.name}: late refresh cannot resurrect a logged-out session`, async () => browser(async () => {
    domain.login('old');
    const started = deferred<void>();
    const pending = deferred<Response>();
    globalThis.fetch = async (input) => {
      if (String(input) === domain.refreshPath) { started.resolve(); return pending.promise; }
      return response({}, 401);
    };
    const request = domain.request().catch(error => error);
    await started.promise;
    domain.clear();
    pending.resolve(response({ accessToken: domain.token('late'), expiresIn: '15m' }));
    await request;
    assert.equal(domain.getToken(), null);
    assert.equal(domain.getUser(), null);
  }));

  test(`${domain.name}: a delayed initial 401 does not refresh a different session`, async () => browser(async () => {
    domain.login('old');
    const pending = deferred<Response>();
    let calls = 0;
    globalThis.fetch = async () => { calls++; return pending.promise; };
    const request = domain.request().catch(error => error);
    domain.login('new');
    pending.resolve(response({}, 401));
    assert.equal(errorCode(await request), 'SESSION_CHANGED');
    assert.equal(calls, 1);
    assert.equal(domain.getToken(), domain.token('new'));
  }));

  test(`${domain.name}: a second 401 after retry cannot clear a newer login`, async () => browser(async () => {
    domain.login('old');
    const retried = deferred<void>();
    const pending = deferred<Response>();
    let protectedCalls = 0;
    globalThis.fetch = async (input) => {
      if (String(input) === domain.refreshPath) return response({ accessToken: domain.token('rotated'), expiresIn: '15m' });
      if (++protectedCalls === 1) return response({}, 401);
      retried.resolve(); return pending.promise;
    };
    const request = domain.request().catch(error => error);
    await retried.promise;
    domain.login('new');
    pending.resolve(response({}, 401));
    assert.equal(errorCode(await request), 'SESSION_CHANGED');
    assert.equal(domain.getToken(), domain.token('new'));
  }));

  test(`${domain.name}: current-session unauthorized refresh still logs out`, async () => browser(async () => {
    domain.login('expired');
    globalThis.fetch = async () => response({}, 401);
    await domain.request().catch(() => {});
    assert.equal(domain.getToken(), null);
    assert.equal(domain.getUser(), null);
  }));

  test(`${domain.name}: a transient refresh failure preserves the session`, async () => browser(async () => {
    domain.login('current');
    globalThis.fetch = async input => response({}, String(input) === domain.refreshPath ? 500 : 401);
    await domain.request().catch(() => {});
    assert.equal(domain.getToken(), domain.token('current'));
    assert.ok(domain.getUser());
  }));

  test(`${domain.name}: concurrent 401s share one refresh and retry with its token`, async () => browser(async () => {
    domain.login('old');
    const version = domain.version();
    const started = deferred<void>();
    const pending = deferred<Response>();
    let refreshes = 0;
    globalThis.fetch = async (input, init) => {
      if (String(input) === domain.refreshPath) { refreshes++; started.resolve(); return pending.promise; }
      return new Headers(init?.headers).get('Authorization') === `Bearer ${domain.token('rotated')}`
        ? response({ ok: true }) : response({}, 401);
    };
    const first = domain.request();
    const second = domain.request();
    await started.promise;
    pending.resolve(response({ accessToken: domain.token('rotated'), expiresIn: '15m' }));
    await Promise.all([first, second]);
    assert.equal(refreshes, 1);
    assert.equal(domain.version(), version, 'routine refresh must not invalidate the session');
    assert.equal(domain.getToken(), domain.token('rotated'));
  }));

  test(`${domain.name}: identical JWTs from separate logins still change session version`, async () => browser(async () => {
    domain.login('same-token');
    const before = domain.version();
    domain.login('same-token');
    assert.notEqual(domain.version(), before);
  }));

  test(`${domain.name}: a refresh for another account cannot replace the current identity`, async () => browser(async () => {
    domain.login('current');
    const otherId = '00000000-0000-4000-8000-000000000099';
    const wrongToken = domain.name === 'tenant'
      ? jwt({ userId: otherId, tenantId: ID, branchId: BRANCH, deviceId: ID, roles: ['OWNER'] })
      : jwt({ tokenType: 'platform_admin', platformAdminId: otherId, sub: otherId, role: 'SUPER_ADMIN' });
    globalThis.fetch = async input => String(input) === domain.refreshPath
      ? response({ accessToken: wrongToken, expiresIn: '15m' }) : response({}, 401);
    await domain.request().catch(() => {});
    assert.equal(domain.getToken(), domain.token('current'));
    assert.equal(domain.getUser()?.id, ID);
  }));
}

test('platform startup refresh cannot erase a login saved while it was pending', async () => browser(async () => {
  const pending = deferred<Response>();
  globalThis.fetch = async () => pending.promise;
  const restore = restorePlatformAdminSession();
  platformAdminStorage.replaceSession(adminToken('new'), admin);
  pending.resolve(response({}, 401));
  assert.equal(await restore, null);
  assert.equal(platformAdminStorage.getAccessToken(), adminToken('new'));
  assert.deepEqual(platformAdminStorage.getAdmin(), admin);
}));

test('a late platform /me response does not overwrite new admin details', async () => browser(async () => {
  platformAdminStorage.replaceSession(adminToken('old'), admin);
  const pending = deferred<Response>();
  globalThis.fetch = async () => pending.promise;
  const restore = restorePlatformAdminSession();
  const nextAdmin = { ...admin, fullName: 'New login' };
  platformAdminStorage.replaceSession(adminToken('new'), nextAdmin);
  pending.resolve(response({ platformAdminId: ID, ...admin }));
  assert.equal(await restore, null);
  assert.deepEqual(platformAdminStorage.getAdmin(), nextAdmin);
}));

test('a late platform logout response does not clear the next login', async () => browser(async () => {
  platformAdminStorage.replaceSession(adminToken('old'), admin);
  const pending = deferred<void>();
  const logout = endPlatformAdminSession(() => pending.promise);
  platformAdminStorage.replaceSession(adminToken('new'), admin);
  pending.resolve(); await logout;
  assert.equal(platformAdminStorage.getAccessToken(), adminToken('new'));
}));

test('downloads cannot retry under a different login', async () => browser(async () => {
  tokenStorage.replaceSession({ accessToken: tenantToken('old') }, user);
  const pending = deferred<Response>();
  let calls = 0;
  globalThis.fetch = async () => { calls++; return pending.promise; };
  const download = apiDownload('/receipts/test').catch(error => error);
  tokenStorage.replaceSession({ accessToken: tenantToken('new') }, user);
  pending.resolve(response({}, 401));
  assert.equal((await download).code, 'SESSION_CHANGED');
  assert.equal(calls, 1);
  assert.equal(tokenStorage.get()?.accessToken, tenantToken('new'));
}));

test('all staff roles preserve the logged-in user and attach the bearer token', async () => browser(async () => {
  for (const role of ['OWNER', 'MANAGER', 'ACCOUNTANT', 'CASHIER'] as UserRole[]) {
    const token = tenantToken(role, [role]);
    tokenStorage.replaceSession({ accessToken: token }, { ...user, roles: [role] });
    globalThis.fetch = async (_input, init) => {
      assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${token}`);
      return response({ roles: [role] });
    };
    assert.deepEqual(await apiFetch('/auth/me'), { roles: [role] });
    assert.deepEqual(tokenStorage.getUser()?.roles, [role]);
  }
}));

for (const missing of ['token', 'entire session']) {
test(`dashboard and branch 401s notify logout when the stored ${missing} is missing`, async () => browser(async () => {
  tokenStorage.replaceSession({ accessToken: tenantToken('lost') }, user);
  window.localStorage.removeItem('cuecloud_access_token');
  if (missing === 'entire session') {
    window.localStorage.removeItem('cuecloud_user');
    window.localStorage.removeItem('cuecloud_session_version');
  }
  let cleared = 0;
  window.addEventListener(AUTH_SESSION_CLEARED_EVENT, () => { cleared++; });
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    paths.push(String(input));
    assert.equal(new Headers(init?.headers).get('Authorization'), null);
    return new Response(JSON.stringify({ success: false, error: { message: 'Missing bearer token', code: 'UNAUTHORIZED' } }), { status: 401 });
  };

  const results = await Promise.allSettled([DashboardApi.getKPIs(), getAssignedBranches()]);

  for (const result of results) {
    assert.equal(result.status, 'rejected');
    if (result.status === 'rejected') {
      assert.ok(result.reason instanceof ApiError);
      assert.equal(result.reason.status, 401);
    }
  }
  assert.equal(tokenStorage.getUser(), null, 'a cached name must not keep the dashboard signed in');
  assert.equal(cleared, 1, 'notify AuthProvider to redirect to login once');
  assert.deepEqual(paths, ['/api/v1/dashboard/kpis', '/api/v1/tenancy/branches/assigned']);
}));
}

test('a delayed missing-token 401 cannot clear a fresh login', async () => browser(async () => {
  tokenStorage.setUser(user);
  const pending = deferred<Response>();
  globalThis.fetch = async () => pending.promise;
  const request = DashboardApi.getKPIs().catch(error => error);
  tokenStorage.replaceSession({ accessToken: tenantToken('new') }, user);
  pending.resolve(response({}, 401));
  assert.equal(errorCode(await request), 'SESSION_CHANGED');
  assert.equal(tokenStorage.get()?.accessToken, tenantToken('new'));
  assert.deepEqual(tokenStorage.getUser(), user);
}));

test('the same owner can log in again and authenticate dashboard and branch requests', async () => browser(async () => {
  tokenStorage.setUser(user);
  let cleared = 0;
  window.addEventListener(AUTH_SESSION_CLEARED_EVENT, () => { cleared++; });
  globalThis.fetch = async () => response({}, 401);
  await assert.rejects(loginWithPassword(user.email, 'incorrect-test-password'), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'UNAUTHORIZED');
    return true;
  });
  assert.equal(cleared, 0, 'a rejected login must remain an ordinary login error');

  const token = tenantToken('relogin');
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    paths.push(path);
    if (path.endsWith('/auth/login')) {
      assert.equal(new Headers(init?.headers).get('Authorization'), null);
      assert.equal(init?.method, 'POST');
      return response({ user, accessToken: token, expiresIn: '15m' });
    }
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${token}`);
    return response({});
  };
  const { user: loggedInUser, ...tokens } = await loginWithPassword(user.email, 'test-password');
  tokenStorage.replaceSession(tokens, loggedInUser);
  await Promise.all([DashboardApi.getKPIs(), getAssignedBranches()]);
  assert.deepEqual(tokenStorage.getUser(), user);
  assert.deepEqual(paths, ['/api/v1/auth/login', '/api/v1/dashboard/kpis', '/api/v1/tenancy/branches/assigned']);
}));

test('independent tab refresh helpers share a browser lock and reuse the rotated token', async () => browser(async () => {
  let queue = Promise.resolve();
  Object.defineProperty(navigator, 'locks', { value: { request: (_name: string, task: () => Promise<boolean>) => {
    const next = queue.then(task); queue = next.then(() => {}); return next;
  } } });
  let token = 'old';
  let clears = 0;
  const store = { lockName: 'tenant-test', getVersion: () => 'login-1', getToken: () => token,
    setToken: (next: string) => { token = next; }, clear: () => { clears++; }, changeEvents: [] };
  const started = deferred<void>();
  const pending = deferred<{ accessToken: string }>();
  let requests = 0;
  const request = async () => { requests++; started.resolve(); return pending.promise; };
  const first = createSessionRefresh(store, request)();
  const second = createSessionRefresh(store, request)();
  await started.promise;
  pending.resolve({ accessToken: 'rotated' });
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
  assert.equal(requests, 1);
  assert.equal(clears, 0);
}));

test('a tab waiting for the refresh lock cannot refresh a replacement login', async () => browser(async () => {
  const gate = deferred<void>();
  Object.defineProperty(navigator, 'locks', { value: { request: async (_name: string, task: () => Promise<boolean>) => {
    await gate.promise; return task();
  } } });
  let version = 'old';
  let requests = 0;
  const refresh = createSessionRefresh({ lockName: 'tenant-test', getVersion: () => version,
    getToken: () => 'token', setToken: () => assert.fail('must not replace login'),
    clear: () => assert.fail('must not clear login'), changeEvents: [] },
    async () => { requests++; return {}; });
  const waiting = refresh();
  version = 'new';
  gate.resolve();
  assert.equal(await waiting, false);
  assert.equal(requests, 0);
}));

test('sync makes no requests without a logged-in session', async () => browser(async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return response(); };
  await performAutoSync();
  assert.equal(calls, 0);
}));

test('sync stops after an expired heartbeat instead of sending a tokenless pull', async () => browser(async () => {
  tokenStorage.replaceSession({ accessToken: tenantToken('expired') }, user);
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    paths.push(String(input));
    if (!String(input).endsWith('/auth/refresh')) assert.ok(new Headers(init?.headers).has('Authorization'));
    return response({}, 401);
  };
  await performAutoSync();
  assert.deepEqual(paths, ['/api/v1/sync/heartbeat', '/api/v1/auth/refresh']);
  assert.equal(tokenStorage.get(), null);
}));

test('sync stops when a branch switch replaces the session mid-request', async () => browser(async () => {
  tokenStorage.replaceSession({ accessToken: tenantToken('old') }, user);
  const started = deferred<void>();
  const pending = deferred<Response>();
  const paths: string[] = [];
  globalThis.fetch = async (input) => { paths.push(String(input)); started.resolve(); return pending.promise; };
  const sync = performAutoSync();
  await started.promise;
  const switchedToken = jwt({ userId: ID, tenantId: ID, branchId: ID, deviceId: ID, roles: ['OWNER'] });
  tokenStorage.replaceSession({ accessToken: switchedToken }, { ...user, branchId: ID });
  pending.resolve(response());
  await sync;
  assert.deepEqual(paths, ['/api/v1/sync/heartbeat']);
  assert.equal(tokenStorage.get()?.accessToken, switchedToken);
}));

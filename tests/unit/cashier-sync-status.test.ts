import assert from "node:assert/strict";
import test from "node:test";
import { sendHeartbeat, pushSyncChanges, pullSyncChanges } from "@/services/sync.service";
import { tokenStorage } from "@/lib/auth/session";
import {
  saveOfflineAuthProfile,
  createOfflineAccessToken,
  getOfflineAuthVault,
  type OfflineAuthRecord,
} from "@/lib/auth/offline-auth";

const CASHIER_USER_ID = "d9e2dbc7-080b-43a0-8499-d4c1dbd0f2c5";
const BRANCH_ID = "00000000-0000-4000-8000-000000000002";
const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const CASHIER_DEVICE_ID = "da679bc1-4de6-489b-8d97-22ba025b43a5";

function makeJwt(data: object) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${header}.${payload}.signature`;
}

function mockCashierToken() {
  return makeJwt({
    userId: CASHIER_USER_ID,
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    deviceId: CASHIER_DEVICE_ID,
    roles: ["CASHIER"],
  });
}

async function withMockBrowser(run: () => Promise<void>) {
  const store = new Map<string, string>();
  const originalWindow = (globalThis as any).window;
  const originalFetch = (globalThis as any).fetch;

  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, val: string) => store.set(key, val),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    },
    atob: (str: string) => Buffer.from(str, "base64").toString("binary"),
    btoa: (str: string) => Buffer.from(str, "binary").toString("base64"),
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  try {
    await run();
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).fetch = originalFetch;
  }
}

test("Cashier Sync Service: sendHeartbeat automatically resolves deviceId and branchId from authenticated token context", async () => {
  await withMockBrowser(async () => {
    tokenStorage.set({ accessToken: mockCashierToken() });

    let capturedUrl = "";
    let capturedBody: any = null;

    (globalThis as any).fetch = async (url: string, init: any) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            deviceId: capturedBody.deviceId,
            branchId: capturedBody.branchId,
            lastHeartbeatAt: new Date().toISOString(),
            lastSyncedAt: null,
          },
          error: null,
        }),
      };
    };

    // Even if an undefined or legacy argument is passed, it must send the authenticated Cashier device ID
    await sendHeartbeat();

    assert.equal(capturedBody.deviceId, CASHIER_DEVICE_ID);
    assert.equal(capturedBody.branchId, BRANCH_ID);
  });
});

test("Cashier Sync Service: pushSyncChanges automatically prioritizes authenticated deviceId", async () => {
  await withMockBrowser(async () => {
    tokenStorage.set({ accessToken: mockCashierToken() });

    let capturedBody: any = null;

    (globalThis as any).fetch = async (url: string, init: any) => {
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            batchId: "batch-1",
            deviceId: capturedBody.deviceId,
            receivedChanges: 0,
            acceptedChanges: [],
            rejectedChanges: [],
            serverTime: new Date().toISOString(),
          },
          error: null,
        }),
      };
    };

    await pushSyncChanges();

    assert.equal(capturedBody.deviceId, CASHIER_DEVICE_ID);
  });
});

test("Cashier Sync Service: pullSyncChanges includes effective authenticated deviceId in query", async () => {
  await withMockBrowser(async () => {
    tokenStorage.set({ accessToken: mockCashierToken() });

    let capturedUrl = "";

    (globalThis as any).fetch = async (url: string) => {
      capturedUrl = url;
      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            deviceId: CASHIER_DEVICE_ID,
            since: null,
            changes: [],
            changeCount: 0,
            serverTime: new Date().toISOString(),
          },
          error: null,
        }),
      };
    };

    await pullSyncChanges();

    assert(capturedUrl.includes(`deviceId=${encodeURIComponent(CASHIER_DEVICE_ID)}`));
  });
});

test("Cashier Offline Profile: preserves deviceId and populates it into offline tokens", async () => {
  await withMockBrowser(async () => {
    const cashierUser = {
      id: CASHIER_USER_ID,
      email: "cashier@demo.cuecloud.test",
      fullName: "Demo Cashier",
      roles: ["CASHIER" as const],
      branchId: BRANCH_ID,
      language: "en" as const,
    };

    saveOfflineAuthProfile({
      user: cashierUser,
      tenantId: TENANT_ID,
      tokens: { accessToken: mockCashierToken() },
      pin: "1234",
    });

    const vault = getOfflineAuthVault();
    const profile = vault.find((r) => r.id === CASHIER_USER_ID);

    assert(profile);
    assert.equal(profile.deviceId, CASHIER_DEVICE_ID);

    const offlineToken = createOfflineAccessToken(profile);
    const payloadPart = offlineToken.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payloadPart, "base64").toString());

    assert.equal(decoded.deviceId, CASHIER_DEVICE_ID);
    assert.equal(decoded.branchId, BRANCH_ID);
  });
});

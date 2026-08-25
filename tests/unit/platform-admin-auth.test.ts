import assert from "node:assert/strict";
import test from "node:test";

import {
  endPlatformAdminSession,
  establishPlatformAdminSession,
  getCurrentPlatformAdmin,
  loginPlatformAdmin,
} from "@/features/platform-admin/auth";
import { getPlatformAdminRouteDecision } from "@/features/platform-admin/route-guard";
import { ApiError } from "@/lib/api/client";
import { refreshPlatformAdminAccessToken } from "@/lib/platform-admin/client";
import {
  decodePlatformAdminAccessToken,
  PLATFORM_ADMIN_STORAGE_KEYS,
  platformAdminStorage,
  type PlatformAdmin,
} from "@/lib/platform-admin/session";

const ADMIN_ID = "00000000-0000-4000-8000-000000000020";
const TENANT_USER_ID = "00000000-0000-4000-8000-000000000021";
const TENANT_ID = "00000000-0000-4000-8000-000000000022";
const BRANCH_ID = "00000000-0000-4000-8000-000000000023";
const DEVICE_ID = "00000000-0000-4000-8000-000000000024";
const TENANT_ACCESS_KEY = "cuecloud_access_token";
const TENANT_USER_KEY = "cuecloud_user";

const admin: PlatformAdmin = {
  id: ADMIN_ID,
  email: "platform@example.com",
  fullName: "Platform Admin",
  role: "SUPER_ADMIN",
};

function jwt(payload: Record<string, unknown>) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

function platformToken(marker: string) {
  return jwt({
    tokenType: "platform_admin",
    platformAdminId: ADMIN_ID,
    role: "SUPER_ADMIN",
    sub: ADMIN_ID,
    marker,
  });
}

function tenantToken() {
  return jwt({
    userId: TENANT_USER_ID,
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    deviceId: DEVICE_ID,
    roles: ["SUPER_ADMIN"],
  });
}

function envelope(data: unknown, status = 200) {
  return new Response(
    JSON.stringify({ success: status < 400, data, error: null }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function errorEnvelope(message: string, status: number, code: string) {
  return new Response(
    JSON.stringify({
      success: false,
      data: null,
      error: { message, code },
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function withBrowser(
  run: (storage: Storage) => Promise<void>,
) {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: storage,
      atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
      dispatchEvent: () => true,
    } as unknown as Window,
  });

  try {
    await run(storage);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  }
}

test("valid PlatformAdmin login establishes only the platform session", async () => {
  await withBrowser(async (storage) => {
    storage.setItem(TENANT_ACCESS_KEY, "tenant-access-token");
    storage.setItem(TENANT_USER_KEY, "tenant-user");
    let requestChecked = false;
    globalThis.fetch = (async (input, init) => {
      assert.equal(String(input), "/api/v1/super-admin/auth/login");
      assert.equal(init?.credentials, "include");
      assert.deepEqual(JSON.parse(String(init?.body)), {
        email: "platform@example.com",
        password: "correct-password",
      });
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        undefined,
      );
      requestChecked = true;
      return envelope({
        admin,
        accessToken: platformToken("login"),
        refreshToken: "http-only-browser-does-not-store-this",
        expiresIn: "15m",
      });
    }) as typeof fetch;

    const result = await loginPlatformAdmin(
      "platform@example.com",
      "correct-password",
    );
    establishPlatformAdminSession(result);

    assert.equal(requestChecked, true);
    assert.equal(platformAdminStorage.getAdmin()?.id, ADMIN_ID);
    assert.equal(
      decodePlatformAdminAccessToken(
        platformAdminStorage.getAccessToken() ?? "",
      )?.platformAdminId,
      ADMIN_ID,
    );
    assert.equal(storage.getItem(TENANT_ACCESS_KEY), "tenant-access-token");
    assert.equal(storage.getItem(TENANT_USER_KEY), "tenant-user");
  });
});

test("invalid PlatformAdmin login returns the backend error without creating state", async () => {
  await withBrowser(async () => {
    let requestCount = 0;
    globalThis.fetch = (async () => {
      requestCount += 1;
      return errorEnvelope("Invalid email or password", 401, "UNAUTHORIZED");
    }) as typeof fetch;

    await assert.rejects(
      loginPlatformAdmin("bad@example.com", "wrong"),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 401 &&
        error.message === "Invalid email or password",
    );
    assert.equal(requestCount, 1);
    assert.equal(platformAdminStorage.getAccessToken(), null);
    assert.equal(platformAdminStorage.getAdmin(), null);
  });
});

test("a tenant token cannot authenticate a super-admin route", async () => {
  await withBrowser(async (storage) => {
    storage.setItem(
      PLATFORM_ADMIN_STORAGE_KEYS.accessToken,
      tenantToken(),
    );
    storage.setItem(PLATFORM_ADMIN_STORAGE_KEYS.admin, JSON.stringify(admin));

    assert.equal(decodePlatformAdminAccessToken(tenantToken()), null);
    assert.equal(platformAdminStorage.getAccessToken(), null);
    assert.deepEqual(
      getPlatformAdminRouteDecision(false, false, "/tenants"),
      {
        status: "redirect",
        destination: "/super-admin/login?next=%2Ftenants",
      },
    );
  });
});

test("an unauthenticated visitor is redirected to PlatformAdmin login", () => {
  assert.deepEqual(
    getPlatformAdminRouteDecision(false, false, "/audit"),
    {
      status: "redirect",
      destination: "/super-admin/login?next=%2Faudit",
    },
  );
  assert.deepEqual(
    getPlatformAdminRouteDecision(true, false, "/audit"),
    { status: "loading" },
  );
});

test("PlatformAdmin refresh rotates access while preserving current admin", async () => {
  await withBrowser(async () => {
    platformAdminStorage.replaceSession(platformToken("old"), admin);
    let refreshCalled = false;
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (url.endsWith("/super-admin/auth/refresh")) {
        refreshCalled = true;
        assert.equal(init?.credentials, "include");
        return envelope({
          accessToken: platformToken("refreshed"),
          refreshToken: "rotated-http-only-token",
          expiresIn: "15m",
        });
      }
      assert.equal(url, "/api/v1/super-admin/auth/me");
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        `Bearer ${platformToken("refreshed")}`,
      );
      return envelope({
        platformAdminId: ADMIN_ID,
        email: admin.email,
        fullName: admin.fullName,
        role: "SUPER_ADMIN",
      });
    }) as typeof fetch;

    assert.equal(await refreshPlatformAdminAccessToken(), true);
    assert.equal(refreshCalled, true);
    assert.equal(platformAdminStorage.getAccessToken(), platformToken("refreshed"));
    assert.deepEqual(platformAdminStorage.getAdmin(), admin);
    assert.deepEqual(await getCurrentPlatformAdmin(), admin);
  });
});

test("PlatformAdmin logout clears only platform state", async () => {
  await withBrowser(async (storage) => {
    storage.setItem(TENANT_ACCESS_KEY, "tenant-access-token");
    storage.setItem(TENANT_USER_KEY, "tenant-user");
    platformAdminStorage.replaceSession(platformToken("logout"), admin);
    let logoutCalled = false;

    await endPlatformAdminSession(async () => {
      logoutCalled = true;
    });

    assert.equal(logoutCalled, true);
    assert.equal(platformAdminStorage.getAccessToken(), null);
    assert.equal(platformAdminStorage.getAdmin(), null);
    assert.equal(storage.getItem(TENANT_ACCESS_KEY), "tenant-access-token");
    assert.equal(storage.getItem(TENANT_USER_KEY), "tenant-user");
  });
});

test("normal tenant auth storage is unaffected by platform session expiry", async () => {
  await withBrowser(async (storage) => {
    storage.setItem(TENANT_ACCESS_KEY, "tenant-access-token");
    storage.setItem(TENANT_USER_KEY, "tenant-user");
    platformAdminStorage.replaceSession(platformToken("expired"), admin);
    platformAdminStorage.clear();

    assert.equal(storage.getItem(TENANT_ACCESS_KEY), "tenant-access-token");
    assert.equal(storage.getItem(TENANT_USER_KEY), "tenant-user");
  });
});

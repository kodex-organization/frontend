import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BranchSelector } from "@/features/tenancy/components/branch-selector";
import {
  completeBranchSwitch,
  type AssignedBranch,
  type BranchSwitchSession,
} from "@/features/tenancy/branch-switching";
import { tokenStorage, type SessionUser } from "@/lib/auth/session";
import {
  filterPendingSyncItemsForBranch,
  type PendingSyncItem,
} from "@/lib/sync/offline-db";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const DEVICE_ID = "00000000-0000-4000-8000-000000000002";
const TENANT_ID = "00000000-0000-4000-8000-000000000003";
const BRANCH_A = "00000000-0000-4000-8000-000000000004";
const BRANCH_B = "00000000-0000-4000-8000-000000000005";

const currentUser: SessionUser = {
  id: USER_ID,
  fullName: "Owner User",
  email: "owner@example.com",
  branchId: BRANCH_A,
  roles: ["OWNER"],
  language: "en",
};

const switchedUser: SessionUser = {
  ...currentUser,
  branchId: BRANCH_B,
  roles: ["MANAGER"],
};

function assignedBranch(
  id: string,
  name: string,
  isSelected: boolean,
): AssignedBranch {
  return {
    id,
    name,
    address: null,
    currency: "PKR",
    timezone: "Asia/Karachi",
    language: "en",
    roles: isSelected ? ["OWNER"] : ["MANAGER"],
    isSelected,
  };
}

function accessToken(branchId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      userId: USER_ID,
      tenantId: TENANT_ID,
      branchId,
      deviceId: DEVICE_ID,
      roles: branchId === BRANCH_A ? ["OWNER"] : ["MANAGER"],
    }),
  ).toString("base64url");
  return `header.${payload}.signature`;
}

function switchedSession(): BranchSwitchSession {
  return {
    user: switchedUser,
    accessToken: accessToken(BRANCH_B),
    expiresIn: "15m",
  };
}

test("assigned branches render and a single assignment hides the selector", () => {
  const branches = [
    assignedBranch(BRANCH_A, "Main Hall", true),
    assignedBranch(BRANCH_B, "DHA Branch", false),
  ];

  const markup = renderToStaticMarkup(
    <BranchSelector
      branches={branches}
      activeBranchId={BRANCH_A}
      switching={false}
      onSwitch={() => undefined}
    />,
  );

  assert.match(markup, /aria-label="Active branch"/);
  assert.match(markup, /Main Hall/);
  assert.match(markup, /DHA Branch/);
  assert.match(markup, new RegExp(`value="${BRANCH_A}" selected`));

  const singleBranchMarkup = renderToStaticMarkup(
    <BranchSelector
      branches={[branches[0]]}
      activeBranchId={BRANCH_A}
      switching={false}
      onSwitch={() => undefined}
    />,
  );
  assert.equal(singleBranchMarkup, "");
});

test("global selector shows the active branch even for a single-branch owner", () => {
  const markup = renderToStaticMarkup(<BranchSelector branches={[assignedBranch(BRANCH_A, "Main Hall", true)]} activeBranchId={BRANCH_A} switching={false} onSwitch={() => {}} showSingle />);
  assert.match(markup, /Main Hall/);
  assert.match(markup, new RegExp(`value="${BRANCH_A}" selected`));
  assert.doesNotMatch(markup, /All Branches/);
});

test("global selector does not silently select a different branch when the active one is unavailable", () => {
  const markup = renderToStaticMarkup(<BranchSelector branches={[assignedBranch(BRANCH_B, "Second", false)]} activeBranchId={BRANCH_A} switching={false} onSwitch={() => {}} showSingle />);
  assert.match(markup, /Select an active branch/);
  assert.match(markup, new RegExp(`value="${BRANCH_A}" selected`));
});

test("successful switch replaces auth before refreshing branch-scoped state", async () => {
  const events: string[] = [];

  const result = await completeBranchSwitch(currentUser, BRANCH_B, {
    requestSwitch: async (branchId) => {
      assert.equal(branchId, BRANCH_B);
      events.push("requested");
      return switchedSession();
    },
    replaceSession: (user, tokens) => {
      assert.equal(user.branchId, BRANCH_B);
      assert.equal(tokens.accessToken, accessToken(BRANCH_B));
      events.push("auth-replaced");
    },
    reScopeOfflineData: async (previousBranchId, nextBranchId) => {
      assert.equal(events.at(-1), "auth-replaced");
      assert.equal(previousBranchId, BRANCH_A);
      assert.equal(nextBranchId, BRANCH_B);
      events.push("offline-rescoped");
    },
    refreshBranchState: async () => {
      assert.ok(events.includes("auth-replaced"));
      events.push("notifications-refreshed");
    },
    navigate: (path) => {
      assert.equal(path, "/dashboard");
      events.push("navigated");
    },
  });

  assert.equal(result.session.user.branchId, BRANCH_B);
  assert.deepEqual(result.maintenanceErrors, []);
  assert.equal(events[0], "requested");
  assert.equal(events[1], "auth-replaced");
  assert.equal(events.at(-1), "navigated");
});

test("an unassigned branch failure does not change auth or local state", async () => {
  let sideEffectCount = 0;

  await assert.rejects(
    completeBranchSwitch(currentUser, BRANCH_B, {
      requestSwitch: async () => {
        const error = new Error("Branch access denied");
        Object.assign(error, { status: 403, code: "BRANCH_ACCESS_DENIED" });
        throw error;
      },
      replaceSession: () => {
        sideEffectCount += 1;
      },
      reScopeOfflineData: async () => {
        sideEffectCount += 1;
      },
      refreshBranchState: async () => {
        sideEffectCount += 1;
      },
      navigate: () => {
        sideEffectCount += 1;
      },
    }),
    (error: Error & { code?: string }) =>
      error.code === "BRANCH_ACCESS_DENIED",
  );

  assert.equal(sideEffectCount, 0);
});

test("atomic session replacement updates both the stored user and JWT branch", () => {
  const values = new Map<string, string>();
  const localStorage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const originalWindow = globalThis.window;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage,
      atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
      dispatchEvent: () => true,
    } as unknown as Window,
  });

  try {
    tokenStorage.replaceSession(
      { accessToken: accessToken(BRANCH_B) },
      switchedUser,
    );

    assert.equal(tokenStorage.getUser()?.branchId, BRANCH_B);
    assert.equal(tokenStorage.getAccessContext()?.branchId, BRANCH_B);
    assert.equal(tokenStorage.get()?.accessToken, accessToken(BRANCH_B));
  } finally {
    if (originalWindow === undefined) {
      Reflect.deleteProperty(globalThis, "window");
    } else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  }
});

test("previous-branch pending data is excluded from the selected branch", () => {
  const item = (branchId: string, entityId: string) =>
    ({ branchId, entityId } as PendingSyncItem);
  const visible = filterPendingSyncItemsForBranch(
    [item(BRANCH_A, "old-session"), item(BRANCH_B, "new-session")],
    BRANCH_B,
  );

  assert.deepEqual(
    visible.map((entry) => entry.entityId),
    ["new-session"],
  );
});

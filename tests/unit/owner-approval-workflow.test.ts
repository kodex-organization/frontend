import assert from "node:assert/strict";
import test from "node:test";

import { createStaff } from "@/features/auth";

test("createStaff returns requiresApproval when cross-branch staff creation is requested", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url: any, init: any) => {
    assert.match(String(url), /\/auth\/staff$/);
    assert.equal(init?.method, "POST");
    const body = JSON.parse(init?.body);
    assert.equal(body.email, "manager.invite@test.com");
    assert.equal(body.branchId, "branch-b-uuid");

    return {
      ok: true,
      status: 202,
      json: async () => ({
        success: true,
        data: {
          requiresApproval: true,
          requestId: "req-12345",
          message: "Staff creation request submitted for owner approval",
        },
        error: null,
      }),
    } as any;
  };

  const result = await createStaff({
    fullName: "Cross Branch Staff",
    email: "manager.invite@test.com",
    role: "CASHIER",
    branchId: "branch-b-uuid",
    password: "Password@123",
  });

  assert.equal(result.requiresApproval, true);
  assert.equal(result.requestId, "req-12345");
  assert.match(result.message!, /submitted for owner approval/);
});

test("createStaff returns standard user object when direct creation succeeds", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url: any, init: any) => {
    return {
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: {
          id: "user-123",
          fullName: "Direct Staff",
          email: "direct@test.com",
          roles: ["CASHIER"],
        },
        error: null,
      }),
    } as any;
  };

  const result = await createStaff({
    fullName: "Direct Staff",
    email: "direct@test.com",
    role: "CASHIER",
    branchId: "branch-a-uuid",
    password: "Password@123",
  });

  assert.equal(result.id, "user-123");
  assert.equal(result.fullName, "Direct Staff");
  assert.equal(result.requiresApproval, undefined);
});

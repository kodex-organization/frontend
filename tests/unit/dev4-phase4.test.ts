import assert from "node:assert/strict";
import test from "node:test";

import {
  getVisibleTenantAnnouncements,
  parseIdentifierList,
  type TenantAnnouncement,
} from "@/features/platform-admin/announcements";
import {
  displayTelemetryValue,
  getPlatformHealth,
} from "@/features/platform-admin/health";
import {
  assignTenantReleaseChannel,
  validateReleaseInput,
} from "@/features/platform-admin/releases";
import {
  cancelTenantSubscription,
  deleteSubscriptionPlan,
  filterSubscriptionPlans,
  resumeTenantSubscription,
  setTenantSubscription,
  suspendTenantSubscription,
  type SubscriptionPlan,
} from "@/features/platform-admin/subscriptions";

const TENANT_ID = "00000000-0000-4000-8000-000000000030";
const PLAN_ID = "00000000-0000-4000-8000-000000000031";
const RELEASE_ID = "00000000-0000-4000-8000-000000000032";

function envelope(data: unknown) {
  return new Response(
    JSON.stringify({ success: true, data, error: null }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

async function withFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
  run: () => Promise<void>,
) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("subscription plan filters and tenant lifecycle requests use backend contracts", async () => {
  const plans: SubscriptionPlan[] = [
    {
      id: PLAN_ID,
      name: "Club Pro",
      price: 5000,
      billingCycle: "monthly",
      maxBranches: 5,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      deletedAt: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000033",
      name: "Enterprise",
      price: 50000,
      billingCycle: "yearly",
      maxBranches: 50,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      deletedAt: null,
    },
  ];
  assert.deepEqual(
    filterSubscriptionPlans(plans, "club", "monthly").map(({ id }) => id),
    [PLAN_ID],
  );

  const requests: Array<{ path: string; body: unknown }> = [];
  await withFetch(
    async (input, init) => {
      requests.push({
        path: new URL(String(input)).pathname,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return envelope({ id: "subscription" });
    },
    async () => {
      await setTenantSubscription(TENANT_ID, {
        planId: PLAN_ID,
        billingCycle: "monthly",
        status: "active",
        paymentStatus: "paid",
        trialEndsAt: null,
        currentPeriodStart: "2026-08-01",
        currentPeriodEnd: "2026-08-31",
        nextBillingDate: "2026-08-31",
        gracePeriodEndsAt: null,
      });
      await suspendTenantSubscription(TENANT_ID, "2026-09-05");
      await resumeTenantSubscription(TENANT_ID);
      await cancelTenantSubscription(TENANT_ID);
      await deleteSubscriptionPlan(PLAN_ID);
    },
  );

  assert.deepEqual(
    requests.map(({ path }) => path),
    [
      `/api/v1/super-admin/subscriptions/tenants/${TENANT_ID}`,
      `/api/v1/super-admin/subscriptions/tenants/${TENANT_ID}/suspend`,
      `/api/v1/super-admin/subscriptions/tenants/${TENANT_ID}/resume`,
      `/api/v1/super-admin/subscriptions/tenants/${TENANT_ID}/cancel`,
      `/api/v1/super-admin/subscriptions/plans/${PLAN_ID}`,
    ],
  );
  assert.deepEqual(requests[1]?.body, { gracePeriodEndsAt: "2026-09-05" });
});

test("platform health never presents missing telemetry as zero", async () => {
  assert.equal(displayTelemetryValue(false, 0), "Unavailable");
  assert.equal(displayTelemetryValue(false, null), "Unavailable");
  assert.equal(displayTelemetryValue(true, 0), "0");
  assert.equal(
    displayTelemetryValue(true, 0.025, (rate) => `${(rate * 100).toFixed(1)}%`),
    "2.5%",
  );

  await withFetch(
    async (input) => {
      const url = new URL(String(input));
      assert.equal(url.pathname, "/api/v1/super-admin/health");
      assert.equal(url.searchParams.get("windowMinutes"), "360");
      assert.equal(url.searchParams.get("heartbeatStaleMinutes"), "15");
      return envelope({ generatedAt: "2026-08-24T12:00:00.000Z" });
    },
    async () => {
      await getPlatformHealth(360, 15);
    },
  );
});

test('plan deletion uses the selected plan ID and the archive endpoint', async () => {
  const archived = { id: PLAN_ID, deletedAt: '2026-09-09T12:00:00.000Z' };
  let calls = 0;
  await withFetch(async (input, init) => {
    calls++;
    assert.equal(new URL(String(input)).pathname, `/api/v1/super-admin/subscriptions/plans/${PLAN_ID}`);
    assert.equal(init?.method, 'DELETE');
    return envelope(archived);
  }, async () => {
    assert.deepEqual(await deleteSubscriptionPlan(PLAN_ID), archived);
  });
  assert.equal(calls, 1);
});

test('assigned-plan protection is surfaced instead of treating deletion as successful', async () => {
  await withFetch(async () => new Response(JSON.stringify({
    success: false, data: null,
    error: { message: 'Plan is assigned to one or more tenants', code: 'CONFLICT' },
  }), { status: 409, headers: { 'Content-Type': 'application/json' } }), async () => {
    await assert.rejects(deleteSubscriptionPlan(PLAN_ID), {
      status: 409, code: 'CONFLICT', message: 'Plan is assigned to one or more tenants',
    });
  });
});

test("tenant announcement inbox respects schedule, expiry, and dismiss state", () => {
  const base: TenantAnnouncement = {
    id: "00000000-0000-4000-8000-000000000034",
    title: "Maintenance",
    body: "Scheduled maintenance tonight.",
    audience: "all_tenants",
    startsAt: "2026-08-24T10:00:00.000Z",
    expiresAt: "2026-08-24T14:00:00.000Z",
    publishedAt: "2026-08-24T09:00:00.000Z",
    createdAt: "2026-08-24T09:00:00.000Z",
    updatedAt: "2026-08-24T09:00:00.000Z",
    readAt: null,
    dismissedAt: null,
  };
  const future = {
    ...base,
    id: "00000000-0000-4000-8000-000000000035",
    startsAt: "2026-08-25T10:00:00.000Z",
  };
  const expired = {
    ...base,
    id: "00000000-0000-4000-8000-000000000036",
    expiresAt: "2026-08-24T11:00:00.000Z",
  };
  const dismissed = {
    ...base,
    id: "00000000-0000-4000-8000-000000000037",
    dismissedAt: "2026-08-24T11:30:00.000Z",
  };

  assert.deepEqual(
    getVisibleTenantAnnouncements(
      [base, future, expired, dismissed],
      new Date("2026-08-24T12:00:00.000Z"),
    ).map(({ id }) => id),
    [base.id],
  );
  assert.deepEqual(
    parseIdentifierList(`${TENANT_ID}, ${TENANT_ID}\n${PLAN_ID}`),
    [TENANT_ID, PLAN_ID],
  );
});

test("release metadata validation and tenant channel payloads are correct", async () => {
  assert.equal(
    validateReleaseInput({
      version: "release-one",
      channel: "stable",
      releaseNotes: null,
      minimumSupportedVersion: null,
    }),
    "Enter a semantic version such as 1.2.3 or 1.2.3-beta.1.",
  );
  assert.equal(
    validateReleaseInput({
      version: "2.1.0-beta.1",
      channel: "beta",
      releaseNotes: "Beta rollout",
      minimumSupportedVersion: "2.0.0",
    }),
    null,
  );

  const bodies: unknown[] = [];
  await withFetch(
    async (input, init) => {
      assert.equal(
        new URL(String(input)).pathname,
        `/api/v1/super-admin/releases/tenants/${TENANT_ID}/channel`,
      );
      bodies.push(JSON.parse(String(init?.body)));
      return envelope({ tenantId: TENANT_ID });
    },
    async () => {
      await assignTenantReleaseChannel(TENANT_ID, "stable", RELEASE_ID);
      await assignTenantReleaseChannel(TENANT_ID, "pinned", RELEASE_ID);
    },
  );
  assert.deepEqual(bodies, [
    { channel: "stable", pinnedReleaseId: null },
    { channel: "pinned", pinnedReleaseId: RELEASE_ID },
  ]);
});

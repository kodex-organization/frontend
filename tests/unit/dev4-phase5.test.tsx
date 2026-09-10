import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  canDownloadExport,
  downloadDataExport,
  formatExportSize,
  requestDataExport,
  type DataExportJob,
} from "@/features/data-exports/data-exports";
import { ImpersonationAuditResults } from "@/features/platform-admin/components/impersonation-audit-console";
import { ImpersonationBannerSummary } from "@/features/platform-admin/components/impersonation-banner";
import {
  activeImpersonationFromStart,
  assertImpersonationScope,
  buildImpersonationAuditPath,
  endAndClearImpersonation,
  groupImpersonationAuditEvents,
  startImpersonationRequest,
  type ImpersonationAuditEvent,
  type ImpersonationConsent,
} from "@/features/platform-admin/impersonation";
import { ApiError } from "@/lib/api/client";
import { tokenStorage } from "@/lib/auth/session";
import {
  impersonationStorage,
  type ActiveImpersonation,
} from "@/lib/platform-admin/impersonation-session";
import {
  platformAdminStorage,
  type PlatformAdmin,
} from "@/lib/platform-admin/session";

const ADMIN_ID = "00000000-0000-4000-8000-000000000040";
const TENANT_ID = "00000000-0000-4000-8000-000000000041";
const BRANCH_ID = "00000000-0000-4000-8000-000000000042";
const CONSENT_ID = "00000000-0000-4000-8000-000000000043";
const SESSION_ID = "00000000-0000-4000-8000-000000000044";
const USER_ID = "00000000-0000-4000-8000-000000000045";
const DEVICE_ID = "00000000-0000-4000-8000-000000000046";
const EXPORT_ID = "00000000-0000-4000-8000-000000000047";

const admin: PlatformAdmin = {
  id: ADMIN_ID,
  email: "support@cuecloud.test",
  fullName: "Support Admin",
  role: "SUPER_ADMIN",
};

function jwt(payload: Record<string, unknown>) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

function platformToken() {
  return jwt({
    tokenType: "platform_admin",
    platformAdminId: ADMIN_ID,
    role: "SUPER_ADMIN",
    sub: ADMIN_ID,
  });
}

function tenantToken() {
  return jwt({
    userId: USER_ID,
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    deviceId: DEVICE_ID,
    roles: ["OWNER"],
  });
}

function impersonationToken(scopes: string[] = ["tenant_read", "branch_read"]) {
  return jwt({
    tokenType: "impersonation",
    platformAdminId: ADMIN_ID,
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    consentId: CONSENT_ID,
    impersonationSessionId: SESSION_ID,
    scopes,
    sub: SESSION_ID,
    exp: Math.floor(Date.now() / 1000) + 900,
  });
}

function envelope(data: unknown, status = 200) {
  return new Response(
    JSON.stringify({ success: status < 400, data, error: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

function errorEnvelope(message: string, status: number, code: string) {
  return new Response(
    JSON.stringify({
      success: false,
      data: null,
      error: { message, code },
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

async function withBrowser(run: (storage: Storage) => Promise<void>) {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
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
    if (originalWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      });
    }
  }
}

function consent(scopes: ImpersonationConsent["allowedScopes"]): ImpersonationConsent {
  return {
    id: CONSENT_ID,
    tenantId: TENANT_ID,
    grantedByUserId: USER_ID,
    allowedScopes: scopes,
    allowedBranchIds: [BRANCH_ID],
    reason: "Investigate session synchronization issue",
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    revokedAt: null,
    revokedByUserId: null,
    tenantNameSnapshot: "Cue Club North",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    grantedByUser: {
      id: USER_ID,
      fullName: "Tenant Owner",
      email: "owner@example.test",
    },
  };
}

function startResponse(scopes: ImpersonationConsent["allowedScopes"]) {
  const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
  return {
    impersonationToken: impersonationToken(scopes),
    tokenType: "impersonation" as const,
    expiresAt,
    session: {
      id: SESSION_ID,
      superAdminId: ADMIN_ID,
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      consentId: CONSENT_ID,
      allowedScopes: scopes,
      reason: "Inspect failed branch synchronization",
      startedAt: new Date().toISOString(),
      expiresAt,
      platformAdminEmailSnapshot: admin.email,
      tenantNameSnapshot: "Cue Club North",
      branchNameSnapshot: "Main Hall",
      consentReasonSnapshot: "Investigate session synchronization issue",
    },
  };
}

test("impersonation starts and ends without replacing the PlatformAdmin session", async () => {
  await withBrowser(async () => {
    platformAdminStorage.replaceSession(platformToken(), admin);
    const selectedConsent = consent(["tenant_read", "branch_read"]);
    const startedSession = startResponse(selectedConsent.allowedScopes);
    let requestNumber = 0;
    globalThis.fetch = (async (input, init) => {
      requestNumber += 1;
      const url = String(input);
      if (url.endsWith("/super-admin/impersonation/start")) {
        assert.equal(
          (init?.headers as Record<string, string>).Authorization,
          `Bearer ${platformToken()}`,
        );
        return envelope(startedSession, 201);
      }
      assert.ok(url.endsWith("/super-admin/impersonation/end"));
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        `Bearer ${startedSession.impersonationToken}`,
      );
      return envelope({
        impersonationSessionId: SESSION_ID,
        endedAt: new Date().toISOString(),
        endReason: "Diagnostics complete",
      });
    }) as typeof fetch;

    const response = await startImpersonationRequest({
      consentId: CONSENT_ID,
      tenantId: TENANT_ID,
      branchId: BRANCH_ID,
      reason: "Inspect failed branch synchronization",
    });
    impersonationStorage.set(
      activeImpersonationFromStart(response, selectedConsent),
    );

    assert.equal(impersonationStorage.get()?.session.id, SESSION_ID);
    assert.equal(platformAdminStorage.getAdmin()?.id, ADMIN_ID);
    assert.equal(platformAdminStorage.getAccessToken(), platformToken());

    await endAndClearImpersonation("Diagnostics complete");
    assert.equal(requestNumber, 2);
    assert.equal(impersonationStorage.get(), null);
    assert.equal(platformAdminStorage.getAdmin()?.id, ADMIN_ID);
    assert.equal(platformAdminStorage.getAccessToken(), platformToken());
  });
});

test("consent and scope failures are surfaced without weakening local checks", async () => {
  await withBrowser(async () => {
    platformAdminStorage.replaceSession(platformToken(), admin);
    const selectedConsent = consent(["tenant_read"]);
    const active = activeImpersonationFromStart(
      startResponse(selectedConsent.allowedScopes),
      selectedConsent,
    );
    assert.throws(
      () => assertImpersonationScope(active, "branch_switch"),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 403 &&
        error.code === "IMPERSONATION_SCOPE_FORBIDDEN",
    );

    globalThis.fetch = (async () =>
      errorEnvelope(
        "Valid, unexpired tenant consent is required for impersonation",
        403,
        "FORBIDDEN",
      )) as typeof fetch;
    await assert.rejects(
      startImpersonationRequest({
        consentId: CONSENT_ID,
        tenantId: TENANT_ID,
        branchId: BRANCH_ID,
        reason: "Inspect failed branch synchronization",
      }),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 403 &&
        /unexpired tenant consent/.test(error.message),
    );
  });
});

test("active impersonation banner visibly identifies the support context", async () => {
  await withBrowser(async () => {
    const selectedConsent = consent(["tenant_read", "branch_switch"]);
    const active = activeImpersonationFromStart(
      startResponse(selectedConsent.allowedScopes),
      selectedConsent,
    );
    const markup = renderToStaticMarkup(
      <ImpersonationBannerSummary active={active} adminName="Support Admin" />,
    );
    assert.match(markup, /Impersonation active/);
    assert.match(markup, /Cue Club North/);
    assert.match(markup, /Main Hall/);
    assert.match(markup, /Support Admin/);
    assert.match(markup, /Inspect failed branch synchronization/);
    assert.match(markup, /branch_switch/);
  });
});

function auditEvent(
  eventType: ImpersonationAuditEvent["eventType"],
  action: string,
  occurredAt: string,
  reason: string | null = null,
): ImpersonationAuditEvent {
  return {
    id: `${eventType}-0000-4000-8000-000000000001`,
    sessionId: SESSION_ID,
    platformAdminId: ADMIN_ID,
    consentId: CONSENT_ID,
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    eventType,
    action,
    scope: eventType === "action" ? "tenant_read" : null,
    reason,
    metadata: eventType === "action" ? { resource: "tenant-context" } : null,
    ipAddress: "127.0.0.1",
    userAgent: "test",
    deviceIdentifier: "browser-test",
    sessionExpiresAt: "2026-08-25T12:15:00.000Z",
    occurredAt,
    platformAdminEmailSnapshot: admin.email,
    tenantNameSnapshot: "Cue Club North",
    branchNameSnapshot: "Main Hall",
    consentReasonSnapshot: "Investigate session synchronization issue",
  };
}

test("impersonation audit filtering and rendering link session actions", () => {
  const path = buildImpersonationAuditPath({
    search: "sync",
    tenantId: TENANT_ID,
    eventType: "action",
    scope: "tenant_read",
    limit: 50,
    offset: 0,
  });
  const url = new URL(path, "http://localhost");
  assert.equal(url.pathname, "/super-admin/impersonation/audit");
  assert.equal(url.searchParams.get("tenantId"), TENANT_ID);
  assert.equal(url.searchParams.get("eventType"), "action");

  const sessions = groupImpersonationAuditEvents([
    auditEvent("end", "impersonation.end", "2026-08-25T12:10:00.000Z", "Diagnostics complete"),
    auditEvent("action", "impersonation.context.read", "2026-08-25T12:05:00.000Z"),
    auditEvent("start", "impersonation.start", "2026-08-25T12:00:00.000Z", "Investigate sync"),
  ]);
  const markup = renderToStaticMarkup(
    <ImpersonationAuditResults sessions={sessions} />,
  );
  assert.match(markup, /Platform impersonation/);
  assert.match(markup, /Impersonated action/);
  assert.match(markup, /Session control/);
  assert.match(markup, /impersonation.context.read/);
  assert.match(markup, /Diagnostics complete/);
  assert.match(markup, new RegExp(CONSENT_ID));
  assert.match(markup, /Linked action metadata/);
});

function completedExport(overrides: Partial<DataExportJob> = {}): DataExportJob {
  return {
    id: EXPORT_ID,
    tenantId: TENANT_ID,
    requestedByUserId: USER_ID,
    requestedByName: "Tenant Owner",
    requestedByEmail: "owner@example.test",
    format: "json",
    status: "completed",
    requestedAt: "2026-08-25T11:00:00.000Z",
    startedAt: "2026-08-25T11:00:01.000Z",
    completedAt: "2026-08-25T11:00:02.000Z",
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
    checksumSha256: "abc123",
    sizeBytes: "2048",
    failureReason: null,
    downloadAvailable: true,
    createdAt: "2026-08-25T11:00:00.000Z",
    updatedAt: "2026-08-25T11:00:02.000Z",
    ...overrides,
  };
}

test("OWNER export request, status metadata, and authorized download work", async () => {
  await withBrowser(async () => {
    tokenStorage.set({ accessToken: tenantToken() });
    let requestCount = 0;
    globalThis.fetch = (async (input, init) => {
      requestCount += 1;
      const url = String(input);
      assert.equal(
        (init?.headers as Record<string, string>).Authorization,
        `Bearer ${tenantToken()}`,
      );
      if (url.endsWith("/tenancy/data-exports/")) {
        assert.deepEqual(JSON.parse(String(init?.body)), { format: "json" });
        return envelope(completedExport({ status: "queued", downloadAvailable: false }), 202);
      }
      assert.ok(url.endsWith(`/tenancy/data-exports/${EXPORT_ID}/download`));
      return new Response(JSON.stringify({ tenant: { name: "Cue Club North" } }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="cuecloud-export.json"',
          "X-Checksum-SHA256": "abc123",
          "Content-Length": "48",
        },
      });
    }) as typeof fetch;

    const requested = await requestDataExport();
    assert.equal(requested.status, "queued");
    const artifact = await downloadDataExport(EXPORT_ID);
    assert.equal(artifact.fileName, "cuecloud-export.json");
    assert.equal(artifact.checksumSha256, "abc123");
    assert.equal(artifact.sizeBytes, 48);
    assert.equal(requestCount, 2);
    assert.equal(canDownloadExport(completedExport()), true);
    assert.equal(formatExportSize("2048"), "2.0 KB");
  });
});

test("cross-tenant and expired export downloads fail cleanly", async () => {
  await withBrowser(async () => {
    tokenStorage.set({ accessToken: tenantToken() });
    globalThis.fetch = (async () =>
      errorEnvelope("Data export not found", 404, "NOT_FOUND")) as typeof fetch;
    await assert.rejects(
      downloadDataExport("00000000-0000-4000-8000-000000000099"),
      (error: unknown) => error instanceof ApiError && error.status === 404,
    );

    globalThis.fetch = (async () =>
      errorEnvelope("Data export has expired", 410, "DATA_EXPORT_EXPIRED")) as typeof fetch;
    await assert.rejects(
      downloadDataExport(EXPORT_ID),
      (error: unknown) =>
        error instanceof ApiError &&
        error.status === 410 &&
        error.code === "DATA_EXPORT_EXPIRED",
    );

    assert.equal(
      canDownloadExport(
        completedExport({
          status: "expired",
          downloadAvailable: false,
          expiresAt: "2026-08-25T10:00:00.000Z",
        }),
        new Date("2026-08-25T12:00:00.000Z"),
      ),
      false,
    );
  });
});

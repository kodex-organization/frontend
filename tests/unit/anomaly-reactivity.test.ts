import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Anomaly and audit real-time dynamic refresh and invalidation", async (t) => {
  const auditPagePath = path.resolve(
    process.cwd(),
    "src/app/(owner)/audit/page.tsx"
  );
  const auditPageContent = fs.readFileSync(auditPagePath, "utf-8");

  const auditApiPath = path.resolve(
    process.cwd(),
    "src/lib/api/audit.ts"
  );
  const auditApiContent = fs.readFileSync(auditApiPath, "utf-8");

  const invoiceServicePath = path.resolve(
    process.cwd(),
    "src/features/invoice/services/invoiceService.ts"
  );
  const invoiceServiceContent = fs.readFileSync(invoiceServicePath, "utf-8");

  const dashboardViewPath = path.resolve(
    process.cwd(),
    "src/features/dashboard/components/DashboardView.tsx"
  );
  const dashboardViewContent = fs.readFileSync(dashboardViewPath, "utf-8");

  await t.test("audit/page.tsx implements background polling and visibility/focus revalidation", () => {
    assert.ok(
      auditPageContent.includes("loadData(true)"),
      "audit/page.tsx must support silent background revalidation without full UI flashing"
    );
    assert.ok(
      auditPageContent.includes("visibilitychange"),
      "audit/page.tsx must listen to visibilitychange to refresh when tab becomes active"
    );
    assert.ok(
      auditPageContent.includes("setInterval"),
      "audit/page.tsx must have an active interval timer for polling dynamic updates"
    );
  });

  await t.test("audit/page.tsx reacts to anomaly-invalidated and invoice-voided events", () => {
    assert.ok(
      auditPageContent.includes("cuecloud:anomaly-invalidated"),
      "audit/page.tsx must listen to cuecloud:anomaly-invalidated event"
    );
    assert.ok(
      auditPageContent.includes("cuecloud:invoice-voided"),
      "audit/page.tsx must listen to cuecloud:invoice-voided event"
    );
  });

  await t.test("invoiceService.voidInvoice broadcasts invalidation events", () => {
    assert.ok(
      invoiceServiceContent.includes("cuecloud:anomaly-invalidated"),
      "invoiceService.voidInvoice must dispatch cuecloud:anomaly-invalidated"
    );
    assert.ok(
      invoiceServiceContent.includes("cuecloud:invoice-voided"),
      "invoiceService.voidInvoice must dispatch cuecloud:invoice-voided"
    );
  });

  await t.test("audit.ts disables HTTP caching with cache: no-store and no-cache headers", () => {
    assert.ok(
      auditApiContent.includes('cache: "no-store"'),
      "audit API client must set cache: no-store to prevent stale browser route caching"
    );
    assert.ok(
      auditApiContent.includes("must-revalidate"),
      "audit API client must set Cache-Control: must-revalidate"
    );
  });

  await t.test("DashboardView reacts to anomaly invalidation and visibility changes", () => {
    assert.ok(
      dashboardViewContent.includes("cuecloud:anomaly-invalidated"),
      "DashboardView must listen to cuecloud:anomaly-invalidated"
    );
    assert.ok(
      dashboardViewContent.includes("visibilitychange"),
      "DashboardView must listen to visibilitychange"
    );
  });
});

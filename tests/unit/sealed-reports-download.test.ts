import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Sealed Reports archive download functionality", async (t) => {
  const workspacePath = path.resolve(
    process.cwd(),
    "src/features/reporting/components/ReportingWorkspace.tsx",
  );
  const content = fs.readFileSync(workspacePath, "utf-8");

  await t.test("ReportingWorkspace enables date range filtering for sealed-reports", () => {
    assert.ok(
      content.includes('"sealed-reports"'),
      "sealed-reports must be configured in workspace",
    );
    assert.match(
      content,
      /rangeTabs:\s*ReportTab\[\]\s*=\s*\[[^\]]*"sealed-reports"/,
      "rangeTabs must include sealed-reports so managers/owners can filter archive ranges",
    );
    assert.match(
      content,
      /DEFAULT_PRESET_BY_TAB[^}]*"sealed-reports":\s*"30d"/,
      "DEFAULT_PRESET_BY_TAB must set sealed-reports preset",
    );
  });

  await t.test("ReportingWorkspace implements downloadSingleReport with reportId", () => {
    assert.ok(
      content.includes("downloadSingleReport"),
      "ReportingWorkspace must implement downloadSingleReport function",
    );
    assert.ok(
      content.includes("reportId: report.id"),
      "downloadSingleReport must pass reportId to target the exact archived report",
    );
    assert.ok(
      content.includes("sealed-report-${reportDateStr"),
      "download filename must include report date or id",
    );
  });

  await t.test("Archived report cards render direct PDF and Excel download buttons", () => {
    assert.ok(
      content.includes('downloadSingleReport(report, "pdf")'),
      "Each report card must have a PDF download button",
    );
    assert.ok(
      content.includes('downloadSingleReport(report, "excel")'),
      "Each report card must have an Excel download button",
    );
    assert.ok(
      content.includes("selectedSealedReport"),
      "ReportingWorkspace must resolve the selected sealed report",
    );
  });
});

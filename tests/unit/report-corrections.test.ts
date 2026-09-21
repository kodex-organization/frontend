import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";

test("Sealed Report Corrections implementation", async (t) => {
  const reportingApiPath = path.resolve(
    process.cwd(),
    "src/features/reporting/api.ts"
  );
  const reportingApiContent = fs.readFileSync(reportingApiPath, "utf-8");

  const workspacePath = path.resolve(
    process.cwd(),
    "src/features/reporting/components/ReportingWorkspace.tsx"
  );
  const workspaceContent = fs.readFileSync(workspacePath, "utf-8");

  await t.test("Reporting API supports correctSealedReport and fetchReportCorrections", () => {
    assert.ok(
      reportingApiContent.includes("correctSealedReport"),
      "Reporting API must export correctSealedReport"
    );
    assert.ok(
      reportingApiContent.includes("/reporting/z-report/correct"),
      "correctSealedReport must call /reporting/z-report/correct endpoint"
    );
    assert.ok(
      reportingApiContent.includes("fetchReportCorrections"),
      "Reporting API must export fetchReportCorrections"
    );
    assert.ok(
      reportingApiContent.includes("/reporting/z-report/corrections"),
      "fetchReportCorrections must call /reporting/z-report/corrections endpoint"
    );
  });

  await t.test("ReportingWorkspace renders Add Correction buttons for sealed reports", () => {
    assert.ok(
      workspaceContent.includes("correctingId"),
      "ReportingWorkspace must manage correctingId state for open correction modal"
    );
    assert.ok(
      workspaceContent.includes("submitCorrection"),
      "ReportingWorkspace must implement submitCorrection"
    );
    assert.ok(
      workspaceContent.includes("Add Report Correction"),
      "ReportingWorkspace must provide 'Add Report Correction' button when zReport is sealed"
    );
    assert.ok(
      workspaceContent.includes("Add Correction"),
      "ReportingWorkspace must provide 'Add Correction' button on archived sealed reports"
    );
  });

  await t.test("ReportingWorkspace displays applied corrections on sealed reports", () => {
    assert.ok(
      workspaceContent.includes("CORRECTION"),
      "ReportingWorkspace must filter items for CORRECTION entries"
    );
    assert.ok(
      workspaceContent.includes("Applied Corrections:"),
      "ReportingWorkspace must display Applied Corrections section header"
    );
  });

  await t.test("Correction Modal captures type, amount, and reason", () => {
    assert.ok(
      workspaceContent.includes("correctionType"),
      "Correction modal must have correctionType state"
    );
    assert.ok(
      workspaceContent.includes("correctionAmount"),
      "Correction modal must have correctionAmount state"
    );
    assert.ok(
      workspaceContent.includes("correctionReason"),
      "Correction modal must have correctionReason state"
    );
    assert.ok(
      workspaceContent.includes("Immutable Sealed Report"),
      "Correction modal must inform user about immutable sealed report audit rules"
    );
  });
});

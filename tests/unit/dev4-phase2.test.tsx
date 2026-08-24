import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CrossBranchReportView } from "@/features/reporting/components/cross-branch-reports-screen";
import {
  buildCrossBranchReportPath,
  type CrossBranchReport,
} from "@/features/reporting/cross-branch";
import {
  deleteManagedBranch,
  getBranchDeleteBlockers,
} from "@/features/tenancy/branch-management";
import type { AssignedBranch } from "@/features/tenancy/branch-switching";
import { BranchDeleteBlockedAlert } from "@/features/tenancy/components/branch-delete-blocked-alert";
import { hasOwnerAccess } from "@/features/tenancy/owner-access";
import {
  emptyPeakHourRuleDraft,
  peakHourRuleInput,
  peakHourRuleToDraft,
  validatePeakHourRuleDraft,
  type PeakHourRule,
} from "@/features/tenancy/peak-hours";
import { ApiError } from "@/lib/api/client";

const BRANCH_A = "00000000-0000-4000-8000-000000000010";
const BRANCH_B = "00000000-0000-4000-8000-000000000011";

function branch(
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
    roles: ["OWNER"],
    isSelected,
  };
}

test("blocked branch deletion exposes and renders every blocker detail", () => {
  const error = new ApiError(
    "Branch cannot be deleted",
    409,
    "BRANCH_DELETE_BLOCKED",
    {
      blockers: {
        activeSessions: 2,
        pausedSessions: 1,
        unsettledUdhaarCustomers: 3,
        unsettledUdhaarBalance: 450.5,
      },
    },
  );
  const blockers = getBranchDeleteBlockers(error);
  assert.ok(blockers);

  const markup = renderToStaticMarkup(
    <BranchDeleteBlockedAlert
      branchName="Main Hall"
      blockers={blockers}
      currency="PKR"
    />,
  );

  assert.match(markup, /Main Hall cannot be deleted/);
  assert.match(markup, /Active sessions/);
  assert.match(markup, />2</);
  assert.match(markup, /Paused sessions/);
  assert.match(markup, /Customers with unsettled udhaar/);
  assert.match(markup, />3</);
  assert.match(markup, /Unsettled balance/);
  assert.match(markup, /450/);
});

test("successful active-branch deletion switches securely and then refreshes branches", async () => {
  const branches = [
    branch(BRANCH_A, "Main Hall", true),
    branch(BRANCH_B, "DHA Branch", false),
  ];
  const events: string[] = [];

  const result = await deleteManagedBranch(
    branches[0],
    branches,
    BRANCH_A,
    {
      deleteBranch: async (branchId) => {
        assert.equal(branchId, BRANCH_A);
        events.push("deleted");
        return {
          id: BRANCH_A,
          name: "Main Hall",
          deletedAt: "2026-08-24T12:00:00.000Z",
        };
      },
      switchBranch: async (branchId) => {
        assert.equal(branchId, BRANCH_B);
        assert.equal(events.at(-1), "deleted");
        events.push("switched");
      },
      refreshBranches: async () => {
        assert.equal(events.at(-1), "switched");
        events.push("refreshed");
      },
    },
  );

  assert.equal(result.fallbackBranch?.id, BRANCH_B);
  assert.deepEqual(events, ["deleted", "switched", "refreshed"]);
});

test("report filters map to the API and backend results render without recomputation", () => {
  const path = buildCrossBranchReportPath({
    from: "2026-08-01",
    to: "2026-08-24",
    branchIds: [BRANCH_A, BRANCH_B],
  });
  const requestUrl = new URL(path, "http://localhost");
  assert.equal(requestUrl.pathname, "/reporting/cross-branch");
  assert.equal(requestUrl.searchParams.get("from"), "2026-08-01T00:00:00.000Z");
  assert.equal(requestUrl.searchParams.get("to"), "2026-08-24T23:59:59.999Z");
  assert.equal(requestUrl.searchParams.get("branchIds"), `${BRANCH_A},${BRANCH_B}`);

  const report: CrossBranchReport = {
    tenantId: "00000000-0000-4000-8000-000000000012",
    period: {
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-24T23:59:59.999Z",
    },
    totals: {
      revenue: 300,
      sessionCount: 4,
      sessionDurationSeconds: 10200,
      udhaarIssued: 160,
      udhaarReceived: 50,
      outstandingUdhaar: 110,
    },
    branches: [
      {
        branchId: BRANCH_A,
        branchName: "Main Hall",
        revenue: 100,
        sessionCount: 1,
        sessionDurationSeconds: 3000,
        udhaarIssued: 60,
        udhaarReceived: 20,
        outstandingUdhaar: 40,
      },
      {
        branchId: BRANCH_B,
        branchName: "DHA Branch",
        revenue: 200,
        sessionCount: 3,
        sessionDurationSeconds: 7200,
        udhaarIssued: 100,
        udhaarReceived: 30,
        outstandingUdhaar: 70,
      },
    ],
  };
  const markup = renderToStaticMarkup(
    <CrossBranchReportView
      report={report}
      branches={[
        branch(BRANCH_A, "Main Hall", true),
        branch(BRANCH_B, "DHA Branch", false),
      ]}
    />,
  );

  assert.match(markup, /Revenue/);
  assert.match(markup, /Rs/);
  assert.match(markup, /300/);
  assert.match(markup, /2h 50m/);
  assert.match(markup, /Main Hall/);
  assert.match(markup, /DHA Branch/);
  assert.match(markup, /Outstanding udhaar/);
});

test("only OWNER roles can access Phase 2 owner screens", () => {
  assert.equal(hasOwnerAccess(["OWNER"]), true);
  assert.equal(hasOwnerAccess(["MANAGER"]), false);
  assert.equal(hasOwnerAccess(["ACCOUNTANT"]), false);
  assert.equal(hasOwnerAccess(["CASHIER"]), false);
});

test("peak-hour create and update drafts enforce the backend input limits", () => {
  const invalidCreate = emptyPeakHourRuleDraft();
  invalidCreate.startTime = "18:00";
  invalidCreate.endTime = "18:00";
  invalidCreate.multiplier = "5.5";
  const createErrors = validatePeakHourRuleDraft(invalidCreate);
  assert.ok(createErrors.daysOfWeek);
  assert.ok(createErrors.endTime);
  assert.ok(createErrors.multiplier);

  const validCreate = {
    ...emptyPeakHourRuleDraft(),
    daysOfWeek: [5, 1],
    multiplier: "1.75",
    effectiveFrom: "2026-09-01",
    effectiveTo: "2026-09-30",
  };
  assert.deepEqual(validatePeakHourRuleDraft(validCreate), {});
  assert.deepEqual(peakHourRuleInput(validCreate), {
    daysOfWeek: [1, 5],
    startTime: "17:00",
    endTime: "21:00",
    multiplier: 1.75,
    isEnabled: true,
    effectiveFrom: "2026-09-01",
    effectiveTo: "2026-09-30",
  });

  const storedRule: PeakHourRule = {
    id: "00000000-0000-4000-8000-000000000013",
    branchId: BRANCH_A,
    daysOfWeek: [1, 2],
    startTime: "18:00",
    endTime: "22:00",
    multiplier: 1.5,
    isEnabled: true,
    effectiveFrom: null,
    effectiveTo: null,
  };
  const updateDraft = {
    ...peakHourRuleToDraft(storedRule),
    multiplier: "2",
    isEnabled: false,
  };
  assert.deepEqual(validatePeakHourRuleDraft(updateDraft), {});
  assert.equal(peakHourRuleInput(updateDraft).multiplier, 2);
  assert.equal(peakHourRuleInput(updateDraft).isEnabled, false);
});

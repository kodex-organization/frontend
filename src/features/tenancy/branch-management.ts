import { z } from "zod";

import { ApiError, apiFetch } from "@/lib/api/client";
import type { AssignedBranch } from "./branch-switching";

export interface DeletedBranch {
  id: string;
  name: string | null;
  deletedAt: string;
}

export interface BranchDeleteBlockers {
  activeSessions: number;
  pausedSessions: number;
  unsettledUdhaarCustomers: number;
  unsettledUdhaarBalance: number;
}

const blockerDetailsSchema = z.object({
  blockers: z.object({
    activeSessions: z.number().nonnegative(),
    pausedSessions: z.number().nonnegative(),
    unsettledUdhaarCustomers: z.number().nonnegative(),
    unsettledUdhaarBalance: z.number(),
  }),
});

export function deleteBranch(branchId: string) {
  return apiFetch<DeletedBranch>(
    `/tenancy/branches/${encodeURIComponent(branchId)}`,
    { method: "DELETE" },
  );
}

export function getBranchDeleteBlockers(error: unknown) {
  if (!(error instanceof ApiError) || error.code !== "BRANCH_DELETE_BLOCKED") {
    return null;
  }

  const parsed = blockerDetailsSchema.safeParse(error.details);
  return parsed.success ? parsed.data.blockers : null;
}

export class ActiveBranchFallbackRequiredError extends Error {
  constructor() {
    super("Assign another branch before deleting the active branch");
    this.name = "ActiveBranchFallbackRequiredError";
  }
}

interface DeleteManagedBranchDependencies {
  deleteBranch: (branchId: string) => Promise<DeletedBranch>;
  switchBranch: (branchId: string) => Promise<void>;
  refreshBranches: () => Promise<void>;
}

export async function deleteManagedBranch(
  branch: AssignedBranch,
  assignedBranches: AssignedBranch[],
  activeBranchId: string,
  dependencies: DeleteManagedBranchDependencies,
) {
  const deletingActiveBranch = branch.id === activeBranchId;
  const fallbackBranch = deletingActiveBranch
    ? assignedBranches.find((candidate) => candidate.id !== branch.id)
    : undefined;

  if (deletingActiveBranch && !fallbackBranch) {
    throw new ActiveBranchFallbackRequiredError();
  }

  const deleted = await dependencies.deleteBranch(branch.id);
  if (fallbackBranch) {
    await dependencies.switchBranch(fallbackBranch.id);
  }
  await dependencies.refreshBranches();

  return { deleted, fallbackBranch: fallbackBranch ?? null };
}

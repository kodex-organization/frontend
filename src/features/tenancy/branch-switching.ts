import { apiFetch } from "@/lib/api/client";
import { redirectPathForRoles, type SessionTokens, type SessionUser, type UserRole } from "@/lib/auth/session";

export const ASSIGNED_BRANCHES_CHANGED_EVENT =
  "cuecloud:assigned-branches-changed";

export interface AssignedBranch {
  id: string;
  name: string | null;
  address: string | null;
  currency: string | null;
  timezone: string | null;
  language: string | null;
  roles: UserRole[];
  isSelected: boolean;
}

export interface BranchSwitchSession extends SessionTokens {
  user: SessionUser;
}

export function getAssignedBranches() {
  return apiFetch<AssignedBranch[]>("/tenancy/branches/assigned");
}

export function notifyAssignedBranchesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ASSIGNED_BRANCHES_CHANGED_EVENT));
  }
}

export function requestBranchSwitch(branchId: string) {
  return apiFetch<BranchSwitchSession>("/auth/switch-branch", {
    method: "POST",
    body: JSON.stringify({ branchId }),
  });
}

interface BranchSwitchDependencies {
  requestSwitch?: (branchId: string) => Promise<BranchSwitchSession>;
  replaceSession: (user: SessionUser, tokens: SessionTokens) => void;
  reScopeOfflineData: (
    previousBranchId: string,
    nextBranchId: string,
  ) => Promise<void>;
  refreshBranchState: () => Promise<void>;
  navigate: (path: string) => void;
}

export interface BranchSwitchCompletion {
  session: BranchSwitchSession;
  maintenanceErrors: unknown[];
}

export async function completeBranchSwitch(
  currentUser: SessionUser,
  branchId: string,
  dependencies: BranchSwitchDependencies,
): Promise<BranchSwitchCompletion> {
  const session = await (dependencies.requestSwitch ?? requestBranchSwitch)(
    branchId,
  );

  // This is intentionally synchronous: subsequent API calls must observe the
  // switched server-issued token and its matching public user together.
  dependencies.replaceSession(session.user, session);

  const maintenance = await Promise.allSettled([
    dependencies.reScopeOfflineData(currentUser.branchId, session.user.branchId),
    dependencies.refreshBranchState(),
  ]);

  dependencies.navigate(redirectPathForRoles(session.user.roles));

  return {
    session,
    maintenanceErrors: maintenance
      .filter((result) => result.status === "rejected")
      .map((result) => result.reason),
  };
}

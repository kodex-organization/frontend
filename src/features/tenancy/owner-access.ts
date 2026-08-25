import type { UserRole } from "@/lib/auth/session";

export const OWNER_ONLY_ROLES: UserRole[] = ["OWNER"];

export function hasOwnerAccess(roles: UserRole[]) {
  return roles.includes("OWNER");
}

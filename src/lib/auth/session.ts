// JWT session handling — implement during auth module work
// See backend docs/02-modules-core.md §3.1

export type UserRole =
  | "owner"
  | "manager"
  | "accountant"
  | "cashier"
  | "super_admin";

export interface SessionUser {
  id: string;
  tenantId: string;
  roles: UserRole[];
}

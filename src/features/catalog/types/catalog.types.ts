export type TableStatus =
  | "available"
  | "occupied"
  | "maintenance"
  | "reserved"
  | "inactive";

export interface SnookerTable {
  id: string;
  branchId: string;
  branch?: { id: string; name: string | null };
  tableNumber: string;
  defaultHourlyRate: number;
  status: TableStatus;
  isActive: boolean;
  deletedAt: string | null;
  /** True while this table only exists on this device and is waiting to sync. */
  pendingSync?: boolean;
  /** Reason the server refused a pending table (shown to the user). */
  syncError?: string | null;
  /** Row id in the local offline queue (used to discard a pending table). */
  pendingQueueId?: number;
}

export interface CreateTableInput {
  tableNumber: string;
  hourlyRate: number;
  status?: string;
  branchId?: string;
}

export interface RatePlan {
  id: string;
  tableId: string;
  branchId: string;
  rateType: string;
  hourlyRate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

export interface CreateRatePlanInput {
  rateType: string;
  hourlyRate: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}
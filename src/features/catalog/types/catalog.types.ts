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
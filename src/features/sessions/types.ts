export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  cnic: string | null;
}
export interface TableOption {
  id: string;
  tableNumber: string;
  defaultHourlyRate: number | string;
  defaultPerGameRate?: number | string | null;
  perGameRate?: number | string | null;
  currency?: string | null;
}
export interface SessionPause {
  id: string;
  pausedAt: string;
  resumedAt: string | null;
}
export interface ActiveSession {
  id: string;
  status: "active" | "paused" | "ended";
  pausedAt?: string | null;
  startedAt: string;
  endedAt: string | null;
  appliedHourlyRate: number | string | null;
  appliedPerGameRate?: number | string | null;
  billingType?: "hourly" | "per_game";
  gameCount?: number | null;
  table: TableOption;
  branch: {
    id?: string;
    name?: string | null;
    currency: string | null;
  };
  customer: Customer | null;
  pauses: SessionPause[];
}

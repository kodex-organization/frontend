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
  startedAt: string;
  endedAt: string | null;
  appliedHourlyRate: number | string;
  table: TableOption;
  branch: {
    currency: string | null;
  };
  customer: Customer | null;
  pauses: SessionPause[];
}

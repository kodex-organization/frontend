import { apiFetch } from "@/lib/api/client";
import type { ActiveSession, ApiResponse, Customer, TableOption } from "./types";
const request = <T>(path: string, options?: RequestInit) => apiFetch<ApiResponse<T>>(path, options).then((r) => r.data);
export const sessionApi = {
  active: () => request<ActiveSession[]>("/sessions?status=ACTIVE&limit=100"),
  paused: () => request<ActiveSession[]>("/sessions?status=PAUSED&limit=100"),
  tables: () => request<TableOption[]>("/sessions/available-tables"),
  customers: (q: string) => request<Customer[]>(`/customers?q=${encodeURIComponent(q)}&limit=10`),
  start: (body: { tableId: string; customerId?: string | null }) => request<ActiveSession>("/sessions", { method: "POST", body: JSON.stringify(body) }),
  action: (id: string, action: "pause" | "resume" | "end") => request<unknown>(`/sessions/${id}/${action}`, { method: "POST" }),
  switchTable: (id: string, tableId: string) => request<unknown>(`/sessions/${id}/switch-table`, { method: "POST", body: JSON.stringify({ tableId }) }),
};

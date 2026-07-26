// src/services/catalog.service.ts
import { apiFetch } from "@/lib/api/client";
import {
  SnookerTable,
  RatePlan,
  CreateTableInput,
  CreateRatePlanInput,
} from "@/features/catalog/types/catalog.types";

// Fix: this used to have its own local apiFetch() that sent a hardcoded
// fake `x-branch-id` header instead of a real JWT, and called
// `/api/v1/tables` — a path the backend never registered (catalog routes
// are actually mounted at `/api/v1/catalog`). Every request here was
// 404ing. Now using the shared apiFetch (same one auth/sessions/etc. use)
// so branch/tenant scoping comes from the verified access token, and the
// paths match the backend's real prefix.

// ── get all tables ────────────────────────────
export async function getTables(): Promise<SnookerTable[]> {
  return apiFetch<SnookerTable[]>("/catalog");
}

// ── create table ──────────────────────────────
export async function createTable(
  input: CreateTableInput
): Promise<SnookerTable> {
  return apiFetch<SnookerTable>("/catalog", {
    method: "POST",
    body: JSON.stringify({
      tableNumber: input.tableNumber,
      defaultHourlyRate: input.hourlyRate,
    }),
  });
}

// ── update table ──────────────────────────────
export async function updateTable(
  id: string,
  input: Partial<CreateTableInput>
): Promise<SnookerTable> {
  return apiFetch<SnookerTable>(`/catalog/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(input.tableNumber && { tableNumber: input.tableNumber }),
      ...(input.hourlyRate && { defaultHourlyRate: input.hourlyRate }),
      ...(input.status && { status: input.status }),
    }),
  });
}

// ── delete table ──────────────────────────────
export async function deleteTable(id: string): Promise<void> {
  await apiFetch<null>(`/catalog/${id}`, {
    method: "DELETE",
  });
}

// ── get rate history ──────────────────────────
export async function getRateHistory(tableId: string): Promise<RatePlan[]> {
  return apiFetch<RatePlan[]>(`/catalog/${tableId}/rates`);
}

// ── create rate plan ──────────────────────────
export async function createRatePlan(
  tableId: string,
  input: CreateRatePlanInput
): Promise<RatePlan> {
  return apiFetch<RatePlan>(`/catalog/${tableId}/rates`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
// src/services/catalog.service.ts

import {
  SnookerTable,
  RatePlan,
  CreateTableInput,
  CreateRatePlanInput,
} from "@/features/catalog/types/catalog.types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// ── helper ────────────────────────────────────
async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      // Dev 2 will replace this with real JWT later
      "x-branch-id": "00000000-0000-0000-0000-000000000002",
    },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

// ── get all tables ────────────────────────────
export async function getTables(): Promise<SnookerTable[]> {
  const data = await apiFetch(`${BASE_URL}/api/v1/tables`);
  return data.data;
}

// ── create table ──────────────────────────────
export async function createTable(
  input: CreateTableInput
): Promise<SnookerTable> {
  const data = await apiFetch(`${BASE_URL}/api/v1/tables`, {
    method: "POST",
    body: JSON.stringify({
      tableNumber: input.tableNumber,
      defaultHourlyRate: input.hourlyRate,
    }),
  });
  return data.data;
}

// ── update table ──────────────────────────────
export async function updateTable(
  id: string,
  input: Partial<CreateTableInput>
): Promise<SnookerTable> {
  const data = await apiFetch(`${BASE_URL}/api/v1/tables/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(input.tableNumber && { tableNumber: input.tableNumber }),
      ...(input.hourlyRate && { defaultHourlyRate: input.hourlyRate }),
      ...(input.status && { status: input.status }),
    }),
  });
  return data.data;
}

// ── delete table ──────────────────────────────
export async function deleteTable(id: string): Promise<void> {
  await apiFetch(`${BASE_URL}/api/v1/tables/${id}`, {
    method: "DELETE",
  });
}

// ── get rate history ──────────────────────────
export async function getRateHistory(tableId: string): Promise<RatePlan[]> {
  const data = await apiFetch(`${BASE_URL}/api/v1/tables/${tableId}/rates`);
  return data.data;
}

// ── create rate plan ──────────────────────────
export async function createRatePlan(
  tableId: string,
  input: CreateRatePlanInput
): Promise<RatePlan> {
  const data = await apiFetch(
    `${BASE_URL}/api/v1/tables/${tableId}/rates`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
  return data.data;
}
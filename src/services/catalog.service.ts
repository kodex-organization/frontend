// src/services/catalog.service.ts

import { SnookerTable, CreateTableInput } from
  "@/features/catalog/types/catalog.types";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

// ── get all tables ────────────────────────────
export async function getTables(): Promise<SnookerTable[]> {
  const res = await fetch(`${BASE_URL}/api/v1/tables`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to fetch tables");
  return data.data;
}

// ── create table ──────────────────────────────
export async function createTable(
  input: CreateTableInput
): Promise<SnookerTable> {
  const res = await fetch(`${BASE_URL}/api/v1/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to create table");
  return data.data;
}

// ── update table ──────────────────────────────
export async function updateTable(
  id: number,
  input: Partial<CreateTableInput>
): Promise<SnookerTable> {
  const res = await fetch(`${BASE_URL}/api/v1/tables/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update table");
  return data.data;
}

// ── delete table ──────────────────────────────
export async function deleteTable(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/v1/tables/${id}`, {
    method: "DELETE",
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to delete table");
}
import type {
  CreateRatePlanInput,
  CreateTableInput,
  RatePlan,
  SnookerTable,
} from "@/features/catalog/types/catalog.types";
import { apiFetch } from "@/lib/api/client";

export function getTables(): Promise<SnookerTable[]> {
  return apiFetch<SnookerTable[]>("/catalog");
}

export function createTable(
  input: CreateTableInput,
): Promise<SnookerTable> {
  return apiFetch<SnookerTable>("/catalog", {
    method: "POST",
    body: JSON.stringify({
      tableNumber: input.tableNumber,
      defaultHourlyRate: input.hourlyRate,
    }),
  });
}

export function updateTable(
  id: string,
  input: Partial<CreateTableInput>,
): Promise<SnookerTable> {
  return apiFetch<SnookerTable>(`/catalog/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(input.tableNumber && { tableNumber: input.tableNumber }),
      ...(input.hourlyRate && { defaultHourlyRate: input.hourlyRate }),
      ...(input.status && { status: input.status }),
    }),
  });
}

export async function deleteTable(id: string): Promise<void> {
  await apiFetch<null>(`/catalog/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function getRateHistory(tableId: string): Promise<RatePlan[]> {
  return apiFetch<RatePlan[]>(
    `/catalog/${encodeURIComponent(tableId)}/rates`,
  );
}

export function createRatePlan(
  tableId: string,
  input: CreateRatePlanInput,
): Promise<RatePlan> {
  return apiFetch<RatePlan>(
    `/catalog/${encodeURIComponent(tableId)}/rates`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

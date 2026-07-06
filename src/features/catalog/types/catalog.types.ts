// src/features/catalog/types/catalog.types.ts

export type TableStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";

export interface SnookerTable {
  id: number;
  tableNumber: string;
  hourlyRate: number;
  status: TableStatus;
}

export interface CreateTableInput {
  tableNumber: string;
  hourlyRate: number;
}
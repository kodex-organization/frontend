import type { TableOption } from "./types";

// Offline "available tables" cache, stored per branch so one branch never sees another's tables.

// Old shared key: never read, only removed.
const LEGACY_KEY = "cuecloud_offline_tables";

export function offlineTablesKey(branchId: string): string {
  return `${LEGACY_KEY}:${branchId}`;
}

export function saveCachedTables(
  branchId: string | null | undefined,
  tables: TableOption[],
): void {
  if (typeof window === "undefined" || !branchId) return;
  try {
    window.localStorage.setItem(offlineTablesKey(branchId), JSON.stringify(tables));
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
  }
}

export function addCachedTable(
  branchId: string | null | undefined,
  table: TableOption,
): void {
  if (!branchId) return;
  const tables = readCachedTables(branchId);
  if (!tables.some((t) => t.id === table.id)) saveCachedTables(branchId, [...tables, table]);
}

export function removeCachedTable(
  branchId: string | null | undefined,
  tableId: string,
): void {
  if (!branchId) return;
  const tables = readCachedTables(branchId);
  const filtered = tables.filter((table) => table.id !== tableId);
  if (filtered.length !== tables.length) saveCachedTables(branchId, filtered);
}

export function readCachedTables(
  branchId: string | null | undefined,
): TableOption[] {
  if (typeof window === "undefined" || !branchId) return [];
  try {
    const raw = window.localStorage.getItem(offlineTablesKey(branchId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as TableOption[]) : [];
  } catch {
    return [];
  }
}
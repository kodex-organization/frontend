import { ApiError } from "@/lib/api/client";
import { tokenStorage } from "@/lib/auth/session";
import { offlineDB } from "./offline-db";

/**
 * Small helpers that keep reference data (dashboard snapshot, assigned branches,
 * customer cache owner) available while the club is offline. Stored in the existing `syncMeta`
 * Dexie table, so no database schema change is needed.
 *
 * Everything is scoped by tenant: one browser can be used by different clubs,
 * and SRS 3.2 says no data may leak across tenant boundaries.
 */

const CUSTOMER_CACHE_TENANT_KEY = "cache:customers:tenant";

function getScope() {
  const context = tokenStorage.getAccessContext();
  if (!context) return null;
  return {
    tenantId: context.tenantId,
    roles: context.roles.map((role) => role.toUpperCase()),
  };
}

/** Same rule as the backend: OWNER / MANAGER see every branch's customers. */
export function canSeeAllBranchesOffline(): boolean {
  const scope = getScope();
  return Boolean(
    scope?.roles.some((role) => role === "OWNER" || role === "MANAGER"),
  );
}

/**
 * Call after a successful ONLINE customer fetch. Marks the cached customers as
 * belonging to the current tenant, and wipes them first if they belonged to a
 * different tenant (another club used this browser before).
 */
export async function claimCustomerCacheForCurrentTenant() {
  const scope = getScope();
  if (!scope) return;
  try {
    const owner = await offlineDB.syncMeta.get(CUSTOMER_CACHE_TENANT_KEY);
    if (owner && owner.value !== scope.tenantId) {
      await offlineDB.cachedCustomers.clear();
    }
    if (!owner || owner.value !== scope.tenantId) {
      await offlineDB.syncMeta.put({
        key: CUSTOMER_CACHE_TENANT_KEY,
        value: scope.tenantId,
      });
    }
  } catch {
    // best-effort
  }
}

/** False only when the cache is known to belong to another tenant. */
export async function isCustomerCacheUsable(): Promise<boolean> {
  const scope = getScope();
  if (!scope) return false;
  try {
    const owner = await offlineDB.syncMeta.get(CUSTOMER_CACHE_TENANT_KEY);
    return !owner || owner.value === scope.tenantId;
  } catch {
    return true;
  }
}

/**
 * True when a request failed because the club is offline or the server cannot
 * be reached (as opposed to the server answering with a real error).
 */
export function isNetworkFailure(error: unknown): boolean {
  return (
    (error instanceof ApiError && error.code === "NETWORK_ERROR") ||
    error instanceof TypeError ||
    (typeof navigator !== "undefined" && !navigator.onLine)
  );
}

type ScopedSnapshot<T> = { savedAt: string; data: T };

const scopedKey = (tenantId: string, name: string) => `cache:${tenantId}:${name}`;

/** Saves the last successful server answer so it can be shown offline (SRS 3.10). */
export async function cacheScopedJson<T>(name: string, data: T) {
  const scope = getScope();
  if (!scope) return;
  try {
    const snapshot: ScopedSnapshot<T> = { savedAt: new Date().toISOString(), data };
    await offlineDB.syncMeta.put({
      key: scopedKey(scope.tenantId, name),
      value: JSON.stringify(snapshot),
    });
  } catch {
    // best-effort
  }
}

export async function readScopedJson<T>(
  name: string,
): Promise<ScopedSnapshot<T> | null> {
  const scope = getScope();
  if (!scope) return null;
  try {
    const row = await offlineDB.syncMeta.get(scopedKey(scope.tenantId, name));
    return row ? (JSON.parse(row.value) as ScopedSnapshot<T>) : null;
  } catch {
    return null;
  }
}

/**
 * Loads data from the server and remembers the answer. When the server cannot be
 * reached it returns the last saved answer (with the time it was saved) instead of
 * failing. Online behaviour is unchanged: the fetcher's result is returned as is.
 */
export async function loadWithOfflineSnapshot<T>(
  name: string,
  fetcher: () => Promise<T>,
): Promise<{ data: T; savedAt: string | null }> {
  try {
    const data = await fetcher();
    void cacheScopedJson(name, data);
    return { data, savedAt: null };
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    const saved = await readScopedJson<T>(name);
    if (saved) return { data: saved.data, savedAt: saved.savedAt };
    throw error;
  }
}
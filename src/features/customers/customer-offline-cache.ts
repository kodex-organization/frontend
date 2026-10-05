import { offlineDB } from "@/lib/sync/offline-db";
import { tokenStorage } from "@/lib/auth/session";
import type { CustomerTag } from "./types";

/**
 * Small offline cache for "lookup" data the customer screens need
 * (tag list, branch list). It reuses the existing Dexie `syncMeta`
 * table (key/value), so NO database schema/version change is needed.
 *
 * Keys are scoped per tenant so two tenants on the same computer
 * never see each other's data.
 */

export type CachedBranchOption = { id: string; name: string };

// Same defaults the backend seeds for a new tenant (customer.service.ts).
export const DEFAULT_TAG_NAMES = ["VIP", "Blocked", "Regular"] as const;

function cacheKey(name: string): string | null {
  const tenantId = tokenStorage.getAccessContext()?.tenantId;
  return tenantId ? `customer-lookup:${tenantId}:${name}` : null;
}

async function save<T>(name: string, value: T): Promise<void> {
  const key = cacheKey(name);
  if (!key) return;
  try {
    await offlineDB.syncMeta.put({ key, value: JSON.stringify(value) });
  } catch {
    // A cache write failure must never break the online flow.
  }
}

async function read<T>(name: string): Promise<T | null> {
  const key = cacheKey(name);
  if (!key) return null;
  try {
    const row = await offlineDB.syncMeta.get(key);
    return row ? (JSON.parse(row.value) as T) : null;
  } catch {
    return null;
  }
}

export const saveCachedTags = (tags: CustomerTag[]) => save("tags", tags);

/** Cached tags, or the default tags if this device never went online yet. */
export async function readCachedTags(): Promise<CustomerTag[]> {
  const cached = await read<CustomerTag[]>("tags");
  if (cached && cached.length > 0) return cached;
  return DEFAULT_TAG_NAMES.map((name) => ({
    id: `offline-tag:${name.toLowerCase()}`,
    name,
  }));
}

export const saveCachedBranches = (branches: CachedBranchOption[]) =>
  save("branches", branches);

export const readCachedBranches = () => read<CachedBranchOption[]>("branches");
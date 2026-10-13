import type {
  BranchFilterParams,
  BranchItem,
  BranchListResponse,
  CreateBranchPayload,
  UpdateBranchConfigPayload,
  UpdateBranchPayload,
} from "../../types/branch";
import { notifyAssignedBranchesChanged } from "@/features/tenancy/branch-switching";
import { cacheBranchCurrency, cacheBranchName } from "@/features/tenancy/branch-currency-cache";

import { apiFetch } from "@/lib/api/client";

/**
 * Generic helper for typed API responses using standard authenticated apiFetch
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const data = await apiFetch<T>(endpoint, options);
  if (options.method && options.method !== "GET") notifyAssignedBranchesChanged();
  return data;
}

/**
 * 1. Fetch paginated branch list for the authenticated tenant
 */
export async function fetchBranches(
  params: BranchFilterParams = {}
): Promise<BranchListResponse> {
  const query = new URLSearchParams();

  if (params.page) query.append("page", String(params.page));
  if (params.limit) query.append("limit", String(params.limit));
  if (params.search) query.append("search", params.search);
  if (params.isActive !== undefined) {
    query.append("isActive", String(params.isActive));
  }

  const qs = query.toString();
  return request<BranchListResponse>(`/tenancy/branches${qs ? `?${qs}` : ""}`);
}

/**
 * 2. Fetch single branch details by ID
 */
export async function fetchBranchById(branchId: string): Promise<BranchItem> {
  return request<BranchItem>(`/tenancy/branches/${branchId}`);
}

/**
 * 3. Create a new branch under the current tenant
 */
export async function createBranch(payload: CreateBranchPayload): Promise<BranchItem> {
  const branch = await request<BranchItem>("/tenancy/branches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  cacheBranchCurrency(branch.id, branch.currency || "PKR");
  cacheBranchName(branch.id, branch.name);
  return branch;
}

/**
 * 4. Update branch general details
 */
export async function updateBranch(
  branchId: string,
  payload: UpdateBranchPayload
): Promise<BranchItem> {
  const branch = await request<BranchItem>(`/tenancy/branches/${branchId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  cacheBranchCurrency(branch.id, branch.currency || "PKR");
  cacheBranchName(branch.id, branch.name);
  return branch;
}

/**
 * 5. Update branch operational & financial configuration (taxes, caps, multipliers)
 */
export async function updateBranchConfig(
  branchId: string,
  payload: UpdateBranchConfigPayload
): Promise<BranchItem> {
  const branch = await request<BranchItem>(`/tenancy/branches/${branchId}/config`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  cacheBranchCurrency(branch.id, branch.currency || "PKR");
  cacheBranchName(branch.id, branch.name);
  return branch;
}

/**
 * 6. Soft delete a branch
 */
export async function deleteBranch(
  branchId: string
): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/tenancy/branches/${branchId}`, {
    method: "DELETE",
  });
}

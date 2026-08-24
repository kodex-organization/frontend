import type {
  BranchFilterParams,
  BranchItem,
  BranchListResponse,
  CreateBranchPayload,
  UpdateBranchConfigPayload,
  UpdateBranchPayload,
} from "../../types/branch";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("cuecloud_access_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    null
  );
}

function getStoredDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cuecloud_device_id") || null;
}

/**
 * Generic helper for typed API responses
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const deviceId = getStoredDeviceId();

  // Only attach Content-Type: application/json if there is an actual body
  const headers: Record<string, string> = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(deviceId ? { "x-device-id": deviceId } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || json.success === false) {
    throw new Error(json.error?.message || json.message || "An unexpected error occurred");
  }

  return json.data as T;
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
  return request<BranchItem>("/tenancy/branches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * 4. Update branch general details
 */
export async function updateBranch(
  branchId: string,
  payload: UpdateBranchPayload
): Promise<BranchItem> {
  return request<BranchItem>(`/tenancy/branches/${branchId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * 5. Update branch operational & financial configuration (taxes, caps, multipliers)
 */
export async function updateBranchConfig(
  branchId: string,
  payload: UpdateBranchConfigPayload
): Promise<BranchItem> {
  return request<BranchItem>(`/tenancy/branches/${branchId}/config`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
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
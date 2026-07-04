import { env } from "@/config/env";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const authHeaders: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem("cuecloud-auth-context");
    if (raw) {
      const auth = JSON.parse(raw) as Record<string, string>;
      if (auth.tenantId) authHeaders["x-tenant-id"] = auth.tenantId;
      if (auth.branchId) authHeaders["x-branch-id"] = auth.branchId;
      if (auth.userId) authHeaders["x-user-id"] = auth.userId;
      if (auth.deviceId) authHeaders["x-device-id"] = auth.deviceId;
    }
  }
  const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...options,
    headers: {
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const apiError = (body as { error?: string | { message?: string } }).error;
    throw new ApiError(typeof apiError === "string" ? apiError : apiError?.message ?? "Request failed", response.status);
  }

  return response.json() as Promise<T>;
}

import { env } from "@/config/env";
import { tokenStorage } from "@/lib/auth/session";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error: { message: string; code?: string } | null;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Calls POST /auth/refresh once; de-duped so concurrent 401s don't race. */
async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const tokens = tokenStorage.get();
    if (!tokens?.refreshToken) return false;

    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      if (!response.ok) {
        tokenStorage.clear();
        return false;
      }
      const body = (await response.json()) as Envelope<{
        accessToken: string;
        refreshToken: string;
        expiresIn: string;
      }>;
      tokenStorage.set(body.data);
      return true;
    } catch {
      return false;
    }
  })();

  const result = await refreshInFlight;
  refreshInFlight = null;
  return result;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { skipAuthRetry?: boolean },
): Promise<T> {
  const tokens = tokenStorage.get();

  const doFetch = () =>
    fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(tokens?.accessToken ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
        ...options?.headers,
      },
    });

  let response: Response;
  try {
    response = await doFetch();
  } catch {
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }

  if (response.status === 401 && !options?.skipAuthRetry && tokens?.refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      try {
        response = await doFetch();
      } catch {
        throw new ApiError(
          "Could not reach the server. Check your connection and try again.",
          0,
          "NETWORK_ERROR",
        );
      }
    }
  }

  const body = await response.json().catch(() => null) as Envelope<T> | null;

  if (!response.ok || !body || body.success === false) {
    throw new ApiError(
      body?.error?.message ??
        (response.ok
          ? "Unexpected response from server"
          : `Request failed (${response.status}). The server may have restarted — please try again.`),
      response.status,
      body?.error?.code,
    );
  }

  return body.data;
}

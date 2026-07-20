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
  error: { message: string; code?: string } | string | null;
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Calls POST /auth/refresh once; de-duped so concurrent 401s don't race.
 * No refresh token is read from storage — the browser holds none. The
 * httpOnly cookie set at login/refresh time is sent automatically because
 * of `credentials: "include"`; if there's no valid cookie (never logged
 * in, or it expired/was revoked), the backend just 401s and we clear
 * whatever stale access token we had.
 */
async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        tokenStorage.clear();
        return false;
      }

      const body = (await response.json()) as Envelope<{
        accessToken: string;
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
  const doFetch = () => {
    const latestTokens = tokenStorage.get();

    return fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
      ...options,
      // Needed so the httpOnly refresh-token cookie is sent to /auth/refresh
      // and /auth/logout; harmless no-op for every other route.
      credentials: "include",
      headers: {
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        ...(latestTokens?.accessToken
          ? { Authorization: `Bearer ${latestTokens.accessToken}` }
          : {}),
        ...options?.headers,
      },
    });
  };

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

  // No client-held refresh token to gate on anymore — if there's a valid
  // refresh cookie, /auth/refresh will succeed; if not, it 401s harmlessly
  // and we fall through to the original response's error below.
  if (response.status === 401 && !options?.skipAuthRetry) {
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

  const body = (await response.json().catch(() => null)) as Envelope<T> | null;

  if (!response.ok || !body || body.success === false) {
    const errorMessage =
      typeof body?.error === "string"
        ? body.error
        : body?.error?.message;
    const errorCode =
      typeof body?.error === "object" && body.error
        ? body.error.code
        : undefined;

    throw new ApiError(
      errorMessage ??
        (response.ok
          ? "Unexpected response from server"
          : `Request failed (${response.status}). The server may have restarted — please try again.`),
      response.status,
      errorCode,
    );
  }

  return body.data;
}
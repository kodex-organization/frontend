import { env } from "@/config/env";
import { tokenStorage } from "@/lib/auth/session";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Envelope<T> {
  success: boolean;
  data: T;
  error: { message: string; code?: string; details?: unknown } | string | null;
}

let refreshInFlight: Promise<boolean> | null = null;

const getApiBaseUrl = () => {
  if (typeof window === "undefined") return env.NEXT_PUBLIC_API_URL;

  const configuredPath = new URL(env.NEXT_PUBLIC_API_URL).pathname.replace(
    /\/$/,
    "",
  );

  return configuredPath && configuredPath !== "/"
    ? configuredPath
    : "/api/backend";
};

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

  const refreshRequest = (async () => {
    try {
      const storedTokens = tokenStorage.get();
      const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          storedTokens?.refreshToken
            ? { refreshToken: storedTokens.refreshToken }
            : {},
        ),
      });

      if (!response.ok) {
        return false;
      }

      const body = (await response.json().catch(() => null)) as Envelope<{
        accessToken: string;
        refreshToken?: string;
        expiresIn: string;
      }> | null;

      if (
        !body ||
        body.success === false ||
        !body.data?.accessToken
      ) {
        return false;
      }

      tokenStorage.set(body.data);
      return true;
    } catch {
      return false;
    }
  })();

  refreshInFlight = refreshRequest;

  try {
    const refreshed = await refreshRequest;

    if (!refreshed) {
      tokenStorage.clear();
    }

    return refreshed;
  } finally {
    if (refreshInFlight === refreshRequest) {
      refreshInFlight = null;
    }
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { skipAuthRetry?: boolean },
): Promise<T> {
  const doFetch = () => {
    const latestTokens = tokenStorage.get();
    const accessContext = tokenStorage.getAccessContext();

    return fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      // Needed so the httpOnly refresh-token cookie is sent to /auth/refresh
      // and /auth/logout; harmless no-op for every other route.
      credentials: "include",
      headers: {
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        ...(accessContext?.deviceId
          ? { "X-Device-Id": accessContext.deviceId }
          : {}),
        ...(accessContext?.branchId
          ? { "X-Branch-Id": accessContext.branchId }
          : {}),
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
  if (
    response.status === 401 &&
    tokenStorage.get()?.accessToken &&
    !options?.skipAuthRetry
  ) {
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

      if (response.status === 401) {
        tokenStorage.clear();
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
    const errorDetails =
      typeof body?.error === "object" && body.error
        ? body.error.details
        : undefined;

    throw new ApiError(
      errorMessage ??
        (response.ok
          ? "Unexpected response from server"
          : `Request failed (${response.status}). The server may have restarted — please try again.`),
      response.status,
      errorCode,
      errorDetails,
    );
  }

  return body.data;
}

export interface ApiDownloadResult {
  blob: Blob;
  fileName: string;
  checksumSha256: string | null;
  sizeBytes: number | null;
}

function fileNameFromDisposition(value: string | null) {
  const match = value?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? "cuecloud-export.json";
}

export async function apiDownload(path: string): Promise<ApiDownloadResult> {
  const doFetch = () => {
    const tokens = tokenStorage.get();
    const context = tokenStorage.getAccessContext();
    return fetch(`${getApiBaseUrl()}${path}`, {
      method: "GET",
      credentials: "include",
      headers: {
        ...(context?.deviceId ? { "X-Device-Id": context.deviceId } : {}),
        ...(context?.branchId ? { "X-Branch-Id": context.branchId } : {}),
        ...(tokens?.accessToken
          ? { Authorization: `Bearer ${tokens.accessToken}` }
          : {}),
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

  if (response.status === 401 && tokenStorage.get()?.accessToken) {
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
      if (response.status === 401) tokenStorage.clear();
    }
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as Envelope<unknown> | null;
    const message =
      typeof body?.error === "string" ? body.error : body?.error?.message;
    const code =
      typeof body?.error === "object" && body.error
        ? body.error.code
        : undefined;
    const details =
      typeof body?.error === "object" && body.error
        ? body.error.details
        : undefined;
    throw new ApiError(
      message ?? `Download failed (${response.status}).`,
      response.status,
      code,
      details,
    );
  }

  const lengthHeader = response.headers.get("Content-Length");
  const length = lengthHeader === null ? Number.NaN : Number(lengthHeader);
  return {
    blob: await response.blob(),
    fileName: fileNameFromDisposition(
      response.headers.get("Content-Disposition"),
    ),
    checksumSha256: response.headers.get("X-Checksum-SHA256"),
    sizeBytes: Number.isFinite(length) ? length : null,
  };
}

export async function apiFetchBlob(
  path: string,
  options?: RequestInit,
): Promise<Blob> {
  const tokens = tokenStorage.get();
  const accessContext = tokenStorage.getAccessContext();
  let response: Response;

  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...(accessContext?.deviceId
          ? { "X-Device-Id": accessContext.deviceId }
          : {}),
        ...(accessContext?.branchId
          ? { "X-Branch-Id": accessContext.branchId }
          : {}),
        ...(tokens?.accessToken
          ? { Authorization: `Bearer ${tokens.accessToken}` }
          : {}),
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as Envelope<unknown> | null;
    const message =
      typeof body?.error === "string" ? body.error : body?.error?.message;
    const code =
      typeof body?.error === "object" && body.error
        ? body.error.code
        : undefined;
    const details =
      typeof body?.error === "object" && body.error
        ? body.error.details
        : undefined;
    throw new ApiError(
      message ?? `Request failed (${response.status})`,
      response.status,
      code,
      details,
    );
  }

  return response.blob();
}

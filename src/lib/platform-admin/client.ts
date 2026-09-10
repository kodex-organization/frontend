import { env } from "@/config/env";
import { ApiError } from "@/lib/api/client";
import { platformAdminStorage } from "./session";

interface Envelope<T> {
  success: boolean;
  data: T;
  error: { message: string; code?: string; details?: unknown } | string | null;
}

interface PlatformAdminTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: string;
}

interface PlatformAdminRequestOptions extends RequestInit {
  skipAuthRetry?: boolean;
  skipPlatformAuth?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

function getApiBaseUrl() {
  if (typeof window === "undefined") return env.NEXT_PUBLIC_API_URL;
  const configuredPath = new URL(env.NEXT_PUBLIC_API_URL).pathname.replace(
    /\/$/,
    "",
  );
  return configuredPath && configuredPath !== "/"
    ? configuredPath
    : "/api/backend";
}

async function parseResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !body || body.success === false) {
    const errorMessage =
      typeof body?.error === "string" ? body.error : body?.error?.message;
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
          : `Request failed (${response.status}). Please try again.`),
      response.status,
      errorCode,
      errorDetails,
    );
  }
  return body.data;
}

export async function refreshPlatformAdminAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  const request = (async () => {
    try {
      const storedRefreshToken = platformAdminStorage.getRefreshToken();
      const response = await fetch(
        `${getApiBaseUrl()}/super-admin/auth/refresh`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(
            storedRefreshToken ? { refreshToken: storedRefreshToken } : {},
          ),
        },
      );
      if (!response.ok) return false;
      const tokens = await parseResponse<PlatformAdminTokens>(response);
      platformAdminStorage.setAccessToken(tokens.accessToken);
      if (tokens.refreshToken) {
        platformAdminStorage.setRefreshToken(tokens.refreshToken);
      }
      return true;
    } catch {
      return false;
    }
  })();

  refreshInFlight = request;
  try {
    const refreshed = await request;
    if (!refreshed) platformAdminStorage.clear();
    return refreshed;
  } finally {
    if (refreshInFlight === request) refreshInFlight = null;
  }
}

export async function platformAdminFetch<T>(
  path: string,
  options: PlatformAdminRequestOptions = {},
): Promise<T> {
  const {
    skipAuthRetry,
    skipPlatformAuth,
    ...requestOptions
  } = options;
  const doFetch = () => {
    const accessToken = skipPlatformAuth
      ? null
      : platformAdminStorage.getAccessToken();
    return fetch(`${getApiBaseUrl()}${path}`, {
      ...requestOptions,
      credentials: "include",
      headers: {
        ...(requestOptions.body ? { "Content-Type": "application/json" } : {}),
        ...(accessToken
          ? { Authorization: `Bearer ${accessToken}` }
          : {}),
        ...requestOptions.headers,
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

  if (
    response.status === 401 &&
    platformAdminStorage.getAccessToken() &&
    !skipAuthRetry &&
    !skipPlatformAuth
  ) {
    const refreshed = await refreshPlatformAdminAccessToken();
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
      if (response.status === 401) platformAdminStorage.clear();
    }
  }

  return parseResponse<T>(response);
}

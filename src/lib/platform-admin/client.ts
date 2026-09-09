import { env } from "@/config/env";
import { ApiError } from "@/lib/api/client";
import { platformAdminStorage, decodePlatformAdminAccessToken, PLATFORM_ADMIN_SESSION_CLEARED_EVENT, PLATFORM_ADMIN_SESSION_REPLACED_EVENT } from "./session";
import { createSessionRefresh } from '@/lib/auth/session-refresh';

interface Envelope<T> {
  success: boolean;
  data: T;
  error: { message: string; code?: string; details?: unknown } | string | null;
}

interface PlatformAdminTokens {
  accessToken: string;
  expiresIn: string;
}

interface PlatformAdminRequestOptions extends RequestInit {
  skipAuthRetry?: boolean;
  skipPlatformAuth?: boolean;
}

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

export const refreshPlatformAdminAccessToken = createSessionRefresh(
  {
    lockName: 'cuecloud:platform-admin-refresh',
    getVersion: () => platformAdminStorage.getSessionVersion(),
    getToken: () => platformAdminStorage.getAccessToken(),
    setToken: (token) => {
      const admin = platformAdminStorage.getAdmin();
      if (admin && decodePlatformAdminAccessToken(token)?.platformAdminId !== admin.id) {
        throw new Error('Refreshed token does not belong to the current administrator');
      }
      platformAdminStorage.setAccessToken(token);
    },
    clear: () => platformAdminStorage.clear(),
    changeEvents: [PLATFORM_ADMIN_SESSION_CLEARED_EVENT, PLATFORM_ADMIN_SESSION_REPLACED_EVENT],
  },
  async (signal) => {
      const response = await fetch(
        `${getApiBaseUrl()}/super-admin/auth/refresh`,
        {
          signal,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({}),
        },
      );
      if (!response.ok) return { unauthorized: response.status === 401 || response.status === 403 };
      const tokens = await parseResponse<PlatformAdminTokens>(response);
      return { accessToken: tokens.accessToken };
  },
);

export async function platformAdminFetch<T>(
  path: string,
  options: PlatformAdminRequestOptions = {},
): Promise<T> {
  const {
    skipAuthRetry,
    skipPlatformAuth,
    ...requestOptions
  } = options;
  const version = platformAdminStorage.getSessionVersion();
  const assertCurrentSession = () => {
    if (!skipPlatformAuth && platformAdminStorage.getSessionVersion() !== version) {
      throw new ApiError('Your session changed. Please try again.', 401, 'SESSION_CHANGED');
    }
  };
  let sentToken: string | null = null;
  const doFetch = () => {
    assertCurrentSession();
    const accessToken = skipPlatformAuth
      ? null
      : platformAdminStorage.getAccessToken();
    sentToken = accessToken;
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

  assertCurrentSession();
  if (
    response.status === 401 &&
    platformAdminStorage.getAccessToken() &&
    !skipAuthRetry &&
    !skipPlatformAuth
  ) {
    const refreshed = platformAdminStorage.getAccessToken() !== sentToken || await refreshPlatformAdminAccessToken();
    assertCurrentSession();
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
      assertCurrentSession();
      if (response.status === 401 && platformAdminStorage.getAccessToken() === sentToken) platformAdminStorage.clear();
    }
  }

  const data = await parseResponse<T>(response);
  assertCurrentSession();
  return data;
}

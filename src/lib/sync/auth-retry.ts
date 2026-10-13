import { ApiError } from "@/lib/api/client";
import { tokenStorage } from "@/lib/auth/session";

const SESSION_EXPIRED_MESSAGE =
  "Your session expired. Please log in again; pending changes stay saved on this device.";

// Right after reconnecting, the first token refresh can fail once; retry once before giving up.
export async function retryOnAuthExpiry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || error.code === "SESSION_CHANGED") {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (!tokenStorage.get()?.accessToken) {
      throw new ApiError(SESSION_EXPIRED_MESSAGE, 401, "UNAUTHORIZED");
    }
    try {
      return await run();
    } catch (retryError) {
      if (retryError instanceof ApiError && retryError.status === 401) {
        throw new ApiError(SESSION_EXPIRED_MESSAGE, 401, "UNAUTHORIZED");
      }
      throw retryError;
    }
  }
}
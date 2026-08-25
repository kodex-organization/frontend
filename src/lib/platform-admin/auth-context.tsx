"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  endPlatformAdminSession,
  establishPlatformAdminSession,
  getCurrentPlatformAdmin,
  loginPlatformAdmin,
} from "@/features/platform-admin/auth";
import { refreshPlatformAdminAccessToken } from "./client";
import {
  PLATFORM_ADMIN_SESSION_CLEARED_EVENT,
  PLATFORM_ADMIN_STORAGE_KEYS,
  platformAdminStorage,
  type PlatformAdmin,
} from "./session";

interface PlatformAdminAuthContextValue {
  admin: PlatformAdmin | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<PlatformAdmin>;
  logout: () => Promise<void>;
  refreshCurrentAdmin: () => Promise<PlatformAdmin | null>;
}

const PlatformAdminAuthContext =
  createContext<PlatformAdminAuthContextValue | null>(null);

export function PlatformAdminAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const restoreSession = useCallback(async () => {
    try {
      if (!platformAdminStorage.getAccessToken()) {
        const refreshed = await refreshPlatformAdminAccessToken();
        if (!refreshed) {
          setAdmin(null);
          return null;
        }
      }

      const current = await getCurrentPlatformAdmin();
      platformAdminStorage.setAdmin(current);
      setAdmin(current);
      return current;
    } catch {
      platformAdminStorage.clear();
      setAdmin(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      await restoreSession();
      if (active) setIsLoading(false);
    };
    const clearSession = () => {
      if (active) {
        setAdmin(null);
        setIsLoading(false);
      }
    };
    const syncFromStorage = (event: StorageEvent) => {
      if (
        event.key === PLATFORM_ADMIN_STORAGE_KEYS.accessToken ||
        event.key === PLATFORM_ADMIN_STORAGE_KEYS.admin
      ) {
        void restoreSession();
      }
    };

    window.addEventListener(
      PLATFORM_ADMIN_SESSION_CLEARED_EVENT,
      clearSession,
    );
    window.addEventListener("storage", syncFromStorage);
    void initialize();

    return () => {
      active = false;
      window.removeEventListener(
        PLATFORM_ADMIN_SESSION_CLEARED_EVENT,
        clearSession,
      );
      window.removeEventListener("storage", syncFromStorage);
    };
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string) => {
    const session = await loginPlatformAdmin(email, password);
    const authenticatedAdmin = establishPlatformAdminSession(session);
    setAdmin(authenticatedAdmin);
    setIsLoading(false);
    return authenticatedAdmin;
  }, []);

  const logout = useCallback(async () => {
    try {
      await endPlatformAdminSession();
    } finally {
      setAdmin(null);
      setIsLoading(false);
      router.replace("/super-admin/login");
    }
  }, [router]);

  const value = useMemo(
    () => ({
      admin,
      isLoading,
      isAuthenticated:
        !isLoading &&
        admin !== null &&
        platformAdminStorage.getAccessToken() !== null,
      login,
      logout,
      refreshCurrentAdmin: restoreSession,
    }),
    [admin, isLoading, login, logout, restoreSession],
  );

  return (
    <PlatformAdminAuthContext.Provider value={value}>
      {children}
    </PlatformAdminAuthContext.Provider>
  );
}

export function usePlatformAdminAuth() {
  const context = useContext(PlatformAdminAuthContext);
  if (!context) {
    throw new Error(
      "usePlatformAdminAuth must be used within PlatformAdminAuthProvider",
    );
  }
  return context;
}

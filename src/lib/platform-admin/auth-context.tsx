"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  endPlatformAdminSession,
  establishPlatformAdminSession,
  restorePlatformAdminSession,
  loginPlatformAdmin,
} from "@/features/platform-admin/auth";
import {
  PLATFORM_ADMIN_SESSION_CLEARED_EVENT,
  PLATFORM_ADMIN_SESSION_REPLACED_EVENT,
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
  const operation = useRef(0);

  const restoreSession = useCallback(async () => {
    const id = ++operation.current;
    const current = await restorePlatformAdminSession(() => operation.current === id);
    if (operation.current === id) setAdmin(current);
    return current;
  }, []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      await restoreSession();
      if (active) setIsLoading(false);
    };
    const clearSession = () => {
      if (active) {
        operation.current++;
        setAdmin(null);
        setIsLoading(false);
      }
    };
    const replaceSession = () => {
      if (!active) return;
      operation.current++;
      setAdmin(platformAdminStorage.getAccessToken() ? platformAdminStorage.getAdmin() : null);
      setIsLoading(false);
    };
    const syncFromStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === PLATFORM_ADMIN_STORAGE_KEYS.version ||
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
    window.addEventListener(PLATFORM_ADMIN_SESSION_REPLACED_EVENT, replaceSession);
    void initialize();

    return () => {
      active = false;
      operation.current++;
      window.removeEventListener(
        PLATFORM_ADMIN_SESSION_CLEARED_EVENT,
        clearSession,
      );
      window.removeEventListener("storage", syncFromStorage);
      window.removeEventListener(PLATFORM_ADMIN_SESSION_REPLACED_EVENT, replaceSession);
    };
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string) => {
    operation.current++;
    const session = await loginPlatformAdmin(email, password);
    const authenticatedAdmin = establishPlatformAdminSession(session);
    setAdmin(authenticatedAdmin);
    setIsLoading(false);
    return authenticatedAdmin;
  }, []);

  const logout = useCallback(async () => {
    operation.current++;
    try {
      await endPlatformAdminSession();
    } finally {
      if (platformAdminStorage.getAccessToken()) return;
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

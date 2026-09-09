"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithPassword, loginWithPin, logoutRequest, updateLanguage } from "@/features/auth";
import {
  AUTH_SESSION_CLEARED_EVENT,
  AUTH_SESSION_REPLACED_EVENT,
  AUTH_STORAGE_KEYS,
  redirectPathForRoles,
  tokenStorage,
  type SessionUser,
} from "@/lib/auth/session";
import { ApiError } from "@/lib/api/client";

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginPassword: (email: string, password: string) => Promise<void>;
  loginPin: (pin: string, identifier: { email?: string; userId?: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUserLanguage: (language: "en" | "ur") => Promise<void>;
  replaceSession: (
    sessionUser: SessionUser,
    tokens: { accessToken: string; refreshToken?: string; expiresIn: string },
  ) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const clearSession = () => {
      setUser(null);
      setIsLoading(false);
    };

    const syncSessionFromStorage = () => {
      const storedUser = tokenStorage.getUser();
      const storedTokens = tokenStorage.get();

      const context = tokenStorage.getAccessContext();
      if (storedUser && storedTokens?.accessToken &&
        context?.userId === storedUser.id && context.branchId === storedUser.branchId) {
        setUser(storedUser);
        return;
      }

      // Reading another tab's session must never mutate shared storage.
      setUser(null);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== window.localStorage) return;
      // replaceSession/clear publish version last. Earlier per-field events
      // can arrive while another tab is still writing the session.
      if (event.key === null || event.key === AUTH_STORAGE_KEYS.version) {
        syncSessionFromStorage();
      } else if (event.key === AUTH_STORAGE_KEYS.user) {
        // Language/profile updates do not replace the session version.
        const storedUser = tokenStorage.getUser();
        const context = tokenStorage.getAccessContext();
        if (storedUser && context?.userId === storedUser.id &&
          context.branchId === storedUser.branchId) setUser(storedUser);
      }
    };

    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, clearSession);
    window.addEventListener(AUTH_SESSION_REPLACED_EVENT, syncSessionFromStorage);
    window.addEventListener("storage", onStorage);

    // A user record without an access token is not an authenticated session.
    syncSessionFromStorage();
    setIsLoading(false);

    return () => {
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, clearSession);
      window.removeEventListener(AUTH_SESSION_REPLACED_EVENT, syncSessionFromStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, [router]);

  const applySession = useCallback(
    (sessionUser: SessionUser, tokens: { accessToken: string; refreshToken?: string; expiresIn: string }) => {
      tokenStorage.replaceSession(tokens, sessionUser);
      setUser(sessionUser);
    },
    [],
  );

  const updateUserLanguage = useCallback(
    async (language: "en" | "ur") => {
      if (!user) return;
      const updated = await updateLanguage(language);
      const nextUser = { ...user, language: updated.language };
      tokenStorage.setUser(nextUser);
      setUser(nextUser);
    },
    [user],
  );

  const loginPassword = useCallback(
    async (email: string, password: string) => {
      const { user: sessionUser, ...tokens } = await loginWithPassword(email, password);
      applySession(sessionUser, tokens);
      router.push(redirectPathForRoles(sessionUser.roles));
    },
    [applySession, router],
  );

  const loginPin = useCallback(
    async (pin: string, identifier: { email?: string; userId?: string }) => {
      const { user: sessionUser, ...tokens } = await loginWithPin(pin, identifier);
      applySession(sessionUser, tokens);
      router.push(redirectPathForRoles(sessionUser.roles));
    },
    [applySession, router],
  );

  const logout = useCallback(async () => {
    const version = tokenStorage.getSessionVersion();
    try {
      await logoutRequest();
    } catch {
      // Best-effort — clear local session regardless of server response.
    } finally {
      if (tokenStorage.getSessionVersion() !== version && tokenStorage.get()?.accessToken) return;
      tokenStorage.clear();
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !isLoading && user !== null,
      loginPassword,
      loginPin,
      logout,
      updateUserLanguage,
      replaceSession: applySession,
    }),
    [user, isLoading, loginPassword, loginPin, logout, updateUserLanguage, applySession],
  );

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-slate-400">
        <span>Loading session...</span>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export { ApiError };

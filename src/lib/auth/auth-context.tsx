"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithPassword, loginWithPin, logoutRequest, updateLanguage } from "@/features/auth";
import {
  AUTH_SESSION_CLEARED_EVENT,
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
      router.replace("/login");
    };

    const syncSessionFromStorage = () => {
      const storedUser = tokenStorage.getUser();
      const storedTokens = tokenStorage.get();

      if (storedUser && storedTokens?.accessToken) {
        setUser(storedUser);
        return;
      }

      if (storedUser || storedTokens) {
        tokenStorage.clear();
      } else {
        setUser(null);
      }
    };

    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, clearSession);
    window.addEventListener("storage", syncSessionFromStorage);

    // A user record without an access token is not an authenticated session.
    syncSessionFromStorage();
    setIsLoading(false);

    return () => {
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, clearSession);
      window.removeEventListener("storage", syncSessionFromStorage);
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
    try {
      await logoutRequest();
    } catch {
      // Best-effort — clear local session regardless of server response.
    } finally {
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

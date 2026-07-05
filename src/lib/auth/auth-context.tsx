"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loginWithPassword, loginWithPin, logoutRequest } from "@/features/auth";
import { redirectPathForRoles, tokenStorage, type SessionUser } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/client";

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  loginPassword: (email: string, password: string) => Promise<void>;
  loginPin: (pin: string, identifier: { email?: string; userId?: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Rehydrate from localStorage on first mount (page refresh, new tab).
    setUser(tokenStorage.getUser());
    setIsLoading(false);
  }, []);

  const applySession = useCallback(
    (sessionUser: SessionUser, tokens: { accessToken: string; refreshToken: string; expiresIn: string }) => {
      tokenStorage.set(tokens);
      tokenStorage.setUser(sessionUser);
      setUser(sessionUser);
    },
    [],
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
    const tokens = tokenStorage.get();
    try {
      if (tokens?.refreshToken) {
        await logoutRequest(tokens.refreshToken);
      }
    } catch {
      // Best-effort — clear local session regardless of server response.
    } finally {
      tokenStorage.clear();
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  const value = useMemo(
    () => ({ user, isLoading, loginPassword, loginPin, logout }),
    [user, isLoading, loginPassword, loginPin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export { ApiError };

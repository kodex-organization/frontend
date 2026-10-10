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
  loginWithPassword,
  loginWithPin,
  logoutRequest,
  updateLanguage,
} from "@/features/auth";
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

  const syncSessionFromStorage = useCallback(() => {
    try {
      const storedTokens = tokenStorage.get();
      const storedUser = tokenStorage.getUser();

      if (!storedTokens?.accessToken || !storedUser) {
        setUser(null);
        return;
      }

      const context = tokenStorage.getAccessContext();

      // Resolve user ID across all standard naming conventions
      const storedUserId =
        storedUser.id ||
        (storedUser as any).userId ||
        (storedUser as any)._id ||
        (storedUser as any).sub;

      // Verify token user identity against stored profile ONLY if BOTH are present
      if (context) {
        const tokenUserId =
          (context as Record<string, unknown>).userId ??
          (context as Record<string, unknown>).sub ??
          (context as Record<string, unknown>).id;

        if (
          tokenUserId &&
          storedUserId &&
          String(tokenUserId).trim() !== String(storedUserId).trim()
        ) {
          console.warn("[Auth] Token userId mismatch with stored profile:", {
            tokenUserId,
            storedUserId,
          });
          tokenStorage.clear();
          setUser(null);
          return;
        }
      }

      // Normalize user object: ensure .id and uppercase .roles exist
      const rawRoles = Array.isArray(storedUser.roles)
        ? storedUser.roles
        : typeof (storedUser as any).role === "string"
        ? [(storedUser as any).role]
        : [];

      const normalizedUser: SessionUser = {
        ...storedUser,
        id: String(storedUserId || ""),
        roles: rawRoles.map((r: any) =>
          typeof r === "string"
            ? (r.toUpperCase() as any)
            : (r?.role || r?.name || "").toUpperCase()
        ),
      };

      // Session is valid; persist normalized user profile to state
      setUser(normalizedUser);
    } catch (err) {
      console.error("[Auth] Session restoration error:", err);
      // Do not clear storage on non-fatal parsing errors
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const clearSession = () => {
      setUser(null);
      setIsLoading(false);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.storageArea && event.storageArea !== window.localStorage) return;

      if (event.key === null || event.key === AUTH_STORAGE_KEYS.version) {
        syncSessionFromStorage();
      } else if (event.key === AUTH_STORAGE_KEYS.user) {
        try {
          const storedUser = tokenStorage.getUser();
          const storedTokens = tokenStorage.get();
          if (storedUser && storedTokens?.accessToken) {
            setUser(storedUser);
          }
        } catch {
          // Ignore transient parsing errors during multi-tab write
        }
      }
    };

    window.addEventListener(AUTH_SESSION_CLEARED_EVENT, clearSession);
    window.addEventListener(AUTH_SESSION_REPLACED_EVENT, syncSessionFromStorage);
    window.addEventListener("storage", onStorage);

    // Initial session hydration
    syncSessionFromStorage();
    setIsLoading(false);

    return () => {
      window.removeEventListener(AUTH_SESSION_CLEARED_EVENT, clearSession);
      window.removeEventListener(AUTH_SESSION_REPLACED_EVENT, syncSessionFromStorage);
      window.removeEventListener("storage", onStorage);
    };
  }, [syncSessionFromStorage]);

  const applySession = useCallback(
    (
      sessionUser: SessionUser,
      tokens: { accessToken: string; refreshToken?: string; expiresIn: string },
    ) => {
      tokenStorage.replaceSession(tokens, sessionUser);
      setUser(sessionUser);
    },
    [],
  );

  const updateUserLanguage = useCallback(
    async (language: "en" | "ur") => {
      if (!user) return;
      try {
        const updated = await updateLanguage(language);
        const nextUser = { ...user, language: updated.language };
        tokenStorage.setUser(nextUser);
        setUser(nextUser);
      } catch (err) {
        console.error("[Auth] Language update failed:", err);
        throw err;
      }
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
      if (tokenStorage.getSessionVersion() !== version && tokenStorage.get()?.accessToken) {
        return;
      }
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
    [
      user,
      isLoading,
      loginPassword,
      loginPin,
      logout,
      updateUserLanguage,
      applySession,
    ],
  );

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
          <span className="text-xs uppercase tracking-wider">Loading session...</span>
        </div>
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
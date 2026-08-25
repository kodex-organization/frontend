"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  activeImpersonationFromStart,
  assertImpersonationScope,
  endAndClearImpersonation,
  startImpersonationRequest,
  switchImpersonationBranchRequest,
  type ImpersonationConsent,
  type StartImpersonationInput,
} from "@/features/platform-admin/impersonation";
import { ApiError } from "@/lib/api/client";
import { usePlatformAdminAuth } from "./auth-context";
import {
  IMPERSONATION_CHANGED_EVENT,
  IMPERSONATION_CLEARED_EVENT,
  IMPERSONATION_STORAGE_KEY,
  impersonationStorage,
  type ActiveImpersonation,
} from "./impersonation-session";

interface ImpersonationContextValue {
  active: ActiveImpersonation | null;
  isActive: boolean;
  start: (
    input: StartImpersonationInput,
    consent: ImpersonationConsent,
  ) => Promise<ActiveImpersonation>;
  end: (reason: string) => Promise<void>;
  switchBranch: (
    branchId: string,
    reason?: string,
    branchName?: string,
  ) => Promise<ActiveImpersonation>;
}

const ImpersonationContext = createContext<ImpersonationContextValue | null>(
  null,
);

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const { admin, isLoading: platformLoading } = usePlatformAdminAuth();
  const [active, setActive] = useState<ActiveImpersonation | null>(null);

  const restore = useCallback(() => {
    const stored = impersonationStorage.get();
    if (stored && admin && stored.session.superAdminId !== admin.id) {
      impersonationStorage.clear();
      setActive(null);
      return;
    }
    setActive(stored);
  }, [admin]);

  useEffect(() => {
    restore();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === IMPERSONATION_STORAGE_KEY) restore();
    };
    window.addEventListener(IMPERSONATION_CHANGED_EVENT, restore);
    window.addEventListener(IMPERSONATION_CLEARED_EVENT, restore);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(IMPERSONATION_CHANGED_EVENT, restore);
      window.removeEventListener(IMPERSONATION_CLEARED_EVENT, restore);
      window.removeEventListener("storage", handleStorage);
    };
  }, [restore]);

  useEffect(() => {
    if (!platformLoading && !admin) {
      impersonationStorage.clear();
      setActive(null);
    }
  }, [admin, platformLoading]);

  useEffect(() => {
    if (!active) return;
    const remaining = new Date(active.session.expiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      impersonationStorage.clear();
      setActive(null);
      return;
    }
    const timer = window.setTimeout(() => {
      impersonationStorage.clear();
      setActive(null);
    }, Math.min(remaining, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [active]);

  const start = useCallback(
    async (input: StartImpersonationInput, consent: ImpersonationConsent) => {
      if (active) {
        throw new ApiError(
          "End the current impersonation before starting another.",
          409,
          "IMPERSONATION_ALREADY_ACTIVE",
        );
      }
      const response = await startImpersonationRequest(input);
      const next = activeImpersonationFromStart(response, consent);
      impersonationStorage.set(next);
      setActive(next);
      return next;
    },
    [active],
  );

  const end = useCallback(async (reason: string) => {
    try {
      await endAndClearImpersonation(reason);
    } finally {
      setActive(null);
    }
  }, []);

  const switchBranch = useCallback(
    async (branchId: string, reason?: string, branchName?: string) => {
      if (!active) {
        throw new ApiError("No active impersonation session.", 401);
      }
      assertImpersonationScope(active, "branch_switch");
      try {
        const response = await switchImpersonationBranchRequest(branchId, reason);
        const next: ActiveImpersonation = {
          ...active,
          impersonationToken: response.impersonationToken,
          session: {
            ...active.session,
            branchId: response.branchId,
            branchNameSnapshot: branchName || response.branchId,
            expiresAt: response.expiresAt,
          },
        };
        impersonationStorage.set(next);
        setActive(next);
        return next;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          impersonationStorage.clear();
          setActive(null);
        }
        throw error;
      }
    },
    [active],
  );

  const value = useMemo(
    () => ({ active, isActive: active !== null, start, end, switchBranch }),
    [active, end, start, switchBranch],
  );

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (!context) {
    throw new Error("useImpersonation must be used within ImpersonationProvider");
  }
  return context;
}

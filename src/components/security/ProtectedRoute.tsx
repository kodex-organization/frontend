"use client";

import { ReactNode, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { redirectPathForRoles, type UserRole } from "@/lib/auth/session";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useAuth();

  // Normalize user roles to uppercase strings
  const userRoles = useMemo(() => {
    const rawRoles = Array.isArray(user?.roles) ? user.roles : [];
    return rawRoles.map((r: any) =>
      typeof r === "string"
        ? r.toUpperCase()
        : String(r?.role || r?.name || "").toUpperCase()
    );
  }, [user?.roles]);

  // Normalize allowed roles to uppercase strings
  const normalizedAllowedRoles = useMemo(() => {
    return (allowedRoles || []).map((r) => String(r).toUpperCase());
  }, [allowedRoles]);

  const hasPermission =
    isAuthenticated &&
    Boolean(user) &&
    userRoles.some((role) => normalizedAllowedRoles.includes(role));

  useEffect(() => {
    // Never trigger redirects while storage hydration is in flight
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }

    if (!hasPermission) {
      const targetPath = redirectPathForRoles(user.roles);

      // Only redirect if target path is different from current page to prevent loops
      if (targetPath && targetPath !== pathname) {
        router.replace(targetPath);
      }
    }
  }, [user, isLoading, isAuthenticated, hasPermission, pathname, router]);

  // Loading barrier: prevents hydration flash and premature redirects on F5
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-slate-400 font-medium text-sm">
        Verifying session...
      </div>
    );
  }

  // Prevent rendering protected components while transition/redirect is active
  if (!isAuthenticated || !user || !hasPermission) {
    return null;
  }

  return <>{children}</>;
}
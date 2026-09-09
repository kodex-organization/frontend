"use client";

import { ReactNode, useEffect } from "react";
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

  // Safely guard roles array against undefined or non-array payloads
  const userRoles: UserRole[] = Array.isArray(user?.roles) ? user.roles : [];

  const hasPermission =
    isAuthenticated &&
    !!user &&
    userRoles.some((role) => allowedRoles.includes(role));

  useEffect(() => {
    // Never trigger redirects while storage hydration is in flight
    if (isLoading) return;

    // 1. Unauthenticated -> redirect to login
    if (!isAuthenticated || !user) {
      router.replace("/login");
      return;
    }

    // 2. Insufficient role permissions -> redirect to role home
    if (!hasPermission) {
      const targetPath = redirectPathForRoles(userRoles);

      // Prevent infinite redirect loops if target is current path or empty
      if (targetPath && targetPath !== pathname) {
        router.replace(targetPath);
      } else if (!targetPath || targetPath === pathname) {
        router.replace("/login");
      }
    }
  }, [user, isLoading, isAuthenticated, hasPermission, userRoles, pathname, router]);

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
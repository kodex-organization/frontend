"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

import { redirectPathForRoles, UserRole } from "@/lib/auth/session";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const router = useRouter();

  const { user, isLoading } = useAuth();

   const hasPermission = !!user && user.roles.some((role) => allowedRoles.includes(role));

  useEffect(() => {
    if (isLoading) return;

    // User is not logged in
    if (!user) {
      router.replace("/login");
      return;
    }

    // User doesn't have required role
    
    if (!hasPermission) {
      router.replace(redirectPathForRoles(user.roles));
    }
  }, [user, isLoading, hasPermission, router]);

  // Wait until auth state is loaded

  if (isLoading) {
    return null;
  }


 // Prevent rendering while redirecting
  if (!user || !hasPermission) {
    return null;
  }

  return <>{children}</>;
}
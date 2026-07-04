"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: string[];
}

export default function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const router = useRouter();

  /**
   * TODO:
   * Replace these values with actual authentication data
   * after Developer 1 completes the JWT login flow.
   */
  const isAuthenticated = true;
  const userRole = "OWNER";

  useEffect(() => {
    // User is not logged in
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    // User doesn't have permission
    if (!allowedRoles.includes(userRole)) {
      router.replace("/unauthorized");
    }
  }, [isAuthenticated, userRole, allowedRoles, router]);

  if (!isAuthenticated || !allowedRoles.includes(userRole)) {
    return null;
  }

  return <>{children}</>;
}



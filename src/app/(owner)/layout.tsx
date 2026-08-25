"use client";

import { OwnerShell } from "@/components/layout/owner-shell";
import ProtectedRoute from "@/components/security/ProtectedRoute";
import type { UserRole } from "@/lib/auth/session";
import { usePathname } from "next/navigation";
import { NotificationProvider } from "@/features/notifications/context";

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isBillingRoute =
    pathname === "/billing" || pathname.startsWith("/billing/");
  const isSyncStatusRoute = pathname === "/sync-status";
  const isOwnerOnlyRoute =
    pathname === "/reports" ||
    pathname.startsWith("/reports/") ||
    pathname === "/settings/branches" ||
    pathname === "/settings/peak-hours" ||
    pathname === "/settings/support-access" ||
    pathname === "/settings/data-export";
  const isBranchManagementRoute =
    pathname === "/branches" || pathname.startsWith("/branches/");
  const isCustomersRoute =
    pathname === "/customers" || pathname.startsWith("/customers/");
  const isOperationalRoute =
    pathname === "/governance" ||
    pathname === "/floor-view" ||
    pathname === "/sessions" ||
    pathname.startsWith("/sessions/");
  const allowedRoles: UserRole[] =
    isOwnerOnlyRoute
      ? ["OWNER"]
      : isBranchManagementRoute
      ? ["OWNER", "MANAGER"]
      : isBillingRoute || isSyncStatusRoute
      ? ["OWNER", "MANAGER", "ACCOUNTANT", "CASHIER"]
      : isCustomersRoute
      ? ["OWNER", "MANAGER", "CASHIER"]
      : isOperationalRoute
      ? ["OWNER", "MANAGER", "CASHIER"]
      : ["OWNER", "MANAGER", "ACCOUNTANT"];

  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <NotificationProvider><OwnerShell>{children}</OwnerShell></NotificationProvider>
    </ProtectedRoute>
  );
}

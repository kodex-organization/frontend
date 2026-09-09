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

  // Strict Owner-only administrative operations & system reports
  const isOwnerOnlyRoute =
    pathname === "/reports" ||
    pathname.startsWith("/reports/") ||
    pathname === "/settings/branches" ||
    pathname === "/settings/peak-hours" ||
    pathname === "/settings/support-access" ||
    pathname === "/settings/data-export";

  // Branch management configuration (Owner and Branch Managers)
  const isBranchManagementRoute =
    pathname === "/branches" || pathname.startsWith("/branches/");

  // Resolve allowed roles:
  // All core operational routes (Dashboard, Sessions, Floor View, Billing, Customers, Udhaar, Sync)
  // are accessible to Cashiers, Accountants, Managers, and Owners.
  const allowedRoles: UserRole[] = isOwnerOnlyRoute
    ? ["OWNER"]
    : isBranchManagementRoute
    ? ["OWNER", "MANAGER"]
    : ["OWNER", "MANAGER", "CASHIER", "ACCOUNTANT"];

  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <NotificationProvider>
        <OwnerShell>{children}</OwnerShell>
      </NotificationProvider>
    </ProtectedRoute>
  );
}
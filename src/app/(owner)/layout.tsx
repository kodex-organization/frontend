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
    pathname === "/settings/security" ||
    pathname === "/settings/support-access" ||
    pathname === "/settings/data-export";

  // Owner and Manager routes (Dashboard, Staff management, Branch controls)
  const isOwnerOrManagerRoute =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/settings/staff" ||
    pathname.startsWith("/settings/staff/") ||
    pathname === "/branches" ||
    pathname.startsWith("/branches/");

  // Resolve allowed roles:
  // Operational routes accessible to Cashiers and Accountants: Sessions, Floor View, Billing, Customers, Udhaar, Sync, Reporting, Audit
  const allowedRoles: UserRole[] = isOwnerOnlyRoute
    ? ["OWNER"]
    : isOwnerOrManagerRoute
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
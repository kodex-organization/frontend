"use client";

import ProtectedRoute from "@/components/security/ProtectedRoute";
import { QuickAccessWorkspace } from "@/features/quick-access";

export default function QuickAccessPage() {
  return (
    <ProtectedRoute allowedRoles={["OWNER", "MANAGER", "ACCOUNTANT", "CASHIER"]}>
      <QuickAccessWorkspace />
    </ProtectedRoute>
  );
}


"use client";

import ProtectedRoute from "@/components/security/ProtectedRoute";
import { DashboardView } from "@/features/dashboard";

export default function DashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["OWNER", "MANAGER"]}>
      <DashboardView />
    </ProtectedRoute>
  );
}


"use client";

import ProtectedRoute from "@/components/security/ProtectedRoute";
import { CrossBranchReportsScreen } from "@/features/reporting/components/cross-branch-reports-screen";
import { OWNER_ONLY_ROLES } from "@/features/tenancy/owner-access";

export default function ReportsPage() {
  return (
    <ProtectedRoute allowedRoles={OWNER_ONLY_ROLES}>
      <CrossBranchReportsScreen />
    </ProtectedRoute>
  );
}

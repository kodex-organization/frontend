"use client";

import ProtectedRoute from "@/components/security/ProtectedRoute";
import { BranchManagementScreen } from "@/features/tenancy/components/branch-management-screen";
import { OWNER_ONLY_ROLES } from "@/features/tenancy/owner-access";

export default function BranchSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={OWNER_ONLY_ROLES}>
      <BranchManagementScreen />
    </ProtectedRoute>
  );
}

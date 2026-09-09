"use client";

import ProtectedRoute from "@/components/security/ProtectedRoute";
import { StaffManager } from "@/features/auth/components/StaffManager";

export default function StaffSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["OWNER", "MANAGER"]}>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <StaffManager />
      </div>
    </ProtectedRoute>
  );
}
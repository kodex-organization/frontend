"use client";

import ProtectedRoute from "@/components/security/ProtectedRoute";
import { PeakHourSettingsScreen } from "@/features/tenancy/components/peak-hour-settings-screen";
import { OWNER_ONLY_ROLES } from "@/features/tenancy/owner-access";

export default function PeakHourSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={OWNER_ONLY_ROLES}>
      <PeakHourSettingsScreen />
    </ProtectedRoute>
  );
}

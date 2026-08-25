"use client";

import ProtectedRoute from "@/components/security/ProtectedRoute";
import ReportingWorkspace from "@/features/reporting/components/ReportingWorkspace";

export default function ReportingPage() {
  return (
    <ProtectedRoute allowedRoles={["OWNER", "MANAGER", "ACCOUNTANT"]}>
      <ReportingWorkspace />
    </ProtectedRoute>
  );
}

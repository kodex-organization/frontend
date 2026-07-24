import { OwnerShell } from "@/components/layout/owner-shell";
import ProtectedRoute from "@/components/security/ProtectedRoute";

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute allowedRoles={["OWNER", "MANAGER", "ACCOUNTANT"]}>
      <OwnerShell>{children}</OwnerShell>
    </ProtectedRoute>
  );
}

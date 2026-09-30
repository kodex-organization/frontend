import ProtectedRoute from "@/components/security/ProtectedRoute";
import BillingWorkspace from "@/features/invoice/components/BillingWorkspace";

export default function BillingPage() {
  return (
    <ProtectedRoute allowedRoles={["OWNER", "MANAGER", "CASHIER"]}>
      <BillingWorkspace />
    </ProtectedRoute>
  );
}
import ProtectedRoute from "@/components/security/ProtectedRoute";
import DeviceTable from "@/features/security/components/DeviceTable";
import LoginHistory from "@/features/security/components/LoginHistory";

export default function SecurityPage() {
  return (
    <ProtectedRoute allowedRoles={["OWNER"]}>
      <div className="p-8">

         <h1 className="text-2xl font-semibold text-slate-900">Security & Devices</h1>
          <p className="mt-2 mb-12 text-slate-600">
            Manage active devices and review login history.
          </p>
       
         <h2 className="mb-8 text-2xl font-semibold text-left text-slate-900  border-b-2 border-gray-200 pb-2 ">
          Active Devices
        </h2>


        <DeviceTable />

        <LoginHistory />
      </div>
    </ProtectedRoute>
  );
}
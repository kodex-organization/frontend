"use client";

import ProtectedRoute from "@/components/security/ProtectedRoute";
import { AddStaffForm } from "@/features/auth/components/AddStaffForm";

export default function StaffSettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["OWNER", "MANAGER"]}>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Staff</h1>
        <p className="mt-2 text-slate-600">
          Add Owner, Manager, or Cashier accounts. Staff never self-register —
          only an Owner or Manager can create an account here.
        </p>
        <div className="mt-6">
          <AddStaffForm />
        </div>
      </div>
    </ProtectedRoute>
  );
}
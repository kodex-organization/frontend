"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  KeyRound,
  Lock,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AddStaffForm } from "./AddStaffForm";
import {
  deactivateStaff,
  listStaff,
  resetStaffPassword,
  resetStaffPin,
  updateStaff,
  type DetailedStaffMember,
  type UpdateStaffInput,
} from "../index";
import { useAuth } from "@/lib/auth/auth-context";
import { fetchBranches } from "@/lib/api/branch";
import type { BranchItem } from "@/types/branch";
import { toast } from "@/lib/toast";

export function StaffManager() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<DetailedStaffMember[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("all");
  const branchFilter = user?.branchId ?? "";

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<DetailedStaffMember | null>(null);
  const [editForm, setEditForm] = useState<{
    fullName: string;
    phone: string;
    role: "OWNER" | "MANAGER" | "ACCOUNTANT" | "CASHIER";
    branchId: string;
    isActive: boolean;
  }>({
    fullName: "",
    phone: "",
    role: "CASHIER",
    branchId: "",
    isActive: true,
  });

  const [passwordResetStaff, setPasswordResetStaff] = useState<DetailedStaffMember | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [pinResetStaff, setPinResetStaff] = useState<DetailedStaffMember | null>(null);
  const [newPin, setNewPin] = useState("");

  const [staffToDeactivate, setStaffToDeactivate] = useState<DetailedStaffMember | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwner = user?.roles.includes("OWNER");

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [staffData, branchData] = await Promise.all([
        listStaff({
          search: search || undefined,
          role: roleFilter !== "ALL" ? roleFilter : undefined,
          branchId: branchFilter || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
        }),
        fetchBranches({ limit: 100 }),
      ]);
      setStaff(staffData);
      setBranches(branchData.branches);
    } catch (err: any) {
      toast.error(err.message || "Failed to load staff list");
    } finally {
      setIsLoading(false);
    }
  }, [search, roleFilter, branchFilter, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenEdit = (member: DetailedStaffMember) => {
    setEditingStaff(member);
    setEditForm({
      fullName: member.fullName || "",
      phone: member.phone || "",
      role: (member.roles[0] as any) || (member.isOwner ? "OWNER" : "CASHIER"),
      branchId: member.branchId || "",
      isActive: member.isActive,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      setIsSubmitting(true);
      await updateStaff(editingStaff.id, {
        fullName: editForm.fullName,
        phone: editForm.phone || null,
        role: editForm.role,
        branchId: editForm.branchId || null,
        isActive: editForm.isActive,
      });
      toast.success(`Updated ${editForm.fullName || "staff member"} successfully.`);
      setEditingStaff(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update staff member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetStaff) return;
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    try {
      setIsSubmitting(true);
      await resetStaffPassword(passwordResetStaff.id, newPassword);
      toast.success(`Password reset for ${passwordResetStaff.fullName || passwordResetStaff.email}.`);
      setPasswordResetStaff(null);
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinResetStaff) return;
    if (!/^\d{4,6}$/.test(newPin)) {
      toast.error("PIN must be 4 to 6 digits");
      return;
    }
    try {
      setIsSubmitting(true);
      await resetStaffPin(pinResetStaff.id, newPin);
      toast.success(`PIN reset for ${pinResetStaff.fullName || pinResetStaff.email}.`);
      setPinResetStaff(null);
      setNewPin("");
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset PIN");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!staffToDeactivate) return;
    try {
      setIsSubmitting(true);
      await deactivateStaff(staffToDeactivate.id);
      toast.success(`Deactivated ${staffToDeactivate.fullName || staffToDeactivate.email}.`);
      setStaffToDeactivate(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to deactivate staff member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadge = (roles: string[], isOwnerMember: boolean) => {
    const primary = isOwnerMember ? "OWNER" : roles[0] || "CASHIER";
    switch (primary) {
      case "OWNER":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">Owner</span>;
      case "MANAGER":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">Manager</span>;
      case "ACCOUNTANT":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Accountant</span>;
      case "CASHIER":
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Cashier</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Staff & Access Control
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage your managers, accountants, and cashiers, assign branches, and govern access PINs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={loadData}
            variant="secondary"
            className="w-auto px-3 py-2 text-xs"
            title="Refresh Staff List"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setShowAddModal(true)}
            className="w-auto px-4 py-2 gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 text-white"
          >
            <Plus className="h-4 w-4" /> Add Staff Member
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          <option value="ALL">All Roles</option>
          <option value="OWNER">Owner</option>
          <option value="MANAGER">Manager</option>
          <option value="ACCOUNTANT">Accountant</option>
          <option value="CASHIER">Cashier</option>
        </select>


        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500 animate-pulse">
            Loading staff directory...
          </div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Users className="h-10 w-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-900">No staff members found</h4>
            <p className="text-xs text-slate-500">
              No staff match your current search or filters. Click &quot;Add Staff Member&quot; to invite a team member.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Assigned Branch</th>
                  <th className="py-3 px-4">Quick PIN</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((member) => {
                  const isSelf = member.id === user?.id;
                  const isTargetOwner = member.isOwner || member.roles.includes("OWNER");
                  const canModify = isOwner || !isTargetOwner;

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {member.fullName || "Unnamed Staff"}
                          {isSelf && (
                            <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-slate-200 text-slate-700">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{member.email}</span>
                          {member.phone && <span>• {member.phone}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-4">{getRoleBadge(member.roles, member.isOwner)}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium">
                          {member.branchName || "Main Branch"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {member.hasPin ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <KeyRound className="h-3.5 w-3.5" /> Configured
                          </span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {member.lockedUntil && new Date(member.lockedUntil) > new Date() ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Locked Out
                          </span>
                        ) : member.isActive ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            Deactivated
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canModify && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(member)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Edit Profile & Role"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setPasswordResetStaff(member);
                                  setNewPassword("");
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Reset Password"
                              >
                                <Lock className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setPinResetStaff(member);
                                  setNewPin("");
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Reset Cashier PIN"
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                              </button>
                              {!isSelf && (
                                <button
                                  onClick={() => setStaffToDeactivate(member)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title="Deactivate Staff Member"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add New Staff Member</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  loadData();
                }}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
            <AddStaffForm
              onSuccess={() => {
                setShowAddModal(false);
                toast.success('Staff member added successfully.');
                void loadData();
              }}
            />
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Edit Staff Member</h3>
            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={editForm.role}
                  disabled={!isOwner && editForm.role === "OWNER"}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                >
                  {isOwner && <option value="OWNER">Owner</option>}
                  <option value="MANAGER">Manager</option>
                  <option value="ACCOUNTANT">Accountant</option>
                  <option value="CASHIER">Cashier</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Branch</label>
                <select
                  value={editForm.branchId}
                  onChange={(e) => setEditForm({ ...editForm, branchId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <label htmlFor="isActiveToggle" className="font-semibold text-slate-700">
                  Account is active
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="px-3.5 py-1.5 font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {passwordResetStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Reset Password</h3>
            <p className="text-xs text-slate-500">
              Set a new secure password for <strong>{passwordResetStaff.fullName || passwordResetStaff.email}</strong>.
            </p>
            <form onSubmit={handleSavePasswordReset} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordResetStaff(null)}
                  className="px-3.5 py-1.5 font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || newPassword.length < 8}
                  className="px-4 py-1.5 font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset PIN Modal */}
      {pinResetStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Reset Quick-Login PIN</h3>
            <p className="text-xs text-slate-500">
              Set a 4 to 6 digit quick shift-login PIN for <strong>{pinResetStaff.fullName || pinResetStaff.email}</strong>.
            </p>
            <form onSubmit={handleSavePinReset} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New 4-6 Digit PIN</label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="e.g. 1234"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 font-mono tracking-widest text-center text-sm"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPinResetStaff(null)}
                  className="px-3.5 py-1.5 font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !/^\d{4,6}$/.test(newPin)}
                  className="px-4 py-1.5 font-semibold rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? "Saving..." : "Save PIN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivation Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(staffToDeactivate)}
        title="Deactivate Staff Member"
        description={
          staffToDeactivate
            ? `Are you sure you want to deactivate "${staffToDeactivate.fullName || staffToDeactivate.email}"? Their active login sessions will be immediately terminated.`
            : ""
        }
        confirmText={isSubmitting ? "Deactivating..." : "Deactivate Account"}
        cancelText="Keep Active"
        variant="danger"
        onConfirm={handleConfirmDeactivate}
        onCancel={() => !isSubmitting && setStaffToDeactivate(null)}
      />
    </div>
  );
}

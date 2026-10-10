// src/app/(owner)/catalog/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { redirectPathForRoles } from "@/lib/auth/session";
import { toast } from "@/lib/toast";
import {
  SnookerTable,
  CreateTableInput,
  RatePlan,
} from "@/features/catalog/types/catalog.types";
import {
  getTables,
  createTable,
  updateTable,
  deleteTable,
  getRateHistory,
  createRatePlan,
} from "@/services/catalog.service";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { fetchBranches } from "@/lib/api/branch";
import type { BranchItem } from "@/types/branch";
import { formatCurrency } from "@/features/invoice/utils/formatCurrency";
import { isNetworkFailure, loadWithOfflineSnapshot } from "@/lib/sync/offline-reference-cache";
import { OfflineSnapshotNotice } from "@/components/sync/offline-snapshot-notice";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The request failed";
}

export default function CatalogPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // ── role protection guard ────────────────────
  const isAuthorized = useMemo(() => {
    if (!user) return false;
    const roles = (user.roles || []).map((r) => String(r).toUpperCase());
    return roles.includes("OWNER") || roles.includes("MANAGER");
  }, [user]);

  useEffect(() => {
    if (!authLoading && user && !isAuthorized) {
      const targetPath = redirectPathForRoles(user.roles) || "/canteen";
      router.replace(targetPath);
    }
  }, [authLoading, user, isAuthorized, router]);

  // ── table state ──────────────────────────────
  const [tables, setTables] = useState<SnookerTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);

  // ── add/edit form state ──────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState<SnookerTable | null>(null);
  const [tableNumber, setTableNumber] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [tableStatus, setTableStatus] = useState("available");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SnookerTable | null>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const selectedCurrency =
    branches.find((branch) => branch.id === selectedBranchId)?.currency ||
    branches.find((branch) => branch.id === user?.branchId)?.currency ||
    "PKR";

  // ── rate modal state ─────────────────────────
  const [rateTable, setRateTable] = useState<SnookerTable | null>(null);
  const [rates, setRates] = useState<RatePlan[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [newRateType, setNewRateType] = useState("standard");
  const [newRateValue, setNewRateValue] = useState("");
  const [rateSaving, setRateSaving] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  // ── fetch branches and tables (only if authorized) ─
  useEffect(() => {
    if (!isAuthorized) return;
    void loadWithOfflineSnapshot("catalog:branches", () => fetchBranches({ limit: 100 }))
      .then(({ data }) => setBranches(data.branches))
      .catch(() => {
        // Offline and never loaded: fall back to branch ID
      });
  }, [isAuthorized]);

  useEffect(() => {
    if (!isAuthorized) return;
    void fetchTables(user?.branchId);
  }, [isAuthorized, user?.branchId]);

  async function fetchTables(branchId?: string) {
    try {
      setLoading(true);
      setError(null);
      const { data, savedAt } = await loadWithOfflineSnapshot(
        `catalog:tables:${branchId ?? "all"}`,
        () => getTables(branchId),
      );
      setTables(data);
      setSnapshotAt(savedAt);
    } catch (err: unknown) {
      setError(
        isNetworkFailure(err)
          ? "You are offline and no saved table list exists on this device yet. Open this page once while online."
          : errorMessage(err),
      );
    } finally {
      setLoading(false);
    }
  }

  // ── add/edit handlers ────────────────────────
  function handleOpenAdd() {
    setEditingTable(null);
    setTableNumber("");
    setHourlyRate("");
    setTableStatus("available");
    setSelectedBranchId(user?.branchId || (branches[0]?.id ?? ""));
    setFormError(null);
    setShowForm(true);
  }

  function handleOpenEdit(table: SnookerTable) {
    setEditingTable(table);
    setTableNumber(table.tableNumber);
    setHourlyRate(String((table as any).hourlyRate ?? table.defaultHourlyRate ?? ""));
    setTableStatus(table.status);
    setSelectedBranchId(table.branchId ?? (table.branch as any)?.id ?? user?.branchId ?? "");
    setFormError(null);
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingTable(null);
    setSelectedBranchId("");
    setFormError(null);
  }

  async function handleSave() {
    setFormError(null);
    if (!tableNumber.trim()) {
      setFormError("Table number is required");
      return;
    }
    if (!hourlyRate || Number(hourlyRate) <= 0) {
      setFormError("Enter a valid hourly rate");
      return;
    }

    const targetBranchId =
      selectedBranchId ||
      editingTable?.branchId ||
      (editingTable?.branch as any)?.id ||
      user?.branchId ||
      "";

    if (!targetBranchId) {
      setFormError("Branch is required");
      return;
    }

    const input: CreateTableInput = {
      tableNumber: tableNumber.trim(),
      hourlyRate: Number(hourlyRate),
      branchId: targetBranchId,
      ...(editingTable && { status: tableStatus }),
    };

    try {
      setSaving(true);
      if (editingTable) {
        const updated = await updateTable(editingTable.id, input);

        const branchObj =
          (updated as any).branch ??
          branches.find((b) => b.id === targetBranchId) ??
          editingTable.branch;

        const merged: SnookerTable = {
          ...editingTable,
          ...updated,
          defaultHourlyRate: Number(hourlyRate),
          branchId: targetBranchId,
          branch: branchObj,
        };

        setTables((prev) =>
          prev.map((t) => (t.id === editingTable.id ? merged : t))
        );
        toast.success(`Table #${tableNumber} updated successfully.`);
      } else {
        const newTable = await createTable(input);
        const branchObj =
          (newTable as any).branch ??
          branches.find((b) => b.id === targetBranchId);

        const merged: SnookerTable = {
          ...newTable,
          defaultHourlyRate: Number(hourlyRate),
          branchId: targetBranchId,
          branch: branchObj,
        };

        setTables((prev) => [...prev, merged]);
        toast.success(`Table #${tableNumber} created successfully.`);
      }
      handleCloseForm();
    } catch (err: unknown) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // ── delete handlers with occupied guard ──────
  async function handleDelete(id: string) {
    const target = tables.find((table) => table.id === id);
    if (!target) return;

    if (target.status === "occupied") {
      toast.error(
        `Table #${target.tableNumber} is currently occupied. End and settle the active session before deleting.`
      );
      return;
    }

    setDeleteTarget(target);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    if (deleteTarget.status === "occupied") {
      toast.error("Cannot delete a table while it is occupied.");
      setDeleteTarget(null);
      return;
    }

    try {
      await deleteTable(deleteTarget.id);
      setTables((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      toast.success(`Table #${deleteTarget.tableNumber} deleted.`);
      setDeleteTarget(null);
    } catch (err: unknown) {
      const msg = errorMessage(err);
      toast.error(msg);
      setError(msg);
      setDeleteTarget(null);
    }
  }

  // ── rate modal handlers ──────────────────────
  async function handleOpenRates(table: SnookerTable) {
    setRateTable(table);
    setRates([]);
    setRateError(null);
    setNewRateValue("");
    try {
      setRatesLoading(true);
      const data = await getRateHistory(table.id);
      setRates(data);
    } catch (err: unknown) {
      setRateError(errorMessage(err));
    } finally {
      setRatesLoading(false);
    }
  }

  function handleCloseRates() {
    setRateTable(null);
    setRates([]);
    setRateError(null);
  }

  async function handleAddRate() {
    setRateError(null);
    if (!rateTable) {
      setRateError("Select a table before adding a rate");
      return;
    }
    if (!newRateValue || Number(newRateValue) <= 0) {
      setRateError("Enter a valid rate value");
      return;
    }
    try {
      setRateSaving(true);
      const newRate = await createRatePlan(rateTable.id, {
        rateType: newRateType,
        hourlyRate: Number(newRateValue),
      });

      setRates((prev) => [newRate, ...prev]);

      if (newRateType === "standard") {
        setTables((prev) =>
          prev.map((t) =>
            t.id === rateTable.id
              ? {
                  ...t,
                  defaultHourlyRate: Number(newRateValue),
                  hourlyRate: Number(newRateValue),
                }
              : t
          )
        );
      }

      setNewRateValue("");
      toast.success("New rate plan applied.");
    } catch (err: unknown) {
      setRateError(errorMessage(err));
    } finally {
      setRateSaving(false);
    }
  }

  // ── status color ──────────────────────────────
  const statusColor: Record<string, string> = {
    available: "bg-green-100 text-green-700",
    occupied: "bg-red-100 text-red-700",
    maintenance: "bg-yellow-100 text-yellow-700",
    reserved: "bg-blue-100 text-blue-700",
    inactive: "bg-slate-100 text-slate-500",
  };

  if (authLoading || !isAuthorized) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-slate-400">Verifying permissions...</p>
      </div>
    );
  }

  return (
    <div>
      {/* ── page header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Tables & Rates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage snooker tables and their hourly rates.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          disabled={snapshotAt !== null}
          title={snapshotAt !== null ? "Adding a table needs an internet connection" : undefined}
          className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add Table
        </button>
      </div>

      {snapshotAt && (
        <div className="mb-4">
          <OfflineSnapshotNotice
            savedAt={snapshotAt}
            note="Adding or editing tables needs an internet connection."
          />
        </div>
      )}

      {/* ── loading ── */}
      {loading && <p className="text-sm text-slate-400">Loading tables...</p>}

      {/* ── error ── */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-4 text-sm text-red-600 mb-4">
          ⚠️ {error}
        </div>
      )}

      {/* ── empty ── */}
      {!loading && !error && tables.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 py-16">
          <p className="text-slate-400 text-sm">No tables added yet</p>
          <p className="text-slate-300 text-xs mt-1">
            Click + Add Table to get started
          </p>
        </div>
      )}

      {/* ── tables list ── */}
      {!loading && tables.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase">
                <th className="px-4 py-3 border-b">Table No.</th>
                <th className="px-4 py-3 border-b">Branch</th>
                <th className="px-4 py-3 border-b">Hourly Rate</th>
                <th className="px-4 py-3 border-b">Status</th>
                <th className="px-4 py-3 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => {
                const branchName =
                  table.branch?.name ??
                  branches.find((b) => b.id === table.branchId)?.name ??
                  "Unknown branch";
                const currency =
                  branches.find((branch) => branch.id === table.branchId)?.currency ||
                  selectedCurrency;

                const rate =
                  (table as any).hourlyRate ?? table.defaultHourlyRate ?? 0;

                const isOccupied = table.status === "occupied";

                return (
                  <tr
                    key={table.id}
                    className="border-b last:border-0 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      Table #{table.tableNumber}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {branchName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">
                      {formatCurrency(Number(rate), currency)}/hr
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          statusColor[table.status] ??
                          "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {table.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenRates(table)}
                          className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          Rates
                        </button>
                        <button
                          onClick={() => handleOpenEdit(table)}
                          className="rounded border border-blue-200 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(table.id)}
                          disabled={isOccupied}
                          title={
                            isOccupied
                              ? "Occupied table cannot be deleted while a session is running"
                              : "Delete table"
                          }
                          className={`rounded border px-3 py-1 text-xs transition-colors ${
                            isOccupied
                              ? "border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50"
                              : "border-red-200 text-red-500 hover:bg-red-50 cursor-pointer"
                          }`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── ADD / EDIT TABLE MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-semibold text-slate-800">
                {editingTable ? "Edit Table" : "Add New Table"}
              </h2>
              <button
                onClick={handleCloseForm}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-base"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-600">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Table Number
                </label>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g. 1, 2, VIP-1"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Hourly Rate ({selectedCurrency})
                </label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="e.g. 200"
                  min={1}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Branch
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(event) => setSelectedBranchId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select a branch</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name ?? "Unnamed branch"}
                    </option>
                  ))}
                </select>
              </div>

              {editingTable && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Table Status
                  </label>
                  <select
                    value={tableStatus}
                    onChange={(e) => setTableStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="reserved">Reserved</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={handleCloseForm}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm text-white hover:bg-green-800 disabled:opacity-50 cursor-pointer"
              >
                {saving
                  ? "Saving..."
                  : editingTable
                  ? "Save Changes"
                  : "Add Table"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RATE HISTORY MODAL ── */}
      {rateTable && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Rate History
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Table #{rateTable.tableNumber}
                </p>
              </div>
              <button
                onClick={handleCloseRates}
                className="text-slate-400 hover:text-slate-600 cursor-pointer text-base"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 mb-5">
              <p className="text-sm font-medium text-slate-700 mb-3">
                Set New Rate
              </p>

              {rateError && (
                <p className="text-xs text-red-500 mb-2">{rateError}</p>
              )}

              <div className="flex gap-2">
                <select
                  value={newRateType}
                  onChange={(e) => setNewRateType(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="standard">Standard</option>
                  <option value="peak">Peak</option>
                  <option value="off_peak">Off Peak</option>
                  <option value="custom">Custom</option>
                </select>

                <input
                  type="number"
                  value={newRateValue}
                  onChange={(e) => setNewRateValue(e.target.value)}
                  placeholder={`Rate in ${selectedCurrency}`}
                  min={1}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />

                <button
                  onClick={handleAddRate}
                  disabled={rateSaving}
                  className="rounded-lg bg-green-700 px-4 py-2 text-sm text-white hover:bg-green-800 disabled:opacity-50 cursor-pointer"
                >
                  {rateSaving ? "..." : "Set"}
                </button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2">
              {ratesLoading && (
                <p className="text-sm text-slate-400 text-center py-4">
                  Loading...
                </p>
              )}

              {!ratesLoading && rates.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">
                  No rate history yet
                </p>
              )}

              {rates.map((rate) => (
                <div
                  key={rate.id}
                  className="flex justify-between items-center border rounded-lg px-4 py-3 text-sm"
                >
                  <div>
                    <span className="font-medium capitalize">
                      {rate.rateType}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      From: {new Date(rate.effectiveFrom).toLocaleDateString()}
                      {rate.effectiveTo
                        ? ` → ${new Date(rate.effectiveTo).toLocaleDateString()}`
                        : " → Current"}
                    </p>
                  </div>
                  <span className="font-semibold text-green-700">
                    {formatCurrency(rate.hourlyRate, branches.find((branch) => branch.id === rateTable?.branchId)?.currency || selectedCurrency)}/hr
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        title="Delete table"
        description={
          deleteTarget
            ? `This will delete table #${deleteTarget.tableNumber}. This action is permanent.`
            : ""
        }
        confirmText="Delete table"
        cancelText="Keep table"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}